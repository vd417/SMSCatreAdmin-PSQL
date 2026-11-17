import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthScreen } from './AuthScreen';
import { AuthProvider } from '../auth/AuthContext';
import { ToastHost } from '../components';
import * as authApi from '../api/auth';
import { ApiError } from '../api/client';

function wrap() {
  return render(<ToastHost><AuthProvider><AuthScreen /></AuthProvider></ToastHost>);
}

describe('AuthScreen', () => {
  it('renders the password login by default and no demo logins', () => {
    wrap();
    expect(screen.getByLabelText(/^email$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    expect(screen.queryByText(/demo logins/i)).not.toBeInTheDocument();
  });

  it('offers a "Create a password" link on login that opens the email step', async () => {
    wrap();
    await userEvent.click(screen.getByRole('button', { name: /create a password/i }));
    expect(await screen.findByRole('button', { name: /send code/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/^email$/i)).toBeInTheDocument();
  });

  it('tells an unregistered email to contact admin from the create-password entry', async () => {
    vi.spyOn(authApi, 'passwordForgot').mockRejectedValue(new ApiError(404, 'not_registered', 'Email is not registered.', null));
    wrap();
    await userEvent.click(screen.getByRole('button', { name: /create a password/i }));
    await userEvent.type(screen.getByLabelText(/^email$/i), 'nobody@x.com');
    await userEvent.click(screen.getByRole('button', { name: /send code/i }));
    await waitFor(() => expect(screen.getByText("That email isn't registered. Contact your administrator.")).toBeInTheDocument());
    expect(screen.queryByLabelText(/code/i)).not.toBeInTheDocument();
  });

  it('signs in with email + password', async () => {
    const loginSpy = vi.spyOn(authApi, 'login').mockResolvedValue({ access_token: 'a', refresh_token: 'r' });
    vi.spyOn(authApi, 'me').mockResolvedValue({ id: 'u1', tenant_id: null, roles: ['owner'] });
    wrap();
    await userEvent.type(screen.getByLabelText(/^email$/i), 'rohan@catre.io');
    await userEvent.type(screen.getByLabelText(/^password$/i), 'supersecret');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() => expect(loginSpy).toHaveBeenCalledWith('rohan@catre.io', 'supersecret'));
  });

  it('shows an error when password login fails', async () => {
    vi.spyOn(authApi, 'login').mockRejectedValue(new ApiError(401, 'invalid_credentials', 'bad email or password', null));
    wrap();
    await userEvent.type(screen.getByLabelText(/^email$/i), 'rohan@catre.io');
    await userEvent.type(screen.getByLabelText(/^password$/i), 'wrongpass');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() => expect(screen.getByText('Incorrect email or password')).toBeInTheDocument());
  });

  it('shows a not-registered message and stays on the email step', async () => {
    vi.spyOn(authApi, 'passwordForgot').mockRejectedValue(new ApiError(404, 'not_registered', 'Email is not registered.', null));
    wrap();
    await userEvent.click(screen.getByRole('button', { name: /forgot password/i }));
    await userEvent.type(screen.getByLabelText(/^email$/i), 'nobody@x.com');
    await userEvent.click(screen.getByRole('button', { name: /send code/i }));
    await waitFor(() => expect(screen.getByText("That email isn't registered. Contact your administrator.")).toBeInTheDocument());
    expect(screen.queryByLabelText(/code/i)).not.toBeInTheDocument();
  });

  it('first-time setup: email → code + new password → back to sign in (no auto-login)', async () => {
    const forgotSpy = vi.spyOn(authApi, 'passwordForgot').mockResolvedValue({ sent: true });
    const resetSpy = vi.spyOn(authApi, 'passwordReset').mockResolvedValue();
    const meSpy = vi.spyOn(authApi, 'me').mockResolvedValue({ id: 'u1', tenant_id: null, roles: ['owner'] });
    wrap();
    await userEvent.click(screen.getByRole('button', { name: /forgot password/i }));
    await userEvent.type(screen.getByLabelText(/^email$/i), 'rohan@catre.io');
    await userEvent.click(screen.getByRole('button', { name: /send code/i }));
    await userEvent.type(await screen.findByLabelText(/code/i), '123456');
    await userEvent.type(screen.getByLabelText(/new password/i), 'supersecret');
    await userEvent.type(screen.getByLabelText(/confirm password/i), 'supersecret');
    await userEvent.click(screen.getByRole('button', { name: /set password/i }));

    await waitFor(() => expect(resetSpy).toHaveBeenCalledWith('rohan@catre.io', '123456', 'supersecret'));
    expect(forgotSpy).toHaveBeenCalledWith('rohan@catre.io');
    // No auto-login: returns to the sign-in screen with a success notice, never fetches /me.
    expect(await screen.findByText(/password set\. sign in/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    expect(meSpy).not.toHaveBeenCalled();
  });

  it('shows an error and stays put when the reset code is invalid', async () => {
    vi.spyOn(authApi, 'passwordForgot').mockResolvedValue({ sent: true });
    vi.spyOn(authApi, 'passwordReset').mockRejectedValue(new ApiError(401, 'invalid_code', 'code invalid or expired', null));
    wrap();
    await userEvent.click(screen.getByRole('button', { name: /forgot password/i }));
    await userEvent.type(screen.getByLabelText(/^email$/i), 'rohan@catre.io');
    await userEvent.click(screen.getByRole('button', { name: /send code/i }));
    await userEvent.type(await screen.findByLabelText(/code/i), '000000');
    await userEvent.type(screen.getByLabelText(/new password/i), 'supersecret');
    await userEvent.type(screen.getByLabelText(/confirm password/i), 'supersecret');
    await userEvent.click(screen.getByRole('button', { name: /set password/i }));
    await waitFor(() => expect(screen.getByText(/that code is incorrect or expired/i)).toBeInTheDocument());
    // Still on the reset step (the new-password field is present, sign-in button is not).
    expect(screen.getByLabelText(/new password/i)).toBeInTheDocument();
  });

  it('keeps "Set password" clickable and validates on submit (no silently-dead button)', async () => {
    const resetSpy = vi.spyOn(authApi, 'passwordReset').mockResolvedValue();
    vi.spyOn(authApi, 'passwordForgot').mockResolvedValue({ sent: true });
    wrap();
    await userEvent.click(screen.getByRole('button', { name: /forgot password/i }));
    await userEvent.type(screen.getByLabelText(/^email$/i), 'rohan@catre.io');
    await userEvent.click(screen.getByRole('button', { name: /send code/i }));
    const btn = await screen.findByRole('button', { name: /set password/i });
    // The button is clickable, not gated on validity.
    expect(btn).toBeEnabled();

    // Incomplete code → submit blocked with a specific reason, API not called.
    await userEvent.type(await screen.findByLabelText(/code/i), '12345');
    await userEvent.type(screen.getByLabelText(/new password/i), 'supersecret');
    await userEvent.type(screen.getByLabelText(/confirm password/i), 'supersecret');
    await userEvent.click(btn);
    expect(resetSpy).not.toHaveBeenCalled();
    expect(screen.getByText(/enter the full 6-digit code/i)).toBeInTheDocument();

    // Mismatched password → its own specific reason, still no API call.
    await userEvent.type(screen.getByLabelText(/code/i), '6'); // now 123456
    await userEvent.clear(screen.getByLabelText(/confirm password/i));
    await userEvent.type(screen.getByLabelText(/confirm password/i), 'different');
    await userEvent.click(btn);
    expect(resetSpy).not.toHaveBeenCalled();
    expect(screen.getByText(/the passwords don't match/i)).toBeInTheDocument();

    // Everything valid → submits.
    await userEvent.clear(screen.getByLabelText(/confirm password/i));
    await userEvent.type(screen.getByLabelText(/confirm password/i), 'supersecret');
    await userEvent.click(btn);
    await waitFor(() => expect(resetSpy).toHaveBeenCalledWith('rohan@catre.io', '123456', 'supersecret'));
  });

  it('blocks submit with a length message when the password is too short', async () => {
    const resetSpy = vi.spyOn(authApi, 'passwordReset').mockResolvedValue();
    vi.spyOn(authApi, 'passwordForgot').mockResolvedValue({ sent: true });
    wrap();
    await userEvent.click(screen.getByRole('button', { name: /forgot password/i }));
    await userEvent.type(screen.getByLabelText(/^email$/i), 'rohan@catre.io');
    await userEvent.click(screen.getByRole('button', { name: /send code/i }));
    await userEvent.type(await screen.findByLabelText(/code/i), '123456');
    await userEvent.type(screen.getByLabelText(/new password/i), 'short');
    await userEvent.type(screen.getByLabelText(/confirm password/i), 'short');
    await userEvent.click(screen.getByRole('button', { name: /set password/i }));
    expect(resetSpy).not.toHaveBeenCalled();
    expect(screen.getByText(/your new password must be at least 8 characters/i)).toBeInTheDocument();
  });

  it('shows the 8-character password requirement on the reset screen', async () => {
    vi.spyOn(authApi, 'passwordForgot').mockResolvedValue({ sent: true });
    wrap();
    await userEvent.click(screen.getByRole('button', { name: /forgot password/i }));
    await userEvent.type(screen.getByLabelText(/^email$/i), 'rohan@catre.io');
    await userEvent.click(screen.getByRole('button', { name: /send code/i }));
    await screen.findByLabelText(/new password/i);
    expect(screen.getByText(/must be at least 8 characters/i)).toBeInTheDocument();
  });

  it('keeps resend disabled for a minute after the email code is sent', async () => {
    const forgotSpy = vi.spyOn(authApi, 'passwordForgot').mockResolvedValue({ sent: true });
    wrap();
    await userEvent.click(screen.getByRole('button', { name: /forgot password/i }));
    await userEvent.type(screen.getByLabelText(/^email$/i), 'rohan@catre.io');
    await userEvent.click(screen.getByRole('button', { name: /send code/i }));
    const resend = await screen.findByRole('button', { name: /resend code in/i });
    expect(resend).toBeDisabled();
    expect(forgotSpy).toHaveBeenCalledTimes(1);
  });

});
