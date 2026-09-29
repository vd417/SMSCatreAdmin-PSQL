import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProfileScreen } from './ProfileScreen';
import { AuthProvider } from '../auth/AuthContext';
import { ToastHost } from '../components';
import { tokenStore } from '../auth/tokenStore';
import * as authApi from '../api/auth';
import * as teamApi from '../api/team';
import type { Me } from '../api/types';

const USER: Me = {
  id: 'u1', tenant_id: null, roles: ['owner'],
  name: 'Rohan Mehta', email: 'rohan@catre.io', phone: '+91 99999 00000',
  employee: 'EMP-1042', joined: '2026-01-15', photo_url: null,
};

async function wrap(overrides: Partial<Me> = {}) {
  tokenStore.set({ access_token: 'a', refresh_token: 'r' });
  vi.spyOn(authApi, 'me').mockResolvedValue({ ...USER, ...overrides });
  const utils = render(<ToastHost><AuthProvider><ProfileScreen /></AuthProvider></ToastHost>);
  // Wait for AuthProvider to load the profile.
  await screen.findByText('Rohan Mehta');
  return utils;
}

beforeEach(() => { localStorage.clear(); tokenStore.clear(); vi.restoreAllMocks(); });

describe('ProfileScreen', () => {
  it('shows the signed-in user name and email', async () => {
    await wrap();
    expect(screen.getByText('Rohan Mehta')).toBeInTheDocument();
    expect(screen.getByText('rohan@catre.io')).toBeInTheDocument();
  });

  it('changes the photo by uploading a file', async () => {
    await wrap();
    vi.spyOn(teamApi, 'fileToTeamPhoto').mockResolvedValue('data:image/jpeg;base64,ZZZ');
    const photoSpy = vi.spyOn(authApi, 'updatePhoto').mockResolvedValue();
    const file = new File(['x'], 'me.png', { type: 'image/png' });
    await userEvent.upload(screen.getByLabelText(/choose a new photo/i), file);
    await waitFor(() => expect(photoSpy).toHaveBeenCalledWith('data:image/jpeg;base64,ZZZ'));
  });

  it('clears the photo when Remove is clicked', async () => {
    await wrap({ photo_url: 'data:image/jpeg;base64,EXISTING' });
    const photoSpy = vi.spyOn(authApi, 'updatePhoto').mockResolvedValue();
    await userEvent.click(screen.getByRole('button', { name: /remove photo/i }));
    await waitFor(() => expect(photoSpy).toHaveBeenCalledWith(null));
  });

  it('blocks a password update when the two entries do not match', async () => {
    await wrap();
    const pwSpy = vi.spyOn(authApi, 'setPassword').mockResolvedValue();
    await userEvent.type(screen.getByLabelText(/new password/i), 'supersecret');
    await userEvent.type(screen.getByLabelText(/confirm password/i), 'different1');
    await userEvent.click(screen.getByRole('button', { name: /update password/i }));
    expect(pwSpy).not.toHaveBeenCalled();
    expect(screen.getByText(/passwords don't match/i)).toBeInTheDocument();
  });

  it('blocks a password shorter than 8 characters', async () => {
    await wrap();
    const pwSpy = vi.spyOn(authApi, 'setPassword').mockResolvedValue();
    await userEvent.type(screen.getByLabelText(/new password/i), 'short');
    await userEvent.type(screen.getByLabelText(/confirm password/i), 'short');
    await userEvent.click(screen.getByRole('button', { name: /update password/i }));
    expect(pwSpy).not.toHaveBeenCalled();
    expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument();
  });

  it('updates the password when both entries are valid and match', async () => {
    await wrap();
    const pwSpy = vi.spyOn(authApi, 'setPassword').mockResolvedValue();
    await userEvent.type(screen.getByLabelText(/new password/i), 'supersecret');
    await userEvent.type(screen.getByLabelText(/confirm password/i), 'supersecret');
    await userEvent.click(screen.getByRole('button', { name: /update password/i }));
    await waitFor(() => expect(pwSpy).toHaveBeenCalledWith('supersecret'));
  });
});
