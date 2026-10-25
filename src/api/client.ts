import { config } from '../config';
import { tokenStore } from '../auth/tokenStore';
import { ApiError } from './ApiError';
import type { ErrorBody } from './types';

export { ApiError };

let onAuthFailure: () => void = () => {};
export function setOnAuthFailure(cb: () => void): void { onAuthFailure = cb; }

const NO_AUTH = new Set([
  '/auth/login', '/auth/otp/request', '/auth/otp/verify', '/auth/refresh',
  '/auth/password/forgot', '/auth/password/reset',
]);

interface RequestOpts {
  method?: string;
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  auth?: boolean;
}

function buildUrl(path: string, query?: RequestOpts['query']): string {
  const url = new URL(config.apiBaseUrl + path);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

async function rawFetch(path: string, opts: RequestOpts, accessToken: string | null): Promise<Response> {
  const headers: Record<string, string> = {};
  // Identifies this front-end to the API so it applies the web-admin session policy
  // (short access token + 1h idle refresh window) instead of the long mobile-app session.
  headers['X-Client'] = 'crm';
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  const useAuth = opts.auth !== false && !NO_AUTH.has(path);
  if (useAuth && accessToken) headers.Authorization = `Bearer ${accessToken}`;
  return fetch(buildUrl(path, opts.query), {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
}

async function parse<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T;
  let json: unknown = {};
  try {
    const text = await res.text();
    json = text ? JSON.parse(text) : {};
  } catch (e) {
    // only swallow body-already-consumed (TypeError); let SyntaxError propagate
    if (!(e instanceof TypeError)) throw e;
  }
  if (!res.ok) {
    const err = (json as { error?: ErrorBody }).error;
    throw new ApiError(res.status, err?.code ?? 'internal_error', err?.message ?? res.statusText, err?.details ?? null);
  }
  return (json as { data: T }).data;
}

// Single-flight the refresh. The backend rotates the refresh token (each /auth/refresh
// returns a new one and invalidates the sent token), so concurrent 401s must share ONE
// refresh — otherwise the losers of the race spend the already-rotated token, 401, and
// get logged out. Callers that arrive while a refresh is in flight await the same promise.
let refreshInFlight: Promise<boolean> | null = null;

// Cross-TAB single-flight. The in-flight promise above only de-dupes within one tab;
// two tabs whose access tokens expire together would each POST the shared (rotating)
// refresh token at once — the backend honours the first and 401s the second, which then
// clears localStorage and logs BOTH tabs out. Serialise refreshes across tabs on a named
// Web Lock so the losing tab waits, then reads the already-rotated token (written to
// localStorage by the winner before it released the lock) and refreshes cleanly.
// Falls back to in-tab single-flight where Web Locks are unavailable.
const REFRESH_LOCK = 'catre-auth-refresh';
function withRefreshLock(fn: () => Promise<boolean>): Promise<boolean> {
  const nav = typeof navigator !== 'undefined'
    ? (navigator as unknown as { locks?: { request(name: string, cb: () => Promise<boolean>): Promise<boolean> } })
    : undefined;
  return nav?.locks?.request ? nav.locks.request(REFRESH_LOCK, fn) : fn();
}

async function doRefresh(): Promise<boolean> {
  // Read inside the lock callback so a tab that waited picks up the token a sibling just rotated.
  const refresh = tokenStore.getRefresh();
  if (!refresh) return false;
  const res = await rawFetch('/auth/refresh', { method: 'POST', body: { refresh_token: refresh } }, null);
  if (!res.ok) return false;
  const body = (await res.json()) as { data: { access_token: string; refresh_token: string } };
  tokenStore.set(body.data);
  return true;
}

function tryRefresh(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = withRefreshLock(doRefresh).finally(() => { refreshInFlight = null; });
  }
  return refreshInFlight;
}

async function executeWithRefresh(path: string, opts: RequestOpts): Promise<Response> {
  let res = await rawFetch(path, opts, tokenStore.getAccess());
  if (res.status === 401 && !NO_AUTH.has(path)) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      res = await rawFetch(path, opts, tokenStore.getAccess());
      // If the retried request is still 401, clear tokens and fire failure callback
      if (res.status === 401) {
        tokenStore.clear();
        onAuthFailure();
      }
    } else {
      tokenStore.clear();
      onAuthFailure();
    }
  }
  return res;
}

export async function request<T>(path: string, opts: RequestOpts = {}): Promise<T> {
  const res = await executeWithRefresh(path, opts);
  return parse<T>(res);
}

/** Like `request` but returns the full parsed JSON body (no `.data` unwrap).
 *  Use for list endpoints whose response IS the envelope: `{ data: [...], next_cursor }`. */
export async function listRequest<T>(path: string, opts: RequestOpts = {}): Promise<T> {
  const res = await executeWithRefresh(path, opts);
  let json: unknown = {};
  try {
    const text = await res.text();
    json = text ? JSON.parse(text) : {};
  } catch (e) {
    if (!(e instanceof TypeError)) throw e;
  }
  if (!res.ok) {
    const err = (json as { error?: ErrorBody }).error;
    throw new ApiError(res.status, err?.code ?? 'internal_error', err?.message ?? res.statusText, err?.details ?? null);
  }
  return json as T;
}
