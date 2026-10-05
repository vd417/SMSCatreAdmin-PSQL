import React, { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { passwordForgot, passwordReset } from '../api/auth';
import { Btn, useToast } from '../components';
import { Icon } from '../lib/icons';
import { ApiError } from '../api/client';

type View = 'login' | 'recover-identify' | 'recover-reset';
const MIN_PW = 8;

export function AuthScreen(): React.ReactElement {
  const { loginWithPassword } = useAuth();
  const toast = useToast();
  const [view, setView] = useState<View>('login');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [code, setCode] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [notice, setNotice] = useState('');

  const goView = (v: View) => {
    setView(v); setErr(''); setNotice('');
    setCode(''); setNewPw(''); setConfirmPw(''); setShowPw(false);
  };

  const doLogin = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(''); setNotice('');
    try { await loginWithPassword(email.trim(), pw); }
    catch (x) { setErr(x instanceof ApiError ? 'Incorrect email or password' : 'Could not sign in. Try again.'); }
    finally { setBusy(false); }
  };

  // Step 1 — send the OTP to a registered identifier.
  const doForgot = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr('');
    try {
      await passwordForgot(email.trim());
      goView('recover-reset');
      toast({ title: 'Code sent', msg: 'Check your email for the 6-digit code.', kind: 'info' });
    } catch (x) {
      if (x instanceof ApiError && x.code === 'not_registered') setErr("That email isn't registered. Contact your administrator.");
      else setErr(x instanceof ApiError ? x.message : 'Could not send the code. Try again.');
    } finally { setBusy(false); }
  };

  // Step 2 — verify the code and set the new password in one call. No auto-login:
  // on success we return to the sign-in screen for the user to log in. The button
  // stays clickable; we validate on submit and surface a specific reason rather than
  // leaving a silently-disabled button the user can't explain.
  const doReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) { setErr('Enter the full 6-digit code to continue.'); return; }
    if (newPw.length < MIN_PW) { setErr(`Your new password must be at least ${MIN_PW} characters.`); return; }
    if (newPw !== confirmPw) { setErr("The passwords don't match. Re-enter them."); return; }
    setBusy(true); setErr('');
    try {
      await passwordReset(email.trim(), code.trim(), newPw);
      goView('login');
      setNotice('Password set. Sign in with your new password.');
      toast({ title: 'Password set', msg: 'Sign in with your new password.', kind: 'success' });
    } catch (x) {
      if (x instanceof ApiError && x.code === 'invalid_code') setErr('That code is incorrect or expired. Request a new code.');
      else if (x instanceof ApiError && x.code === 'weak_password') setErr(`Password must be at least ${MIN_PW} characters.`);
      else setErr(x instanceof ApiError ? x.message : 'Could not set the password. Try again.');
    } finally { setBusy(false); }
  };

  const PwToggle = (
    <button type="button" onClick={() => setShowPw(s => !s)} aria-label={showPw ? 'Hide password' : 'Show password'}
      style={{ display: 'grid', placeItems: 'center', color: 'var(--text-3)' }}>
      {React.createElement(showPw ? Icon.eyeOff : Icon.eye, { size: 15 })}
    </button>
  );

  return (
    <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', overflowY: 'auto', padding: 24, background: 'var(--bg-grad)' }}>
      <div className="login-card" style={{ margin: 'auto' }}>
        {/* left: brand panel */}
        <div className="login-brand">
          <div className="row gap10" style={{ marginBottom: 'auto' }}>
            <img className="brand-logo" src="/catre-emblem.png" alt="Catre" style={{ width: 64, height: 64 }} />
            <div>
              <div className="brand-name" style={{ fontSize: 16 }}>Catre</div>
              <div className="brand-sub">Operator Control Plane</div>
            </div>
          </div>
          <div style={{ margin: '40px 0' }}>
            <h1 style={{ fontSize: 25, fontWeight: 750, letterSpacing: '-0.03em', lineHeight: 1.15 }}>Run the business behind every school.</h1>
            <p className="muted" style={{ marginTop: 12, fontSize: 13.5, lineHeight: 1.6 }}>
              Manage client schools, onboarding, billing and support from one internal control plane.
            </p>
          </div>
          <div className="row gap8" style={{ marginTop: 'auto', fontSize: 12, color: 'var(--text-3)' }}>
            <Icon.shield size={15} />
            <span>Platform-admin access · audited</span>
          </div>
        </div>

        {/* right: form */}
        <div className="login-form">
          {view === 'login' && (
            <>
              <h2 style={{ fontSize: 19, fontWeight: 700, letterSpacing: '-0.02em' }}>Sign in to your account</h2>
              <p className="muted tiny" style={{ marginTop: 4 }}>Platform administrators only.</p>
              {notice && (
                <div className="row gap6" style={{ marginTop: 14, padding: '8px 10px', borderRadius: 8,
                  background: 'color-mix(in srgb, var(--green) 14%, transparent)', color: 'var(--green)', fontSize: 12.5 }}>
                  <Icon.check size={15} /><span>{notice}</span>
                </div>
              )}
              <form onSubmit={doLogin} style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="field">
                  <label htmlFor="email">Email</label>
                  <input id="email" className="input" type="email" autoComplete="username"
                    value={email} onChange={e => { setEmail(e.target.value); setErr(''); setNotice(''); }} placeholder="you@catre.io" />
                </div>
                <div className="field">
                  <div className="row jb">
                    <label htmlFor="password">Password</label>
                    <button type="button" className="tiny" style={{ color: 'var(--accent-text)' }} onClick={() => goView('recover-identify')}>Forgot password?</button>
                  </div>
                  <div className="input-group" style={{ height: 38 }}>
                    <Icon.lock size={15} />
                    <input id="password" type={showPw ? 'text' : 'password'} autoComplete="current-password"
                      value={pw} onChange={e => { setPw(e.target.value); setErr(''); setNotice(''); }} />
                    {PwToggle}
                  </div>
                </div>
                {err && <div className="tiny" style={{ color: 'var(--red)' }}>{err}</div>}
                <Btn variant="primary" type="submit" disabled={busy || !email.trim() || !pw}>
                  {busy ? 'Signing in…' : 'Sign in'}{!busy && <Icon.arrowRight size={16} />}
                </Btn>
              </form>
              <div className="row gap6" style={{ marginTop: 16, justifyContent: 'center' }}>
                <span className="tiny muted">First time here?</span>
                <button type="button" className="tiny" style={{ color: 'var(--accent-text)' }} onClick={() => goView('recover-identify')}>Create a password</button>
              </div>
            </>
          )}

          {view === 'recover-identify' && (
            <>
              <h2 style={{ fontSize: 19, fontWeight: 700, letterSpacing: '-0.02em' }}>Set your password</h2>
              <p className="muted tiny" style={{ marginTop: 4 }}>First time here or forgot your password? Enter your email — if it's registered, we'll send a 6-digit code to verify it's you.</p>
              <form onSubmit={doForgot} style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="field">
                  <label htmlFor="email">Email</label>
                  <input id="email" className="input" type="email" autoComplete="username"
                    value={email} onChange={e => { setEmail(e.target.value); setErr(''); }} placeholder="you@catre.io" />
                </div>
                {err && <div className="tiny" style={{ color: 'var(--red)' }}>{err}</div>}
                <Btn variant="primary" type="submit" disabled={busy || !email.trim()}>{busy ? 'Sending…' : 'Send code'}</Btn>
                <button type="button" className="muted tiny" onClick={() => goView('login')}>Back to sign in</button>
              </form>
            </>
          )}

          {view === 'recover-reset' && (
            <>
              <h2 style={{ fontSize: 19, fontWeight: 700, letterSpacing: '-0.02em' }}>Choose a new password</h2>
              <p className="muted tiny" style={{ marginTop: 4 }}>Enter the 6-digit code we sent to {email}, then set a new password (at least {MIN_PW} characters).</p>
              <form onSubmit={doReset} style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="field">
                  <label htmlFor="code">6-digit code</label>
                  <input id="code" className="input mono" inputMode="numeric" maxLength={6}
                    value={code} onChange={e => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setErr(''); }}
                    placeholder="••••••" style={{ letterSpacing: '4px', fontSize: 16 }} />
                  <div className="tiny" style={{ marginTop: 6, color: code.length > 0 && code.length < 6 ? 'var(--red)' : 'var(--text-3)' }}>
                    Enter all 6 digits of the code.
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="newpw">New password</label>
                  <div className="input-group" style={{ height: 38 }}>
                    <Icon.lock size={15} />
                    <input id="newpw" type={showPw ? 'text' : 'password'} autoComplete="new-password"
                      value={newPw} onChange={e => { setNewPw(e.target.value); setErr(''); }} />
                    {PwToggle}
                  </div>
                  <div className="tiny" style={{ marginTop: 6, color: newPw.length > 0 && newPw.length < MIN_PW ? 'var(--red)' : 'var(--text-3)' }}>
                    Must be at least {MIN_PW} characters.
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="confirmpw">Confirm password</label>
                  <input id="confirmpw" className="input" type={showPw ? 'text' : 'password'} autoComplete="new-password"
                    value={confirmPw} onChange={e => { setConfirmPw(e.target.value); setErr(''); }} />
                </div>
                {confirmPw.length > 0 && newPw !== confirmPw && <div className="tiny muted">Passwords don't match yet.</div>}
                {err && <div className="tiny" style={{ color: 'var(--red)' }}>{err}</div>}
                <Btn variant="primary" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Set password'}</Btn>
                <button type="button" className="muted tiny" onClick={() => goView('recover-identify')}>Use a different email</button>
              </form>
            </>
          )}
        </div>
      </div>
      <footer className="login-copyright">
        <strong>© 2026 Catre Technology. All Rights Reserved.</strong>
        <span>
          This software, source code, design, graphics, logos, documentation, and related materials are the
          exclusive property of Catre Technology. Unauthorized copying, reproduction, modification, distribution,
          or use of any part of this project without prior written permission from Catre Technology is strictly
          prohibited.
        </span>
      </footer>
    </div>
  );
}
