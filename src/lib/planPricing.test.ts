import { describe, it, expect } from 'vitest';
import { isPerStudent } from './planPricing';

describe('isPerStudent', () => {
  it('matches the canonical lowercase value', () => {
    expect(isPerStudent('per_student')).toBe(true);
  });

  // The backend compares case-insensitively (lower(pricing) = 'per_student') and
  // never normalises case on write, so plans created via the owner app arrive with
  // mixed case. These must still count as per-student.
  it('matches regardless of case', () => {
    expect(isPerStudent('Per_Student')).toBe(true);
    expect(isPerStudent('PER_STUDENT')).toBe(true);
  });

  it('matches despite surrounding whitespace', () => {
    expect(isPerStudent('  per_student  ')).toBe(true);
  });

  it('is false for flat and other pricing', () => {
    expect(isPerStudent('flat')).toBe(false);
    expect(isPerStudent('')).toBe(false);
  });

  it('treats null/undefined as not per-student', () => {
    expect(isPerStudent(null)).toBe(false);
    expect(isPerStudent(undefined)).toBe(false);
  });

  it('accepts a plan-shaped object', () => {
    expect(isPerStudent({ pricing: 'Per_Student' })).toBe(true);
    expect(isPerStudent({ pricing: 'flat' })).toBe(false);
  });
});
