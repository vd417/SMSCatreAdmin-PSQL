/* URL <-> route mapping.
   The app navigates through a single { name, params } route (see NavCtx / useNav).
   These pure helpers bind that route to the address bar so every screen is a real,
   deep-linkable URL and the browser back/forward buttons work — no router library. */

export type RouteParams = Record<string, unknown>;
export interface ParsedRoute {
  name: string;
  params: RouteParams;
}

/* Top-level screens that map 1:1 to /<name>. Param'd routes (client, billing tab,
   onboard) are handled explicitly below. Keep in sync with renderScreen() in App.tsx. */
const SCREENS = new Set([
  'dashboard', 'health', 'clients', 'reports', 'onboarding', 'onboard',
  'plans', 'billing', 'team', 'identity', 'support', 'profile', 'settings',
]);

/** Parse the browser pathname into a route. Unknown paths fall back to the dashboard. */
export function parsePath(pathname: string): ParsedRoute {
  const [a, b] = pathname.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);
  if (!a) return { name: 'dashboard', params: {} };
  if (a === 'clients' && b) return { name: 'client', params: { id: b } };
  if (a === 'clients') return { name: 'clients', params: {} };
  if (a === 'billing' && b) return { name: 'billing', params: { tab: b } };
  if (a === 'onboard' && b) return { name: 'onboard', params: { id: b } };
  if (SCREENS.has(a)) return { name: a, params: {} };
  return { name: 'dashboard', params: {} };
}

/** Serialize a route back into a pathname. Inverse of parsePath for every real route. */
export function routeToPath(route: ParsedRoute): string {
  const { name, params } = route;
  if (name === 'client') return params.id ? `/clients/${params.id}` : '/clients';
  if (name === 'billing' && params.tab) return `/billing/${params.tab}`;
  if (name === 'onboard' && params.id) return `/onboard/${params.id}`;
  if (name === 'dashboard') return '/dashboard';
  return `/${name}`;
}
