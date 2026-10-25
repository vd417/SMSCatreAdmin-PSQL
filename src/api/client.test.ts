import { describe, it, expect, beforeEach, vi } from 'vitest';
import { request, listRequest, ApiError, setOnAuthFailure } from './client';
import { tokenStore } from '../auth/tokenStore';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

beforeEach(() => { localStorage.clear(); tokenStore.clear(); vi.restoreAllMocks(); });

describe('request', () => {
  it('unwraps the data envelope', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ data: { ok: 1 } })));
    const out = await request<{ ok: number }>('/ping');
    expect(out).toEqual({ ok: 1 });
  });

  it('attaches the bearer token when authed', async () => {
    tokenStore.set({ access_token: 'a1', refresh_token: 'r1' });
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: {} }));
    vi.stubGlobal('fetch', fetchMock);
    await request('/secure');
    const headers = (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer a1');
  });

  it('throws a typed ApiError on error envelope', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      jsonResponse({ error: { code: 'forbidden', message: 'nope', details: null } }, 403)));
    await expect(request('/x')).rejects.toMatchObject({ status: 403, code: 'forbidden' });
    await expect(request('/x')).rejects.toBeInstanceOf(ApiError);
  });

  it('refreshes once on 401 then retries the original request', async () => {
    tokenStore.set({ access_token: 'old', refresh_token: 'r1' });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ error: { code: 'invalid_token', message: 'exp' } }, 401)) // original
      .mockResolvedValueOnce(jsonResponse({ data: { access_token: 'new', refresh_token: 'r2' } }))     // /auth/refresh
      .mockResolvedValueOnce(jsonResponse({ data: { ok: true } }));                                    // retry
    vi.stubGlobal('fetch', fetchMock);
    const out = await request<{ ok: boolean }>('/secure');
    expect(out).toEqual({ ok: true });
    expect(tokenStore.getAccess()).toBe('new');
    const retryHeaders = (fetchMock.mock.calls[2][1] as RequestInit).headers as Record<string, string>;
    expect(retryHeaders.Authorization).toBe('Bearer new');
  });

  it('calls onAuthFailure, clears tokens, and throws ApiError when retry after refresh still returns 401', async () => {
    tokenStore.set({ access_token: 'old', refresh_token: 'r1' });
    const onFail = vi.fn();
    setOnAuthFailure(onFail);
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(jsonResponse({ error: { code: 'invalid_token', message: 'exp' } }, 401))  // original
      .mockResolvedValueOnce(jsonResponse({ data: { access_token: 'new', refresh_token: 'r2' } }))      // /auth/refresh succeeds
      .mockResolvedValueOnce(jsonResponse({ error: { code: 'invalid_token', message: 'still bad' } }, 401))); // retry still 401
    const err = await request('/secure').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(401);
    expect(onFail).toHaveBeenCalledOnce();
    expect(tokenStore.getRefresh()).toBeNull();
  });

  it('coalesces concurrent 401s into a single refresh so a rotating token is spent once', async () => {
    // Backend rotates the refresh token: /auth/refresh returns a NEW refresh token and
    // invalidates the one that was sent. Two requests that 401 at the same time must share
    // one refresh — otherwise the second spends the already-rotated token, 401s, and logs out.
    tokenStore.set({ access_token: 'old', refresh_token: 'r1' });
    const onFail = vi.fn();
    setOnAuthFailure(onFail);

    let validRefresh = 'r1';
    let refreshCalls = 0;
    const fetchMock = vi.fn((url: string, init: RequestInit) => {
      const path = new URL(url).pathname;
      const auth = (init.headers as Record<string, string> | undefined)?.Authorization;
      if (path.endsWith('/auth/refresh')) {
        refreshCalls++;
        const sent = (JSON.parse(init.body as string) as { refresh_token: string }).refresh_token;
        if (sent !== validRefresh) {
          return Promise.resolve(jsonResponse({ error: { code: 'invalid_token', message: 'rotated' } }, 401));
        }
        validRefresh = 'r2'; // rotate: the token just sent is now spent
        return Promise.resolve(jsonResponse({ data: { access_token: 'new', refresh_token: 'r2' } }));
      }
      if (auth === 'Bearer new') return Promise.resolve(jsonResponse({ data: { ok: true } }));
      return Promise.resolve(jsonResponse({ error: { code: 'invalid_token', message: 'exp' } }, 401));
    });
    vi.stubGlobal('fetch', fetchMock);

    const [a, b] = await Promise.all([request<{ ok: boolean }>('/a'), request<{ ok: boolean }>('/b')]);
    expect(a).toEqual({ ok: true });
    expect(b).toEqual({ ok: true });
    expect(refreshCalls).toBe(1);
    expect(onFail).not.toHaveBeenCalled();
    expect(tokenStore.getRefresh()).toBe('r2');
  });

  it('serializes refresh across tabs via a Web Lock and uses the latest stored refresh token', async () => {
    // Multi-tab race: a sibling tab already rotated r1 -> r2 in shared localStorage and
    // released the lock before this tab's refresh runs. This tab must read r2 (not the
    // spent r1 it started with) and refresh cleanly instead of 401-ing into a logout.
    tokenStore.set({ access_token: 'old', refresh_token: 'r2' });
    const locksRequest = vi.fn((_name: string, cb: () => Promise<boolean>) => cb());
    vi.stubGlobal('navigator', { locks: { request: locksRequest } });
    const onFail = vi.fn();
    setOnAuthFailure(onFail);
    const fetchMock = vi.fn((url: string, init: RequestInit) => {
      const path = new URL(url).pathname;
      if (path.endsWith('/auth/refresh')) {
        const sent = (JSON.parse(init.body as string) as { refresh_token: string }).refresh_token;
        if (sent !== 'r2') return Promise.resolve(jsonResponse({ error: { code: 'invalid_token', message: 'spent' } }, 401));
        return Promise.resolve(jsonResponse({ data: { access_token: 'new', refresh_token: 'r3' } }));
      }
      const auth = (init.headers as Record<string, string> | undefined)?.Authorization;
      if (auth === 'Bearer new') return Promise.resolve(jsonResponse({ data: { ok: true } }));
      return Promise.resolve(jsonResponse({ error: { code: 'invalid_token', message: 'exp' } }, 401));
    });
    vi.stubGlobal('fetch', fetchMock);
    const out = await request<{ ok: boolean }>('/secure');
    expect(out).toEqual({ ok: true });
    expect(locksRequest).toHaveBeenCalledWith('catre-auth-refresh', expect.any(Function));
    expect(tokenStore.getRefresh()).toBe('r3');
    expect(onFail).not.toHaveBeenCalled();
  });

  it('calls onAuthFailure and throws when refresh also fails', async () => {
    tokenStore.set({ access_token: 'old', refresh_token: 'r1' });
    const onFail = vi.fn();
    setOnAuthFailure(onFail);
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(jsonResponse({ error: { code: 'invalid_token', message: 'exp' } }, 401))
      .mockResolvedValueOnce(jsonResponse({ error: { code: 'invalid_token', message: 'bad' } }, 401)));
    await expect(request('/secure')).rejects.toBeInstanceOf(ApiError);
    expect(onFail).toHaveBeenCalledOnce();
    expect(tokenStore.getRefresh()).toBeNull();
  });
});

