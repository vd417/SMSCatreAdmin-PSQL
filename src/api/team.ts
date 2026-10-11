import { listRequest, request } from './client';
import type { TeamMember, TeamDocument, TeamDocumentInput, ListEnvelope, Role } from './types';

export interface InviteTeamBody {
  name: string;
  email: string;
  role: Role;
  employee_id: string;
  photo_url?: string | null;
  phone?: string | null;
  documents?: TeamDocumentInput[];
}

export interface UpdateTeamBody {
  role?: Role;
  status?: string;
  name?: string;
  employee_id?: string;
  photo_url?: string | null;
  phone?: string | null;
}

export function listTeam(): Promise<ListEnvelope<TeamMember>> {
  return listRequest<ListEnvelope<TeamMember>>('/team');
}

export function inviteTeamMember(body: InviteTeamBody): Promise<TeamMember> {
  return request<TeamMember>('/team', { method: 'POST', body });
}

export function updateTeamMember(id: string, body: UpdateTeamBody): Promise<TeamMember> {
  return request<TeamMember>(`/team/${id}`, { method: 'PATCH', body });
}

export function addTeamDocument(memberId: string, body: TeamDocumentInput): Promise<TeamDocument> {
  return request<TeamDocument>(`/team/${memberId}/documents`, { method: 'POST', body });
}

export function getTeamDocument(memberId: string, docId: string): Promise<TeamDocument & { content: string }> {
  return request<TeamDocument & { content: string }>(`/team/${memberId}/documents/${docId}`);
}

export function deleteTeamDocument(memberId: string, docId: string): Promise<void> {
  return request<void>(`/team/${memberId}/documents/${docId}`, { method: 'DELETE' });
}

/** Resize an image file to a square JPEG data URL for team photo storage. */
export function fileToTeamPhoto(file: File, maxPx = 256, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Choose an image file'));
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      reject(new Error('Image must be under 8MB'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read image'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image'));
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = maxPx;
        canvas.height = maxPx;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Canvas unavailable')); return; }
        const side = Math.min(img.width, img.height);
        const sx = (img.width - side) / 2;
        const sy = (img.height - side) / 2;
        ctx.drawImage(img, sx, sy, side, side, 0, 0, maxPx, maxPx);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

const DOC_MAX_BYTES = 2.5 * 1024 * 1024;
const DOC_ACCEPT = [
  'application/pdf',
  'image/jpeg', 'image/png', 'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

/** Read an onboarding document as a data URL payload for the API. */
export function fileToTeamDocument(file: File, label?: string): Promise<TeamDocumentInput> {
  return new Promise((resolve, reject) => {
    if (file.size > DOC_MAX_BYTES) {
      reject(new Error(`${file.name} must be under 2.5MB`));
      return;
    }
    const type = file.type || 'application/octet-stream';
    if (type !== 'application/octet-stream' && !DOC_ACCEPT.includes(type) && !type.startsWith('image/')) {
      reject(new Error(`${file.name}: use PDF, Word, or image`));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
    reader.onload = () => {
      resolve({
        label: (label || file.name.replace(/\.[^.]+$/, '') || 'Document').trim(),
        file_name: file.name,
        content_type: type,
        content: String(reader.result),
      });
    };
    reader.readAsDataURL(file);
  });
}

/** MIME types accepted for an admin ID proof (PAN/Aadhaar scan). */
export const ID_PROOF_ACCEPT = ['image/jpeg', 'image/png', 'application/pdf'];

/** Read an admin ID-proof document (PAN/Aadhaar) as a base64 data URL for the API.
 *  Rejects wrong types or files over 2.5MB (matches the backend DocumentUrlValidation cap). */
export function fileToIdProof(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!ID_PROOF_ACCEPT.includes(file.type)) {
      reject(new Error('ID proof must be a JPEG, PNG, or PDF file.'));
      return;
    }
    if (file.size > DOC_MAX_BYTES) {
      reject(new Error('ID proof must be 2.5MB or smaller.'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the file.'));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

export function downloadDataUrl(fileName: string, dataUrl: string): void {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = fileName;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}
