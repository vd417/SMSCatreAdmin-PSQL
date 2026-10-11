# Admin ID-proof upload (PAN / Aadhaar) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Capture a required ID-proof document (PAN or Aadhaar) for the school admin during onboarding, persist it full-stack, and show it on the client detail screen.

**Architecture:** Follow the existing "data URL in a Postgres `text` column" pattern (no blob storage). Two scalar columns on `Tenants` (`IdProofType`, `IdProofUrl`) flow through the existing `POST /clients` → `CreateClientRequest` → `TenancyService.CreateClientAsync` → `ClientRepository` → `Client_Create` proc path. The CRM form converts the chosen file to a base64 data URL and sends it in the create body.

**Tech Stack:** .NET (C#, Dapper, FluentMigrator, Postgres, xUnit) for `sms-api`; React 18 + TypeScript + Vitest for `sms-catreadmin`.

**Spec:** `docs/superpowers/specs/2026-10-11-admin-id-proof-upload-design.md`

> **Two repos.** Backend tasks run in `D:\convert\SMS backend\sms-api`; frontend tasks run in `D:\convert\SMS backend\sms-catreadmin`. Each repo is committed independently.

## Global Constraints

- ID type is one of exactly `'pan'` or `'aadhaar'` (lowercase) everywhere — DB value, API value, UI value.
- ID-proof document is stored as a base64 **data URL** string (`data:image/...` or `data:application/pdf;...`) in a Postgres `text` column. No blob/object storage.
- Document size cap: **~2.5 MB** → data-URL string length cap **3_500_000** chars. Error code `invalid_request`, HTTP 422.
- Allowed MIME: `image/jpeg`, `image/png`, `application/pdf`.
- API JSON is snake_case: C# `IdProofType`/`IdProofUrl` ⇄ JSON `id_proof_type`/`id_proof_url`.
- FluentMigrator migrations are authored in SQL-Server syntax; the live DB is Postgres. Every schema/proc change must be made in BOTH the FluentMigrator `.cs` migration AND the canonical Postgres files (`db/postgres/04_tables.sql`, `db/postgres/10_tenancy_procs.sql`).
- Next migration number is **M0211** (highest existing is M0210).
- ID proof is **required** to create a school via the CRM onboard wizard.

## Review Focus

- **Oversized file (> 2.5 MB):** user picks a large scan → frontend rejects before upload with a clear message; backend also returns 422 if a large data URL arrives directly. (Covered: Task 7 frontend helper test, Task 5 backend 422 test.)
- **Disallowed file type (e.g. .docx, .gif):** picker rejects and shows an error; nothing is stored. (Covered: Task 7.)
- **Missing type or missing file at submit:** wizard blocks submission with field errors; backend returns 422 if only one of type/url is sent. (Covered: Task 8 validation test, Task 5 backend test.)
- **Older clients without an ID proof:** detail screen renders a dash, not a broken link; reads must tolerate null. (Covered: Task 9 test.)
- **Type present but not pan/aadhaar:** backend rejects unknown type with 422 rather than persisting garbage. (Covered: Task 5.)

---

## Task 1: `DocumentUrlValidation` backend helper

**Files:**
- Create: `src/Sms.Application/Common/DocumentUrlValidation.cs`
- Test: `tests/Sms.Tests.Unit/Common/DocumentUrlValidationTests.cs`

**Interfaces:**
- Produces: `DocumentUrlValidation.Validate(string?) : Error?` and `DocumentUrlValidation.Normalize(string?) : string?` (same shape as `ImageUrlValidation`).

- [ ] **Step 1: Write the failing test**

```csharp
using Sms.Application.Common;
using Xunit;

public class DocumentUrlValidationTests
{
    [Fact]
    public void Accepts_pdf_and_image_data_urls()
    {
        Assert.Null(DocumentUrlValidation.Validate("data:application/pdf;base64,JVBERi0="));
        Assert.Null(DocumentUrlValidation.Validate("data:image/png;base64,iVBOR"));
        Assert.Null(DocumentUrlValidation.Validate("https://example.com/id.pdf"));
    }

    [Fact]
    public void Rejects_oversize_and_wrong_prefix()
    {
        var big = "data:application/pdf;base64," + new string('A', 3_500_001);
        Assert.NotNull(DocumentUrlValidation.Validate(big));
        Assert.NotNull(DocumentUrlValidation.Validate("data:text/plain;base64,QQ=="));
        Assert.NotNull(DocumentUrlValidation.Validate("ftp://x/y.pdf"));
    }

    [Fact]
    public void Normalize_blank_becomes_null()
    {
        Assert.Null(DocumentUrlValidation.Normalize("   "));
        Assert.Equal("data:image/png;base64,A", DocumentUrlValidation.Normalize(" data:image/png;base64,A "));
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `dotnet test tests/Sms.Tests.Unit --filter DocumentUrlValidationTests`
Expected: FAIL (type `DocumentUrlValidation` does not exist / build error).

- [ ] **Step 3: Write minimal implementation**

```csharp
using Sms.Shared.Kernel.Results;

namespace Sms.Application.Common;

/// <summary>Rules for ID-proof / document fields stored as a data URL or http(s)
/// URL directly on a row (no blob storage). Permits PDF in addition to images,
/// with a larger cap than <see cref="ImageUrlValidation"/>.</summary>
public static class DocumentUrlValidation
{
    // ~2.5 MB of base64. Matches the TeamDocuments 2.5MB document limit.
    private const int MaxChars = 3_500_000;

    public static Error? Validate(string? url)
    {
        if (url is { Length: > MaxChars })
            return new Error("invalid_request", "ID proof is too large (max ~2.5MB)");
        if (url is { Length: > 0 } &&
            !url.StartsWith("data:image/", StringComparison.OrdinalIgnoreCase) &&
            !url.StartsWith("data:application/pdf", StringComparison.OrdinalIgnoreCase) &&
            !url.StartsWith("http://", StringComparison.OrdinalIgnoreCase) &&
            !url.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
            return new Error("invalid_request", "ID proof must be an image/PDF data URL or http(s) URL");
        return null;
    }

    public static string? Normalize(string? url) =>
        string.IsNullOrWhiteSpace(url) ? null : url.Trim();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `dotnet test tests/Sms.Tests.Unit --filter DocumentUrlValidationTests`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/Sms.Application/Common/DocumentUrlValidation.cs tests/Sms.Tests.Unit/Common/DocumentUrlValidationTests.cs
git commit -m "feat(api): add DocumentUrlValidation for ID-proof uploads"
```

---

## Task 2: Migration M0211 — `Tenants.IdProofType` / `IdProofUrl` + `Client_Create`

**Files:**
- Create: `db/Sms.Migrations/M0211_Tenant_IdProof.cs`
- Modify: `db/postgres/04_tables.sql` (Tenants table: add two columns)
- Modify: `db/postgres/10_tenancy_procs.sql` (Client_Create proc: add params/insert/select)

**Interfaces:**
- Produces: `dbo.Tenants.IdProofType` (`varchar(16)` null), `dbo.Tenants.IdProofUrl` (`text` null); `dbo.Client_Create` accepts `@IdProofType`, `@IdProofUrl` and projects them in its result set.

- [ ] **Step 1: Write the FluentMigrator migration**

Create `db/Sms.Migrations/M0211_Tenant_IdProof.cs`. Copy the proc body verbatim from `M0059_Tenant_LogoUrl.cs`, then add the two new columns to the param list, the INSERT column list/VALUES, and the trailing SELECT. Keep `ImageUrl` (added by M0060) and all other existing columns in place — read the CURRENT `dbo.Client_Create` body from `db/postgres/10_tenancy_procs.sql` and mirror every column it already has, adding only the two new ones.

```csharp
using FluentMigrator;

namespace Sms.Migrations;

[Migration(211, "Tenants.IdProofType / IdProofUrl for admin ID proof (PAN/Aadhaar)")]
public sealed class M0211_Tenant_IdProof : Migration
{
    public override void Up()
    {
        Alter.Table("Tenants").AddColumn("IdProofType").AsString(16).Nullable();
        Alter.Table("Tenants").AddColumn("IdProofUrl").AsString(int.MaxValue).Nullable();

        // CREATE OR ALTER dbo.Client_Create adding @IdProofType / @IdProofUrl.
        // IMPORTANT: start from the CURRENT proc body (which already includes
        // LogoUrl + ImageUrl + Address + Csm etc.), not the M0059 snapshot.
        Execute.Sql(@"
CREATE OR ALTER PROCEDURE dbo.Client_Create
    @Name nvarchar(200), @Slug nvarchar(100), @Country nvarchar(120),
    @ContactName nvarchar(200), @ContactEmail nvarchar(256), @ContactPhone nvarchar(40),
    @Address nvarchar(300), @PlanId uniqueidentifier, @Csm nvarchar(120),
    @LogoUrl nvarchar(max) = NULL, @ImageUrl nvarchar(max) = NULL,
    @IdProofType nvarchar(16) = NULL, @IdProofUrl nvarchar(max) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @Id uniqueidentifier = NEWID();
    DECLARE @PlanName nvarchar(100), @Tier nvarchar(20), @Mrr decimal(18,2),
            @LS int, @LSt int, @LStor int;
    SELECT @PlanName = p.Name, @Tier = p.Tier, @Mrr = p.Price,
           @LS = p.LimitsStudents, @LSt = p.LimitsStaff, @LStor = p.LimitsStorageGb
    FROM dbo.Plans p WHERE p.Id = @PlanId;

    INSERT dbo.Tenants (Id, Name, Slug, Status, Tier, Country, PlanId, PlanName, Mrr,
        LimitsStudents, LimitsStaff, LimitsStorageGb, ContactName, ContactEmail, ContactPhone,
        Address, LogoUrl, ImageUrl, IdProofType, IdProofUrl, Csm, HealthScore)
    VALUES (@Id, @Name, @Slug, 'trial', @Tier, @Country, @PlanId, @PlanName, ISNULL(@Mrr, 0),
        @LS, @LSt, @LStor, @ContactName, @ContactEmail, @ContactPhone,
        @Address, @LogoUrl, @ImageUrl, @IdProofType, @IdProofUrl, @Csm, 100);

    SELECT Id, Name, Slug, Country, Status, PlanId, PlanName, Tier, Mrr, StudentsCount, StaffCount, StorageGb,
           LimitsStudents, LimitsStaff, LimitsStorageGb, CreatedAt, Csm, HealthScore,
           ContactName, ContactEmail, ContactPhone, Address, LogoUrl, ImageUrl, IdProofType, IdProofUrl
    FROM dbo.Tenants WHERE Id = @Id;
END");
    }

    public override void Down()
    {
        Delete.Column("IdProofType").FromTable("Tenants");
        Delete.Column("IdProofUrl").FromTable("Tenants");
        // Restore the prior proc body (LogoUrl + ImageUrl, no IdProof) by copying
        // the CREATE OR ALTER dbo.Client_Create body from M0060_Tenant_ImageUrl.cs.
    }
}
```

- [ ] **Step 2: Update the canonical Postgres schema**

In `db/postgres/04_tables.sql`, on `"dbo"."Tenants"`, add next to `"LogoUrl" text, "ImageUrl" text`:

```sql
    "IdProofType" varchar(16),
    "IdProofUrl" text,
```

- [ ] **Step 3: Update the Postgres `Client_Create` proc**

In `db/postgres/10_tenancy_procs.sql`, find the `Client_Create` function, add `IdProofType`/`IdProofUrl` to its signature (defaulting NULL), the INSERT column list + VALUES, and the returned result columns — mirroring the FluentMigrator body above in Postgres syntax.

- [ ] **Step 4: Run the migration + schema build to verify it applies**

Run the project's DB bring-up (e.g. `dotnet run --project tools/Sms.DevSeed` or the integration-test harness that applies migrations). 
Expected: migrations apply with no error; `Tenants` has the two new columns.

- [ ] **Step 5: Commit**

```bash
git add db/Sms.Migrations/M0211_Tenant_IdProof.cs db/postgres/04_tables.sql db/postgres/10_tenancy_procs.sql
git commit -m "feat(api): add Tenants.IdProofType/IdProofUrl columns + Client_Create params (M0211)"
```

---

## Task 3: Contracts — add ID-proof fields to Client records

**Files:**
- Modify: `src/Sms.Modules.Tenancy/Contracts/CatreContracts.cs`

**Interfaces:**
- Consumes: nothing.
- Produces: `CreateClientRequest.IdProofType`/`IdProofUrl`, `ClientRow.IdProofType`/`IdProofUrl`, `ClientResponse.IdProofType`/`IdProofUrl` (all `string?`, default null).

- [ ] **Step 1: Add fields to the three records**

In `CreateClientRequest` (after `ImageUrl`):
```csharp
public sealed record CreateClientRequest(
    string Name, string Slug, string? Country, string? AdminName, string? AdminEmail,
    string? AdminPhone, Guid PlanId, int TrialDays, string? Csm, string? Address = null,
    string? LogoUrl = null, string? ImageUrl = null,
    string? IdProofType = null, string? IdProofUrl = null);
```
In `ClientRow` (after `ImageUrl`):
```csharp
    string? LogoUrl = null, string? ImageUrl = null,
    string? IdProofType = null, string? IdProofUrl = null);
```
In `ClientResponse` (after `ImageUrl`):
```csharp
    string? LogoUrl = null, string? ImageUrl = null,
    string? IdProofType = null, string? IdProofUrl = null);
```

- [ ] **Step 2: Build to verify compilation**

Run: `dotnet build src/Sms.Modules.Tenancy`
Expected: builds (the mapping from `ClientRow` → `ClientResponse` in `TenancyService` will need the new fields in Task 4/5; if the mapper is positional it already compiles, if it is explicit it is updated in Task 5).

- [ ] **Step 3: Commit**

```bash
git add src/Sms.Modules.Tenancy/Contracts/CatreContracts.cs
git commit -m "feat(api): add IdProofType/IdProofUrl to client contracts"
```

---

## Task 4: Repository — persist + read the new columns

**Files:**
- Modify: `src/Sms.Modules.Tenancy/Data/ClientRepository.cs`

**Interfaces:**
- Consumes: `CreateClientRequest`/`ClientRow` from Task 3.
- Produces: `CreateAsync` passes `IdProofType`/`IdProofUrl` to `dbo.Client_Create`; `SelectLive` projects `t."IdProofType", t."IdProofUrl"`.

- [ ] **Step 1: Add the params to the Client_Create call**

In `CreateAsync`, extend the anonymous param object passed to `QuerySingleProcAsync<ClientRow>("dbo.Client_Create", new { ... })` to include `r.IdProofType, r.IdProofUrl` alongside `r.LogoUrl, r.ImageUrl`.

- [ ] **Step 2: Add the columns to SelectLive**

In the `SelectLive` SQL, add `t."IdProofType", t."IdProofUrl"` to the column list next to `t."LogoUrl", t."ImageUrl"`, so reads (list/detail) return them and Dapper maps them onto `ClientRow`.

- [ ] **Step 3: Build**

Run: `dotnet build src/Sms.Modules.Tenancy`
Expected: builds.

- [ ] **Step 4: Commit**

```bash
git add src/Sms.Modules.Tenancy/Data/ClientRepository.cs
git commit -m "feat(api): persist and read IdProof columns in ClientRepository"
```

---

## Task 5: Service validation + integration test

**Files:**
- Modify: `src/Sms.Application/Services/Tenancy/TenancyService.cs` (`CreateClientAsync`, ~line 103)
- Test: `tests/Sms.Tests.Integration/Catre/CatreClientsTests.cs`

**Interfaces:**
- Consumes: `DocumentUrlValidation` (Task 1), `CreateClientRequest` (Task 3), `ClientRepository` (Task 4).
- Produces: `POST /clients` persists `id_proof_type`/`id_proof_url` and returns them; rejects bad input with 422.

- [ ] **Step 1: Write the failing integration test**

Add to `CatreClientsTests.cs` (match the file's existing helper for authenticated catre requests and the create payload shape it already uses):
```csharp
[Fact]
public async Task Create_client_persists_id_proof()
{
    var body = CatreCreateBody(name: "Greenwood High", slug: "greenwood-high");
    body["id_proof_type"] = "pan";
    body["id_proof_url"] = "data:application/pdf;base64,JVBERi0=";

    var res = await PostCatre("/v1/clients", body);
    res.EnsureSuccessStatusCode();
    var json = await res.Content.ReadFromJsonAsync<JsonElement>();
    Assert.Equal("pan", json.GetProperty("id_proof_type").GetString());
    Assert.StartsWith("data:application/pdf", json.GetProperty("id_proof_url").GetString());
}

[Fact]
public async Task Create_client_rejects_bad_id_proof_type()
{
    var body = CatreCreateBody(name: "Bad Type", slug: "bad-type");
    body["id_proof_type"] = "passport";
    body["id_proof_url"] = "data:application/pdf;base64,JVBERi0=";

    var res = await PostCatre("/v1/clients", body);
    Assert.Equal(HttpStatusCode.UnprocessableEntity, res.StatusCode);
}

[Fact]
public async Task Create_client_rejects_oversize_id_proof()
{
    var body = CatreCreateBody(name: "Too Big", slug: "too-big");
    body["id_proof_type"] = "pan";
    body["id_proof_url"] = "data:application/pdf;base64," + new string('A', 3_500_001);

    var res = await PostCatre("/v1/clients", body);
    Assert.Equal(HttpStatusCode.UnprocessableEntity, res.StatusCode);
}
```
> If `CatreCreateBody` / `PostCatre` helpers don't exist by those names, use the file's existing equivalents — read the other `CatreClientsTests` methods first and mirror them.

- [ ] **Step 2: Run to verify it fails**

Run: `dotnet test tests/Sms.Tests.Integration --filter CatreClientsTests`
Expected: the three new tests FAIL (values not persisted / not rejected).

- [ ] **Step 3: Add validation in `CreateClientAsync`**

At the start of `CreateClientAsync` (before/after `AllocateUniqueSlugAsync`, line ~105), add:
```csharp
if (!string.IsNullOrWhiteSpace(req.IdProofType) &&
    req.IdProofType is not ("pan" or "aadhaar"))
    return ApiResult<ClientResponse>.Fail(
        new Error("invalid_request", "ID proof type must be 'pan' or 'aadhaar'"), 422);
if (DocumentUrlValidation.Validate(req.IdProofUrl) is { } idErr)
    return ApiResult<ClientResponse>.Fail(idErr, 422);
var create = req with {
    Slug = slug,
    IdProofType = string.IsNullOrWhiteSpace(req.IdProofType) ? null : req.IdProofType,
    IdProofUrl = DocumentUrlValidation.Normalize(req.IdProofUrl),
};
```
(Replace the existing `var create = req with { Slug = slug };` line.) Add `using Sms.Application.Common;` if missing. If `ClientRow` → `ClientResponse` mapping is explicit anywhere in this file, add `IdProofType`/`IdProofUrl` to it.

- [ ] **Step 4: Run to verify tests pass**

Run: `dotnet test tests/Sms.Tests.Integration --filter CatreClientsTests`
Expected: PASS (including the three new tests). Then run the unit suite: `dotnet test tests/Sms.Tests.Unit --filter DocumentUrlValidationTests` — PASS.

- [ ] **Step 5: Commit**

```bash
git add src/Sms.Application/Services/Tenancy/TenancyService.cs tests/Sms.Tests.Integration/Catre/CatreClientsTests.cs
git commit -m "feat(api): validate and persist admin ID proof on client create"
```

---

## Task 6: Frontend types — create body, Client, tenant keys

**Files:**
- Modify: `src/api/types.ts` (`CreateClientBody` ~line 127, `Client` ~line 97, `TENANT_KEYS` ~line 34)

**Interfaces:**
- Produces: `CreateClientBody.id_proof_type?`/`id_proof_url?`; `Client.id_proof_type`/`id_proof_url`; `TENANT_KEYS` includes both.

- [ ] **Step 1: Extend `CreateClientBody`**

```ts
export interface CreateClientBody {
  name: string; slug: string; country: string; size: string;
  admin_name: string; admin_email: string; admin_phone: string;
  plan_id: string; trial_days: number;
  address?: string; status?: ClientStatus; csm?: string | null;
  id_proof_type?: 'pan' | 'aadhaar';
  id_proof_url?: string;
}
```

- [ ] **Step 2: Extend the `Client` type and `TENANT_KEYS`**

On the `Client` interface (the one with `id, name, slug, country, status, ...`), add:
```ts
  id_proof_type?: 'pan' | 'aadhaar' | null;
  id_proof_url?: string | null;
```
In `TENANT_KEYS`, append `'id_proof_type','id_proof_url'` to the array.

- [ ] **Step 3: Typecheck**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/api/types.ts
git commit -m "feat(catreadmin): add id_proof fields to client types"
```

---

## Task 7: File → data-URL helper for ID proof

**Files:**
- Modify: `src/api/team.ts` (add `fileToIdProof` beside `fileToTeamDocument`)
- Test: `src/api/team.test.ts` (or a new `src/api/idProof.test.ts` if team.ts has no test wiring for files)

**Interfaces:**
- Produces: `fileToIdProof(file: File): Promise<string>` — resolves to a `data:` URL, rejects on wrong type or > 2.5 MB.

- [ ] **Step 1: Write the failing test**

```ts
import { fileToIdProof } from './team';

const makeFile = (type: string, size: number) =>
  new File([new Uint8Array(size)], 'x', { type });

it('rejects a non-image/pdf file', async () => {
  await expect(fileToIdProof(makeFile('text/plain', 10))).rejects.toThrow();
});

it('rejects a file over 2.5MB', async () => {
  await expect(fileToIdProof(makeFile('application/pdf', 2.5 * 1024 * 1024 + 1))).rejects.toThrow();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/api/team.test.ts`
Expected: FAIL (`fileToIdProof` is not exported).

- [ ] **Step 3: Implement the helper**

Add to `src/api/team.ts` (mirror the existing `fileToTeamDocument` structure — FileReader.readAsDataURL):
```ts
const ID_PROOF_MAX_BYTES = 2.5 * 1024 * 1024;
const ID_PROOF_ACCEPT = ['image/jpeg', 'image/png', 'application/pdf'];

export function fileToIdProof(file: File): Promise<string> {
  if (!ID_PROOF_ACCEPT.includes(file.type)) {
    return Promise.reject(new Error('ID proof must be a JPEG, PNG, or PDF file.'));
  }
  if (file.size > ID_PROOF_MAX_BYTES) {
    return Promise.reject(new Error('ID proof must be 2.5MB or smaller.'));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read the file.'));
    reader.readAsDataURL(file);
  });
}
```
Export `ID_PROOF_ACCEPT` too (the form uses it for the `accept` attribute).

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/api/team.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/api/team.ts src/api/team.test.ts
git commit -m "feat(catreadmin): add fileToIdProof data-URL helper"
```

---

## Task 8: OnboardWizard — type picker, upload, validation, submit

**Files:**
- Modify: `src/screens/OnboardWizard.tsx`
- Test: `src/screens/OnboardWizard.test.tsx`

**Interfaces:**
- Consumes: `fileToIdProof`, `ID_PROOF_ACCEPT` (Task 7); `CreateClientBody` (Task 6).
- Produces: admin step collects `idProofType` + `idProofUrl`; `submit()` includes `id_proof_type` + `id_proof_url`.

- [ ] **Step 1: Write the failing validation test**

Add to `OnboardWizard.test.tsx` (mirror the existing step-navigation helpers in that file):
```tsx
it('requires an ID proof type and document on the admin step', async () => {
  const user = userEvent.setup();
  renderWizard();
  await user.type(screen.getByPlaceholderText('e.g. Greenwood High'), 'Greenwood');
  fireEvent.click(screen.getByText('Continue')); // -> admin step
  await user.type(screen.getByPlaceholderText('e.g. Priya Sharma'), 'Priya');
  await user.type(screen.getByPlaceholderText('admin@school.edu'), 'a@b.com');
  fireEvent.click(screen.getByText('Continue')); // try to advance
  expect(screen.getByText('ID proof document is required')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/screens/OnboardWizard.test.tsx`
Expected: FAIL (no such validation text).

- [ ] **Step 3: Add form state + fields**

- Extend the `Form` type: `idProofType: '' | 'pan' | 'aadhaar'; idProofUrl: string;` and add a component-local `const [idProofName, setIdProofName] = useState('')` for the chosen filename label (not submitted).
- Add to the initial `form` state: `idProofType: '', idProofUrl: ''`.
- In the admin step (step 1 JSX), after the Phone field, add:
```tsx
<div className="field">
  <label>ID proof type</label>
  <select className="select" value={form.idProofType}
          onChange={e => set('idProofType', e.target.value)}>
    <option value="">Select…</option>
    <option value="pan">PAN</option>
    <option value="aadhaar">Aadhaar</option>
  </select>
  {errors.idProofType && <span className="error">{errors.idProofType}</span>}
</div>
<div className="field">
  <label>ID proof document</label>
  <input type="file" accept={ID_PROOF_ACCEPT.join(',')}
    onChange={async e => {
      const f = e.target.files?.[0];
      if (!f) return;
      try {
        const url = await fileToIdProof(f);
        set('idProofUrl', url);
        setIdProofName(f.name);
        setErrors(x => ({ ...x, idProofUrl: '' }));
      } catch (err) {
        setErrors(x => ({ ...x, idProofUrl: (err as Error).message }));
      }
    }} />
  {idProofName && <span className="hint">Attached: {idProofName}</span>}
  {errors.idProofUrl && <span className="error">{errors.idProofUrl}</span>}
  <span className="hint">PAN or Aadhaar — JPG, PNG, or PDF, up to ~2.5MB.</span>
</div>
```
- In `validate()` for `step === 1`, add:
```ts
if (!form.idProofType) e.idProofType = 'ID type is required';
if (!form.idProofUrl) e.idProofUrl = 'ID proof document is required';
```
- In `submit()`, add to the body: `id_proof_type: form.idProofType || undefined, id_proof_url: form.idProofUrl || undefined`.
- Add imports: `import { fileToIdProof, ID_PROOF_ACCEPT } from '../api/team';`

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/screens/OnboardWizard.test.tsx`
Expected: PASS (new test + existing tests). Then `npx tsc -b` — no errors.

- [ ] **Step 5: Commit**

```bash
git add src/screens/OnboardWizard.tsx src/screens/OnboardWizard.test.tsx
git commit -m "feat(catreadmin): capture required admin ID proof in onboard wizard"
```

---

## Task 9: ClientDetailScreen — display the ID proof

**Files:**
- Modify: `src/screens/ClientDetailScreen.tsx`
- Test: `src/screens/ClientDetailScreen.test.tsx`

**Interfaces:**
- Consumes: `Client.id_proof_type`/`id_proof_url` (Task 6).

- [ ] **Step 1: Write the failing test**

Add to `ClientDetailScreen.test.tsx` (mirror the file's existing mock for `detail.data`):
```tsx
it('shows the ID proof with a view link when present', async () => {
  // arrange detail.data with id_proof_type: 'pan', id_proof_url: 'data:application/pdf;base64,AAA'
  // (extend the existing detail mock used by other tests in this file)
  renderDetail();
  expect(await screen.findByText('ID proof')).toBeInTheDocument();
  const link = screen.getByRole('link', { name: /view/i });
  expect(link).toHaveAttribute('href', 'data:application/pdf;base64,AAA');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/screens/ClientDetailScreen.test.tsx`
Expected: FAIL (no "ID proof" row).

- [ ] **Step 3: Add the detail row**

Next to the existing `<Detail label="Workspace URL" ... />` row, add:
```tsx
<Detail
  label="ID proof"
  value={
    detail.data.id_proof_url
      ? <span className="row gap8">
          <span>{detail.data.id_proof_type === 'aadhaar' ? 'Aadhaar' : 'PAN'}</span>
          <a href={detail.data.id_proof_url} target="_blank" rel="noopener noreferrer">View</a>
        </span>
      : dash(null)
  }
/>
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/screens/ClientDetailScreen.test.tsx`
Expected: PASS. Then run the full frontend suite: `npx vitest run` — all green; and `npx tsc -b`.

- [ ] **Step 5: Commit**

```bash
git add src/screens/ClientDetailScreen.tsx src/screens/ClientDetailScreen.test.tsx
git commit -m "feat(catreadmin): show admin ID proof on client detail"
```

---

## Final verification

- [ ] Backend: `dotnet test tests/Sms.Tests.Unit && dotnet test tests/Sms.Tests.Integration --filter CatreClientsTests` — all green.
- [ ] Frontend: `npx tsc -b && npx vitest run` — all green.
- [ ] Manual: onboard a school with a PAN PDF → appears on client detail with a working View link; try >2.5MB and a .docx → both rejected in the form.