describe('unauthenticated auth paths (NO_AUTH)', () => {
  it('does not refresh or clear tokens on a 401 from /auth/password/reset', async () => {
    tokenStore.set({ access_token: 'a1', refresh_token: 'r1' });
    const onFail = vi.fn();
    setOnAuthFailure(onFail);
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ error: { code: 'invalid_code', message: 'code invalid or expired' } }, 401));
    vi.stubGlobal('fetch', fetchMock);
    await expect(request('/auth/password/reset', { method: 'POST', body: {} }))
      .rejects.toMatchObject({ status: 401, code: 'invalid_code' });
    // 401 here is a normal API error — no refresh attempt, no logout, tokens untouched.
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(onFail).not.toHaveBeenCalled();
    expect(tokenStore.getRefresh()).toBe('r1');
  });
});

describe('listRequest', () => {
  it('refreshes once on 401 then retries and returns the full envelope', async () => {
    tokenStore.set({ access_token: 'old', refresh_token: 'r1' });
    const envelope = { data: [{ id: 1 }], next_cursor: 'abc' };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ error: { code: 'invalid_token', message: 'exp' } }, 401)) // original
      .mockResolvedValueOnce(jsonResponse({ data: { access_token: 'new', refresh_token: 'r2' } }))     // /auth/refresh
      .mockResolvedValueOnce(jsonResponse(envelope));                                                   // retry
    vi.stubGlobal('fetch', fetchMock);
    const out = await listRequest<typeof envelope>('/items');
    expect(out).toEqual(envelope);
    expect(tokenStore.getAccess()).toBe('new');
    const retryHeaders = (fetchMock.mock.calls[2][1] as RequestInit).headers as Record<string, string>;
    expect(retryHeaders.Authorization).toBe('Bearer new');
  });
});
