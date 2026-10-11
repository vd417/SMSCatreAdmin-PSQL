# Admin ID‑proof upload (PAN / Aadhaar) — design

**Date:** 2026-10-11
**Status:** Draft for review
**Repos:** `sms-catreadmin` (CRM frontend) + `sms-api` (backend/.NET) — cross‑repo change.

## 1. Intent

When a Catre operator onboards a new school, the **Admin contact** step
should capture an **ID‑proof document** for the person who will administer
the account. The operator picks the ID **type** (PAN or Aadhaar) and uploads
**one** document (image or PDF). The document is **required** to create the
school and is persisted so it can be viewed later from the client record.

This came from the user request: *"Admin contact … add id proof PAN/Aadhaar"*,
refined to *one document + type picker, required, saved full‑stack.*

## 2. Requirements (agreed)

- **Where:** onboard wizard, Admin contact step (step index 1 in `OnboardWizard.tsx`).
- **Shape:** a **type picker** (`PAN` | `Aadhaar`) + **one file upload**.
- **Required:** cannot advance/submit without both a type and a file.
- **File types:** image (JPEG/PNG) or **PDF** (ID scans are often PDFs).
- **Size:** ~**2.5 MB** max (matches the existing `TeamDocuments` document limit).
- **Persisted** full‑stack and **viewable** from the client detail screen.

## 3. Storage approach (Approach A — approved)

No blob/object storage exists in `sms-api`; every uploaded asset is a
**base64 data URL in a Postgres `text` column** (see `ImageUrlValidation`,
`Tenants.LogoUrl/ImageUrl`, `Users.PhotoUrl`). We follow that pattern with
**scalar columns on the `Tenants` row**, mirroring `LogoUrl`:

| Column | Type | Notes |
|---|---|---|
| `IdProofType` | `varchar(16)` (PG) / `nvarchar(16)` (FM) nullable | `'pan'` or `'aadhaar'` |
| `IdProofUrl` | `text` (PG) / `nvarchar(max)` (FM) nullable | data URL (`data:image/*` or `data:application/pdf;base64,…`). The data URL encodes the MIME type, so no separate content‑type column is needed. |

No filename column: a download name is derived on the frontend from the
school slug + type + MIME (e.g. `greenwood-high-pan.pdf`). (YAGNI; add a
`TenantIdProofs` table later only if multiple docs / audit history are needed.)

## 4. Data model & migration

Dual‑dialect, same as `M0059_Tenant_LogoUrl`:

1. **FluentMigrator** `db/Sms.Migrations/M0211_Tenant_IdProof.cs`
   - `Alter.Table("Tenants").AddColumn("IdProofType").AsString(16).Nullable();`
   - `Alter.Table("Tenants").AddColumn("IdProofUrl").AsString(int.MaxValue).Nullable();`
   - `CREATE OR ALTER dbo.Client_Create` to add `@IdProofType nvarchar(16)=NULL,
     @IdProofUrl nvarchar(max)=NULL`, insert both columns, and add them to the
     trailing `SELECT`. Keep `Client_SetStatus` / `Client_ChangePlan` SELECTs in
     sync (they also project the Tenants columns).
   - `Down()` drops the two columns and restores the prior proc bodies.
2. **Postgres canonical schema** `db/postgres/04_tables.sql`
   - Add `"IdProofType" varchar(16), "IdProofUrl" text` to `"dbo"."Tenants"`.
3. **Postgres procs** under `db/postgres/*_procs.sql` (tenancy/catre) — update the
   `Client_Create` (and the status/plan SELECTs) to match the FM bodies.

## 5. Backend changes (`sms-api`)

- **Contracts** `src/Sms.Modules.Tenancy/Contracts/CatreContracts.cs`
  - `CreateClientRequest`: add `string? IdProofType = null, string? IdProofUrl = null`.
  - `ClientRow` and `ClientResponse`: add `string? IdProofType = null, string? IdProofUrl = null`.
  - (`UpdateSchoolProfileRequest` is out of scope — capture is create‑time only.)
- **Controller** (`POST /clients`, the catre ops client‑create endpoint the CRM
  calls) — its request DTO gains `id_proof_type` / `id_proof_url` and passes
  them into `CreateClientRequest`.
- **Service** `TenancyService.CreateAsync` (and the self‑serve
  `MeSchoolsService.CreateAsync` for parity, if cheap):
  - **Validate** before insert: type ∈ {`pan`,`aadhaar`}; URL non‑empty and a
    valid document data URL (new validator below). Return `422 invalid_request`
    on failure.
  - Normalize and pass through to `clients.CreateAsync`.
