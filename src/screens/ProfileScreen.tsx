import React, { useRef, useState } from 'react';
import { Avatar, Btn, useToast } from '../components';
import { Icon } from '../lib/icons';
import { useAuth } from '../auth/AuthContext';
import { ROLES } from '../auth/rbac';
import { updatePhoto, setPassword } from '../api/auth';
import { fileToTeamPhoto } from '../api/team';
import { ApiError } from '../api/client';

const MIN_PW = 8;

// Visually hidden but still focusable/queryable — lets a styled button drive the
// native file picker while keeping the input reachable (incl. for tests).
const SR_ONLY: React.CSSProperties = {
  position: 'absolute', width: 1, height: 1, padding: 0, margin: -1,
  overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0,
};

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="row jb" style={{ padding: '9px 0', borderBottom: '1px solid var(--border-soft)' }}>
      <span className="tiny muted">{label}</span>
      <span style={{ fontSize: 13, fontWeight: 550 }}>{value}</span>
    </div>
  );
}

export function ProfileScreen(): React.ReactElement {
  const { user, role, finalizeSession } = useAuth();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [pwBusy, setPwBusy] = useState(false);
  const [pwErr, setPwErr] = useState('');

  const roleMeta = role ? ROLES[role] : null;
  const name = user?.name || '—';
  const photo = user?.photo_url ?? null;

  const onPickPhoto = async (file: File | null) => {
    if (!file) return;
    setPhotoBusy(true);
    try {
      const dataUrl = await fileToTeamPhoto(file);
      await updatePhoto(dataUrl);
      await finalizeSession();
      toast({ kind: 'success', title: 'Photo updated' });
    } catch (err) {
      toast({ kind: 'error', title: 'Could not update photo', msg: err instanceof Error ? err.message : undefined });
    } finally {
      setPhotoBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const onRemovePhoto = async () => {
    setPhotoBusy(true);
    try {
      await updatePhoto(null);
      await finalizeSession();
      toast({ kind: 'success', title: 'Photo removed' });
    } catch (err) {
      toast({ kind: 'error', title: 'Could not remove photo', msg: err instanceof Error ? err.message : undefined });
    } finally {
      setPhotoBusy(false);
    }
  };

  const onUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPw.length < MIN_PW) { setPwErr(`Your new password must be at least ${MIN_PW} characters.`); return; }
    if (newPw !== confirmPw) { setPwErr("The passwords don't match. Re-enter them."); return; }
    setPwBusy(true); setPwErr('');
    try {
      await setPassword(newPw);
      setNewPw(''); setConfirmPw('');
      toast({ kind: 'success', title: 'Password updated', msg: 'Use it next time you sign in.' });
    } catch (err) {
      setPwErr(err instanceof ApiError ? err.message : 'Could not update the password. Try again.');
    } finally {
      setPwBusy(false);
    }
  };

  const PwToggle = (
    <button type="button" onClick={() => setShowPw(s => !s)} aria-label={showPw ? 'Hide password' : 'Show password'}
      style={{ display: 'grid', placeItems: 'center', color: 'var(--text-3)' }}>
      {React.createElement(showPw ? Icon.eyeOff : Icon.eye, { size: 15 })}
    </button>
  );

  return (
    <div className="page">
      <div style={{ marginBottom: 18 }}>
        <h1 className="page-title">My profile</h1>
        <p className="muted tiny" style={{ marginTop: 4 }}>Your account details, photo, and password.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 14, alignItems: 'start' }}>
        {/* ---- identity + photo ---- */}
        <div className="card" style={{ padding: 16 }}>
          <div className="row gap12" style={{ alignItems: 'center' }}>
            <Avatar name={name} size={64} src={photo} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{name}</div>
              <div className="tiny muted">{user?.email || '—'}</div>
              {roleMeta && (
                <span className="badge" style={{ marginTop: 6, background: roleMeta.color + '22', color: roleMeta.color }}>
                  {roleMeta.name}
                </span>
              )}
            </div>
          </div>

          <input ref={fileRef} type="file" accept="image/*" aria-label="Choose a new photo" style={SR_ONLY}
            onChange={e => onPickPhoto(e.target.files?.[0] ?? null)} />
          <div className="row gap8" style={{ marginTop: 14 }}>
            <Btn variant="default" size="sm" icon={Icon.upload} disabled={photoBusy} onClick={() => fileRef.current?.click()}>
              {photoBusy ? 'Working…' : photo ? 'Change photo' : 'Add photo'}
            </Btn>
            {photo && (
              <Btn variant="default" size="sm" disabled={photoBusy} onClick={onRemovePhoto}>Remove photo</Btn>
            )}
          </div>
          <div className="tiny muted" style={{ marginTop: 8 }}>JPG or PNG, up to ~300KB.</div>

          <div style={{ marginTop: 14 }}>
            <Row label="Employee ID" value={user?.employee || '—'} />
            <Row label="Phone" value={user?.phone || '—'} />
            <Row label="Joined" value={fmtDate(user?.joined)} />
          </div>
        </div>

        {/* ---- change password ---- */}
        <div className="card" style={{ padding: 16 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700 }}>Change password</h2>
          <p className="muted tiny" style={{ marginTop: 4, marginBottom: 14 }}>Sets a new password for your account.</p>
          <form onSubmit={onUpdatePassword} className="fc gap12">
            <div className="field">
              <label htmlFor="newpw">New password</label>
              <div className="input-group" style={{ height: 38 }}>
                <Icon.lock size={15} />
                <input id="newpw" type={showPw ? 'text' : 'password'} autoComplete="new-password"
                  value={newPw} onChange={e => { setNewPw(e.target.value); setPwErr(''); }} />
                {PwToggle}
              </div>
              <div className="tiny" style={{ marginTop: 6, color: newPw.length > 0 && newPw.length < MIN_PW ? 'var(--red)' : 'var(--text-3)' }}>
                Minimum {MIN_PW} characters.
              </div>
            </div>
            <div className="field">
              <label htmlFor="confirmpw">Confirm password</label>
              <input id="confirmpw" className="input" type={showPw ? 'text' : 'password'} autoComplete="new-password"
                value={confirmPw} onChange={e => { setConfirmPw(e.target.value); setPwErr(''); }} />
            </div>
            {confirmPw.length > 0 && newPw !== confirmPw && <div className="tiny muted">Both entries must be identical.</div>}
            {pwErr && <div className="tiny" style={{ color: 'var(--red)' }}>{pwErr}</div>}
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <Btn variant="primary" type="submit" disabled={pwBusy}>{pwBusy ? 'Saving…' : 'Update password'}</Btn>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
