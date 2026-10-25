import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DashboardScreen } from './DashboardScreen';

vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ can: () => true }) }));
vi.mock('../api/hooks/useDashboardOverview', () => ({
  useDashboardOverview: () => ({
    isLoading: false, isError: false,
    data: {
      counts: { total: 12, active: 9, trial: 2, suspended: 1, cancelled: 0 },
      mrr: 250000, trials_ending: 2, churn_pct: 1.8,
      months: ['Jan', 'Feb', 'Mar'], mrr_series: [0, 0, 250000], signup_series: [1, 2, 3],
      plan_mix: [{ label: 'Gold', value: 9, color: '#f0b429' }],
      usage_alerts: [], system_health: [], recent_activity: [],
    },
  }),
}));

describe('DashboardScreen', () => {
  it('renders the MRR KPI from live data', () => {
    render(<DashboardScreen />);
    // MRR now shows in both the KPI card and the revenue-card header (matches the design)
    expect(screen.getAllByText(/2,50,000/).length).toBeGreaterThan(0);
  });

  it('renders ARR as MRR × 12', () => {
    render(<DashboardScreen />);
    // 250000 × 12 = 3,000,000 → ₹30,00,000 (Indian grouping), in the ARR tile + revenue header.
    expect(screen.getAllByText(/30,00,000/).length).toBeGreaterThan(0);
  });
});