- **Repository** `ClientRepository.CreateAsync` — include `IdProofType`,
  `IdProofUrl` in the `dbo.Client_Create` param object; `SelectLive` projects the
  two new columns so reads return them.
- **Validation helper** `src/Sms.Application/Common/DocumentUrlValidation.cs`
  (new; sibling of `ImageUrlValidation`):
  - Reject if `Length > 3_500_000` (~2.5 MB of base64) → "ID proof is too large (max ~2.5MB)".
  - Must start with `data:image/`, `data:application/pdf`, `http://`, or `https://`.
  - `Normalize` trims; blank → null. (We do **not** reuse `ImageUrlValidation`
    because it rejects PDFs and caps at ~300KB.)

## 6. Frontend changes (`sms-catreadmin`)

- **Types** `src/api/types.ts`
  - `CreateClientBody`: add `id_proof_type?: 'pan' | 'aadhaar'; id_proof_url?: string;`
    (sent as required by the form; optional in the type to avoid breaking other callers).
  - `Client`: add `id_proof_type?: 'pan' | 'aadhaar' | null; id_proof_url?: string | null;`
  - Add both keys to `TENANT_KEYS`.
- **Form** `src/screens/OnboardWizard.tsx` (admin step, step 1)
  - `Form` type: add `idProofType: '' | 'pan' | 'aadhaar'; idProofUrl: string; idProofFileName: string;`
    (filename kept in component state only, for the "selected: X" label — not sent).
  - Default: `idProofType: '', idProofUrl: '', idProofFileName: ''`.
  - UI: a **select** (Select… / PAN / Aadhaar) + a **file input**
    (`accept="image/png,image/jpeg,application/pdf"`). On pick, convert to a data
    URL and store in `idProofUrl` (reuse the `fileToTeamDocument` pattern from
    `src/api/team.ts`: reject non‑allowed type / >2.5 MB, `FileReader.readAsDataURL`).
    Show the chosen filename and a "Remove" affordance.
  - `validate()` step 1: require `idProofType` and `idProofUrl`
    ("ID type is required", "ID proof document is required").
  - `submit()`: add `id_proof_type: form.idProofType, id_proof_url: form.idProofUrl`.
  - Review step: show "ID proof: PAN — document attached".
- **Read / display** `src/screens/ClientDetailScreen.tsx`
  - Add a detail row: label "ID proof", value = `PAN` / `Aadhaar` + a **View**
    link that opens `id_proof_url` in a new tab (data URLs open/download directly);
    `dash()` when absent (older records).

## 7. Testing

**Frontend (vitest):**
- OnboardWizard: cannot submit without ID type + document (validation errors shown).
- OnboardWizard: picking type + a stubbed file populates the submit body with
  `id_proof_type` + a `data:` URL.
- File helper: rejects oversized / wrong‑type files.
- ClientDetailScreen: renders the ID‑proof row + View link when present; `—` when absent.

**Backend (xUnit integration, `Sms.Tests.Integration/Catre`):**
- Create client with a valid PAN document persists and returns `IdProofType`/`IdProofUrl`.
- Invalid type or oversized/non‑document URL → `422`.
- `DocumentUrlValidation` unit tests (size cap, allowed prefixes, PDF accepted).

## 8. Compliance & security considerations

- ⚠️ **Aadhaar is sensitive PII** under India's UIDAI framework; storing full
  Aadhaar scans carries legal/retention obligations. This design stores the raw
  document like any other asset, as requested. **Recommended follow‑ups (not in
  this scope):** restrict read access to the ID‑proof field to authorized roles,
  add audit logging on view, consider encryption‑at‑rest for the column, and a
  retention/deletion policy. Flag to stakeholders before production use.
- The document is only returned on the client‑detail read path; ensure that
  endpoint is already role‑gated to Catre operators (it is, via existing RBAC).

## 9. Out of scope

- Editing/replacing the ID proof after creation (`UpdateSchoolProfileRequest`).
- A dedicated documents table / multiple ID docs (Approach B).
- OCR / number extraction / verification against government APIs.
- Encryption‑at‑rest and audit logging (noted as compliance follow‑ups).

## 10. Key files

**Backend:** `CatreContracts.cs`, the `POST /clients` controller + its DTO,
`TenancyService.cs` (+ `MeSchoolsService.cs`), `ClientRepository.cs`,
`DocumentUrlValidation.cs` (new), `M0211_Tenant_IdProof.cs` (new),
`db/postgres/04_tables.sql`, `db/postgres/*_procs.sql`.

**Frontend:** `src/api/types.ts`, `src/screens/OnboardWizard.tsx`,
`src/api/team.ts` (reuse file→dataURL helper), `src/screens/ClientDetailScreen.tsx`,
plus the matching `*.test.tsx`.
