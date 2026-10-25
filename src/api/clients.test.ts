import { describe, it, expect, beforeEach, vi } from 'vitest';
import { listClients, getClient, getClientUsage, getClientActivity, createClient, setClientStatus, changeClientPlan, updateClient } from './clients';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
beforeEach(() => vi.restoreAllMocks());

describe('listClients', () => {
  it('passes filter/sort/cursor as query params and returns the list envelope', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: [{ id: 'c1' }], next_cursor: 'n2' }));
    vi.stubGlobal('fetch', fetchMock);
    const out = await listClients({ status: 'active', sort: '-mrr', limit: 50 }, 'cur1');
    expect(out).toEqual({ data: [{ id: 'c1' }], next_cursor: 'n2' });
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain('status=active');
    expect(url).toContain('sort=-mrr');
    expect(url).toContain('cursor=cur1');
  });
});

describe('getClient', () => {
  it('GETs /clients/{id}', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: { id: 'c1' } }));
    vi.stubGlobal('fetch', fetchMock);
    const out = await getClient('c1');
    expect(out).toEqual({ id: 'c1' });
    expect(String(fetchMock.mock.calls[0][0])).toContain('/clients/c1');
  });
});

describe('getClientUsage', () => {
  it('derives usage from GET /clients/{id} (no /usage route on backend)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      data: {
        id: 'c1', students_count: 400, staff_count: 30, storage_gb: 12,
        limits: { students: 1000, staff: 80, storage_gb: 50 }, usage_series: [1, 2],
      },
    }));
    vi.stubGlobal('fetch', fetchMock);
    const out = await getClientUsage('c1');
    expect(String(fetchMock.mock.calls[0][0])).toContain('/clients/c1');
    expect(String(fetchMock.mock.calls[0][0])).not.toContain('/usage');
    expect(out).toEqual({
      students_count: 400, staff_count: 30, storage_gb: 12,
      limits: { students: 1000, staff: 80, storage_gb: 50 },
      usage_series: [1, 2], usage_pct: 40,
    });
  });
});

describe('getClientActivity', () => {
  it('GETs /audit?tenant_id={id}', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: [], next_cursor: null }));
    vi.stubGlobal('fetch', fetchMock);
    await getClientActivity('c1', 'cur1');
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain('/audit');
    expect(url).toContain('tenant_id=c1');
    expect(url).toContain('cursor=cur1');
  });
});

describe('createClient', () => {
  it('POSTs /clients with the body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: { id: 'c9' } }));
    vi.stubGlobal('fetch', fetchMock);
    const body = { name: 'New', slug: 'new', country: 'Mumbai, MH', size: '',
      admin_name: 'A', admin_email: 'a@b.c', admin_phone: '', plan_id: 'pl_gold', trial_days: 14 };
    const out = await createClient(body);
    expect(out).toEqual({ id: 'c9' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/clients');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual(body);
  });
});

describe('setClientStatus', () => {
  it('POSTs /clients/{id}/status with { status } mapped from the UI action', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: { id: 'c1', status: 'suspended' } }));
    vi.stubGlobal('fetch', fetchMock);
    await setClientStatus('c1', 'suspend');
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/clients/c1/status');
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(init.body)).toEqual({ status: 'suspended' });
  });

  it('maps activate/reinstate → active and start_trial → trial', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: { id: 'c1' } }));
    vi.stubGlobal('fetch', fetchMock);
    await setClientStatus('c1', 'activate');
    await setClientStatus('c1', 'reinstate');
    await setClientStatus('c1', 'start_trial', 're-onboard');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ status: 'active' });
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ status: 'active' });
    expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toEqual({ status: 'trial', reason: 're-onboard' });
  });
});

describe('changeClientPlan', () => {
  it('POSTs /clients/{id}/change-plan with { plan_id }', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: { id: 'c1', plan_id: 'pl_platinum' } }));
    vi.stubGlobal('fetch', fetchMock);
    await changeClientPlan('c1', 'pl_platinum');
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/clients/c1/change-plan');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ plan_id: 'pl_platinum' });
  });
});

describe('updateClient', () => {
  it('PATCHes /clients/{id} with the contact fields', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: { id: 'c1' } }));
    vi.stubGlobal('fetch', fetchMock);
    const out = await updateClient('c1', { contact_name: 'Asha', contact_email: 'asha@s.edu', contact_phone: '9000012345' });
    expect(out).toEqual({ id: 'c1' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/clients/c1');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body)).toEqual({ contact_name: 'Asha', contact_email: 'asha@s.edu', contact_phone: '9000012345' });
  });
});
