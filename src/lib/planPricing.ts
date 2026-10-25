/**
 * Per-student plan detection, case-insensitive.
 *
 * The backend stores a plan's `Pricing` without normalising case and compares it
 * case-insensitively (`lower(pricing) = 'per_student'`), so plans created through
 * the owner app arrive here as `'PerStudent'`. An exact `=== 'per_student'` check
 * silently misclassifies those as flat — hiding the per-student price and skipping
 * the student-count requirement at onboarding. Always detect through this helper.
 */
export function isPerStudent(
  pricing: string | null | undefined | { pricing?: string | null },
): boolean {
  const value = typeof pricing === 'string' || pricing == null ? pricing : pricing.pricing;
  return (value ?? '').trim().toLowerCase() === 'per_student';
}
