import { request } from './client';
import { tokenStore } from '../auth/tokenStore';
import type { AuthTokens, Me } from './types';

export async function otpRequest(identifier: string): Promise<{ sent: boolean }> {
  return request('/auth/otp/request', { method: 'POST', body: { identifier } });
}

export async function otpVerify(identifier: string, code: string): Promise<AuthTokens> {
  const tokens = await request<AuthTokens>('/auth/otp/verify', { method: 'POST', body: { identifier, code } });
  tokenStore.set(tokens);
  return tokens;
}

export async function login(email: string, password: string): Promise<AuthTokens> {
  const tokens = await request<AuthTokens>('/auth/login', { method: 'POST', body: { email, password } });
  tokenStore.set(tokens);
  return tokens;
}

export async function refresh(): Promise<AuthTokens> {
  const refresh_token = tokenStore.getRefresh();
  const tokens = await request<AuthTokens>('/auth/refresh', { method: 'POST', body: { refresh_token } });
  tokenStore.set(tokens);
  return tokens;
}

export async function me(): Promise<Me> {
  return request<Me>('/auth/me');
}

export async function logout(): Promise<void> {
  const refresh_token = tokenStore.getRefresh();
  try {
    if (refresh_token) await request('/auth/logout', { method: 'POST', body: { refresh_token } });
  } finally {
    tokenStore.clear();
  }
}

export async function setPassword(password: string): Promise<void> {
  await request('/auth/set-password', { method: 'POST', body: { password } });
}

/** Update the signed-in user's own photo. Pass an image data URL (or http(s) URL)
 *  to set it, or null to clear it. Backend: PATCH /me/photo (max ~300KB). */
export async function updatePhoto(photoUrl: string | null): Promise<void> {
  await request('/me/photo', { method: 'PATCH', body: { photo_url: photoUrl } });
}

/** Send an OTP to a registered email/phone so the user can set a new password.
 *  Throws ApiError `not_registered` (404) when the identifier has no account. */
export async function passwordForgot(identifier: string): Promise<{ sent: boolean }> {
  return request('/auth/password/forgot', { method: 'POST', body: { identifier } });
}

/** Verify the OTP and set the new password in one call. No session is issued
 *  (the user signs in afterwards). Throws ApiError `invalid_code` (401) for a
 *  bad/expired code or `weak_password` (422) for a password under 8 chars. */
export async function passwordReset(identifier: string, code: string, password: string): Promise<void> {
  await request('/auth/password/reset', { method: 'POST', body: { identifier, code, password } });
}
