import type { Client } from '../api/types';

/** The only client fields needed to spot a duplicate customer at onboarding. */
export type ClientContact = Pick<Client, 'id' | 'name' | 'contact_email' | 'contact_phone'>;

/** Trim + lowercase for case-insensitive email comparison; null/undefined → ''. */
export function normalizeEmail(email: string | null | undefined): string {
  return (email ?? '').trim().toLowerCase();
}

/** Digits-only tail (last 10) so +91 / spaces / dashes don't defeat a phone match. */
export function normalizePhone(phone: string | null | undefined): string {
  const digits = (phone ?? '').replace(/\D/g, '');
  return digits.length > 10 ? digits.slice(-10) : digits;
}

/**
 * First existing client whose contact email OR phone matches the entered admin
 * contact. Email match is exact (normalized); phone only counts when both sides
 * have a full 10-digit number, to avoid false positives on partial input.
 */
export function findDuplicateClient(
  clients: ClientContact[],
  email: string,
  phone: string,
): ClientContact | undefined {
  const e = normalizeEmail(email);
  const p = normalizePhone(phone);
  return clients.find((c) => {
    if (e && normalizeEmail(c.contact_email) === e) return true;
    if (p.length === 10 && normalizePhone(c.contact_phone) === p) return true;
    return false;
  });
}
