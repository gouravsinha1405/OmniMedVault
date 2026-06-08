# OmniMedVault — Engineering Specifications

**Version:** 1.1 | **Date:** 2026-06-08 | **Status:** Phase 1A Active — Vaccination Tracker module added

> This document is the authoritative engineering spec for implementation. It translates `SYSTEM_DESIGN_OmniMedVault.md` and `OMNIMEDVAULT_CONSTITUTION.md` into precise, implementable contracts for every module. A developer picking up any spec here should be able to implement it without referring back to the design doc for clarification.
>
> Specs are numbered `S{nn}` and grouped by phase. Phase 1A specs are implementation-ready. Phase 1B and Phase 2 specs are outline-level — detailed specs are written when that phase begins.

---

## Table of Contents

**Phase 1A — Core Product (Months 1–6)**
- [S01 — Auth](#s01--auth)
- [S02 — Patient Profile](#s02--patient-profile)
- [S03 — Doctor Profile & NMC Verification](#s03--doctor-profile--nmc-verification)
- [S04 — Document Upload & Storage](#s04--document-upload--storage)
- [S05 — OCR Pipeline](#s05--ocr-pipeline)
- [S06 — Medical Specialties](#s06--medical-specialties)
- [S07 — Search](#s07--search)
- [S08 — Consent Lifecycle](#s08--consent-lifecycle)
- [S09 — Prescriptions](#s09--prescriptions)
- [S10 — Notifications](#s10--notifications)
- [S11 — Institution Onboarding & CRM Widget](#s11--institution-onboarding--crm-widget)
- [S12 — Emergency QR Code](#s12--emergency-qr-code)
- [S13 — Financial Tracking & Illness Episodes (Premium)](#s13--financial-tracking--illness-episodes-premium)
- [S19 — Vaccination Tracker](#s19--vaccination-tracker)

**Phase 1B — AI Health Insights (Months 5–8)**
- [S14 — AI Health Insights Engine](#s14--ai-health-insights-engine)

**Phase 2 — Scale & Ecosystem (Months 9–18)**
- [S15 — Family Medical Proxy](#s15--family-medical-proxy)
- [S16 — Natural Language Query Interface](#s16--natural-language-query-interface)
- [S17 — SOS Emergency Feature](#s17--sos-emergency-feature)
- [S18 — Family Account Management](#s18--family-account-management)

---

## Spec Conventions

### Authentication Headers
All protected endpoints require:
```
Authorization: Bearer <JWT access token>
```
Exceptions noted per spec.

### Guards Applied
Each endpoint table lists which NestJS guards apply. Guards execute in this order:
1. `JwtAuthGuard` — validates JWT, injects `req.user`
2. `RolesGuard` — checks `@Roles()` decorator against `req.user.role`
3. `NmcVerifiedGuard` — checks `doctor.nmcVerified === true` (prescription endpoints only)
4. `ConsentGuard` — checks active consent row for cross-patient data access
5. `PremiumGuard` — checks `patient.subscriptionTier === 'PREMIUM'`

### Standard Error Response
```json
{
  "errorResponse": {
    "errorCode": 1005,
    "description": "Human-readable message"
  }
}
```

### Standard List Response
```json
{
  "data": [ /* array of resource objects */ ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 145,
    "totalPages": 8
  }
}
```

### UUID Generation
All `id` fields are UUID v4, generated in TypeScript via `uuid` package in the entity's `@BeforeInsert()` hook. Never use `gen_random_uuid()` in PostgreSQL.

---

---

## S01 — Auth

**Module:** `src/modules/auth/`
**Functional Requirements:** FR01
**Priority:** P0 — all other specs depend on this

### Overview

OTP-based authentication for both patients and doctors using AWS Cognito. No passwords. Phone number is the identity anchor. JWT access tokens (15-minute expiry) and refresh tokens (30-day expiry) are issued after OTP verification.

### Business Rules

| Rule | Detail |
|------|--------|
| BR-A01 | OTP is 6 digits, expires in 10 minutes, single-use |
| BR-A02 | Maximum 5 OTP requests per phone number per hour; 429 returned on breach |
| BR-A03 | JWT access token lifespan: 15 minutes |
| BR-A04 | Refresh token lifespan: 30 days |
| BR-A05 | Refresh token is one-time use; a new refresh token is issued on each refresh call (rotation) |
| BR-A06 | Logout invalidates the refresh token in Cognito; existing access tokens remain valid until expiry (stateless JWTs) |
| BR-A07 | On first OTP verification for a new phone number, a `PATIENT` account is created automatically |
| BR-A08 | Doctor registration is a separate flow (S03) after the initial OTP-based account creation |
| BR-A09 | JWT payload: `{ sub: userId, role: 'PATIENT'|'DOCTOR'|'HOSPITAL_ADMIN'|'PLATFORM_ADMIN', institutionId?: string, iat, exp }` |

### API Contracts

---

#### `POST /api/v1/auth/otp/request`

Sends a 6-digit OTP to the provided phone number via AWS Cognito / SNS.

**Auth:** None  
**Guards:** None

**Request Body:**
```typescript
{
  phone: string;    // E.164 format: "+919876543210"; validated by regex
}
```

**Response `202 Accepted`:**
```typescript
{
  message: string;           // "OTP sent to +919876543210"
  expiresInSeconds: number;  // 600
}
```

**Error Scenarios:**

| Condition | errorCode | HTTP |
|-----------|-----------|------|
| Invalid phone format | 1005 | 400 |
| Rate limit exceeded (> 5 requests/hour) | 1000 | 429 |
| Cognito / SNS unavailable | 2001 | 503 |

---

#### `POST /api/v1/auth/otp/verify`

Verifies the OTP. Creates a patient account if the phone number is new. Returns JWT pair.

**Auth:** None  
**Guards:** None

**Request Body:**
```typescript
{
  phone: string;   // E.164 format
  otp: string;     // 6-digit numeric string
}
```

**Response `200 OK`:**
```typescript
{
  accessToken: string;      // JWT, 15-minute expiry
  refreshToken: string;     // opaque token, 30-day expiry
  expiresIn: number;        // 900 (seconds)
  user: {
    id: string;             // UUID
    role: 'PATIENT' | 'DOCTOR' | 'HOSPITAL_ADMIN' | 'PLATFORM_ADMIN';
    isNewUser: boolean;     // true if account was just created
  };
}
```

**Error Scenarios:**

| Condition | errorCode | HTTP |
|-----------|-----------|------|
| OTP incorrect | 1001 | 401 |
| OTP expired | 1001 | 401 |
| Phone not found (OTP not requested first) | 1003 | 404 |

---

#### `POST /api/v1/auth/token/refresh`

Issues a new access token and rotates the refresh token.

**Auth:** None  
**Guards:** None

**Request Body:**
```typescript
{
  refreshToken: string;
}
```

**Response `200 OK`:**
```typescript
{
  accessToken: string;
  refreshToken: string;   // new rotated token
  expiresIn: number;      // 900
}
```

**Error Scenarios:**

| Condition | errorCode | HTTP |
|-----------|-----------|------|
| Refresh token invalid or expired | 1001 | 401 |
| Refresh token already used (replay) | 1001 | 401 |

---

#### `POST /api/v1/auth/logout`

Invalidates the refresh token in Cognito.

**Auth:** Bearer JWT  
**Guards:** `JwtAuthGuard`

**Request Body:**
```typescript
{
  refreshToken: string;
}
```

**Response `204 No Content`:** (empty body)

---

### Database

```sql
-- Auth state managed by AWS Cognito.
-- Only the internal userId mapping is stored locally.
users
  id          VARCHAR(36)  PRIMARY KEY    -- UUID v4, generated in TypeScript
  cognito_sub VARCHAR(255) NOT NULL UNIQUE -- Cognito user pool sub (internal link)
  role        VARCHAR(20)  NOT NULL        -- PATIENT | DOCTOR | HOSPITAL_ADMIN | PLATFORM_ADMIN
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
  is_active   BOOLEAN      NOT NULL DEFAULT TRUE
```

### Acceptance Criteria

- [ ] OTP request does not reveal whether a phone is already registered
- [ ] 6th OTP request within an hour returns 429 (not 500)
- [ ] Expired OTP returns 401 with clear description
- [ ] New user `isNewUser: true` triggers onboarding flow on client
- [ ] Refresh token rotation: using an old refresh token after rotation returns 401

---

---

## S02 — Patient Profile

**Module:** `src/modules/users/`  
**Functional Requirements:** FR01, FR05  
**Priority:** P0

### Overview

Patient profile stores personal information, blood group, known allergies, and ABHA ID (optional). PHI fields (`phone`, `name`, `dateOfBirth`, `allergies`, `abhaId`) are encrypted at the column level via KMS. The profile is created automatically on first OTP verification (BR-A07).

### Business Rules

| Rule | Detail |
|------|--------|
| BR-P01 | Patient profile is created with `name = null`, `dateOfBirth = null` on account creation — patient completes profile in onboarding |
| BR-P02 | `phone` is immutable after creation — it is the identity anchor |
| BR-P03 | `bloodGroup` and `allergies` are used in the Emergency QR and Active Medication card — must always reflect the patient's current state |
| BR-P04 | `subscriptionTier` defaults to `FREE`; updated by the billing system when a Premium subscription is activated |
| BR-P05 | Soft-delete via `isActive = false`; data retained per DPDPA 2023 (7 years after deletion request) |
| BR-P06 | `abhaId` is optional in Phase 1; ABHA integration is Phase 2 |

### API Contracts

---

#### `GET /api/v1/patients/me`

Returns the authenticated patient's profile.

**Auth:** Bearer JWT  
**Guards:** `JwtAuthGuard`, `RolesGuard(['PATIENT'])`

**Response `200 OK`:**
```typescript
{
  id: string;
  name: string | null;
  gender: 'MALE' | 'FEMALE' | 'OTHER' | null;
  dateOfBirth: string | null;     // "YYYY-MM-DD"
  bloodGroup: string | null;      // "A+" | "A-" | "B+" | "B-" | "O+" | "O-" | "AB+" | "AB-"
  allergies: string[];            // ["Penicillin", "Aspirin"]
  abhaId: string | null;
  subscriptionTier: 'FREE' | 'PREMIUM';
  createdAt: string;              // ISO 8601
  updatedAt: string;
}
```

---

#### `PUT /api/v1/patients/me`

Updates patient profile fields. Partial update — only provided fields are changed.

**Auth:** Bearer JWT  
**Guards:** `JwtAuthGuard`, `RolesGuard(['PATIENT'])`

**Request Body:**
```typescript
{
  name?: string;               // 2–100 chars
  gender?: 'MALE' | 'FEMALE' | 'OTHER';
  dateOfBirth?: string;        // "YYYY-MM-DD"; must be a past date
  bloodGroup?: 'A+' | 'A-' | 'B+' | 'B-' | 'O+' | 'O-' | 'AB+' | 'AB-';
  allergies?: string[];        // max 50 entries; each max 100 chars
  abhaId?: string;             // 14-digit ABHA format, optional
}
```

**Response `200 OK`:** Same shape as `GET /api/v1/patients/me`

**Error Scenarios:**

| Condition | errorCode | HTTP |
|-----------|-----------|------|
| `dateOfBirth` is a future date | 1005 | 400 |
| `abhaId` format invalid | 1005 | 400 |

---

#### `GET /api/v1/patients/me/timeline`

Returns the patient's medical history in reverse-chronological order.

**Auth:** Bearer JWT  
**Guards:** `JwtAuthGuard`, `RolesGuard(['PATIENT'])`

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | integer | 1 | Pagination page |
| `pageSize` | integer | 20 | Max 100 |
| `from` | string | — | ISO 8601 date filter start |
| `to` | string | — | ISO 8601 date filter end |
| `type` | string | — | `PRESCRIPTION \| LAB_REPORT \| RECEIPT \| OTHER` |
| `specialty` | string | — | Specialty code e.g. `OPHTHALMOLOGY` |

**Response `200 OK`:**
```typescript
{
  data: Array<{
    id: string;
    type: 'PRESCRIPTION' | 'LAB_REPORT' | 'RECEIPT' | 'OTHER';
    source: 'PATIENT_UPLOAD' | 'DOCTOR_CREATED' | 'LAB_UPLOAD';
    documentDate: string;         // "YYYY-MM-DD" — date on the document
    uploadedAt: string;           // ISO 8601
    tags: string[];
    doctorName: string | null;    // OCR-extracted or from doctor profile
    doctorSpecialty: string | null; // e.g. "Ophthalmology (Eye)"
    ocrStatus: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REVIEW_NEEDED';
    thumbnailUrl: string | null;  // CloudFront pre-signed thumbnail URL, 1-hour expiry
  }>;
  pagination: { page, pageSize, total, totalPages };
}
```

---

#### `GET /api/v1/patients/me/audit-log`

Returns the patient's immutable access log — every time a doctor, proxy, or the system accessed their records.

**Auth:** Bearer JWT  
**Guards:** `JwtAuthGuard`, `RolesGuard(['PATIENT'])`

**Query Parameters:** `page`, `pageSize`, `from`, `to`

**Response `200 OK`:**
```typescript
{
  data: Array<{
    id: string;
    actorName: string;              // "Dr. Priya Sharma" or "Rahul Kumar (Proxy)"
    actorRole: 'DOCTOR' | 'FAMILY_PROXY' | 'SYSTEM';
    action: 'VIEW' | 'DOWNLOAD' | 'PRESCRIBE' | 'QUERY';
    resourceType: 'DOCUMENT' | 'PRESCRIPTION' | 'PROFILE' | 'TIMELINE';
    resourceId: string | null;
    timestamp: string;              // ISO 8601
  }>;
  pagination: { page, pageSize, total, totalPages };
}
```

---

### Database

```sql
patients
  id                 VARCHAR(36)   PRIMARY KEY
  user_id            VARCHAR(36)   NOT NULL UNIQUE  REFERENCES users(id)
  phone              TEXT          NOT NULL          -- encrypted (KMS)
  name               TEXT                            -- encrypted (KMS); nullable
  date_of_birth      TEXT                            -- encrypted (KMS); stored as "YYYY-MM-DD"
  gender             VARCHAR(10)
  blood_group        VARCHAR(5)
  allergies          TEXT                            -- encrypted (KMS); stored as JSON array string
  abha_id            TEXT                            -- encrypted (KMS); nullable
  subscription_tier  VARCHAR(10)   NOT NULL DEFAULT 'FREE'  -- FREE | PREMIUM
  created_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW()
  updated_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW()
  is_active          BOOLEAN       NOT NULL DEFAULT TRUE
```

### Acceptance Criteria

- [ ] `phone` is stored encrypted; reading it back returns the original value
- [ ] `GET /api/v1/patients/me/audit-log` only shows entries for the authenticated patient
- [ ] Timeline returns results ordered by `document_date DESC`
- [ ] `specialty` filter on timeline resolves `OPHTHALMOLOGY` → matches documents tagged with that specialty
- [ ] No PHI field appears in any log line during profile create or update

---

---

## S03 — Doctor Profile & NMC Verification

**Module:** `src/modules/users/`  
**Functional Requirements:** FR11, FR14, FR15  
**Priority:** P0

### Overview

Doctors register separately after creating a phone-based account. They provide their NMC registration number and specialisation. The account enters `PENDING` verification immediately and is fully usable for viewing consented records and adding notes. Prescription creation is locked until NMC verification completes asynchronously.

### Business Rules

| Rule | Detail |
|------|--------|
| BR-D01 | Doctor account state immediately after registration: `nmcVerified = false`; can view consented records, search, add notes |
| BR-D02 | `POST /api/v1/prescriptions` returns `HTTP 403 / errorCode 1007` if `nmcVerified = false` |
| BR-D03 | NMC verification is triggered async at registration time; the background job calls the NMC public lookup API |
| BR-D04 | On successful NMC verification: `nmcVerified = true`; push notification sent to doctor: "Your NMC ID has been verified — you can now create digital prescriptions" |
| BR-D05 | On NMC verification failure: `nmcVerified` stays `false`; doctor notified; platform admin alerted for manual review |
| BR-D06 | A doctor without an `institutionId` is an independent practitioner — uses mobile/web interface, not the CRM widget |
| BR-D07 | `specialtyId` must reference a valid, active row in `medical_specialties` |
| BR-D08 | `subSpecialty` is free-text (e.g. "Spine Surgery" under Orthopedics); max 100 chars; optional |

### API Contracts

---

#### `POST /api/v1/doctors/register`

Registers the authenticated user as a doctor. The user must have already completed OTP verification (have a valid JWT with role `PATIENT`). On success, the user's role is updated to `DOCTOR`.

**Auth:** Bearer JWT  
**Guards:** `JwtAuthGuard`, `RolesGuard(['PATIENT'])` — only a non-doctor account can register as a doctor

**Request Body:**
```typescript
{
  nmcId: string;            // 7–10 digit alphanumeric NMC registration number
  specialtyId: string;      // UUID of a valid medical_specialties row
  subSpecialty?: string;    // optional; max 100 chars
  fullName: string;         // 2–100 chars
  institutionId?: string;   // UUID; optional — links to an institution if known
}
```

**Response `201 Created`:**
```typescript
{
  id: string;               // doctor UUID
  nmcId: string;
  nmcVerified: boolean;     // always false at creation
  specialty: {
    id: string;
    code: string;           // "OPHTHALMOLOGY"
    displayName: string;    // "Ophthalmology (Eye)"
  };
  subSpecialty: string | null;
  institutionId: string | null;
  verificationStatus: 'PENDING';
  createdAt: string;
}
```

**Error Scenarios:**

| Condition | errorCode | HTTP |
|-----------|-----------|------|
| `nmcId` format invalid | 1005 | 400 |
| `specialtyId` not found or inactive | 1003 | 404 |
| Doctor profile already exists for this user | 1004 | 409 |
| `institutionId` not found | 1003 | 404 |

---

#### `GET /api/v1/doctors/me`

Returns the authenticated doctor's profile.

**Auth:** Bearer JWT  
**Guards:** `JwtAuthGuard`, `RolesGuard(['DOCTOR'])`

**Response `200 OK`:**
```typescript
{
  id: string;
  nmcId: string;
  nmcVerified: boolean;
  verificationStatus: 'PENDING' | 'VERIFIED' | 'FAILED';
  specialty: { id, code, displayName };
  subSpecialty: string | null;
  institutionId: string | null;
  fullName: string;
  createdAt: string;
  updatedAt: string;
}
```

---

#### `GET /api/v1/doctors/:doctorId/patients`

Returns the list of patients who have granted this doctor active consent.

**Auth:** Bearer JWT  
**Guards:** `JwtAuthGuard`, `RolesGuard(['DOCTOR'])`  
Note: a doctor can only view their own patient list (`doctorId` in path must equal `req.user.sub`)

**Query Parameters:** `page`, `pageSize`

**Response `200 OK`:**
```typescript
{
  data: Array<{
    patientId: string;
    name: string | null;             // decrypted from patient profile
    consentGrantedAt: string;        // ISO 8601
    consentExpiresAt: string | null; // null = permanent
    consentScope: 'FULL' | 'SPECIALTY' | 'CUSTOM';
    activeMedicationsCount: number;
    lastVisitDate: string | null;    // date of most recent document
  }>;
  pagination: { page, pageSize, total, totalPages };
}
```

---

### Background Job: NMC Verification

**Trigger:** Fired via SQS message immediately after `POST /api/v1/doctors/register` returns.  
**Worker:** `src/modules/users/workers/nmc-verification.worker.ts`

```
SQS message received: { doctorId, nmcId }
  │
  ▼
Call NMC public lookup API: GET https://nmc.org.in/api/doctor/{nmcId}
  │
  ├── 200 OK & data matches → update doctors SET nmc_verified = true
  │                         → publish 'doctor.verified' event
  │                         → notification: "NMC verified — prescriptions unlocked"
  │
  ├── 200 OK & no match    → nmc_verified stays false
  │                         → notification: "NMC ID could not be verified — contact support"
  │                         → alert PLATFORM_ADMIN for manual review
  │
  └── Network error / 5xx  → retry (exponential backoff, 3 attempts)
                            → if all retries fail → alert PLATFORM_ADMIN
```

---

### Database

```sql
doctors
  id              VARCHAR(36)  PRIMARY KEY
  user_id         VARCHAR(36)  NOT NULL UNIQUE  REFERENCES users(id)
  nmc_id          VARCHAR(20)  NOT NULL UNIQUE
  nmc_verified    BOOLEAN      NOT NULL DEFAULT FALSE
  verification_status VARCHAR(10) NOT NULL DEFAULT 'PENDING'  -- PENDING | VERIFIED | FAILED
  specialty_id    VARCHAR(36)  NOT NULL  REFERENCES medical_specialties(id)
  sub_specialty   VARCHAR(100)
  institution_id  VARCHAR(36)  REFERENCES institutions(id)
  full_name       TEXT         NOT NULL   -- encrypted (KMS)
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()

INDEX idx_doctors_nmc_id ON doctors(nmc_id)
INDEX idx_doctors_institution_id ON doctors(institution_id)
```

### Acceptance Criteria

- [ ] Doctor can view a consented patient's timeline immediately after registration (nmcVerified = false)
- [ ] `POST /api/v1/prescriptions` returns 403 / errorCode 1007 when nmcVerified = false
- [ ] NMC verification worker fires via SQS within 30 seconds of registration
- [ ] On NMC verification success: `nmcVerified = true`, push notification sent, doctor can now create prescriptions
- [ ] Invalid `specialtyId` returns 404, not 500

---

---

## S04 — Document Upload & Storage

**Module:** `src/modules/documents/`  
**Functional Requirements:** FR02, FR03, FR08  
**Priority:** P0

### Overview

Patients upload scanned prescriptions, lab reports, receipts, and other medical documents as images (JPG, PNG) or PDFs. Files are virus-scanned, encrypted, stored in S3, and queued for async OCR. Documents are retrieved exclusively via time-limited pre-signed URLs — raw S3 keys are never exposed.

### Business Rules

| Rule | Detail |
|------|--------|
| BR-DOC01 | Accepted MIME types: `image/jpeg`, `image/png`, `application/pdf` only |
| BR-DOC02 | Maximum file size: 20 MB |
| BR-DOC03 | Free tier document limit: 50 documents. Attempt to upload the 51st returns `errorCode 1011` |
| BR-DOC04 | Document is stored as-is in S3 (original scan preserved). OCR runs on a copy or the original — never modifying the stored file |
| BR-DOC05 | `documentDate` is the date on the document (e.g., the prescription date), not the upload date. If OCR extracts a date, it is pre-populated. Patient can correct it during review |
| BR-DOC06 | `source` is always `PATIENT_UPLOAD` for this module; `DOCTOR_CREATED` is set by the Prescription module |
| BR-DOC07 | Pre-signed download URLs expire in 24 hours |
| BR-DOC08 | Virus scanning runs before the document is written to S3 production prefix. Infected files → deleted; patient notified; upload returns `HTTP 422` |
| BR-DOC09 | A patient can only access their own documents. `patientId` is always taken from `req.user.sub`, never from the request body or query string |
| BR-DOC10 | Soft delete: `isActive = false`. S3 objects are retained (lifecycle policy moves to Glacier after 1 year) |

### API Contracts

---

#### `POST /api/v1/documents`

Upload a new document. Multipart form submission.

**Auth:** Bearer JWT  
**Guards:** `JwtAuthGuard`, `RolesGuard(['PATIENT'])`  
**Content-Type:** `multipart/form-data`

**Form Fields:**
```typescript
file: File;                          // Required; JPG, PNG, or PDF; max 20 MB
type: 'PRESCRIPTION' | 'LAB_REPORT' | 'RECEIPT' | 'OTHER';  // Required
documentDate?: string;               // "YYYY-MM-DD"; optional — OCR will attempt to extract if not provided
doctorName?: string;                 // Optional; max 100 chars; overrides OCR extraction
specialtyId?: string;                // UUID from medical_specialties; optional
notes?: string;                      // Patient notes; max 500 chars
```

**Response `202 Accepted`:**
```typescript
{
  id: string;                        // document UUID
  status: 'PROCESSING';
  ocrStatus: 'PENDING';
  createdAt: string;
}
```
> `202` because OCR is async. The document is saved but not yet searchable.

**Error Scenarios:**

| Condition | errorCode | HTTP |
|-----------|-----------|------|
| MIME type not accepted | 1010 | 400 |
| File exceeds 20 MB | 1005 | 400 |
| Free tier limit reached (50 docs) | 1011 | 402 |
| File infected (virus scan) | 2000 | 422 |

---

#### `GET /api/v1/documents`

List the authenticated patient's documents.

**Auth:** Bearer JWT  
**Guards:** `JwtAuthGuard`, `RolesGuard(['PATIENT'])`

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `page` | integer | Default 1 |
| `pageSize` | integer | Default 20, max 100 |
| `type` | string | `PRESCRIPTION \| LAB_REPORT \| RECEIPT \| OTHER` |
| `ocrStatus` | string | `PENDING \| COMPLETED \| FAILED \| REVIEW_NEEDED` |
| `from` | string | Date filter start (YYYY-MM-DD) |
| `to` | string | Date filter end (YYYY-MM-DD) |
| `sortBy` | string | `documentDate \| createdAt` (default `documentDate`) |
| `sortOrder` | string | `asc \| desc` (default `desc`) |

**Response `200 OK`:**
```typescript
{
  data: Array<{
    id: string;
    type: string;
    source: string;
    documentDate: string | null;
    ocrStatus: string;
    tags: string[];
    doctorName: string | null;
    doctorSpecialtyDisplay: string | null;
    thumbnailUrl: string | null;    // 1-hour pre-signed CloudFront URL
    createdAt: string;
  }>;
  pagination: { page, pageSize, total, totalPages };
}
```

---

#### `GET /api/v1/documents/:documentId`

Get full metadata for a single document.

**Auth:** Bearer JWT  
**Guards:** `JwtAuthGuard`, `RolesGuard(['PATIENT', 'DOCTOR'])`  
**Additional check (service layer):** If `role === DOCTOR`, verify active consent before returning

**Response `200 OK`:**
```typescript
{
  id: string;
  patientId: string;
  type: string;
  source: string;
  documentDate: string | null;
  ocrStatus: string;
  ocrText: string | null;          // only returned to the owning patient; null for doctors
  tags: string[];
  doctorName: string | null;
  specialty: { id, code, displayName } | null;
  notes: string | null;
  fileType: 'image/jpeg' | 'image/png' | 'application/pdf';
  fileSizeBytes: number;
  createdAt: string;
  updatedAt: string;
}
```

**Error Scenarios:**

| Condition | errorCode | HTTP |
|-----------|-----------|------|
| Document not found | 1003 | 404 |
| Doctor has no active consent for this patient | 1006 | 403 |

---

#### `GET /api/v1/documents/:documentId/download`

Returns a time-limited pre-signed URL to download the original file.

**Auth:** Bearer JWT  
**Guards:** `JwtAuthGuard`, `RolesGuard(['PATIENT', 'DOCTOR'])`  
**Additional check (service layer):** Consent check if caller is `DOCTOR`; audit log entry written

**Response `200 OK`:**
```typescript
{
  downloadUrl: string;       // Pre-signed S3 or CloudFront URL, 24-hour expiry
  expiresAt: string;         // ISO 8601
  fileType: string;
}
```

---

#### `PATCH /api/v1/documents/:documentId`

Allows the patient to correct document metadata (e.g., fix an OCR-extracted date, add specialty tag).

**Auth:** Bearer JWT  
**Guards:** `JwtAuthGuard`, `RolesGuard(['PATIENT'])`

**Request Body:**
```typescript
{
  documentDate?: string;    // "YYYY-MM-DD"
  type?: 'PRESCRIPTION' | 'LAB_REPORT' | 'RECEIPT' | 'OTHER';
  doctorName?: string;
  specialtyId?: string;
  notes?: string;
  ocrText?: string;         // Patient-corrected OCR text; triggers re-indexing in Elasticsearch
}
```

**Response `200 OK`:** Full document metadata (same shape as `GET /api/v1/documents/:documentId`)

---

#### `DELETE /api/v1/documents/:documentId`

Soft-deletes the document.

**Auth:** Bearer JWT  
**Guards:** `JwtAuthGuard`, `RolesGuard(['PATIENT'])`

**Response `204 No Content`**

---

### Storage Layout (AWS S3)

```
Bucket: omnimedvault-documents-prod
  /patient-uploads/{patientId}/{year}/{month}/{documentId}.{ext}
  /thumbnails/{patientId}/{documentId}_thumb.jpg
  /prescriptions/{patientId}/{prescriptionId}.pdf    ← doctor-generated PDFs
```

All objects encrypted with SSE-KMS. No public access. All access via pre-signed URLs only.

### Database

```sql
documents
  id                   VARCHAR(36)   PRIMARY KEY
  patient_id           VARCHAR(36)   NOT NULL  REFERENCES patients(id)
  type                 VARCHAR(20)   NOT NULL   -- PRESCRIPTION | LAB_REPORT | RECEIPT | OTHER
  source               VARCHAR(20)   NOT NULL   -- PATIENT_UPLOAD | DOCTOR_CREATED | LAB_UPLOAD
  s3_key               VARCHAR(512)  NOT NULL   -- never exposed in API responses
  thumbnail_s3_key     VARCHAR(512)             -- null until thumbnail generated
  file_mime_type       VARCHAR(50)   NOT NULL
  file_size_bytes      INTEGER       NOT NULL
  ocr_status           VARCHAR(20)   NOT NULL DEFAULT 'PENDING'
  ocr_text             TEXT                     -- encrypted (KMS); nullable
  tags                 TEXT[]        NOT NULL DEFAULT '{}'
  document_date        DATE
  doctor_name          VARCHAR(200)             -- OCR-extracted or patient-provided
  doctor_specialty_id  VARCHAR(36)   REFERENCES medical_specialties(id)
  notes                VARCHAR(500)
  uploaded_by          VARCHAR(36)   NOT NULL  REFERENCES users(id)
  is_active            BOOLEAN       NOT NULL DEFAULT TRUE
  created_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW()
  updated_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW()

INDEX idx_documents_patient_id          ON documents(patient_id)
INDEX idx_documents_patient_id_type     ON documents(patient_id, type)
INDEX idx_documents_patient_date        ON documents(patient_id, document_date DESC)
INDEX idx_documents_specialty           ON documents(doctor_specialty_id)
```

### Acceptance Criteria

- [ ] 51st document upload by a free-tier patient returns 422 / errorCode 1011
- [ ] Infected file: upload returns 422; no document row written; patient notified
- [ ] `downloadUrl` in response never contains the raw S3 key or bucket name
- [ ] Doctor calling `GET /api/v1/documents/:id` without consent returns 403 / errorCode 1006
- [ ] `ocrText` is null in doctor's response to `GET /api/v1/documents/:id`
- [ ] `PATCH` with corrected `ocrText` triggers Elasticsearch re-index (verified by subsequent search returning the document)

---

---

## S05 — OCR Pipeline

**Module:** `src/modules/ocr/`  
**Functional Requirements:** FR04  
**Priority:** P0

### Overview

When a document is uploaded, an SQS message triggers the async OCR worker. The worker sends the image/PDF to Google Cloud Vision API, post-processes the raw text to extract structured entities (medicines, dates, doctor names, diagnoses), stores results, and updates the document's Elasticsearch index.

### Business Rules

| Rule | Detail |
|------|--------|
| BR-OCR01 | OCR runs asynchronously — document upload returns 202 before OCR completes |
| BR-OCR02 | If Google Cloud Vision is unavailable (circuit open), fall back to AWS Textract; record `ocr_provider` on the document |
| BR-OCR03 | Confidence score < 0.70 → `ocrStatus = REVIEW_NEEDED`; patient receives push: "Please verify your document — we couldn't read it clearly" |
| BR-OCR04 | Confidence score ≥ 0.70 → `ocrStatus = COMPLETED`; patient receives push: "Your prescription has been digitised" |
| BR-OCR05 | OCR failure after all retries → `ocrStatus = FAILED`; patient notified; document remains accessible as an image |
| BR-OCR06 | Medicine names matched against the Indian drug dictionary (~15,000 entries); unmatched names are retained as-is |
| BR-OCR07 | Specialty extraction: attempt to match the prescription header against `medical_specialties.common_name` synonyms; if confidence ≥ 0.75, set `doctor_specialty_id` on the document |
| BR-OCR08 | Language hints to Vision API: `["en", "hi"]` in Phase 1 |
| BR-OCR09 | PDF documents: each page is extracted and concatenated; first page is used for thumbnail |
| BR-OCR10 | Receipt documents trigger additional receipt parsing (S13) after OCR completes |

### Pipeline Flow

```
SQS message: { documentId, patientId, s3Key, mimeType, type }
  │
  ▼
Fetch file from S3 (temporary buffer — not stored on worker disk)
  │
  ▼
Send to OcrProvider (Google Cloud Vision → AWS Textract fallback)
  │
  ▼
Raw text received + per-block confidence scores
  │
  ▼
NLP Post-Processor:
  ├── Extract document date (regex patterns: DD/MM/YYYY, DD-Mon-YYYY, etc.)
  ├── Extract doctor name (lines matching "Dr.", "Doctor" prefix)
  ├── Extract specialty (match header against medical_specialties.common_name)
  ├── Extract medicine names (match against drug dictionary)
  ├── Extract diagnosis keywords (NLP entity recognition)
  └── Compute overall confidence score (average of block-level scores)
  │
  ▼
Confidence gate:
  ├── >= 0.70 → ocrStatus = COMPLETED
  └── < 0.70  → ocrStatus = REVIEW_NEEDED
  │
  ▼
Update documents table:
  - ocr_text (encrypted)
  - ocr_status
  - document_date (if extracted and not already set)
  - doctor_name (if extracted and not already set)
  - doctor_specialty_id (if matched with confidence >= 0.75)
  - tags (auto-generated from extracted entities)
  │
  ▼
Index document in Elasticsearch (see S07)
  │
  ▼
Generate thumbnail (if image: resize to 300px wide; if PDF: first page → JPEG)
  Store thumbnail in S3 /thumbnails/ prefix
  │
  ▼
Publish SQS event: 'document.ocr.completed'
  → Notification worker sends push to patient
  → If type = RECEIPT and status = COMPLETED → trigger receipt parser (S13)
  → If type = LAB_REPORT and status = COMPLETED → trigger lab value extractor (S14)
```

### Extractors (one TypeScript class per entity type)

```
src/modules/ocr/extractors/
  date.extractor.ts          ← regex patterns for Indian date formats
  doctor-name.extractor.ts   ← "Dr.", "Doctor" prefix + NER
  medicine-name.extractor.ts ← drug dictionary lookup + fuzzy match
  specialty.extractor.ts     ← medical_specialties.common_name matching
  diagnosis.extractor.ts     ← medical entity NER (spaCy-style patterns)
```

Each extractor is independently testable. No extractor calls another extractor.

### OCR Provider Interface

```typescript
// src/shared/providers/ocr.provider.ts
interface OcrResult {
  rawText: string;
  blocks: Array<{ text: string; confidence: number; boundingBox: BoundingBox }>;
  overallConfidence: number;      // 0.0 – 1.0
  provider: 'GOOGLE_VISION' | 'AWS_TEXTRACT';
}

interface OcrProvider {
  extractText(imageBuffer: Buffer, languageHints: string[]): Promise<OcrResult>;
}
```

### Database Additions

```sql
ALTER TABLE documents
  ADD COLUMN ocr_provider VARCHAR(20);  -- GOOGLE_VISION | AWS_TEXTRACT
  ADD COLUMN ocr_confidence DECIMAL(4,3);
```

### Acceptance Criteria

- [ ] OCR worker processes the SQS message within 60 seconds of document upload
- [ ] Low-confidence document: `ocrStatus = REVIEW_NEEDED`, patient receives push notification
- [ ] Google Vision circuit open → job retried via AWS Textract; `ocr_provider = 'AWS_TEXTRACT'` recorded
- [ ] Medicine names resolved against drug dictionary: "Paracetamol" and "Crocin" both indexed as medicine tags
- [ ] Specialty extraction: prescription header containing "Consultant Cardiologist" → `doctor_specialty_id = CARDIOLOGY UUID` (confidence ≥ 0.75)
- [ ] Document remains accessible (download URL works) even if OCR fails

---

---

## S06 — Medical Specialties

**Module:** `src/modules/search/` (lookup endpoint lives here)  
**Priority:** P1

### Overview

A normalised reference table of medical specialties. Used for consent scope selection, document tagging, and search filtering. Specialties are seeded at database initialisation — not managed via the API in Phase 1.

### API Contracts

#### `GET /api/v1/specialties`

Returns all active medical specialties. Used by the client for filter dropdowns and consent scope configuration.

**Auth:** Bearer JWT  
**Guards:** `JwtAuthGuard`

**Response `200 OK`:**
```typescript
{
  data: Array<{
    id: string;
    code: string;           // "OPHTHALMOLOGY"
    displayName: string;    // "Ophthalmology (Eye)"
    commonName: string;     // "Eye" — used for NL search synonym display
  }>;
  // No pagination — full list; ~22 specialties
}
```

### Seeded Data (Phase 1A)

| Code | Display Name | Common Names |
|------|-------------|--------------|
| GENERAL_MEDICINE | General Medicine / GP | GP, Family Doctor |
| PEDIATRICS | Pediatrics | Child, Paeds |
| ORTHOPEDICS | Orthopedics | Bone, Ortho |
| CARDIOLOGY | Cardiology | Heart |
| NEUROLOGY | Neurology | Brain, Neuro |
| DERMATOLOGY | Dermatology | Skin |
| OPHTHALMOLOGY | Ophthalmology (Eye) | Eye |
| DENTISTRY | Dentistry | Tooth, Dental |
| ENT | ENT (Ear, Nose & Throat) | ENT |
| GYNECOLOGY | Gynecology & Obstetrics | Gynae, OB |
| PSYCHIATRY | Psychiatry & Mental Health | Mental Health |
| PULMONOLOGY | Pulmonology | Lungs, Chest |
| GASTROENTEROLOGY | Gastroenterology | Stomach, Digestive |
| NEPHROLOGY | Nephrology | Kidney |
| UROLOGY | Urology | Urology |
| ONCOLOGY | Oncology | Cancer |
| ENDOCRINOLOGY | Endocrinology | Diabetes, Thyroid, Hormones |
| RHEUMATOLOGY | Rheumatology | Joints, Arthritis |
| PHYSIOTHERAPY | Physiotherapy & Rehabilitation | Physio |
| RADIOLOGY | Radiology & Imaging | X-Ray, Scan |
| AYURVEDA | Ayurveda / Homeopathy | Ayurveda |
| EMERGENCY | Emergency Medicine | Emergency, Casualty |

### Database

```sql
medical_specialties
  id           VARCHAR(36)   PRIMARY KEY
  code         VARCHAR(50)   NOT NULL UNIQUE
  display_name VARCHAR(100)  NOT NULL
  common_name  VARCHAR(200)  NOT NULL   -- comma-separated synonyms; used for NL and OCR matching
  is_active    BOOLEAN       NOT NULL DEFAULT TRUE
  sort_order   INTEGER       NOT NULL DEFAULT 0
```

---

---

## S07 — Search

**Module:** `src/modules/search/`  
**Functional Requirements:** FR05, FR13  
**Priority:** P0

### Overview

Full-text and structured search across a patient's medical records, powered by AWS OpenSearch. A patient searches their own records. A doctor (with active consent) searches a consented patient's records. Access control is enforced at the application layer AND as a mandatory filter in every Elasticsearch query (defence in depth).

### Business Rules

| Rule | Detail |
|------|--------|
| BR-SRCH01 | `patient_id` filter is mandatory in every Elasticsearch query — no cross-patient data leakage |
| BR-SRCH02 | A doctor can only search records of patients who have granted them active consent |
| BR-SRCH03 | `specialty` query param is a human-readable string resolved via `medical_specialties.common_name` before querying (e.g. "tooth" → `DENTISTRY`) |
| BR-SRCH04 | Elasticsearch is indexed from the OCR worker (async). Newly uploaded documents are not searchable until OCR completes |
| BR-SRCH05 | Search results include snippet highlights from `ocr_text` — sensitive fields are never returned in full |
| BR-SRCH06 | Every doctor search against a patient's records generates an audit log entry |

### API Contracts

---

#### `GET /api/v1/search`

Patient searches their own records.

**Auth:** Bearer JWT  
**Guards:** `JwtAuthGuard`, `RolesGuard(['PATIENT'])`

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `q` | string | Free-text query (required if no other filter) |
| `type` | string | `PRESCRIPTION \| LAB_REPORT \| RECEIPT \| OTHER` |
| `from` | string | Date range start (YYYY-MM-DD) |
| `to` | string | Date range end (YYYY-MM-DD) |
| `specialty` | string | Natural language specialty ("eye", "OPHTHALMOLOGY", "tooth") |
| `doctorName` | string | Partial match on doctor name |
| `page` | integer | Default 1 |
| `pageSize` | integer | Default 20, max 50 |

**Response `200 OK`:**
```typescript
{
  data: Array<{
    id: string;
    type: string;
    documentDate: string | null;
    doctorName: string | null;
    doctorSpecialtyDisplay: string | null;
    highlight: string | null;      // snippet from ocr_text with <em> tags around matches
    thumbnailUrl: string | null;
    score: number;                 // Elasticsearch relevance score
  }>;
  pagination: { page, pageSize, total, totalPages };
  resolvedSpecialty: string | null;  // e.g. "DENTISTRY" if specialty="tooth"
}
```

---

#### `GET /api/v1/patients/:patientId/search`

Doctor searches a consented patient's records. Same query parameters as above.

**Auth:** Bearer JWT  
**Guards:** `JwtAuthGuard`, `RolesGuard(['DOCTOR'])`, `ConsentGuard`  
**Side effect:** Writes audit log entry; triggers push notification to patient: "Dr. [Name] searched your records"

**Response `200 OK`:** Same shape as patient search.  
**Note:** `highlight` snippets from `ocr_text` are included (the doctor has consent to view the records).

---

### Elasticsearch Index Schemas

**Index: `omnimedvault_documents`**
```json
{
  "mappings": {
    "properties": {
      "documentId":              { "type": "keyword" },
      "patientId":               { "type": "keyword" },
      "type":                    { "type": "keyword" },
      "source":                  { "type": "keyword" },
      "documentDate":            { "type": "date" },
      "ocrText":                 { "type": "text", "analyzer": "standard" },
      "tags":                    { "type": "keyword" },
      "doctorName":              { "type": "text" },
      "doctorSpecialtyCode":     { "type": "keyword" },
      "doctorSpecialtyDisplay":  { "type": "text" },
      "medicines":               { "type": "text" },
      "diagnosis":               { "type": "text" }
    }
  }
}
```

**Index: `omnimedvault_prescriptions`**
```json
{
  "mappings": {
    "properties": {
      "prescriptionId":          { "type": "keyword" },
      "patientId":               { "type": "keyword" },
      "doctorId":                { "type": "keyword" },
      "doctorSpecialtyCode":     { "type": "keyword" },
      "doctorSpecialtyDisplay":  { "type": "text" },
      "diagnosis":               { "type": "text" },
      "medicines":               { "type": "nested",
        "properties": {
          "name":      { "type": "text" },
          "dose":      { "type": "keyword" },
          "frequency": { "type": "keyword" }
        }
      },
      "createdAt":               { "type": "date" }
    }
  }
}
```

### Acceptance Criteria

- [ ] Search query with `specialty = "tooth"` resolves to `DENTISTRY` and returns only documents tagged DENTISTRY
- [ ] Patient cannot search another patient's records (patientId filter hardcoded from JWT)
- [ ] Doctor search without active consent returns 403 / errorCode 1006
- [ ] Doctor search generates audit log entry and patient push notification
- [ ] New document not searchable until OCR worker completes indexing
- [ ] Search returns zero results rather than error when no documents match

---

---

## S08 — Consent Lifecycle

**Module:** `src/modules/consent/`  
**Functional Requirements:** FR06, FR07, FR08  
**Priority:** P0

### Overview

Patients grant doctors time-limited or permanent access to their records. Each consent has a scope (full history, specialty-specific, or custom). Regardless of scope, the Active Medication Context (Layer 2) is always shown to the doctor unless the patient explicitly opts out. Every consent state change generates notifications to both parties.

### Business Rules

| Rule | Detail |
|------|--------|
| BR-CON01 | Only one `ACTIVE` consent row can exist per `(patient_id, doctor_id)` pair at a time |
| BR-CON02 | Granting new consent to a doctor who already has active consent → update the existing row (not insert a new one) |
| BR-CON03 | Revocation is immediate: `status = REVOKED`, `revoked_at = NOW()`. Doctor loses access on the next request — no grace period |
| BR-CON04 | Expired consent (`expires_at < NOW()`): treated identically to revoked — `ConsentGuard` returns 403 |
| BR-CON05 | `activeMedicationContextEnabled` defaults to `true` and must be explicitly set to `false` with a warning acknowledgement |
| BR-CON06 | Consent scope defaults: `FULL` for GENERAL_MEDICINE doctors; `SPECIALTY` (auto-selected from doctor's registered specialty) for all other specialties |
| BR-CON07 | When a patient revokes consent: doctor receives push notification; all active pre-signed URLs generated for that doctor remain valid until their expiry (pre-signed URL revocation is not implemented in Phase 1) |
| BR-CON08 | Single-session consent expires when the doctor's JWT expires (effectively 15 minutes, not extended on refresh) — represented in DB as `expires_at = NOW() + INTERVAL '15 minutes'` set at grant time |
| BR-CON09 | Every consent grant, revocation, and expiry is written to `audit_logs` |

### API Contracts

---

#### `POST /api/v1/consent`

Patient grants access to a doctor.

**Auth:** Bearer JWT  
**Guards:** `JwtAuthGuard`, `RolesGuard(['PATIENT'])`

**Request Body:**
```typescript
{
  doctorId: string;                  // UUID of the target doctor
  duration: 'PERMANENT' | 'TIME_LIMITED' | 'SINGLE_SESSION';
  expiresAt?: string;                // ISO 8601; required if duration = TIME_LIMITED
  scope: 'FULL' | 'SPECIALTY' | 'CUSTOM';
  specialtyIds?: string[];           // required if scope = SPECIALTY or CUSTOM
  activeMedicationContextEnabled: boolean;  // defaults to true; false requires acknowledgement
  activeMedicationContextDisableAck?: boolean;  // required and must be true if activeMedicationContextEnabled = false
}
```

**Response `201 Created`:**
```typescript
{
  id: string;
  patientId: string;
  doctorId: string;
  doctorName: string;
  status: 'ACTIVE';
  duration: string;
  expiresAt: string | null;
  scope: string;
  activeMedicationContextEnabled: boolean;
  grantedAt: string;
}
```

**Error Scenarios:**

| Condition | errorCode | HTTP |
|-----------|-----------|------|
| `doctorId` not found | 1003 | 404 |
| `duration = TIME_LIMITED` but no `expiresAt` | 1005 | 400 |
| `expiresAt` is in the past | 1005 | 400 |
| `activeMedicationContextEnabled = false` but `activeMedicationContextDisableAck` not provided or false | 1005 | 400 |
| `scope = SPECIALTY` but no `specialtyIds` | 1005 | 400 |

---

#### `GET /api/v1/consent`

Patient lists all their active consents.

**Auth:** Bearer JWT  
**Guards:** `JwtAuthGuard`, `RolesGuard(['PATIENT'])`

**Response `200 OK`:**
```typescript
{
  data: Array<{
    id: string;
    doctorId: string;
    doctorName: string;
    doctorSpecialty: string;
    status: 'ACTIVE' | 'EXPIRED' | 'REVOKED';
    scope: 'FULL' | 'SPECIALTY' | 'CUSTOM';
    expiresAt: string | null;
    activeMedicationContextEnabled: boolean;
    grantedAt: string;
    lastAccessedAt: string | null;   // from audit_logs; most recent DOCTOR VIEW event
  }>;
}
```

---

#### `DELETE /api/v1/consent/:doctorId`

Patient revokes access from a specific doctor. Immediate effect.

**Auth:** Bearer JWT  
**Guards:** `JwtAuthGuard`, `RolesGuard(['PATIENT'])`

**Response `204 No Content`**

**Error Scenarios:**

| Condition | errorCode | HTTP |
|-----------|-----------|------|
| No active consent found for this doctorId | 1003 | 404 |

---

#### `GET /api/v1/patients/:patientId/active-medications`

Returns the Active Medication List for a consented patient — shown as the persistent card at the top of the doctor's patient view.

**Auth:** Bearer JWT  
**Guards:** `JwtAuthGuard`, `RolesGuard(['DOCTOR'])`, `ConsentGuard`  
**Additional check:** `activeMedicationContextEnabled = true` on the consent row (if false, return 204 with empty body)

**Response `200 OK`:**
```typescript
{
  medications: Array<{
    medicineName: string;        // brand name as prescribed
    genericName: string | null;  // resolved from drug dictionary
    dose: string;                // "500mg"
    frequency: string;           // "twice daily"
    prescribedBy: string;        // "Dr. Iyer"
    prescribedBySpecialty: string; // "Gastroenterology"
    prescriptionDate: string;    // "YYYY-MM-DD"
    isOngoing: boolean;
    daysRemaining: number | null; // null if isOngoing
  }>;
  asOf: string;                  // ISO 8601 timestamp of computation
}
```

**Computation logic:** Returns all prescription medicines where `current_date <= prescription_date + duration_days` OR `is_ongoing = true`. Sorted by `prescription_date DESC`.

---

### Database

```sql
consents
  id                              VARCHAR(36)  PRIMARY KEY
  patient_id                      VARCHAR(36)  NOT NULL  REFERENCES patients(id)
  doctor_id                       VARCHAR(36)  NOT NULL  REFERENCES doctors(id)
  status                          VARCHAR(10)  NOT NULL DEFAULT 'ACTIVE'
  duration_type                   VARCHAR(20)  NOT NULL  -- PERMANENT | TIME_LIMITED | SINGLE_SESSION
  scope                           VARCHAR(10)  NOT NULL  -- FULL | SPECIALTY | CUSTOM
  specialty_ids                   TEXT[]       NOT NULL DEFAULT '{}'  -- UUID list
  active_medication_context_enabled BOOLEAN    NOT NULL DEFAULT TRUE
  granted_at                      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
  expires_at                      TIMESTAMPTZ
  revoked_at                      TIMESTAMPTZ
  updated_at                      TIMESTAMPTZ  NOT NULL DEFAULT NOW()

UNIQUE CONSTRAINT uq_consents_active ON consents(patient_id, doctor_id)
  WHERE status = 'ACTIVE'
INDEX idx_consents_patient_id    ON consents(patient_id)
INDEX idx_consents_doctor_id     ON consents(doctor_id)
INDEX idx_consents_status_expiry ON consents(status, expires_at)
```

### Acceptance Criteria

- [ ] Granting consent to a doctor who already has active consent updates the existing row
- [ ] `DELETE /consent/:doctorId` makes the doctor unable to access patient records on the very next request
- [ ] `activeMedicationContextEnabled = false` without the acknowledgement flag returns 400
- [ ] Active Medication card returns medications from across all specialties, regardless of consent scope
- [ ] `ConsentGuard` treats expired consent identically to revoked — 403 returned
- [ ] Consent grant and revocation each write to `audit_logs`

---

---

## S09 — Prescriptions

**Module:** `src/modules/prescriptions/`  
**Functional Requirements:** FR11, FR15  
**Priority:** P0

### Overview

Verified doctors create structured digital prescriptions linked to a consented patient. Prescriptions are stored in PostgreSQL, indexed in Elasticsearch, and a PDF is generated and stored in S3. The prescription automatically becomes part of the patient's medical timeline.

### Business Rules

| Rule | Detail |
|------|--------|
| BR-RX01 | Only doctors with `nmcVerified = true` can create prescriptions |
| BR-RX02 | Doctor must have active consent from the patient before creating a prescription |
| BR-RX03 | `medicines` array must contain at least 1 entry |
| BR-RX04 | Each medicine entry: `name` is required; `dose`, `frequency`, `duration`, `instructions` are optional |
| BR-RX05 | The prescription PDF is generated async after the DB record is created; `pdfStatus` starts as `PENDING` |
| BR-RX06 | Prescription is indexed in Elasticsearch after the DB write (sync) |
| BR-RX07 | A push notification is sent to the patient: "Dr. [Name] has added a new prescription" |
| BR-RX08 | `doctorSpecialtyId` is a snapshot from the doctor's profile at prescription time — it is never updated even if the doctor later changes specialty |

### API Contracts

---

#### `POST /api/v1/prescriptions`

Doctor creates a digital prescription.

**Auth:** Bearer JWT  
**Guards:** `JwtAuthGuard`, `RolesGuard(['DOCTOR'])`, `NmcVerifiedGuard`, `ConsentGuard` (checks `patientId` from body)

**Request Body:**
```typescript
{
  patientId: string;         // UUID
  diagnosis: string;         // free text; max 500 chars; required
  medicines: Array<{
    name: string;            // required; max 200 chars
    dose?: string;           // "500mg"
    frequency?: string;      // "twice daily"
    durationDays?: number;   // 0 = single dose; null = ongoing
    isOngoing?: boolean;     // true for chronic medications
    instructions?: string;   // "take after food"; max 200 chars
  }>;
  notes?: string;            // max 1000 chars
  followUpDate?: string;     // "YYYY-MM-DD"; must be a future date
}
```

**Response `201 Created`:**
```typescript
{
  id: string;
  patientId: string;
  doctorId: string;
  doctorName: string;
  doctorSpecialty: string;
  diagnosis: string;
  medicines: Array<{
    name: string;
    dose: string | null;
    frequency: string | null;
    durationDays: number | null;
    isOngoing: boolean;
    instructions: string | null;
  }>;
  notes: string | null;
  followUpDate: string | null;
  pdfStatus: 'PENDING';
  createdAt: string;
}
```

**Error Scenarios:**

| Condition | errorCode | HTTP |
|-----------|-----------|------|
| Doctor NMC not verified | 1007 | 403 |
| No active consent for this patient | 1006 | 403 |
| `medicines` array is empty | 1005 | 400 |
| `followUpDate` is a past date | 1005 | 400 |
| `patientId` not found | 1003 | 404 |

---

#### `GET /api/v1/prescriptions/:prescriptionId`

Get full prescription details.

**Auth:** Bearer JWT  
**Guards:** `JwtAuthGuard`, `RolesGuard(['PATIENT', 'DOCTOR'])`  
**Additional check:** Patient must own the prescription OR doctor must have active consent

**Response `200 OK`:** Full prescription object including `pdfDownloadUrl` (pre-signed, 24-hour expiry) when `pdfStatus = 'COMPLETED'`

---

#### `GET /api/v1/patients/:patientId/prescriptions`

List all prescriptions for a patient.

**Auth:** Bearer JWT  
**Guards:** `JwtAuthGuard`, `RolesGuard(['PATIENT', 'DOCTOR'])`, `ConsentGuard` (doctor only)

**Query Parameters:** `page`, `pageSize`, `from`, `to`, `doctorId`, `specialty`

**Response `200 OK`:** Paginated list of prescription summaries

---

### PDF Generation (Async Worker)

**Trigger:** SQS message after `POST /api/v1/prescriptions` succeeds  
**Output:** QR-coded PDF stored at `s3://omnimedvault-documents-prod/prescriptions/{patientId}/{prescriptionId}.pdf`

The PDF includes:
- OmniMedVault header + watermark
- Doctor name, NMC ID, specialty, date
- Patient name, blood group, allergies
- Diagnosis and medicines table
- Doctor notes
- Follow-up date
- QR code linking to `https://omnimedvault.com/rx/{prescriptionId}` (patient-verifiable)

### Database

```sql
prescriptions
  id                   VARCHAR(36)  PRIMARY KEY
  patient_id           VARCHAR(36)  NOT NULL  REFERENCES patients(id)
  doctor_id            VARCHAR(36)  NOT NULL  REFERENCES doctors(id)
  doctor_specialty_id  VARCHAR(36)  NOT NULL  REFERENCES medical_specialties(id)
  diagnosis            TEXT         NOT NULL
  medicines            JSONB        NOT NULL  -- [{name, dose, frequency, durationDays, isOngoing, instructions}]
  notes                TEXT
  follow_up_date       DATE
  pdf_s3_key           VARCHAR(512)           -- null until PDF generated
  pdf_status           VARCHAR(10)  NOT NULL DEFAULT 'PENDING'  -- PENDING | COMPLETED | FAILED
  document_id          VARCHAR(36)  REFERENCES documents(id)    -- the generated PDF document row
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()

INDEX idx_prescriptions_patient_id       ON prescriptions(patient_id)
INDEX idx_prescriptions_doctor_id        ON prescriptions(doctor_id)
INDEX idx_prescriptions_patient_date     ON prescriptions(patient_id, created_at DESC)
```

### Acceptance Criteria

- [ ] Unverified doctor creating prescription returns 403 / errorCode 1007
- [ ] Doctor without consent returns 403 / errorCode 1006
- [ ] Prescription appears in patient timeline immediately after creation
- [ ] Active Medication card reflects the new prescription within seconds of creation
- [ ] PDF generated with correct QR code; download URL returned once `pdfStatus = COMPLETED`
- [ ] `doctorSpecialtyId` snapshot is correct even if doctor changes specialty later

---

---

## S10 — Notifications

**Module:** `src/modules/notifications/`  
**Priority:** P1

### Overview

All outbound communications to patients and doctors are dispatched by the Notification Service. It consumes domain events (via NestJS `EventEmitter2`) and dispatches push (FCM), SMS (AWS SNS + Twilio fallback), and email (AWS SES) via a unified `NotificationProvider` interface.

### Notification Events — Phase 1A

| Event | Trigger | Recipients | Channels |
|-------|---------|-----------|---------|
| `document.ocr.completed` | OCR worker completes | Patient | Push |
| `document.ocr.review_needed` | OCR confidence < 0.70 | Patient | Push |
| `consent.granted` | Patient grants consent | Doctor | Push |
| `consent.revoked` | Patient revokes consent | Doctor | Push + SMS |
| `consent.expiring_soon` | Consent expires in 3 days | Doctor | Push + SMS |
| `consent.expired` | Consent `expires_at` passed | Doctor + Patient | Push |
| `doctor.record_accessed` | Doctor views/downloads patient record | Patient | Push (batched per 30-min session) |
| `prescription.created` | Doctor creates prescription | Patient | Push + SMS |
| `doctor.nmc_verified` | NMC verification succeeds | Doctor | Push |
| `doctor.nmc_failed` | NMC verification fails | Doctor | Push + SMS |
| `premium.upgraded` | Patient upgrades to Premium | Patient | Push |

### Business Rules

| Rule | Detail |
|------|--------|
| BR-NOTIF01 | Doctor record access notifications are batched: multiple accesses within a 30-minute window → single push: "Dr. [Name] viewed 4 records in your history at 3:42 PM" |
| BR-NOTIF02 | SMS is sent in addition to push only for high-priority events (consent revoked, new prescription, NMC failed) |
| BR-NOTIF03 | FCM high-priority channel used for all SOS-adjacent and consent-revocation notifications |
| BR-NOTIF04 | Notification failures are retried 3 times with exponential backoff; permanent failures are logged but do not fail the originating operation |
| BR-NOTIF05 | All notification templates are stored in `src/modules/notifications/templates/` — one file per event type in English and Hindi |

### Notification Provider Interface

```typescript
interface NotificationProvider {
  sendPush(userId: string, payload: PushPayload): Promise<void>;
  sendSms(phone: string, message: string): Promise<void>;
  sendEmail(email: string, subject: string, html: string): Promise<void>;
}

interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;  // deep-link context for the mobile app
  priority: 'normal' | 'high';
}
```

### Acceptance Criteria

- [ ] Doctor viewing 3 documents in 20 minutes → patient receives 1 consolidated push (not 3)
- [ ] FCM failure → retry 3 times; final failure logged; no exception propagated to the calling service
- [ ] Hindi template served when patient's locale preference is `hi`
- [ ] No PHI appears in push notification body (patient name in "Dr. X viewed your records" is fine; diagnosis/medicine name is not)

---

---

## S11 — Institution Onboarding & CRM Widget

**Module:** `src/modules/institutions/`  
**Functional Requirements:** FR29, FR30, FR31  
**Priority:** P1

### Overview

Hospitals and clinics register on OmniMedVault and receive a JavaScript embed widget for their existing software (HIS/CRM). The widget is an iframe that renders a sandboxed doctor interface. Authentication between the hospital CRM and OmniMedVault uses OAuth2.

### Business Rules

| Rule | Detail |
|------|--------|
| BR-INST01 | Each institution has exactly one API key; the key can be rotated |
| BR-INST02 | The CRM widget is a sandboxed iframe — the hospital's CRM cannot intercept OmniMedVault data |
| BR-INST03 | API key rate limit: 1000 requests per minute per institution |
| BR-INST04 | Institution-linked doctors inherit the institution's subscription tier for CRM widget access |
| BR-INST05 | Hospital admin cannot access patient PHI — only usage metrics (prescription count, active doctors) |

### API Contracts

---

#### `POST /api/v1/institutions/register`

**Auth:** Bearer JWT  
**Guards:** `JwtAuthGuard` (any authenticated user; they become the HOSPITAL_ADMIN)

**Request Body:**
```typescript
{
  name: string;              // institution name; max 200 chars
  type: 'HOSPITAL' | 'CLINIC' | 'DIAGNOSTIC_CENTRE' | 'OTHER';
  address: string;           // max 500 chars
  city: string;
  state: string;
  pinCode: string;           // 6-digit Indian PIN code
  contactPhone: string;      // E.164
  contactEmail: string;
}
```

**Response `201 Created`:**
```typescript
{
  id: string;
  name: string;
  apiKey: string;             // shown only once at creation; hash stored
  widgetEmbedCode: string;    // <script> tag HTML
  createdAt: string;
}
```

---

#### `GET /api/v1/institutions/me/dashboard`

**Auth:** Bearer JWT  
**Guards:** `JwtAuthGuard`, `RolesGuard(['HOSPITAL_ADMIN'])`

**Response `200 OK`:**
```typescript
{
  institutionName: string;
  activeDoctors: number;
  prescriptionsThisMonth: number;
  patientsServedThisMonth: number;
  widgetEmbedCode: string;
}
```

---

#### `POST /api/v1/institutions/me/api-key/rotate`

Rotates the institution API key. The old key is invalidated immediately.

**Auth:** Bearer JWT  
**Guards:** `JwtAuthGuard`, `RolesGuard(['HOSPITAL_ADMIN'])`

**Response `200 OK`:**
```typescript
{
  apiKey: string;       // new key; shown only once
  rotatedAt: string;
}
```

---

### Database

```sql
institutions
  id               VARCHAR(36)  PRIMARY KEY
  admin_user_id    VARCHAR(36)  NOT NULL UNIQUE  REFERENCES users(id)
  name             VARCHAR(200) NOT NULL
  type             VARCHAR(30)  NOT NULL
  address          TEXT
  city             VARCHAR(100)
  state            VARCHAR(100)
  pin_code         VARCHAR(6)
  contact_phone    VARCHAR(15)
  contact_email    VARCHAR(255)
  api_key_hash     VARCHAR(64)  NOT NULL   -- SHA-256 of the API key; key itself is never stored
  subscription_tier VARCHAR(10) NOT NULL DEFAULT 'CLINIC'  -- CLINIC | HOSPITAL | ENTERPRISE
  is_active        BOOLEAN      NOT NULL DEFAULT TRUE
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
```

---

---

## S12 — Emergency QR Code

**Module:** `src/modules/users/` (patient controller)  
**Functional Requirements:** FR10  
**Priority:** P1

### Overview

Patients generate a scannable QR code in the app showing blood group, known allergies, and current active medications. No login or consent is required to view the emergency profile page — it is designed for first responders when the patient is unconscious. The patient controls what is shown; the QR links to a permanent, patient-specific public URL.

### Business Rules

| Rule | Detail |
|------|--------|
| BR-QR01 | Emergency QR URL format: `https://omnimedvault.com/emergency/{patientId}` — patient-specific, permanent (not time-limited unlike SOS tokens) |
| BR-QR02 | Emergency profile shows: blood group, allergies, current active medications only — no medical history, no documents |
| BR-QR03 | No authentication required to view the emergency profile URL |
| BR-QR04 | Patient controls `emergencyQrEnabled` toggle; when disabled, the URL returns a "This patient has disabled their emergency profile" message |
| BR-QR05 | Every view of the emergency profile URL is logged to `audit_logs` with `actor_role = ANONYMOUS` |
| BR-QR06 | Active medication computation: same logic as Active Medication Card (S08) — `current_date <= prescription_date + duration_days` OR `is_ongoing = true` |

### API Contracts

---

#### `GET /api/v1/patients/me/emergency-qr`

Returns the QR code image and the public emergency profile URL.

**Auth:** Bearer JWT  
**Guards:** `JwtAuthGuard`, `RolesGuard(['PATIENT'])`

**Response `200 OK`:**
```typescript
{
  qrCodeDataUrl: string;      // base64 data URL of the QR image (PNG)
  emergencyProfileUrl: string; // "https://omnimedvault.com/emergency/{patientId}"
  emergencyQrEnabled: boolean;
}
```

---

#### `PATCH /api/v1/patients/me/emergency-qr`

Toggle emergency QR on/off.

**Auth:** Bearer JWT  
**Guards:** `JwtAuthGuard`, `RolesGuard(['PATIENT'])`

**Request Body:**
```typescript
{
  enabled: boolean;
}
```

**Response `200 OK`:** Updated QR response (same shape as GET)

---

#### `GET /emergency/:patientId` *(Public — no auth)*

Returns the emergency profile data for display.

**Auth:** None  
**Guards:** None  
**Rate limit:** 60 requests/minute per IP (bot protection)

**Response `200 OK`:**
```typescript
{
  bloodGroup: string | null;
  allergies: string[];
  activeMedications: Array<{
    medicineName: string;
    dose: string | null;
    frequency: string | null;
    prescribedBy: string;    // doctor name only; no specialty or other PHI
  }>;
  lastUpdatedAt: string;     // ISO 8601; when medications were last changed
  disclaimer: string;        // "This is an emergency medical summary. Not a complete medical record."
}
```

**Response when QR disabled:**
```typescript
{
  message: "This patient has disabled their emergency profile.",
  emergencyContact: null  // Phase 2 will surface non-PHI emergency contact
}
```

---

---

## S13 — Financial Tracking & Illness Episodes (Premium)

**Module:** `src/modules/expenses/`  
**Functional Requirements:** FR20–FR24  
**Priority:** P1 (Premium feature)  
**Guard:** `@Premium()` on all endpoints

### Overview

Premium patients can view parsed financial data from their receipts, create illness episodes to group related documents, and generate expense reports (PDF). The receipt parser runs async after OCR, extracting vendor name, date, amount, and expense category.

### Business Rules

| Rule | Detail |
|------|--------|
| BR-EXP01 | Receipt parsing runs only when `document.type = RECEIPT` and `ocrStatus = COMPLETED` |
| BR-EXP02 | Low-confidence fields (`parse_confidence < 0.70`) are flagged with `needsVerification = true`; the app prompts the patient to confirm or correct |
| BR-EXP03 | A document can belong to at most one illness episode |
| BR-EXP04 | `total_amount` must be a positive decimal; currency is `INR` |
| BR-EXP05 | The `specialty_id` on an expense row is inferred from the linked document's `doctor_specialty_id` — enabling specialty-level spend queries ("how much spent on dental in 6 months") |
| BR-EXP06 | Free-tier patients hitting any `/api/v1/expenses` endpoint receive `HTTP 402 / errorCode 1008` |

### API Contracts

---

#### `GET /api/v1/expenses`

List the patient's medical expenses with filters.

**Auth:** Bearer JWT  
**Guards:** `JwtAuthGuard`, `RolesGuard(['PATIENT'])`, `PremiumGuard`

**Query Parameters:** `page`, `pageSize`, `from`, `to`, `category`, `specialty`, `episodeId`, `needsVerification`

**Response `200 OK`:**
```typescript
{
  data: Array<{
    id: string;
    documentId: string;
    vendorName: string | null;
    expenseDate: string;          // "YYYY-MM-DD"
    totalAmount: number;          // in INR
    category: 'CONSULTATION' | 'MEDICINE' | 'LAB_TEST' | 'IMAGING' | 'PROCEDURE' | 'IPD' | 'OTHER';
    specialtyDisplay: string | null;
    episodeId: string | null;
    needsVerification: boolean;
    manuallyVerified: boolean;
  }>;
  pagination: { page, pageSize, total, totalPages };
  totals: {
    grandTotal: number;
    byCategory: Record<string, number>;  // { CONSULTATION: 3200, MEDICINE: 1800, ... }
  };
}
```

---

#### `GET /api/v1/expenses/summary`

Aggregated spend summary for dashboard display.

**Auth:** Bearer JWT  
**Guards:** `JwtAuthGuard`, `RolesGuard(['PATIENT'])`, `PremiumGuard`

**Query Parameters:** `year` (4-digit), `specialty`, `from`, `to`

**Response `200 OK`:**
```typescript
{
  totalSpend: number;
  byCategory: Record<string, number>;
  byMonth: Array<{ month: string; amount: number }>;  // "2025-01" → 4500.00
  bySpecialty: Array<{ specialty: string; amount: number }>;
  currency: 'INR';
  period: { from: string; to: string };
}
```

---

#### `POST /api/v1/episodes`

Create an illness episode.

**Auth:** Bearer JWT  
**Guards:** `JwtAuthGuard`, `RolesGuard(['PATIENT'])`, `PremiumGuard`

**Request Body:**
```typescript
{
  title: string;                  // max 200 chars; required
  primaryDiagnosis?: string;      // max 200 chars
  startedOn: string;              // "YYYY-MM-DD"; required
  endedOn?: string;               // "YYYY-MM-DD"; null if ongoing
  status: 'ACTIVE' | 'RECOVERED' | 'CHRONIC';
}
```

**Response `201 Created`:** Full episode object

---

#### `POST /api/v1/episodes/:episodeId/documents`

Link a document to an illness episode.

**Auth:** Bearer JWT  
**Guards:** `JwtAuthGuard`, `RolesGuard(['PATIENT'])`, `PremiumGuard`

**Request Body:**
```typescript
{
  documentId: string;
}
```

**Response `200 OK`:** Updated episode summary

**Error Scenarios:**

| Condition | errorCode | HTTP |
|-----------|-----------|------|
| Document already linked to another episode | 1004 | 409 |
| Document not owned by this patient | 1002 | 403 |

---

#### `GET /api/v1/expenses/report`

Generate and return a PDF expense report.

**Auth:** Bearer JWT  
**Guards:** `JwtAuthGuard`, `RolesGuard(['PATIENT'])`, `PremiumGuard`

**Query Parameters:** `type` (`EPISODE` | `ANNUAL`), `episodeId` (required if type = EPISODE), `year` (required if type = ANNUAL)

**Response `200 OK`:**
```typescript
{
  reportUrl: string;    // pre-signed S3 URL, 24-hour expiry
  generatedAt: string;
}
```

---

### Database

```sql
medical_expenses
  id                 VARCHAR(36)   PRIMARY KEY
  patient_id         VARCHAR(36)   NOT NULL  REFERENCES patients(id)
  document_id        VARCHAR(36)   NOT NULL  REFERENCES documents(id)
  episode_id         VARCHAR(36)   REFERENCES illness_episodes(id)
  vendor_name        VARCHAR(200)
  expense_date       DATE          NOT NULL
  total_amount       DECIMAL(10,2) NOT NULL
  currency           CHAR(3)       NOT NULL DEFAULT 'INR'
  category           VARCHAR(20)   NOT NULL
  specialty_id       VARCHAR(36)   REFERENCES medical_specialties(id)
  itemized_lines     JSONB
  bill_number        VARCHAR(100)
  parse_confidence   DECIMAL(4,3)  NOT NULL
  manually_verified  BOOLEAN       NOT NULL DEFAULT FALSE
  created_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW()

illness_episodes
  id                 VARCHAR(36)   PRIMARY KEY
  patient_id         VARCHAR(36)   NOT NULL  REFERENCES patients(id)
  title              VARCHAR(200)  NOT NULL
  primary_diagnosis  VARCHAR(200)
  started_on         DATE          NOT NULL
  ended_on           DATE
  status             VARCHAR(10)   NOT NULL DEFAULT 'ACTIVE'
  created_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW()
  updated_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW()

INDEX idx_expenses_patient_id     ON medical_expenses(patient_id)
INDEX idx_expenses_patient_date   ON medical_expenses(patient_id, expense_date)
INDEX idx_expenses_episode_id     ON medical_expenses(episode_id)
INDEX idx_episodes_patient_id     ON illness_episodes(patient_id)
```

### Acceptance Criteria

- [ ] Free-tier patient calling any `/expenses` endpoint returns 402 / errorCode 1008
- [ ] Receipt parser runs automatically within 60 seconds of OCR completion
- [ ] Low-confidence extracted amount: `needsVerification = true` returned in response
- [ ] Linking a document to a second episode returns 409
- [ ] `GET /expenses?specialty=tooth` resolves to `DENTISTRY` and filters correctly
- [ ] PDF expense report contains correct totals and episode summary

---

---

---

## S19 — Vaccination Tracker

**Module:** `src/modules/vaccinations/`
**Functional Requirements:** FR50–FR59
**Priority:** P1 (Phase 1A — Free feature, available to all patients)

### Overview

Digital tracking of a child's complete Government of India (GOI) immunisation schedule from birth through 15 years of age. When a parent registers a child as a managed dependent, the system auto-generates the full vaccine schedule based on the child's date of birth and sends timely push + SMS reminders before each vaccination is due. Parents can upload scanned vaccination card photos, mark vaccinations as administered, and download a printable PDF vaccination card.

### Business Rules

| Rule | Detail |
|------|--------|
| BR-VAX01 | The GOI UIP schedule is seeded in `vaccination_schedule` table; one row per vaccine per dose. The schedule version applied to a child is determined by their `date_of_birth` — versioned for future GOI updates |
| BR-VAX02 | On registration of a child as a managed dependent, the system creates `child_vaccinations` rows for all applicable vaccines. Past-due vaccines (child added after birth) are set to `status = NEEDS_VERIFICATION`; future vaccines to `status = UPCOMING` |
| BR-VAX03 | Only the guardian (parent managing the account) can mark vaccinations as administered or skipped. Doctors with consent can view but not modify vaccination records |
| BR-VAX04 | A vaccination can be marked administered with a date in the past (parents often update retrospectively) |
| BR-VAX05 | `administered_date` must not be in the future |
| BR-VAX06 | Reminder engine runs as a daily cron at 08:00 IST. Reminders fire on: 7 days before `due_date`, 1 day before, on `due_date`, and weekly thereafter while `status = OVERDUE` |
| BR-VAX07 | A parent can snooze a reminder by 7 days. Snooze is recorded in `reminder_snooze_until`; the cron skips this vaccination until after the snooze date |
| BR-VAX08 | Free tier: vaccination tracking is available to all patients. No `PremiumGuard` on vaccination endpoints |
| BR-VAX09 | Optional (non-GOI) vaccines can be added by the parent via `POST /vaccinations/extra`. These are not auto-generated and have no reminder unless explicitly requested |
| BR-VAX10 | Uploaded vaccination card documents use `type = VACCINATION_CARD` in the `documents` table and are linked to a `child_vaccinations` row via `document_id` |
| BR-VAX11 | A PDF vaccination card is generated on demand (not stored permanently); a pre-signed URL is returned with 24-hour expiry |
| BR-VAX12 | Vaccination records for a child are visible to any doctor who has active consent from the managing parent's account — same `ConsentGuard` as all other patient data |

### API Contracts

---

#### `GET /api/v1/vaccinations/schedule`

Returns the complete GOI master vaccination schedule. Used to populate informational screens ("What does this vaccine protect against?").

**Auth:** Bearer JWT
**Guards:** `JwtAuthGuard`
**Cache:** Response cached 24 hours in Redis (schedule rarely changes)

**Response `200 OK`:**
```typescript
{
  data: Array<{
    id: string;
    scheduleVersion: string;      // "UIP_2023"
    vaccineCode: string;          // "BCG", "DPT_1", "MR_1"
    vaccineName: string;          // "BCG (Bacillus Calmette-Guérin)"
    diseaseProtected: string;     // "Tuberculosis"
    ageDaysTarget: number;        // 0 = at birth, 42 = 6 weeks, etc.
    doseNumber: number;
    isMandatory: boolean;
    notes: string | null;
    sortOrder: number;
  }>;
}
```

---

#### `GET /api/v1/patients/:patientId/vaccinations`

Returns the full vaccination timeline for a child. Grouped by status.

**Auth:** Bearer JWT
**Guards:** `JwtAuthGuard`, `RolesGuard(['PATIENT', 'DOCTOR'])`,
- If caller is `PATIENT`: `patientId` must belong to a child managed by the authenticated parent
- If caller is `DOCTOR`: `ConsentGuard` (active consent from the managing parent's account)

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `status` | string | Filter: `UPCOMING \| DUE \| OVERDUE \| ADMINISTERED \| SKIPPED \| NEEDS_VERIFICATION` |
| `from` | string | Date range start (due_date or administered_date) |
| `to` | string | Date range end |

**Response `200 OK`:**
```typescript
{
  child: {
    patientId: string;
    name: string;
    dateOfBirth: string;         // "YYYY-MM-DD"
    ageInMonths: number;
  };
  summary: {
    total: number;
    administered: number;
    upcoming: number;
    overdue: number;
    needsVerification: number;
  };
  data: Array<{
    id: string;
    vaccineCode: string;
    vaccineName: string;
    diseaseProtected: string;
    doseNumber: number;
    dueDate: string;              // "YYYY-MM-DD"
    status: 'UPCOMING' | 'REMINDER_SENT' | 'DUE' | 'ADMINISTERED' | 'OVERDUE' | 'SKIPPED' | 'NEEDS_VERIFICATION';
    administeredDate: string | null;
    vaccineBrand: string | null;
    administeringClinic: string | null;
    administeringDoctor: string | null;
    documentId: string | null;   // linked vaccination card scan
    notes: string | null;
    isMandatory: boolean;
    lastReminderSentAt: string | null;
    reminderSnoozeUntil: string | null;
  }>;
}
```

---

#### `PATCH /api/v1/patients/:patientId/vaccinations/:vaccinationId`

Mark a vaccination as administered, skipped, or update its details. Parent only.

**Auth:** Bearer JWT
**Guards:** `JwtAuthGuard`, `RolesGuard(['PATIENT'])`, + service-layer check: authenticated user is the `guardian_patient_id` for this child

**Request Body:**
```typescript
{
  status: 'ADMINISTERED' | 'SKIPPED' | 'NEEDS_VERIFICATION';
  administeredDate?: string;       // "YYYY-MM-DD"; required if status = ADMINISTERED; must be past date
  vaccineBrand?: string;           // max 200 chars; optional
  administeringClinic?: string;    // max 300 chars; optional
  administeringDoctor?: string;    // max 200 chars; optional
  documentId?: string;             // UUID of an uploaded vaccination card scan
  notes?: string;                  // max 500 chars
  skipReason?: string;             // required if status = SKIPPED; max 500 chars
}
```

**Response `200 OK`:** Full updated vaccination record (same shape as data item above)

**Error Scenarios:**

| Condition | errorCode | HTTP |
|-----------|-----------|------|
| `vaccinationId` not found or not owned by this parent | 1003 | 404 |
| `administeredDate` is a future date | 1005 | 400 |
| `status = SKIPPED` but no `skipReason` | 1005 | 400 |
| Caller is not the managing guardian | 1002 | 403 |

---

#### `POST /api/v1/patients/:patientId/vaccinations/extra`

Add an optional or non-GOI vaccination. Parent only.

**Auth:** Bearer JWT
**Guards:** `JwtAuthGuard`, `RolesGuard(['PATIENT'])`, + guardian ownership check

**Request Body:**
```typescript
{
  vaccineName: string;             // required; max 200 chars
  diseaseProtected: string;        // required; max 500 chars
  administeredDate: string;        // "YYYY-MM-DD"; required; must be past date
  doseNumber?: number;             // default 1
  vaccineBrand?: string;           // max 200 chars
  administeringClinic?: string;    // max 300 chars
  administeringDoctor?: string;    // max 200 chars
  documentId?: string;             // UUID of linked scan
  notes?: string;                  // max 500 chars
}
```

**Response `201 Created`:** Full vaccination record

---

#### `GET /api/v1/patients/:patientId/vaccinations/pdf`

Generate a printable PDF vaccination card. Returns a pre-signed URL.

**Auth:** Bearer JWT
**Guards:** `JwtAuthGuard`, `RolesGuard(['PATIENT', 'DOCTOR'])`, ConsentGuard if DOCTOR

**Response `200 OK`:**
```typescript
{
  pdfUrl: string;          // pre-signed S3 / CloudFront URL, 24-hour expiry
  generatedAt: string;     // ISO 8601
}
```

---

#### `PATCH /api/v1/patients/:patientId/vaccinations/reminders/:vaccinationId`

Snooze or dismiss a vaccination reminder. Parent only.

**Auth:** Bearer JWT
**Guards:** `JwtAuthGuard`, `RolesGuard(['PATIENT'])`, + guardian ownership check

**Request Body:**
```typescript
{
  action: 'SNOOZE' | 'DISMISS';
  snoozeDays?: number;     // required if action = SNOOZE; min 1, max 30
}
```

**Response `200 OK`:**
```typescript
{
  vaccinationId: string;
  action: string;
  snoozeUntil: string | null;   // "YYYY-MM-DD"
}
```

---

### Reminder Scheduler (Background Job)

**File:** `src/modules/vaccinations/services/reminder-scheduler.service.ts`
**Schedule:** Cron `0 8 * * *` — daily at 08:00 IST (02:30 UTC)
**Mechanism:** NestJS `@Cron` decorator using `@nestjs/schedule`

```
Daily 08:00 IST — Reminder Scheduler fires:
  │
  ▼
Query child_vaccinations WHERE:
  ├── status = 'UPCOMING' AND due_date = TODAY + 7  → emit vaccination.reminder_7day
  ├── status IN ('UPCOMING','REMINDER_SENT') AND due_date = TOMORROW  → emit vaccination.reminder_1day
  ├── status IN ('UPCOMING','REMINDER_SENT') AND due_date = TODAY  → update to DUE; emit vaccination.due_today
  ├── status = 'DUE' AND due_date < TODAY  → update to OVERDUE; emit vaccination.overdue
  └── status = 'OVERDUE' AND (last_reminder_sent_at IS NULL
       OR last_reminder_sent_at < TODAY - 7)  → emit vaccination.overdue_weekly
  │
  ▼
For each matched row:
  - Check reminder_snooze_until: if set and > TODAY → skip this row
  - Emit event to NotificationService
  - Write row to vaccination_reminder_logs
  - Update last_reminder_sent_at on child_vaccinations row
```

---

### Database

```sql
-- Master GOI schedule (seeded; versioned)
vaccination_schedule
  id                VARCHAR(36)   PRIMARY KEY
  schedule_version  VARCHAR(20)   NOT NULL              -- "UIP_2023"
  vaccine_code      VARCHAR(50)   NOT NULL              -- "BCG", "OPV_0", "DPT_1"
  vaccine_name      VARCHAR(200)  NOT NULL
  disease_protected VARCHAR(500)  NOT NULL
  age_days_min      INTEGER       NOT NULL
  age_days_target   INTEGER       NOT NULL
  age_days_max      INTEGER
  dose_number       INTEGER       NOT NULL DEFAULT 1
  is_mandatory      BOOLEAN       NOT NULL DEFAULT TRUE
  notes             TEXT
  sort_order        INTEGER       NOT NULL DEFAULT 0
  is_active         BOOLEAN       NOT NULL DEFAULT TRUE
  valid_from_dob    DATE          NOT NULL
  valid_until_dob   DATE

UNIQUE CONSTRAINT uq_vax_schedule ON vaccination_schedule(vaccine_code, dose_number, schedule_version)

-- Per-child vaccination records
child_vaccinations
  id                      VARCHAR(36)   PRIMARY KEY
  patient_id              VARCHAR(36)   NOT NULL  REFERENCES patients(id)
  guardian_patient_id     VARCHAR(36)   NOT NULL  REFERENCES patients(id)
  schedule_entry_id       VARCHAR(36)   REFERENCES vaccination_schedule(id)  -- null for extra vaccines
  vaccine_code            VARCHAR(50)   NOT NULL
  vaccine_name            VARCHAR(200)  NOT NULL
  dose_number             INTEGER       NOT NULL DEFAULT 1
  due_date                DATE          NOT NULL
  status                  VARCHAR(25)   NOT NULL DEFAULT 'UPCOMING'
  administered_date       DATE
  vaccine_brand           VARCHAR(200)
  administering_clinic    VARCHAR(300)
  administering_doctor    VARCHAR(200)
  document_id             VARCHAR(36)   REFERENCES documents(id)
  notes                   TEXT
  skip_reason             TEXT
  last_reminder_sent_at   TIMESTAMPTZ
  reminder_snooze_until   DATE
  is_extra_vaccine        BOOLEAN       NOT NULL DEFAULT FALSE  -- true for non-GOI additions
  created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW()
  updated_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW()

INDEX idx_child_vax_patient_id         ON child_vaccinations(patient_id)
INDEX idx_child_vax_guardian_id        ON child_vaccinations(guardian_patient_id)
INDEX idx_child_vax_status_due         ON child_vaccinations(status, due_date)
INDEX idx_child_vax_patient_status     ON child_vaccinations(patient_id, status)

-- Reminder delivery log
vaccination_reminder_logs
  id                       VARCHAR(36)   PRIMARY KEY
  child_vaccination_id     VARCHAR(36)   NOT NULL  REFERENCES child_vaccinations(id)
  reminder_type            VARCHAR(25)   NOT NULL  -- SEVEN_DAY | ONE_DAY | DUE_TODAY | OVERDUE | WEEKLY_OVERDUE
  sent_at                  TIMESTAMPTZ   NOT NULL
  channel                  VARCHAR(10)   NOT NULL  -- PUSH | SMS
  delivery_status          VARCHAR(20)   NOT NULL  -- SENT | FAILED
  created_at               TIMESTAMPTZ   NOT NULL DEFAULT NOW()

INDEX idx_vax_reminder_log_vaccination_id ON vaccination_reminder_logs(child_vaccination_id)
```

### OpenSearch Index

**Index: `omnimedvault_vaccinations`**
```json
{
  "mappings": {
    "properties": {
      "vaccinationId":     { "type": "keyword" },
      "patientId":         { "type": "keyword" },
      "guardianPatientId": { "type": "keyword" },
      "vaccineCode":       { "type": "keyword" },
      "vaccineName":       { "type": "text" },
      "diseaseProtected":  { "type": "text" },
      "dueDate":           { "type": "date" },
      "administeredDate":  { "type": "date" },
      "status":            { "type": "keyword" },
      "isMandatory":       { "type": "boolean" }
    }
  }
}
```

### Notification Templates (added to S10)

| Event | English Template |
|-------|-----------------|
| `vaccination.reminder_7day` | "[Child Name]'s [Vaccine Name] (dose [N]) is due in 7 days on [Date]. Tap to find a nearby clinic or mark as done." |
| `vaccination.reminder_1day` | "Tomorrow — [Child Name] is due for [Vaccine Name]. Don't miss this important vaccination." |
| `vaccination.due_today` | "Today is the day — [Child Name]'s [Vaccine Name] is due today. Visit your nearest health centre." |
| `vaccination.overdue` | "Overdue — [Child Name] missed [Vaccine Name] on [Date]. Please visit a clinic soon. Tap to update." |
| `vaccination.overdue_weekly` | "Reminder — [Child Name]'s [Vaccine Name] is still overdue (since [Date]). Please act soon." |

### Acceptance Criteria

- [ ] Registering a child born today auto-generates a complete 15-year schedule with correct due dates
- [ ] Registering a child aged 18 months sets all past-milestone vaccines to `NEEDS_VERIFICATION` and future vaccines to `UPCOMING`
- [ ] Daily cron at 08:00 IST dispatches 7-day, 1-day, and due-today reminders correctly
- [ ] Overdue reminder fires weekly until vaccination is marked ADMINISTERED or SKIPPED
- [ ] Snoozed reminder is not re-sent until after `reminder_snooze_until` date
- [ ] Doctor with consent can view the child's vaccination timeline (GET) but cannot PATCH it
- [ ] Authenticated parent without guardian relationship returns 403 (cannot see another parent's child)
- [ ] PDF card generates with correct formatting and correct status for each vaccine
- [ ] No `PremiumGuard` — free-tier patient can access all vaccination endpoints
- [ ] `vaccination_reminder_logs` is INSERT-only (no UPDATE or DELETE — append-only per constitution)
- [ ] Uploaded vaccination card scan stored with `type = VACCINATION_CARD` and linked to `child_vaccinations.document_id`

---

---

## S14 — AI Health Insights Engine

**Phase:** 1B (Months 5–8) | **Module:** `src/modules/insights/`  
**Functional Requirements:** AI Health Insights (System Design §22)  
**Guard:** `@Premium()` on all patient-facing endpoints; insights generated for all patients but only delivered to Premium

### Outline Spec (detailed spec written when Phase 1B begins)

#### Key Components

| Component | Description |
|-----------|-------------|
| `LabValueExtractor` | Runs after OCR on LAB_REPORT documents; extracts `{marker, value, unit, confidence}` tuples from raw OCR text |
| `HealthProfileBuilder` | Aggregates `health_metrics` over time per patient; detects trends and threshold breaches |
| `RiskAssessmentEngine` | Layer A (rule-based thresholds) + Layer B (Claude API + RAG against medical knowledge base) |
| `MedicalKnowledgeBase` | pgvector-indexed research chunks from PubMed, ICMR, WHO, ADA, ACC; updated monthly via NCBI API |
| `InsightPublisher` | De-duplicates, throttles (max 2/month), validates against `InsightSchema`, delivers push + in-app |

#### InsightSchema (non-negotiable contract)

```typescript
interface InsightSchema {
  insightId: string;
  patientId: string;
  riskDomain: 'PRE_DIABETES' | 'HYPERTENSION' | 'THYROID' | 'ANEMIA' | 'VITAMIN_D' | 'VITAMIN_B12' | 'CARDIOVASCULAR' | 'KIDNEY';
  riskLevel: 'MEDIUM' | 'HIGH';   // LOW never delivered
  insightHeadline: string;         // max 120 chars; precautionary tone
  insightBody: string;             // max 400 chars; no diagnostic language
  evidence: Array<{ journal, paperTitle, year, doi, relevantFinding }>;
  supportingMarkers: Array<{ marker, patientValue, unit, referenceRange, trend }>;
  callToAction: string;            // "Kindly consult your doctor and take necessary precautions."
  disclaimer: string;              // legally reviewed text; non-nullable
  generatedAt: string;
  llmModel: string;
  confidenceGatePassed: true;      // always true; gate blocks generation if false
}
```

#### Pre-Launch Requirements (before Phase 1B goes live)

1. CDSCO regulatory review — determine if SaMD registration is required under MDR 2017
2. Legal sign-off on disclaimer text
3. Medical advisor partnership for knowledge base curation
4. Beta test with 5–10 doctors for accuracy validation

---

---

## S15 — Family Medical Proxy

**Phase:** 2 | **Module:** `src/modules/proxy/`  
**Functional Requirements:** FR35–FR39  
**Guard:** `@Premium()` (proxy must be Premium to view records)

### Outline Spec

A patient can grant a trusted family member (who has their own OmniMedVault account) read-only access to their complete medical history. Typical use: a son in Pune who needs to consult a local doctor on behalf of his father in Delhi.

#### Key Endpoints (detailed contracts written in Phase 2 spec)

```
POST   /api/v1/family-proxy/request              → Proxy requests access
GET    /api/v1/family-proxy/pending              → Patient views pending requests
POST   /api/v1/family-proxy/:id/approve          → Patient approves (with optional expiresAt)
POST   /api/v1/family-proxy/:id/decline          → Patient declines
DELETE /api/v1/family-proxy/:id                  → Patient revokes

GET    /api/v1/proxy/:patientId/summary          → Active medications + allergy card
GET    /api/v1/proxy/:patientId/timeline         → Full medical timeline (paginated)
GET    /api/v1/proxy/:patientId/documents        → Document list
GET    /api/v1/proxy/:patientId/documents/:id/download  → Pre-signed download URL
GET    /api/v1/proxy/:patientId/prescriptions    → Prescription list
GET    /api/v1/proxy/:patientId/search?q=...     → Search records
```

#### What Proxy Can/Cannot Do

| Allowed | Not Allowed |
|---------|------------|
| View full medical timeline | Upload documents |
| Search records | Edit or delete anything |
| Download PDFs (prescriptions, lab reports) | Create prescriptions |
| Share PDFs externally via device share sheet | Grant this access to another person (no sub-delegation) |
| View active medications and allergies | View financial data or expense reports |

---

---

## S16 — Natural Language Query Interface

**Phase:** 2 | **Module:** `src/modules/nl-query/`  
**Functional Requirements:** FR40–FR45  
**Guard:** `@Premium()` for patients; included for doctors (all tiers)

### Outline Spec

Patients and doctors type questions in plain language (English or Hindi) and receive factual, grounded answers drawn exclusively from actual records. The system never interpolates, estimates, or interprets.

#### Query Processing Pipeline (high-level)

```
1. Query Parsing LLM call → structured intent JSON
   { intent, marker, date_range, fallback_range_months }

2. Primary DB query (deterministic — no LLM)
   health_metrics WHERE confidence >= 0.80 AND date IN range
   → EXACT MATCH FOUND → step 4
   → NO MATCH → step 3

3. Fallback: expand ±6 months; return up to 3 nearest records

4. Response Generation LLM call
   Input: original query + retrieved records
   Constraint: "format only the retrieved data; do not add any information not in the provided records"

5. Log to nl_queries (INSERT-only); return response to user
```

#### Display Rules for Trend Queries

| Records found | Display |
|---------------|---------|
| 0 | Text: "No records found" |
| 1 | Text only |
| 2+ | Scatter plot (default) + text toggle |

Chart type: scatter plot with **straight-line segments** connecting actual data points. Dashed line for gaps > 180 days. **No smooth curves. No regression lines. No future projections. No averaged points.**

---

---

## S17 — SOS Emergency Feature

**Phase:** 2 | **Module:** `src/modules/sos/`  
**Priority:** Premium feature for patient; SMS recipients do not need the app

### Outline Spec

One-tap (press-and-hold 3 seconds) emergency alert that notifies the patient's recent doctors, active hospital, nearest hospitals (via Google Places API), and emergency contacts simultaneously via push + SMS.

#### Key Design Constraints

- < 2 second total server response time from POST to notification dispatch
- Location captured as point-in-time at trigger (no continuous tracking)
- 5-second cancel window after trigger
- `CALL 108 NOW` button always prominently displayed post-trigger
- Emergency profile URL: time-limited (4 hours), no login required, shows blood group + allergies + active meds only

#### Key Endpoint

```
POST /api/v1/sos/trigger  → { latitude, longitude }
→ 202 Accepted { sosEventId, recipientCount, emergencyProfileUrl, cancelWindowExpiresAt }
```

```
DELETE /api/v1/sos/:sosEventId  → cancel within 5-second window
→ 204 No Content
```

---

---

## S18 — Family Account Management

**Phase:** 2 | **Module:** `src/modules/family/`  
**Functional Requirements:** FR25–FR28  
**Guard:** `@Premium()` (primary account holder must be Premium)

### Outline Spec

Primary account holders can add managed dependents (elderly/children with no smartphone — primary holder manages their records) and linked dependents (adults with their own account who share financial summary only).

| | Managed Dependent | Linked Dependent |
|---|---|---|
| Smartphone required | No | Yes (own OmniMedVault account) |
| Medical records access | Full (primary holder manages) | None |
| Financial summary | Full | Patient controls — consent-based |
| Age 18+ behaviour | Stays managed until manually converted | No change |

**Key constraint:** Linked dependent's medical records are **never** accessible to the primary account holder — only financial summary, and only if the dependent has consented. Enforced at data layer, not UI layer.

---

---

## Appendix A — Guard Reference

| Guard | Behaviour | HTTP on failure |
|-------|-----------|----------------|
| `JwtAuthGuard` | Validates JWT signature + expiry; populates `req.user` | 401 / errorCode 1001 |
| `RolesGuard` | Checks `req.user.role` against `@Roles()` decorator | 403 / errorCode 1002 |
| `NmcVerifiedGuard` | Checks `doctor.nmcVerified === true` | 403 / errorCode 1007 |
| `ConsentGuard` | Checks active consent row for `(patientId, doctorId)` | 403 / errorCode 1006 |
| `PremiumGuard` | Checks `patient.subscriptionTier === 'PREMIUM'` | 402 / errorCode 1008 |
| `ProxyConsentGuard` | Checks active `family_medical_proxies` row | 403 / errorCode 1006 |

---

## Appendix B — Event Catalogue

All domain events emitted via NestJS `EventEmitter2`. Event listeners are in `src/modules/*/listeners/`.

| Event Name | Payload | Listeners |
|------------|---------|-----------|
| `document.uploaded` | `{ documentId, patientId, type, s3Key }` | OCR worker, thumbnail worker |
| `document.ocr.completed` | `{ documentId, ocrStatus, type }` | Notification, Elasticsearch indexer, receipt parser (if RECEIPT), lab extractor (if LAB_REPORT) |
| `consent.granted` | `{ consentId, patientId, doctorId }` | Notification, audit logger |
| `consent.revoked` | `{ consentId, patientId, doctorId }` | Notification, audit logger |
| `prescription.created` | `{ prescriptionId, patientId, doctorId }` | PDF generator, Elasticsearch indexer, notification, audit logger |
| `doctor.verified` | `{ doctorId }` | Notification |
| `doctor.nmc_failed` | `{ doctorId }` | Notification, PLATFORM_ADMIN alert |
| `doctor.record_accessed` | `{ doctorId, patientId, resourceType, resourceId }` | Audit logger, batched notification |
| `vaccination.reminder_7day` | `{ childVaccinationId, patientId, guardianPatientId }` | Notification, reminder log |
| `vaccination.reminder_1day` | `{ childVaccinationId, patientId, guardianPatientId }` | Notification, reminder log |
| `vaccination.due_today` | `{ childVaccinationId, patientId, guardianPatientId }` | Notification, reminder log, status updater |
| `vaccination.overdue` | `{ childVaccinationId, patientId, guardianPatientId }` | Notification, reminder log, status updater |
| `vaccination.overdue_weekly` | `{ childVaccinationId, patientId, guardianPatientId }` | Notification, reminder log |

---

## Appendix C — Database Migration Order

Migrations must be applied in this order (each depends on the previous):

1. `{ts}__create_users.ts`
2. `{ts}__create_medical_specialties.ts`
3. `{ts}__seed_medical_specialties.ts`
4. `{ts}__create_institutions.ts`
5. `{ts}__create_patients.ts`
6. `{ts}__create_doctors.ts`
7. `{ts}__create_documents.ts`
8. `{ts}__create_consents.ts`
9. `{ts}__create_prescriptions.ts`
10. `{ts}__create_audit_logs.ts`  ← append-only trigger applied here
11. `{ts}__create_illness_episodes.ts`
12. `{ts}__create_medical_expenses.ts`
13. `{ts}__create_vaccination_schedule.ts`  ← Phase 1A
14. `{ts}__seed_vaccination_schedule_uip2023.ts`  ← Phase 1A
15. `{ts}__create_child_vaccinations.ts`  ← Phase 1A
16. `{ts}__create_vaccination_reminder_logs.ts`  ← Phase 1A (append-only trigger applied here)
17. `{ts}__create_health_metrics.ts`  ← Phase 1B
18. `{ts}__create_health_insights.ts`  ← Phase 1B
19. `{ts}__create_nl_queries.ts`  ← Phase 2 (append-only trigger applied)
20. `{ts}__create_family_medical_proxies.ts`  ← Phase 2
21. `{ts}__create_family_members.ts`  ← Phase 2
22. `{ts}__create_sos_events.ts`  ← Phase 2

---

## Appendix D — Phase 1A Delivery Checklist

Before Phase 1A is considered complete:

**Infrastructure**
- [ ] AWS ECS Fargate running NestJS with 2-replica minimum
- [ ] RDS PostgreSQL Multi-AZ in ap-south-1
- [ ] OpenSearch cluster operational; both indices created
- [ ] ElastiCache Redis operational
- [ ] SQS queues for OCR and notification workers
- [ ] S3 buckets with correct lifecycle policies and KMS encryption
- [ ] AWS CloudFront CDN for static assets and pre-signed URL distribution
- [ ] GitHub Actions CI: lint + typecheck + unit tests + integration tests + security scan

**Features**
- [ ] S01 Auth — OTP login working end-to-end on Android
- [ ] S02 Patient Profile — create, update, timeline, audit log
- [ ] S03 Doctor Profile — register, NMC verification worker, prescription gating
- [ ] S04 Document Upload — upload, list, download, soft delete
- [ ] S05 OCR Pipeline — Google Vision + Textract fallback; confidence gate; re-indexing
- [ ] S06 Specialties — seeded and queryable
- [ ] S07 Search — patient search; doctor search with consent; specialty resolution
- [ ] S08 Consent — full lifecycle; active medication card
- [ ] S09 Prescriptions — create, PDF generation, timeline integration
- [ ] S10 Notifications — all Phase 1A events dispatched and confirmed delivered
- [ ] S11 Institutions — onboarding, API key, widget embed
- [ ] S12 Emergency QR — QR generation; public profile URL
- [ ] S13 Financial Tracking — receipt parser; episodes; expense summary; PDF report (Premium)
- [ ] S19 Vaccination Tracker — schedule generation; mark administered; reminders; PDF card (Free)

**Compliance & Security**
- [ ] Column-level PHI encryption verified in production DB snapshot
- [ ] Zero PHI in CloudWatch logs (verified via log search)
- [ ] Audit log immutability: DB trigger preventing UPDATE/DELETE verified
- [ ] ConsentGuard 100% coverage: every cross-patient data access returns 403 when consent inactive
- [ ] PremiumGuard 100% coverage: every S13 endpoint returns 402 for free-tier patient
- [ ] Vaccination reminder cron fires at 08:00 IST daily; all reminder types dispatched correctly
- [ ] Guardian ownership check: a parent cannot access another parent's child vaccination records
- [ ] `vaccination_reminder_logs` INSERT-only: no UPDATE or DELETE path exists in the repository
- [ ] Doctor with consent can GET vaccination records; PATCH returns 403 for doctor role
- [ ] Pre-signed URLs verified: S3 keys never appear in any API response

---

*Specs version: 1.1 | Date: 2026-06-08 | Aligned with SYSTEM_DESIGN_OmniMedVault.md v2.1 and OMNIMEDVAULT_CONSTITUTION.md v1.0*

---

> **CONFIDENTIAL & PROPRIETARY** — © 2026 Rishi Sood. All rights reserved.
