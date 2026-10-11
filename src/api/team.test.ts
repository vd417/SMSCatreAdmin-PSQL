import { describe, it, expect, beforeEach, vi } from 'vitest';
import { listTeam, inviteTeamMember, updateTeamMember, fileToIdProof } from './team';

function jr(b: unknown, s = 200): Response {
  return new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } });
}
beforeEach(() => vi.restoreAllMocks());

describe('fileToIdProof', () => {
  const makeFile = (type: string, size: number) =>
    new File([new Uint8Array(size)], 'id', { type });

  it('rejects a non-image/pdf file', async () => {
    await expect(fileToIdProof(makeFile('text/plain', 10))).rejects.toThrow();
  });

  it('rejects a file over 2.5MB', async () => {
    await expect(fileToIdProof(makeFile('application/pdf', 2.5 * 1024 * 1024 + 1))).rejects.toThrow();
  });

  it('resolves a pdf to a data URL', async () => {
    const url = await fileToIdProof(makeFile('application/pdf', 20));
    expect(url.startsWith('data:application/pdf')).toBe(true);
  });
});

describe('listTeam', () => {
  it('GETs /team', async () => {
    const f = vi.fn().mockResolvedValue(jr({ data: [{ id: 'u1' }], next_cursor: null }));
    vi.stubGlobal('fetch', f);
    const out = await listTeam();
    expect(out).toEqual({ data: [{ id: 'u1' }], next_cursor: null });
    expect(String(f.mock.calls[0][0])).toContain('/team');
  });
});

describe('inviteTeamMember', () => {
  it('POSTs /team with full profile fields and documents', async () => {
    const f = vi.fn().mockResolvedValue(jr({ data: { id: 't1', role: 'sales' } }, 201));
    vi.stubGlobal('fetch', f);
    await inviteTeamMember({
      name: 'Sam', email: 'sam@catre.app', role: 'sales',
      employee_id: 'EMP-1', photo_url: 'data:image/jpeg;base64,xx', phone: '+911',
      documents: [{ label: 'ID proof', file_name: 'id.pdf', content_type: 'application/pdf', content: 'data:application/pdf;base64,aa' }],
    });
    const [u, i] = f.mock.calls[0];
    expect(String(u)).toContain('/team');
    expect(i.method).toBe('POST');
    expect(JSON.parse(i.body).documents[0].label).toBe('ID proof');
  });
});

describe('updateTeamMember', () => {
  it('PATCHes /team/{id}', async () => {
    const f = vi.fn().mockResolvedValue(jr({ data: { id: 't1', role: 'admin' } }));
    vi.stubGlobal('fetch', f);
    await updateTeamMember('t1', { role: 'admin' });
    const [u, i] = f.mock.calls[0];
    expect(String(u)).toContain('/team/t1');
    expect(i.method).toBe('PATCH');
    expect(JSON.parse(i.body)).toEqual({ role: 'admin' });
  });
});
