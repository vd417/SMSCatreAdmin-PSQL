import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PlansTab, planToDraft } from './PlansTab';
import { ToastCtx } from '../index';
import type { Plan } from '../../api/types';

const plan = (p: Partial<Plan>): Plan => ({
  id: 'pl', name: 'P', description: '', price: 0, per_student: 0, min_students: 0,
  pricing: 'flat', period: 'month', color: '#000', band: 'Mid', visibility: 'published',
  audience: 'all', features: [], limits: { students: 0, staff: 0, storage_gb: 0 },
  offer: null, tier: 'gold', ...p,
}) as Plan;

vi.mock('../../api/hooks/usePlans', () => ({ usePlans: () => ({ isLoading: false, isError: false, data: { data: [
  { id: 'pl_g', name: 'Gold', description: 'Best', price: 50000, per_student: 0, min_students: 0,
    pricing: 'flat', period: 'month', color: '#caa', band: 'Mid', visibility: 'published', audience: 'all',
    features: ['sis.students'], limits: { students: 1000, staff: 80, storage_gb: 50 }, offer: null, tier: 'gold' },
] } }) }));
vi.mock('../../api/hooks/usePlanMutations', () => ({
  useCreatePlan: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdatePlan: () => ({ mutate: vi.fn(), isPending: false }),
  usePublishPlan: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock('../../auth/AuthContext', () => ({ useAuth: () => ({ can: () => true }) }));

describe('PlansTab', () => {
  it('renders plan cards and the New plan action for managers', () => {
    render(<ToastCtx.Provider value={() => {}}><PlansTab /></ToastCtx.Provider>);
    expect(screen.getByText('Gold')).toBeInTheDocument();
    expect(screen.getByText('New plan')).toBeInTheDocument();
  });

  // The backend stores pricing with mixed case; the edit modal keys its segmented
  // control on an exact 'per_student'/'flat', so the draft must be canonicalised or
  // a per-student plan opens with no segment selected and can be saved back as flat.
  describe('planToDraft canonicalises pricing', () => {
    it('normalises a mixed-case per-student plan to per_student', () => {
      expect(planToDraft(plan({ pricing: 'Per_Student' })).pricing).toBe('per_student');
    });
    it('leaves a flat plan as flat', () => {
      expect(planToDraft(plan({ pricing: 'flat' })).pricing).toBe('flat');
    });
  });
});
