import React, { useRef, useState } from 'react';
import { Avatar, Modal, Btn } from './index';
import { Icon } from '../lib/icons';
import { ROLES } from '../auth/rbac';
import type { Role, TeamDocumentInput } from '../api/types';
import { fileToTeamDocument, fileToTeamPhoto, type InviteTeamBody } from '../api/team';

const INVITE_ROLES: Role[] = ['admin', 'support', 'sales', 'finance', 'analyst', 'owner'];

const DOC_LABELS = ['ID proof', 'Offer letter', 'Contract', 'Resume', 'Other'] as const;

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (body: InviteTeamBody) => void;
  pending?: boolean;
  allowedRoles?: Role[];
};

export function InviteTeamModal({ open, onClose, onSubmit, pending, allowedRoles }: Props): React.ReactElement {
  const roles = allowedRoles ?? INVITE_ROLES;
  const fileRef = useRef<HTMLInputElement>(null);
  const docRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [phone, setPhone] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [docBusy, setDocBusy] = useState(false);
  const [docLabel, setDocLabel] = useState<string>(DOC_LABELS[0]);
  const [documents, setDocuments] = useState<TeamDocumentInput[]>([]);
  const [role, setRole] = useState<Role>(roles.includes('sales') ? 'sales' : roles[0]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const reset = () => {
    setName(''); setEmail(''); setEmployeeId(''); setPhone(''); setPhotoUrl(null);
    setDocuments([]); setDocLabel(DOC_LABELS[0]);
    setRole(roles.includes('sales') ? 'sales' : roles[0]); setErrors({}); setPhotoBusy(false); setDocBusy(false);
    if (fileRef.current) fileRef.current.value = '';
    if (docRef.current) docRef.current.value = '';
  };

  const onPickPhoto = async (file: File | null) => {
    if (!file) return;
    setPhotoBusy(true);
    setErrors(e => ({ ...e, photo: '' }));
    try {
      setPhotoUrl(await fileToTeamPhoto(file));
    } catch (err) {
      setErrors(e => ({ ...e, photo: err instanceof Error ? err.message : 'Photo failed' }));
      setPhotoUrl(null);
    } finally {
      setPhotoBusy(false);
    }
  };

  const onPickDocs = async (files: FileList | null) => {
    if (!files?.length) return;
    setDocBusy(true);
    setErrors(e => ({ ...e, documents: '' }));
    try {
      const next = [...documents];
      for (const file of Array.from(files)) {
        if (next.length >= 8) break;
        next.push(await fileToTeamDocument(file, docLabel === 'Other' ? undefined : docLabel));
      }
      setDocuments(next);
    } catch (err) {
      setErrors(e => ({ ...e, documents: err instanceof Error ? err.message : 'Document failed' }));
    } finally {
      setDocBusy(false);
      if (docRef.current) docRef.current.value = '';
    }
  };

  const submit = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Name is required';
    if (!/^[^@]+@[^@]+\.[^@]+$/.test(email.trim())) e.email = 'Valid email required';
    if (!employeeId.trim()) e.employee_id = 'Employee ID is required';
    if (!roles.includes(role)) e.role = 'Pick a role';
    setErrors(e);
    if (Object.keys(e).length) return;
    onSubmit({
      name: name.trim(),
      email: email.trim(),
      role,
      employee_id: employeeId.trim(),
      photo_url: photoUrl,
      phone: phone.trim() || null,
      documents: documents.length ? documents : undefined,
    });
  };

  return (
    <Modal open={open} onClose={() => { reset(); onClose(); }} size="lg">
      <div style={{ padding: 4 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>Add team member</h2>
        <p className="muted tiny" style={{ marginBottom: 16 }}>
          Profile, documents, and Catre login (OTP). Role controls panel access.
        </p>

        <div className="row gap16" style={{ alignItems: 'flex-start', marginBottom: 14 }}>
          <div className="fc gap8" style={{ alignItems: 'center' }}>
            <Avatar name={name || 'New'} size={72} src={photoUrl} />
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
              onChange={ev => onPickPhoto(ev.target.files?.[0] ?? null)} />
            <Btn variant="default" size="sm" icon={Icon.upload} disabled={photoBusy}
              onClick={() => fileRef.current?.click()}>
              {photoBusy ? 'Processing…' : photoUrl ? 'Change photo' : 'Add photo'}
            </Btn>
            {photoUrl && (
              <button type="button" className="tiny muted" onClick={() => { setPhotoUrl(null); if (fileRef.current) fileRef.current.value = ''; }}>
                Remove
              </button>
            )}
            {errors.photo && <span className="err">{errors.photo}</span>}
          </div>
          <div className="fc gap12" style={{ flex: 1, minWidth: 0 }}>
            <div className="field">
              <label>Full name</label>
              <input className="input" value={name} onChange={ev => setName(ev.target.value)} placeholder="e.g. Priya Sharma" />
              {errors.name && <span className="err">{errors.name}</span>}
            </div>
            <div className="field">
              <label>Work email</label>
              <input className="input" type="email" value={email} onChange={ev => setEmail(ev.target.value)} placeholder="name@catre.app" />
              {errors.email && <span className="err">{errors.email}</span>}
            </div>
            <div className="grid-auto cols-200">
              <div className="field">
                <label>Employee ID</label>
                <input className="input" value={employeeId} onChange={ev => setEmployeeId(ev.target.value)} placeholder="e.g. EMP-1042" />
                {errors.employee_id && <span className="err">{errors.employee_id}</span>}
              </div>
              <div className="field">
                <label>Phone (optional)</label>
                <input className="input" value={phone} onChange={ev => setPhone(ev.target.value)} placeholder="+91 …" />
              </div>
            </div>
          </div>
        </div>

        <div className="field" style={{ marginBottom: 14 }}>
          <label>Onboarding documents (optional)</label>
          <div className="row gap8 fw" style={{ marginBottom: 8 }}>
            <select className="select" style={{ width: 160 }} value={docLabel} onChange={e => setDocLabel(e.target.value)}>
              {DOC_LABELS.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
            <input ref={docRef} type="file" multiple accept=".pdf,.doc,.docx,image/*"
              style={{ display: 'none' }} onChange={ev => onPickDocs(ev.target.files)} />
            <Btn variant="default" size="sm" icon={Icon.upload} disabled={docBusy || documents.length >= 8}
              onClick={() => docRef.current?.click()}>
              {docBusy ? 'Adding…' : 'Add documents'}
            </Btn>
            <span className="tiny muted">PDF / Word / image · max 8 · 2.5MB each</span>
          </div>
          {errors.documents && <span className="err">{errors.documents}</span>}
          {documents.length > 0 && (
            <div className="fc gap6" style={{ marginTop: 6 }}>
              {documents.map((d, i) => (
                <div key={i} className="row jb gap8" style={{ padding: '8px 10px', background: 'var(--surface-2)', borderRadius: 8, border: '1px solid var(--border-soft)' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{d.label}</div>
                    <div className="tiny muted truncate">{d.file_name}</div>
                  </div>
                  <button type="button" className="tiny muted" onClick={() => setDocuments(docs => docs.filter((_, j) => j !== i))}>
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="field">
          <label>Role</label>
          <div className="row gap8" style={{ flexWrap: 'wrap' }}>
            {roles.map(r => (
              <button
                key={r}
                type="button"
                className="chip"
                onClick={() => setRole(r)}
                style={{
                  borderColor: role === r ? ROLES[r].color : undefined,
                  background: role === r ? 'var(--surface-2)' : undefined,
                  fontWeight: role === r ? 700 : 500,
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: ROLES[r].color, display: 'inline-block' }} />
                {ROLES[r].name}
              </button>
            ))}
          </div>
          {errors.role && <span className="err">{errors.role}</span>}
          <span className="hint" style={{ marginTop: 6 }}>{ROLES[role].desc}</span>
        </div>

        <div className="row gap8" style={{ marginTop: 18, justifyContent: 'flex-end' }}>
          <Btn variant="default" onClick={() => { reset(); onClose(); }}>Cancel</Btn>
          <Btn variant="primary" disabled={pending || photoBusy || docBusy} onClick={submit}>
            {pending ? 'Creating…' : 'Create member'}
          </Btn>
        </div>
      </div>
    </Modal>
  );
}
