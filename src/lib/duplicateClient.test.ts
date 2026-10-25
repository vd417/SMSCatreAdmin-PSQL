import { describe, it, expect } from 'vitest';
import { normalizeEmail, normalizePhone, findDuplicateClient, type ClientContact } from './duplicateClient';

const client = (p: Partial<ClientContact> & { id: string }): ClientContact => ({
  name: 'School', contact_email: null, contact_phone: null, ...p,
});

describe('normalizeEmail', () => {
  it('trims and lowercases', () => {
    expect(normalizeEmail('  Admin@School.EDU ')).toBe('admin@school.edu');
  });
  it('treats null/undefined as empty', () => {
    expect(normalizeEmail(null)).toBe('');
    expect(normalizeEmail(undefined)).toBe('');
  });
});

describe('normalizePhone', () => {
  it('keeps only the last 10 digits, dropping +91/spaces/dashes', () => {
    expect(normalizePhone('+91 90000-12345')).toBe('9000012345');
    expect(normalizePhone('09000012345')).toBe('9000012345');
    expect(normalizePhone('9000012345')).toBe('9000012345');
  });
  it('treats null/undefined as empty', () => {
    expect(normalizePhone(null)).toBe('');
  });
});

describe('findDuplicateClient', () => {
  it('matches an existing client by email, case-insensitively', () => {
    const clients = [client({ id: 'cl_1', name: 'Greenwood', contact_email: 'dup@school.edu' })];
    expect(findDuplicateClient(clients, 'DUP@School.edu', '')?.id).toBe('cl_1');
  });

  it('matches by phone even when the email is new, ignoring +91/spaces/dashes', () => {
    const clients = [client({ id: 'cl_2', name: 'Blue Valley', contact_email: 'a@b.co', contact_phone: '+91 90000 12345' })];
    expect(findDuplicateClient(clients, 'fresh@school.edu', '9000012345')?.id).toBe('cl_2');
  });

  it('returns undefined when neither email nor phone matches', () => {
    const clients = [client({ id: 'cl_3', contact_email: 'a@b.co', contact_phone: '9999999999' })];
    expect(findDuplicateClient(clients, 'new@school.edu', '9000012345')).toBeUndefined();
  });

  it('skips clients with no email or phone on record', () => {
    const clients = [client({ id: 'cl_4', contact_email: null, contact_phone: null })];
    expect(findDuplicateClient(clients, '', '')).toBeUndefined();
    expect(findDuplicateClient(clients, 'new@school.edu', '9000012345')).toBeUndefined();
  });

  it('does not match on a partial phone (fewer than 10 digits)', () => {
    const clients = [client({ id: 'cl_5', contact_phone: '9000012345' })];
    expect(findDuplicateClient(clients, '', '12345')).toBeUndefined();
  });
});
