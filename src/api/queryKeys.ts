export interface ClientsListParams {
  status?: string; tier?: string; q?: string; sort?: string; limit?: number;
}
export interface RevenueParams { months?: number; }
export interface InvoicesListParams { status?: string; limit?: number; }
export interface TicketsListParams { status?: string; q?: string; limit?: number; }

export const qk = {
  dashboard: () => ['dashboard', 'overview'] as const,
  clients: {
    list: (params: ClientsListParams) => ['clients', 'list', params] as const,
    detail: (id: string) => ['clients', 'detail', id] as const,
    usage: (id: string) => ['clients', 'usage', id] as const,
    activity: (id: string) => ['clients', 'activity', id] as const,
  },
  reports: {
    revenue: (params: RevenueParams) => ['reports', 'revenue', params] as const,
  },
  plans: {
    list: () => ['plans', 'list'] as const,
    detail: (id: string) => ['plans', 'detail', id] as const,
  },
  subscriptions: {
    list: () => ['subscriptions', 'list'] as const,
  },
  invoices: {
    list: (params: InvoicesListParams) => ['invoices', 'list', params] as const,
    detail: (id: string) => ['invoices', 'detail', id] as const,
  },
  tickets: {
    list: (params: TicketsListParams) => ['tickets', 'list', params] as const,
    detail: (id: string) => ['tickets', 'detail', id] as const,
  },
  team: {
    list: () => ['team', 'list'] as const,
  },
  onboarding: { list: () => ['onboarding', 'list'] as const },
  notifications: { list: () => ['notifications', 'list'] as const },
  upgradeRequests: {
    list: (status?: string) => ['upgradeRequests', 'list', status ?? 'all'] as const,
  },
};
