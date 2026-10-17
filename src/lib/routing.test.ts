import { describe, it, expect } from 'vitest';
import { parsePath, routeToPath } from './routing';

describe('parsePath', () => {
  it('maps "/" and "" to the dashboard', () => {
    expect(parsePath('/')).toEqual({ name: 'dashboard', params: {} });
    expect(parsePath('')).toEqual({ name: 'dashboard', params: {} });
  });

  it('maps top-level screens', () => {
    expect(parsePath('/clients')).toEqual({ name: 'clients', params: {} });
    expect(parsePath('/plans')).toEqual({ name: 'plans', params: {} });
    expect(parsePath('/settings/')).toEqual({ name: 'settings', params: {} });
  });

  it('extracts the client id', () => {
    expect(parsePath('/clients/abc-123')).toEqual({ name: 'client', params: { id: 'abc-123' } });
  });

  it('extracts the billing tab and onboard id', () => {
    expect(parsePath('/billing/seats')).toEqual({ name: 'billing', params: { tab: 'seats' } });
    expect(parsePath('/onboard/t1')).toEqual({ name: 'onboard', params: { id: 't1' } });
  });

  it('falls back to the dashboard for unknown paths', () => {
    expect(parsePath('/nope/xyz')).toEqual({ name: 'dashboard', params: {} });
  });
});

describe('routeToPath', () => {
  it('round-trips every real route', () => {
    const routes = [
      { name: 'dashboard', params: {} },
      { name: 'clients', params: {} },
      { name: 'client', params: { id: 'abc-123' } },
      { name: 'billing', params: {} },
      { name: 'billing', params: { tab: 'seats' } },
      { name: 'onboard', params: {} },
      { name: 'onboard', params: { id: 't1' } },
      { name: 'reports', params: {} },
    ];
    for (const r of routes) {
      expect(parsePath(routeToPath(r))).toEqual(r);
    }
  });
});
