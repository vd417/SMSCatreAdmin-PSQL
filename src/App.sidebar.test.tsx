import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from './App';
import { AuthProvider } from './auth/AuthContext';
import { ToastHost } from './components';
import { tokenStore } from './auth/tokenStore';
import * as authApi from './api/auth';
import { setMediaMatches } from './test/setup';

beforeEach(() => { localStorage.clear(); tokenStore.clear(); vi.restoreAllMocks(); setMediaMatches(false); });

function wrapAuthed() {
  tokenStore.set({ access_token: 'a1', refresh_token: 'r1' });
  vi.spyOn(authApi, 'me').mockResolvedValue({ id: 'u1', tenant_id: null, roles: ['owner'] });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ToastHost><AuthProvider><App /></AuthProvider></ToastHost>
    </QueryClientProvider>
  );
}

describe('App shell — width-driven sidebar', () => {
  it('collapses the sidebar to the rail when the viewport is too narrow for it', async () => {
    setMediaMatches(true);
    const { container } = wrapAuthed();
    await screen.findByRole('navigation');
    expect(container.querySelector('.sidebar')).toHaveClass('collapsed');
  });

  it('leaves the sidebar expanded when there is room for it', async () => {
    setMediaMatches(false);
    const { container } = wrapAuthed();
    await screen.findByRole('navigation');
    expect(container.querySelector('.sidebar')).not.toHaveClass('collapsed');
  });

});
