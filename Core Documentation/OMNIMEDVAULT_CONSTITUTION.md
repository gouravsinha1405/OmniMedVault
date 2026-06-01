# OMNIMEDVAULT_CONSTITUTION.md

This file is the binding project constitution for OmniMedVault. It provides guidance to Claude Code (claude.ai/code) and every engineer working in this repository. All implementation decisions must be consistent with this document and with `SYSTEM_DESIGN_OmniMedVault.md`.

---

## Project Status

**OmniMedVault — Phase 1A active development.** As of June 2026, the repository contains design documents and planning artefacts. Source code has not yet been written.

Reference files in this repo:
- `SYSTEM_DESIGN_OmniMedVault.md` — **Source of truth.** Full system design: actors, functional requirements, data models, API design, security, phasing, and AI engine architecture. Read this before implementing any feature.
- `OMNIMEDVAULT_CONSTITUTION.md` — **This file.** Binding implementation rules, patterns, and conventions.
- `OmniMedVault_Brand_Guide.md` — Product naming, tone, and positioning.
- `OmniMedVault_Product_Backlog.xlsx` — Feature backlog and priority stack.

---

## Build & Run Commands

```bash
# Install backend dependencies
npm install

# Start infrastructure (PostgreSQL, Redis, Elasticsearch)
docker-compose up

# Run the NestJS development server
npm run start:dev

# Run tests with coverage
npm run test:cov

# Run a single test file
npm run test -- --testPathPattern=consent.service.spec.ts

# Run integration tests
npm run test:e2e

# Code quality (run all before committing)
npm run lint
npm run format:check
npx tsc --noEmit

# Flutter mobile (from /mobile directory)
flutter pub get
flutter run

# Next.js web (from /web directory)
npm install
npm run dev
```

---

## Architecture Overview

**OmniMedVault** — a unified, secure, lifelong digital medical record system for Indian patients and their doctors.

### Actors & Roles

| Role | What they can do |
|------|-----------------|
| `PATIENT` | Upload records, grant/revoke doctor access, view own history, emergency QR |
| `DOCTOR` | View consented patients, create prescriptions (verified only), query history |
| `FAMILY_PROXY` | Read-only view of a patient's records (Premium; patient-consented) |
| `HOSPITAL_ADMIN` | Manage institution doctors, view usage dashboard, get embed widget |
| `PLATFORM_ADMIN` | System management only — zero access to Protected Health Information (PHI) |

### Phase 1 Technology Stack

| Layer | Technology |
|-------|-----------|
| Backend | NestJS (Node.js/TypeScript) — modular monolith |
| Mobile | Flutter (Android Phase 1; iOS Phase 2) |
| Web | Next.js (React/TypeScript) — doctor web + hospital admin |
| Auth | AWS Cognito (OTP/JWT) |
| Database | AWS RDS PostgreSQL (Multi-AZ) |
| Search | AWS OpenSearch (managed Elasticsearch) |
| File Storage | AWS S3 (AES-256 encrypted) |
| OCR | Google Cloud Vision API (primary); AWS Textract (fallback) |
| Cache | AWS ElastiCache (Redis) |
| Event Bus | Amazon SQS / SNS (async document pipeline) |
| Hosting | AWS ECS Fargate |
| CDN | AWS CloudFront |
| CI/CD | GitHub Actions |
| Monitoring | AWS CloudWatch + Sentry |

### Monolith Module Structure (Phase 1)

```
src/
  modules/
    auth/           ← AWS Cognito integration; OTP; JWT guards
    users/          ← Patient + Doctor profiles; NMC verification
    documents/      ← Upload, categorise, store, retrieve
    ocr/            ← Google Cloud Vision; NLP post-processing
    search/         ← Elasticsearch queries; access-gated search
    prescriptions/  ← Digital Rx creation; PDF generation
    consent/        ← Consent lifecycle; audit trail
    notifications/  ← SMS (SNS), Email (SES), Push (FCM)
    institutions/   ← Hospital onboarding; CRM widget; API keys
    expenses/       ← Receipt parsing; illness episodes (Premium)
    insights/       ← AI Health Insights engine (Phase 1B)
    nl-query/       ← Natural language query interface (Phase 2)
    sos/            ← SOS emergency feature (Phase 2)
  shared/
    database/       ← TypeORM setup; base repository
    guards/         ← JWT guard; roles guard; consent guard; premium guard
    interceptors/   ← Request ID; PII scrubbing; audit logging
    middleware/      ← Rate limiting; PII log scrubbing
    providers/      ← OCR provider; notification provider; AI provider
    errors/         ← Typed error classes; HTTP exception filters
    mappers/        ← Domain model ↔ API response converters
    config/         ← All env-var loading via ConfigService
```

Each module maps 1:1 to a future microservice. When traffic warrants extraction, the boundary already exists in code — the migration is operational (split the deployment), not a rewrite.

### Data Flow

```
Client (Flutter / Next.js / CRM Widget)
    ↓ HTTPS / TLS 1.3
AWS CloudFront + WAF
    ↓
AWS ALB → ECS Fargate (NestJS)
    ↓
Controller → Guard (JWT + Roles + Consent) → Service → Repository
    ↓                               ↓
AWS RDS PostgreSQL          AWS OpenSearch
AWS S3 (documents)          AWS ElastiCache (Redis)
    ↓
Async events → SQS → OCR Worker → Elasticsearch index
                    → Notification Service → FCM / SNS / SES
```

---

## Confirmed Design Decisions (Non-Negotiable)

1. **Consent-first architecture** — No PHI is returned to any caller without a verified, active consent record. The consent check runs at the Guard layer (not just the service layer). Every access to patient data that crosses the patient's own identity boundary must pass through `ConsentGuard`.

2. **PHI never appears in logs** — A PII scrubbing interceptor strips all PHI fields before any log line is emitted. This is non-negotiable: `phone`, `name`, `date_of_birth`, `allergies`, `ocr_text`, `diagnosis`, `medicines`, Aadhaar references, and query text are never logged. Log IDs and correlation context only.

3. **Audit trail is INSERT-only** — The `audit_logs` table (and `nl_queries`) accepts only `INSERT` operations. No `UPDATE` or `DELETE` ever. Every repository method touching these tables must be reviewed to ensure no mutation path exists.

4. **All document access via pre-signed URLs** — Raw S3 keys are never returned to clients. The Document Service generates time-limited pre-signed URLs (24-hour default, 4-hour for emergency tokens). S3 buckets have no public access policy.

5. **All external service calls go through provider abstractions** — Never call Google Cloud Vision, AWS Textract, Firebase FCM, Twilio, or the Claude/OpenAI API directly in service or module code. Use the injected provider interface (`OcrProvider`, `NotificationProvider`, `AiProvider`). This enables test mocking and future provider swapping.

6. **Credentials are always environment variables** — Never stored in code, config files, or the database. `ConfigService` (wrapping NestJS `@nestjs/config`) is the single place that reads `process.env`. No `process.env.FOO` outside `src/shared/config/`.

7. **AI Health Insights never diagnose** — The Insights engine produces `MEDIUM` or `HIGH` risk flags only. It never surfaces `LOW` risk ("you're fine") messages. Every insight must conform to `InsightSchema` before storage or delivery. Insights failing schema validation are silently discarded and logged to the internal error pipeline (never shown to users). The system prompt bans the words "diagnosis", "prognosis", "you have", and "you are at risk of developing" — instead using precautionary phrasing ("may indicate", "consider consulting your doctor").

8. **Emergency QR shows only three fields** — Blood group, known allergies, current active medications. No full medical history, no diagnosis, no doctor names beyond prescribing context for active meds. The emergency profile URL (SOS feature, Phase 2) follows the same constraint.

9. **NMC verification is async; prescription creation is hard-gated** — A doctor with `nmc_verified = false` can view consented records, search, and add notes. `POST /api/v1/prescriptions` returns `HTTP 403` with `DOCTOR_NOT_VERIFIED` until verification completes. The guard enforces this — the service layer must not re-implement it.

10. **Layered architecture** — `Controller → Service → Repository`. Controllers contain no business logic. Services contain no HTTP or database concepts. Repositories return domain models, not raw TypeORM entities. This boundary is mandatory and reviewed in every PR.

11. **Data localisation** — All data stored exclusively in AWS `ap-south-1` (Mumbai) primary and `ap-south-2` (Hyderabad) for DR. No data written to any other region. Enforced via S3 bucket policy and RDS subnet configuration.

12. **Single session for institution consent** — When a patient checks into a hospital institution, the consent duration defaults to single-session (expires on logout). The patient can upgrade to time-limited or permanent before confirming.

13. **DPDPA 2023 compliance is built in** — Every data collection must have a purpose. Right to erasure is handled by the `account_deletion_requests` pipeline: data is purged within 30 days. Breach notification pipeline must alert CERT-In and affected users within 72 hours. These are not afterthoughts — they are first-class flows designed and tested before any PHI flows through the system.

14. **Premium feature gating is a Guard, not a service check** — `PremiumGuard` runs before the handler. Premium endpoints are decorated with `@Premium()`. Services never implement the premium check themselves. This centralises the monetisation gate and prevents bypass via indirect service calls.

---

## Section IV — Request / Response Consistency (NON-NEGOTIABLE)

All API request and response payloads must follow these rules uniformly.

### Content-Type
- Default: `application/json`
- Multipart uploads: `multipart/form-data`
- Error responses: `application/problem+json`

### Field Naming
- All JSON properties: `camelCase`. TypeScript interfaces and DTOs use `camelCase`. NestJS `ClassSerializerInterceptor` with `@Exclude()` / `@Expose()` handles serialisation; never return raw TypeORM entities from controllers.

### Timestamps
- **Storage**: all timestamps stored as UTC in PostgreSQL (`TIMESTAMPTZ` columns).
- **API format**: ISO 8601 UTC — `"2026-05-22T10:30:00Z"`. Use `toISOString()` consistently; never `.toString()` on a `Date`.
- **Never** return `Date` objects directly from controllers — always serialise through the response DTO.

### Booleans
- `true` / `false` only — never `1`/`0`, `"yes"`/`"no"`, or string booleans.

### IDs
- External-facing IDs: UUID v4, generated in TypeScript (`uuid` package), never by the database (`DEFAULT gen_random_uuid()`).
- Internal DB auto-increment IDs must **never** appear in API responses.
- Path parameters accept UUID format only; validated by `ParseUUIDPipe`.

### Audit Fields
Every entity response must include:

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "createdAt": "2026-05-22T10:30:00Z",
  "updatedAt": "2026-05-22T10:30:00Z"
}
```

### Pagination
All list endpoints return:

```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 145,
    "totalPages": 8
  }
}
```

- `page`: 1-based integer
- `pageSize`: default 20, max 100; validated via DTO
- `total`: total records matching the filter
- `totalPages`: `Math.ceil(total / pageSize)`

### Error Response Format
HTTP status codes are conveyed via the HTTP status line only — never duplicated in the body.

```json
{
  "errorResponse": {
    "errorCode": 1005,
    "description": "Validation failed: phone must be a valid Indian mobile number"
  }
}
```

Standard error codes:

| Code | Meaning |
|------|---------|
| 1000 | Bad Request — invalid syntax or missing required field |
| 1001 | Unauthorized — missing or invalid JWT token |
| 1002 | Forbidden — authenticated but not authorised for this resource |
| 1003 | Not Found — resource does not exist |
| 1004 | Conflict — resource already exists or state conflict |
| 1005 | Validation Error — DTO validation failure |
| 1006 | Consent Required — no active consent for this patient-doctor pair |
| 1007 | Doctor Not Verified — NMC verification pending; action not permitted |
| 1008 | Premium Required — feature requires an active Premium subscription |
| 1009 | OCR Failed — document could not be processed |
| 1010 | File Type Not Supported — only JPG, PNG, PDF accepted |
| 1011 | Storage Limit Reached — free tier document limit exceeded |
| 2000 | Internal Error — unexpected server error |
| 2001 | Service Unavailable — external dependency (OCR, SMS, AI) unreachable |
| 2002 | Database Error — PostgreSQL operation failed |
| 2003 | AI Provider Unavailable — all AI providers temporarily circuit-open |

All error codes and messages are defined once in `src/shared/errors/error-codes.ts`. Never construct error objects inline in controllers or services.

```typescript
// WRONG — inline error in a service
throw new HttpException({ errorResponse: { errorCode: 1006, description: 'No consent' } }, 403);

// CORRECT — shared error class from shared/errors/
import { ErrConsentRequired } from '@shared/errors';
throw new ErrConsentRequired(doctorId, patientId);
```

---

## Resource Naming Conventions

OmniMedVault's REST API lives under `/api/v1/`.

- Resource names: lowercase, hyphen-separated (`/api/v1/family-proxy`, `/api/v1/nl-query`).
- Path parameters: `camelCase` nouns — e.g., `/patients/:patientId`, `/documents/:documentId`.
- Query parameters: `camelCase` — e.g., `?pageSize=20&sortBy=createdAt&specialty=OPHTHALMOLOGY`.

### Standard Query Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `page` | 1-based page number | `1` |
| `pageSize` | Records per page | `20` (max `100`) |
| `sortBy` | Field to sort by | resource-specific |
| `sortOrder` | `asc` or `desc` | `desc` |
| `from` | ISO 8601 date filter start | — |
| `to` | ISO 8601 date filter end | — |

### HTTP Method Mapping

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/v1/auth/otp/request` | Request OTP |
| `POST` | `/api/v1/auth/otp/verify` | Verify OTP → JWT |
| `GET` | `/api/v1/patients/me` | Own patient profile |
| `PUT` | `/api/v1/patients/me` | Update own profile |
| `GET` | `/api/v1/patients/me/timeline` | Own medical timeline |
| `POST` | `/api/v1/documents` | Upload document |
| `GET` | `/api/v1/documents/:documentId` | Document metadata |
| `GET` | `/api/v1/documents/:documentId/download` | Pre-signed download URL |
| `POST` | `/api/v1/consent` | Grant doctor access |
| `DELETE` | `/api/v1/consent/:doctorId` | Revoke doctor access |
| `POST` | `/api/v1/prescriptions` | Create digital prescription |
| `GET` | `/api/v1/search` | Search own records |
| `GET` | `/api/v1/patients/:patientId/search` | Search patient records (doctor) |
| `POST` | `/api/v1/family-proxy/request` | Request proxy access |
| `POST` | `/api/v1/family-proxy/:id/approve` | Approve proxy request |
| `POST` | `/api/v1/query` | NL query own records |
| `GET` | `/health` | Health check (unauthenticated) |
| `GET` | `/metrics` | Prometheus metrics (internal only) |

---

## Section VII — Observability & Logging (NON-NEGOTIABLE)

### Log Format

All production logs must be structured JSON. Use NestJS's built-in `Logger` with a custom JSON transport (Winston or Pino) — never `console.log()` in any environment.

Every log entry must include:

```json
{
  "timestamp": "2026-05-22T10:30:00Z",
  "level": "info",
  "message": "document_uploaded",
  "module": "documents",
  "operation": "uploadDocument",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "userId": "patient-uuid",
  "userRole": "PATIENT",
  "documentId": "document-uuid",
  "documentType": "PRESCRIPTION"
}
```

Log levels:
- `debug` — intermediate computation; suppressed in production (`LOG_LEVEL=info`).
- `info` — normal events: document uploaded, OCR completed, consent granted, prescription created.
- `warn` — recoverable issues: OCR low confidence, NMC API slow, SMS delivery delayed, premium gate triggered.
- `error` — service failure, unhandled exception. Always include `err: error` in the log context.

**Never log**: phone numbers, names, date_of_birth, Aadhaar IDs, ocr_text, diagnosis, medicines, query text, API keys, JWT tokens, or pre-signed URLs. Log document IDs and types, not their content. The PII scrubbing interceptor enforces this as a second safety net — the primary responsibility is on the developer writing the log call.

### Request Tracing

- Every HTTP request carries `X-Request-ID`. Generate a UUID v4 if the client omits it (in the request ID middleware).
- All logs within a request share the same `requestId` field.
- `requestId` propagates into async workers (OCR, notification) via SQS message metadata.

### Metrics

Expose via `GET /metrics` in Prometheus format. Track at minimum:

- Per endpoint: request count, latency (p50/p95/p99), error rate.
- OCR: success rate, confidence distribution, fallback (Textract) usage rate.
- AI Insights: insights generated, schema validation failures, discarded insights.
- Consent: grants per day, revocations per day, expired consent rate.
- Premium gate: upgrade prompts shown, conversion events.
- External dependency: AWS Cognito, Google Vision, FCM — call count, error rate, latency.

---

## Section VIII — Resilience & Graceful Error Handling (NON-NEGOTIABLE)

### Never-Crash Policy

The NestJS application must never crash due to a request-level error. Use a global exception filter:

```typescript
// src/shared/errors/global-exception.filter.ts
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    // Catches anything that escapes guard/service/handler layers — logs it, returns safe 500
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    this.logger.error('unhandled_exception', {
      path: request.url,
      requestId: request['requestId'] ?? 'unknown',
      err: exception,
    });
    response.status(500).json({
      errorResponse: { errorCode: 2000, description: 'Internal server error' },
    });
  }
}
```

### Error Handling Architecture

Errors flow upward through layers, each translating to the next layer's type:

- **Repository layer**: throws `RepositoryError` — wraps raw TypeORM exceptions. Never lets `QueryFailedError` propagate upward.
- **Service layer**: catches `RepositoryError`, throws typed `AppError` (from `shared/errors/`) with an error code and human-readable message.
- **Controller layer**: catches `AppError` via the NestJS exception filter. Never catches `Error` directly in a controller method.

```typescript
// shared/errors/app-errors.ts — define all error types once
export class AppError extends Error {
  constructor(
    public readonly errorCode: number,
    public readonly description: string,
    public readonly httpStatus: number,
  ) { super(description); }
}

export class ErrConsentRequired extends AppError {
  constructor(doctorId: string, patientId: string) {
    // Doctor has no active consent to access this patient's records
    super(1006, `Doctor ${doctorId} has no active consent for patient ${patientId}`, 403);
  }
}

export class ErrDoctorNotVerified extends AppError {
  constructor() {
    // NMC verification is still pending; prescription creation is not permitted
    super(1007, 'NMC verification is pending. Prescription creation is not permitted.', 403);
  }
}
```

### External Service Resilience

All calls to Google Cloud Vision, Firebase FCM, AWS SNS, and the AI provider must be wrapped with:

- **Timeout**: 30 s for OCR, 10 s for SMS/push, 60 s for AI. Configurable via env var.
- **Retry**: exponential backoff, max 3 attempts, for transient failures (`5xx`, network timeouts) only. Auth errors and 4xx responses are never retried.
- **Circuit Breaker**: after 5 consecutive failures, open for 60 s. On circuit open, the calling service degrades gracefully (OCR → queued for retry; notification → logged for async retry; AI insight → silently deferred).
- **OCR Fallback**: if Google Cloud Vision circuit opens, route to AWS Textract. Set `ocrProvider` on the document record so reports can show which provider was used.

### Health Check

`GET /health` must:
- Return `200 OK` with `{ "status": "healthy" }` when PostgreSQL, Redis, and Elasticsearch are reachable.
- Return `503 Service Unavailable` listing failed dependencies when any critical dependency is down.
- Be unauthenticated (for ALB and ECS health probes).

---

## Software Engineering Design Principles

These are enforced throughout the codebase. Each rule is stated in OmniMedVault terms.

---

### SOLID

**S — Single Responsibility**

Each NestJS service does exactly one job. `ConsentService` manages consent lifecycle — it does not send notifications, log to audit, or query documents. If you find yourself importing `NotificationService` into `ConsentService` to send a push, extract the side effect into a `ConsentEventService` or use a domain event. If a service description needs "and" to describe what it does, split it.

```typescript
// WRONG — ConsentService doing audit work that belongs to AuditService
async grantConsent(dto: GrantConsentDto, patientId: string) {
  const consent = await this.consentRepo.create(dto);
  await this.auditRepo.insert({ action: 'CONSENT_GRANT', ... }); // not this service's job
  await this.notificationService.sendPush(...); // not this service's job
  return consent;
}

// CORRECT — ConsentService creates the record; events are handled by listeners
async grantConsent(dto: GrantConsentDto, patientId: string) {
  const consent = await this.consentRepo.create(dto);
  this.eventEmitter.emit('consent.granted', new ConsentGrantedEvent(consent));
  return consent;
}
```

Functions ≤ 25 lines; files ≤ 350 lines; classes ≤ 12 public methods. Extract helpers aggressively.

---

**O — Open/Closed**

Adding a new OCR provider means writing a new `OcrProvider` implementation — not editing the `OcrService`. Adding a new notification channel means a new `NotificationChannel` — not touching `EmailChannel`.

```typescript
// Adding a new OCR provider: implement the interface, register in the module
export class AwsTextractProvider implements OcrProvider {
  async extractText(imageBuffer: Buffer, language: string[]): Promise<OcrResult> { ... }
}
```

---

**L — Liskov Substitution**

Any `OcrProvider` implementation must be a drop-in replacement for another: same method signatures, same return type (`OcrResult`), same exception types (`OcrTransientError`, `OcrPermanentError`). The `OcrService` must never special-case a provider.

---

**I — Interface Segregation**

Don't force services to implement methods they don't need.

```typescript
// WRONG — all notification channels forced to implement sendEmail
interface NotificationChannel {
  sendPush(payload: PushPayload): Promise<void>;
  sendSms(payload: SmsPayload): Promise<void>;
  sendEmail(payload: EmailPayload): Promise<void>;  // FCM doesn't need this
}

// CORRECT — separate interfaces; channels implement only what they support
interface PushChannel { sendPush(payload: PushPayload): Promise<void>; }
interface SmsChannel  { sendSms(payload: SmsPayload): Promise<void>; }
interface EmailChannel { sendEmail(payload: EmailPayload): Promise<void>; }
```

---

**D — Dependency Inversion**

Services and repositories depend on interfaces, never on concrete implementations. All dependencies are injected via NestJS DI — never instantiated inside a method.

```typescript
// WRONG — OcrService creates its own Google Vision client; untestable
@Injectable()
export class OcrService {
  private vision = new ImageAnnotatorClient(); // hard-coded; can't be mocked
}

// CORRECT — OcrProvider injected; swap for MockOcrProvider in tests
@Injectable()
export class OcrService {
  constructor(
    @Inject(OCR_PROVIDER) private readonly ocrProvider: OcrProvider,
    private readonly documentRepo: DocumentRepository,
  ) {}
}
```

---

### DRY — Don't Repeat Yourself (NON-NEGOTIABLE)

**Rule of Three**: write once, note the second time, refactor on the third.

Centralise the following — never inline across multiple services or files:

- **OCR NLP extractors** (`modules/ocr/extractors/`) — one extractor class per entity type (medicines, diagnoses, dates, doctor names). Never duplicate extraction logic across the OCR service and the receipt parser.
- **Consent checks** (`shared/guards/consent.guard.ts`) — one guard; never re-implement consent validation in a service method.
- **Pre-signed URL generation** (`modules/documents/storage.provider.ts`) — one method; called by Document Service, Proxy Service, and Emergency Profile generator — never duplicated.
- **PHI field lists** (`shared/constants/phi-fields.ts`) — one source of truth for which fields require encryption and which are stripped from logs.
- **Role-permission matrix** (`shared/constants/rbac.ts`) — one place; never hard-code role strings in individual guards or services.
- **Elasticsearch query builders** (`modules/search/query-builders/`) — one builder per index; never build ES query objects inline in a service method.
- **Response mappers** (`shared/mappers/`) — one mapper per entity; called from controllers only; services return domain objects.

```typescript
// WRONG — pre-signed URL logic duplicated in DocumentController and ProxyController
// DocumentController
const url = await s3.getSignedUrl('getObject', { Bucket: '...', Key: doc.s3Key, Expires: 86400 });

// CORRECT — shared provider called from both controllers
const url = await this.storageProvider.getDownloadUrl(doc.s3Key, { expiresIn: 86400 });
```

---

### KISS — Keep It Simple

Build only what the current phase requires. Phase 1A does not need a plugin architecture for OCR providers — it needs Google Cloud Vision to work. Phase 1B AI Insights do not need a fine-tuned model — rules + Claude API with RAG is the design. Three similar lines is better than a premature abstraction.

---

### YAGNI — You Aren't Gonna Need It

If the system design does not require a feature in the current phase, do not implement it. Common violations to avoid:

- Building a Kafka/Confluent cluster when SQS is sufficient for Phase 1 event volume
- Adding a full microservices service mesh before services are extracted from the monolith
- Implementing multi-region writes before the product has meaningful scale
- Building a drug interaction engine in Phase 1 when it is flagged as a Phase 2 addition to the prescription tool

---

### Separation of Concerns

| Concern | Owner | Must NOT touch |
|---------|-------|----------------|
| Auth / JWT validation | Cognito + `AuthGuard` | Business logic |
| Consent enforcement | `ConsentGuard` | Document content |
| PHI encryption/decryption | Repository layer | Controllers, services |
| OCR extraction | `OcrService` | Search indexing, document storage |
| Search indexing | `SearchService` | OCR, document storage |
| Audit trail writes | `AuditService` | Business logic |
| Notification dispatch | `NotificationService` | Consent state, document content |
| AI insight generation | `InsightsService` | Document upload, search |
| Expense parsing | `ExpensesService` | OCR raw text, prescription logic |
| Premium gating | `PremiumGuard` | Feature implementation code |

---

### Fail Fast

Validate inputs at system boundaries before any expensive operation.

```typescript
// In DocumentService.uploadDocument() — validate before S3 write, virus scan, or OCR queue
async uploadDocument(dto: UploadDocumentDto, file: Express.Multer.File, patientId: string) {
  // Validate file type before touching S3 or the OCR pipeline
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    throw new ErrFileTypeNotSupported(file.mimetype);
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new ErrFileTooLarge(file.size);
  }
  // Free tier limit check before any write
  const docCount = await this.documentRepo.countByPatient(patientId);
  if (docCount >= FREE_TIER_DOC_LIMIT && !(await this.premiumService.isActive(patientId))) {
    throw new ErrStorageLimitReached();
  }
  // Validated — safe to proceed
}
```

---

### Law of Demeter

A service should talk only to its immediate dependencies — not to the internals of those dependencies.

```typescript
// WRONG — ConsentService reaching into the doctor's institution to check subscription
const isActive = await consentService.doctorService.institutionService.subscriptionRepo.findOne(...);

// CORRECT — ask the service that owns the answer
const isActive = await this.institutionService.isSubscriptionActive(institutionId);
```

---

### Command-Query Separation

Functions that return data must have no side effects. Functions that change state must not return data.

```typescript
// Query — reads consent, returns result, no side effects
async getActiveConsents(patientId: string): Promise<ConsentDto[]> { ... }

// Command — writes consent revocation, returns nothing
async revokeConsent(consentId: string, patientId: string): Promise<void> { ... }

// WRONG — query that also writes an audit log entry as a side effect
async getPatientTimeline(patientId: string, viewerId: string): Promise<TimelineDto> {
  const timeline = await this.documentRepo.getTimeline(patientId);
  await this.auditRepo.insert({ action: 'VIEW', ... }); // side effect inside a query
  return timeline;
}
```

---

### Composition over Inheritance

NestJS's DI system enables composition. Do not build deep inheritance chains for services or guards.

```typescript
// WRONG — deep inheritance chain
class BaseGuard → ConsentBaseGuard → ConsentWithPremiumGuard → ProxyConsentGuard

// CORRECT — composed guards; each concern is a separate, injected guard
@UseGuards(JwtAuthGuard, RolesGuard, ConsentGuard)  // composed in decorator
async getPatientTimeline(...) { ... }
```

---

### Design Patterns in Use

| Pattern | Where | What it solves |
|---------|-------|----------------|
| **Strategy** | `OcrProvider`, `NotificationChannel`, `AiProvider` | Swap providers without changing service logic |
| **Adapter** | `shared/providers/` | Uniform interface over Google Vision, Textract, FCM, SNS |
| **Observer** | `EventEmitter2` domain events | Audit writes, notifications, OCR queue — decoupled from business logic |
| **Repository** | `shared/database/base.repository.ts` | DB access encapsulated; services never touch TypeORM directly |
| **Factory** | NestJS `DynamicModule` in each module | Provider construction separated from business logic |
| **Decorator** | `@Roles()`, `@Premium()`, `@ConsentRequired()` | Declarative access control; no repeated if-checks in controllers |
| **Chain of Responsibility** | NestJS request pipeline: Middleware → Guard → Interceptor → Handler | Each step handles one concern (auth, consent, audit, response mapping) |

---

## Section IX — Unit Testing & Code Quality (NON-NEGOTIABLE)

### Coverage Requirements

- Minimum: **80%** for all new code.
- Critical paths (auth, consent enforcement, PHI access, audit trail, premium gating): **100%**.
- Every controller: tests for success case and all defined error codes.
- Every service method: tests with mocked repositories and providers.
- Every repository method: integration tests against a real PostgreSQL instance.
- Edge cases: expired consent, revoked consent, pending NMC verification, free tier limit, OCR low confidence, fallback to Textract.

### Test Organisation

```
test/
  unit/
    modules/
      consent/          ← consent.service.spec.ts, consent.guard.spec.ts
      documents/        ← documents.service.spec.ts, storage.provider.spec.ts
      ocr/              ← ocr.service.spec.ts, medicine-extractor.spec.ts
      insights/         ← insights.service.spec.ts, insight-schema.validator.spec.ts
    shared/
      guards/           ← jwt.guard.spec.ts, premium.guard.spec.ts
      mappers/          ← patient.mapper.spec.ts, document.mapper.spec.ts
  integration/
    repos/              ← consent.repo.integration.spec.ts (real PostgreSQL)
    api/                ← e2e tests (Supertest + real DB)
  fixtures/             ← shared test data builders
```

- Test files named `{module}.spec.ts` (unit) or `{module}.integration.spec.ts`.
- Integration tests marked with Jest `@group integration`; excluded from default `npm run test`, included in CI via `npm run test:integration`.

### Parametrised Tests

Use `test.each` for multiple scenarios — keeps tests readable and coverage broad.

```typescript
test.each([
  ['active consent exists', true, 200],
  ['no consent record', false, 403],
  ['expired consent', 'expired', 403],
  ['revoked consent', 'revoked', 403],
])('consent guard: %s → HTTP %i', async (scenario, consentState, expectedStatus) => {
  // Verifies that ConsentGuard correctly blocks or allows based on consent state
  const consent = buildConsent({ state: consentState });
  consentRepo.findActive.mockResolvedValue(consentState === true ? consent : null);
  const response = await request(app.getHttpServer())
    .get(`/api/v1/patients/${PATIENT_ID}/timeline`)
    .set('Authorization', `Bearer ${doctorToken}`);
  expect(response.status).toBe(expectedStatus);
});
```

Each test case description reads like a sentence: `"consent guard: expired consent → HTTP 403"`, not `"test case 3"`.

### Mocking Requirements

- External dependencies (AWS Cognito, Google Vision, PostgreSQL, Elasticsearch, Redis, FCM, SNS, AI provider) must be mocked in unit tests.
- Use Jest's `jest.fn()` and `jest.spyOn()`. Use `@nestjs/testing`'s `TestingModule` to inject mocks via the DI system.
- Mocks must assert on call arguments — not just that a function was called, but that it was called with the correct parameters.
- Never mock the module under test.

```typescript
it('emits consent.granted event after successful grant', async () => {
  // Verifies that granting consent publishes the domain event so audit and notification listeners fire
  const emitSpy = jest.spyOn(eventEmitter, 'emit');
  await consentService.grantConsent(grantDto, PATIENT_ID);
  expect(emitSpy).toHaveBeenCalledWith(
    'consent.granted',
    expect.objectContaining({ patientId: PATIENT_ID, doctorId: grantDto.doctorId }),
  );
});
```

---

## Code Comments — Plain English (MANDATORY)

Every non-trivial function or method must have a **one-line comment in plain English** explaining what it does and why it exists.

```typescript
// WRONG — no comment; reader must reverse-engineer the intent
async buildActiveMediacationList(patientId: string): Promise<ActiveMedication[]> {
  return this.prescriptionRepo.findActive(patientId, new Date());
}

// WRONG — restates the function name, adds nothing
// Builds the active medication list for a patient
async buildActiveMediacationList(patientId: string): Promise<ActiveMedication[]> { ... }

// CORRECT — explains what "active" means and why this is used
async buildActiveMedicationList(patientId: string): Promise<ActiveMedication[]> {
  // Returns all medications where today falls within the prescription's duration window;
  // used by the doctor's Medication Context card and the Emergency QR generator
  return this.prescriptionRepo.findActive(patientId, new Date());
}

async computeInsightConfidenceGate(metrics: HealthMetric[]): Promise<boolean> {
  // Blocks AI insight generation unless all input lab values have extraction_confidence >= 0.80;
  // prevents predictions from low-quality OCR output (e.g., "HbA1c: 62" instead of "6.2")
  return metrics.every(m => m.extractionConfidence >= CONFIDENCE_GATE_THRESHOLD);
}
```

Rules:
- Comment goes immediately above the function body (not on the `function` line).
- Plain English — avoid jargon unless universally known (`OCR`, `PHI`, `NMC`, `JWT`, `UUID` are fine).
- Focus on **what** it does for the caller and **why** it exists — not how it works step-by-step.
- Skip comments on obvious one-liners (`return result`, `this.x = x`).

---

## Section X — DRY Principle (NON-NEGOTIABLE)

*(See Software Engineering Design Principles above for examples.)*

- **Rule of Three**: write once, note the second time, refactor on the third.
- Extract a function when the same 3+ lines appear in 2+ places.
- Create a shared module when 3+ files need the same utility.

Code review checklist for DRY:
- Flag duplicated consent checks, PHI access patterns, or error construction.
- Flag inline Elasticsearch query objects that could be builder methods.
- PRs with significant duplication must be revised before merge.
- Refactoring suggestions must include a specific target location in `shared/`.

---

## Section XI — Clean Code & Loose Coupling (NON-NEGOTIABLE)

### Layered Architecture (MANDATORY)

```
NestJS Controller  →  Service  →  Repository
NestJS Guard       →  Service  →  Repository
```

- **Controller** (`modules/*/controllers/`): parse request, call one service method, return response DTO. No business logic. No direct repository calls. No TypeORM imports.
- **Service** (`modules/*/services/`): business logic, orchestration, validation. No HTTP concepts (`@Req()`, `@Res()`, `HttpStatus`). No TypeORM direct queries — use repository methods only.
- **Repository** (`modules/*/repositories/` or `shared/database/`): TypeORM access only. Returns domain models (plain TypeScript classes), not raw `Entity` instances. No business rules.

### TypeScript Type Safety

- `strict: true` in `tsconfig.json` — non-negotiable.
- No `any` types in production code. Use `unknown` + type narrowing where the shape is genuinely unknown.
- DTOs validated with `class-validator` decorators. The `ValidationPipe` is global and configured with `whitelist: true, forbidNonWhitelisted: true`.
- Return types must be explicit on all public service methods — never rely on inferred `Promise<any>`.

### Dependency Injection

All dependencies injected via NestJS `@Injectable()` + constructor injection or `@Inject()` tokens. Never instantiate services, repositories, or providers inside a method.

```typescript
// WRONG — tight coupling, untestable
@Get(':documentId/download')
async getDownload(@Param('documentId') id: string) {
  const s3 = new S3Client({ region: process.env.AWS_REGION }); // hard-coded; not testable
  ...
}

// CORRECT — injected; swap StorageProvider for MockStorageProvider in tests
@Get(':documentId/download')
async getDownload(
  @Param('documentId', ParseUUIDPipe) id: string,
  @CurrentUser() user: JwtPayload,
) {
  return this.documentsService.getDownloadUrl(id, user.sub);
}
```

Constructor parameter lists must not exceed 7 parameters. If more are needed, group related dependencies into a config object or split the service.

### Boy Scout Rule

Leave every file you touch cleaner than you found it. Technical debt is addressed at the time of encounter — never deferred to a "cleanup sprint". Code reviews enforce this.

### Avoid God Objects

- No service with more than 12 public methods — split it.
- No function exceeding 40 lines — extract helpers.
- No file exceeding 500 lines — split into focused modules.

### Immutability

- Response DTOs are serialised, not mutated after construction.
- Domain events are plain immutable objects — `readonly` fields, constructed once.
- Repository query results are treated as read-only; services never mutate entity instances and call `save()` without explicit intent.

### Variable and Function Naming

- Variables: descriptive nouns (`consentRecord`, `ocrResult`, `presignedUrl`, not `cr`, `r`, `url`).
- Booleans: questions (`isConsentActive`, `hasNmcVerification`, `isPremiumUser`).
- Functions: verbs (`grantConsent`, `extractMedicineNames`, `computeRiskFlag`).
- No abbreviations unless universally known in the domain (`ocr`, `phi`, `nmc`, `jwt`, `sos`, `ai`, `rag`).

---

## Healthcare-Specific Security Engineering

### PHI Protection — Defence in Depth

PHI (Protected Health Information) is protected at three independent layers:

1. **Storage**: column-level AES-256 encryption (KMS-managed keys) for `phone`, `name`, `date_of_birth`, `allergies`, `abha_id`, `ocr_text`, `query_text`. TypeORM column transformers handle encrypt/decrypt transparently in the repository layer.
2. **Transit**: TLS 1.3 enforced. TLS 1.2 deprecated. S3 access via HTTPS pre-signed URLs only.
3. **Logs**: PII scrubbing interceptor removes all PHI fields from log context before emission. The interceptor runs on every outbound log entry — it is not optional per route.

### Consent Enforcement — Zero Trust PHI Access

No PHI crosses a patient-identity boundary without an active consent record. This is enforced at the Guard layer, not the service layer.

```typescript
// ConsentGuard — runs before any controller method decorated with @ConsentRequired()
async canActivate(context: ExecutionContext): Promise<boolean> {
  const request = context.switchToHttp().getRequest();
  const { patientId } = request.params;
  const doctorId = request.user.sub;
  // Every PHI access that crosses patient identity must pass this check
  const consent = await this.consentService.findActiveConsent(patientId, doctorId);
  if (!consent) throw new ErrConsentRequired(doctorId, patientId);
  return true;
}
```

The same guard is applied to `FAMILY_PROXY` access routes — checking the `family_medical_proxies` table instead of `consents`.

### Access Control — RBAC + Consent (Two-Layer)

Layer 1: Role check via `RolesGuard` — is the JWT principal allowed to call this endpoint at all?
Layer 2: Consent / ownership check — does the principal have the right to this specific patient's data?

Both layers must pass. Passing Layer 1 alone does not grant access to another patient's data.

### Audit Trail Integrity

The `audit_logs` and `nl_queries` tables are protected by a database-level `BEFORE UPDATE` and `BEFORE DELETE` trigger that raises an exception. Application-level enforcement is the primary control; the database trigger is the backstop. Every repository method that touches these tables is tested to confirm it inserts only.

### Principle of Least Privilege

| Component | Access granted | Access denied |
|-----------|---------------|---------------|
| OCR Worker | S3 read (patient uploads bucket) | All other S3 buckets; database; API |
| Notification Worker | SQS read; FCM; SNS | Patient data; database PHI fields |
| Hospital Admin | Manage institution doctors | Patient PHI; prescriptions; audit log |
| Platform Admin | System metrics; user management | PHI of any patient |
| Emergency Profile URL | Blood group, allergies, active meds | Full history; lab reports; financial data |

### SQL Injection Prevention

Use TypeORM ORM methods or parameterised queries — **never string concatenation** for SQL.

```typescript
// WRONG — SQL injection risk
const results = await this.entityManager.query(
  `SELECT * FROM documents WHERE patient_id = '${patientId}'`
);

// CORRECT — parameterised via TypeORM
const results = await this.documentRepo.find({
  where: { patientId },
});
```

For raw Elasticsearch queries, use the `@opensearch-project/opensearch` client's typed query DSL — never string-interpolated query bodies.

### CORS & Cross-Origin Security

CORS origins explicitly whitelisted — never `origin: '*'` in any environment. Configured via `CORS_ALLOWED_ORIGINS` environment variable.

```typescript
// main.ts — read from env; never hard-code origins
app.enableCors({
  origin: configService.get<string>('CORS_ALLOWED_ORIGINS').split(','),
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Authorization', 'Content-Type', 'X-Request-ID'],
  credentials: false,
});
```

### AI Insights Safety Guardrails

These rules are non-negotiable and enforced at the `InsightsService` level:

1. **Two-layer gate**: Rule-based threshold check (Layer A) must flag a risk before the AI call (Layer B) is made. The AI cannot introduce a risk not already flagged by deterministic rules.
2. **Schema validation before storage**: Every AI-generated insight is validated against `InsightSchema` before being stored. Invalid insights are discarded and the discard event is logged.
3. **No `LOW` risk notifications**: Only `MEDIUM` and `HIGH` risk insights are delivered. Low risk signals are logged internally but never surfaced to users.
4. **Throttle**: maximum 2 insights per patient per month. De-duplicate: same risk domain not notified again within 90 days.
5. **Mandatory disclaimer**: The disclaimer field in `InsightSchema` is non-nullable. An insight without a disclaimer fails schema validation.
6. **Forbidden phrases**: The AI system prompt prohibits: "diagnosis", "prognosis", "you have [disease]", "you are at risk of developing". Validated via post-generation regex check before schema validation.

---

## Database Naming Conventions

### Tables

Lowercase, underscore-separated. Core tables:

| Table | Purpose |
|-------|---------|
| `patients` | Patient profile (PHI encrypted) |
| `doctors` | Doctor profile + NMC status |
| `medical_specialties` | Specialty lookup (normalised reference table) |
| `institutions` | Hospitals and clinics |
| `documents` | All uploaded documents (prescriptions, labs, receipts) |
| `prescriptions` | Doctor-created digital prescriptions |
| `consents` | Patient-doctor consent records |
| `family_medical_proxies` | Proxy access grants |
| `family_members` | Family account links (managed + linked dependents) |
| `audit_logs` | Immutable append-only access log |
| `illness_episodes` | Patient-created illness episode containers |
| `medical_expenses` | Parsed receipt financial data |
| `health_metrics` | Extracted lab values for AI Insights |
| `health_insights` | AI-generated insights |
| `nl_queries` | Natural language query log (append-only) |
| `sos_events` | SOS trigger events |
| `sos_recipients` | Recipients notified per SOS event |

### Columns

- Column names: `snake_case` in PostgreSQL (TypeORM `@Column({ name: 'snake_case' })` maps to TypeScript `camelCase`).
- Timestamp columns: `TIMESTAMPTZ` type, UTC values always.
- Nullable columns must explicitly declare `NOT NULL` or `nullable: true` in the TypeORM decorator.

### Primary Key (NON-NEGOTIABLE)

Every table must have:
- `id VARCHAR(36) NOT NULL PRIMARY KEY` — UUID v4 generated in TypeScript (`import { v4 as uuidv4 } from 'uuid'`), set in the `@BeforeInsert()` hook of the base entity. **Never** use `gen_random_uuid()` in the database — UUID generation happens in the application layer.
- No separate auto-increment `id` for external-facing tables. UUID is both the PK and the external-facing ID.

### Index and FK Naming

- Indexes: `idx_{table}_{columns}` — e.g., `idx_consents_patient_id`, `idx_documents_patient_id_type`.
- Foreign keys: `fk_{table}_{referenced_table}` — e.g., `fk_documents_patients`, `fk_consents_doctors`.
- Unique constraints: `uq_{table}_{columns}` — e.g., `uq_doctors_nmc_id`.

### Migration Scripts

- Location: `database/migrations/`
- Naming: `{timestamp}__{description}.ts` — e.g., `1716384000000__initial_schema.ts`, `1716470400000__add_health_metrics.ts`. Use TypeORM's `MigrationInterface`.
- **Immutable once deployed** — never modify an existing migration. New changes always go in a new migration file.
- Use `IF NOT EXISTS` for `CREATE TABLE` statements to make scripts idempotent.
- Every migration must have a `down()` method that cleanly reverts the `up()`.

---

## Amendment Process

Changes to this constitution must:

1. Include a rationale for the change.
2. Include an impact analysis on existing code or conventions.
3. Include a migration plan if the change is breaking (e.g., a renamed guard, a changed error code).
4. Be approved by the technical lead before taking effect.
5. Add a version note at the bottom of this file with the date and summary of the change.

---

## Compliance Review

- All implementations must be reviewed against this file and `SYSTEM_DESIGN_OmniMedVault.md` before merging.
- PRs must include a compliance checklist or note documenting any exception.
- Quarterly review of this file to ensure it remains current as the product evolves through its phases.

---

## Exception Handling (Rule Exceptions)

Exceptions to any rule in this file must be documented in the PR with:

1. Which rule is being violated and why (technical or compliance constraint).
2. Simpler alternatives considered and why they were rejected.
3. Whether the exception is temporary (include a remediation plan) or permanent.
4. Explicit approval from the technical lead.

Undocumented violations will be rejected in code review.

---

## Do Not

- Do not call `S3Client`, `ImageAnnotatorClient` (Google Vision), or any external SDK directly in service code — always use the injected provider interface.
- Do not log PHI: phone numbers, names, DOB, Aadhaar IDs, ocr_text, diagnosis, medicines, query text, pre-signed URLs. Use document IDs, correlation IDs, and operation names only.
- Do not access patient records without passing `ConsentGuard` — no shortcut service-layer bypass of the consent check.
- Do not return raw TypeORM `Entity` instances from controllers — always map through response DTOs.
- Do not use `any` types in production code — use `unknown` or explicit interfaces.
- Do not generate UUIDs in the database (no `gen_random_uuid()`) — generate in TypeScript with the `uuid` library in the base entity `@BeforeInsert()` hook.
- Do not expose internal database IDs (auto-increment or otherwise) in API responses — UUID only.
- Do not implement the premium check in a service method — use `PremiumGuard` via the `@Premium()` decorator.
- Do not update or delete rows in `audit_logs` or `nl_queries` — these tables are INSERT-only.
- Do not publish an AI insight that has not passed `InsightSchema` validation — invalid insights are discarded silently.
- Do not surface a `LOW` risk AI insight to any user — low risk signals are logged internally only.
- Do not return a "pre-signed" URL that exposes the raw S3 key or bucket name — use the `StorageProvider` which generates time-limited CloudFront-signed or S3-signed URLs only.
- Do not allow a `PLATFORM_ADMIN` to access patient PHI — platform admins see system metrics and audit event counts only.
- Do not use `CORS origin: '*'` in any environment — explicit whitelist only.
- Do not hardcode model names, API keys, region names, or bucket names in source code — `ConfigService` only.
- Do not merge without `npm run lint` and `npx tsc --noEmit` both passing — CI enforces this.
- Do not build Phase 2 or Phase 3 features during Phase 1A unless explicitly agreed with the technical lead.
- Do not modify existing TypeORM migration files — new changes go in a new timestamped migration.
- Do not write medical advice, clinical judgements, or diagnostic language in any AI-generated content — only factual retrieval and clearly disclaimed risk flags.

---

## Technology Stack

| Component | Technology | Phase |
|-----------|-----------|-------|
| Backend | NestJS (Node.js 20 LTS / TypeScript 5.x) | Phase 1 |
| Mobile | Flutter 3.x (Dart) — Android | Phase 1 (iOS Phase 2) |
| Web | Next.js 14 (React 18 / TypeScript) | Phase 1 |
| Auth | AWS Cognito (OTP + JWT RS256) | Phase 1 |
| Database | AWS RDS PostgreSQL 16 (Multi-AZ) | Phase 1 |
| ORM | TypeORM | Phase 1 |
| Search | AWS OpenSearch 2.x | Phase 1 |
| File Storage | AWS S3 (AES-256 SSE-KMS) | Phase 1 |
| OCR (primary) | Google Cloud Vision API | Phase 1 |
| OCR (fallback) | AWS Textract | Phase 1 |
| Cache | AWS ElastiCache (Redis 7) | Phase 1 |
| Event Bus | Amazon SQS + SNS | Phase 1 |
| Push Notifications | Firebase Cloud Messaging (FCM) | Phase 1 |
| SMS | AWS SNS + Twilio (fallback) | Phase 1 |
| Email | AWS SES | Phase 1 |
| AI (Health Insights) | Claude API (claude-sonnet-4-6) + pgvector RAG | Phase 1B |
| Hosting | AWS ECS Fargate | Phase 1 |
| CDN | AWS CloudFront | Phase 1 |
| CI/CD | GitHub Actions + ArgoCD | Phase 1 |
| Monitoring | AWS CloudWatch + Sentry + Prometheus/Grafana | Phase 1 |
| Container Registry | AWS ECR | Phase 1 |
| Secret Management | AWS Secrets Manager | Phase 1 |
| PDF Generation | Puppeteer or PDFKit | Phase 1 |
| QR Generation | `qrcode` npm package | Phase 1 |

---

## Key Environment Variables

```bash
# AWS
AWS_REGION=ap-south-1
AWS_COGNITO_USER_POOL_ID=...
AWS_COGNITO_CLIENT_ID=...
AWS_S3_DOCUMENTS_BUCKET=omnimedvault-documents-prod
AWS_S3_PRESCRIPTIONS_BUCKET=omnimedvault-prescriptions-prod
AWS_KMS_PHI_KEY_ARN=...

# Database
DATABASE_URL=postgresql://user:pass@hostname/omnimedvault
DATABASE_MAX_CONNECTIONS=20

# Search
OPENSEARCH_URL=https://...ap-south-1.es.amazonaws.com
OPENSEARCH_INDEX_DOCUMENTS=documents
OPENSEARCH_INDEX_PRESCRIPTIONS=prescriptions
OPENSEARCH_INDEX_EXPENSES=medical_expenses

# Cache
REDIS_URL=redis://...cache.amazonaws.com:6379

# OCR
GOOGLE_CLOUD_VISION_CREDENTIALS=...  # JSON service account key (base64)
AWS_TEXTRACT_REGION=ap-south-1       # fallback OCR

# Notifications
FIREBASE_SERVER_KEY=...
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_FROM_NUMBER=...

# AI (Health Insights — Phase 1B)
ANTHROPIC_API_KEY=...
AI_MODEL=claude-sonnet-4-6
AI_TIMEOUT_SECONDS=60

# App
PORT=3000
NODE_ENV=production                  # development | staging | production
LOG_LEVEL=info                       # debug | info | warn | error
LOG_FORMAT=json                      # json | pretty (pretty for local dev only)
CORS_ALLOWED_ORIGINS=https://app.omnimedvault.com,https://doctor.omnimedvault.com
MAX_FILE_SIZE_MB=20
FREE_TIER_DOC_LIMIT=50
CONFIDENCE_GATE_THRESHOLD=0.80       # AI Insights: minimum OCR confidence for lab values

# Feature flags
INSIGHTS_ENABLED=false               # Toggle AI Health Insights (Phase 1B)
NL_QUERY_ENABLED=false               # Toggle Natural Language Query (Phase 2)
SOS_ENABLED=false                    # Toggle SOS feature (Phase 2)
```

---

## Implementation Timeline

> **Active schedule: 18 months across 3 phases.** The system design's phasing is authoritative — refer to `SYSTEM_DESIGN_OmniMedVault.md §6` for the full delivery plan.

| Phase | Months | Focus | Milestone |
|-------|--------|-------|-----------|
| **1A** | 1–6 | Core product: auth, patient upload, OCR, search, consent, doctor view, digital Rx, hospital admin, CRM widget, financial tracking (Premium) | **Core value loop live: patient stores → doctor views → doctor prescribes** |
| **1B** | 5–8 | AI Health Insights: lab value extraction, risk assessment engine, medical knowledge base (RAG), insight delivery | **AI Insights live (post regulatory review)** |
| **2** | 9–18 | iOS, 9 regional languages, ABHA integration, NL query, family accounts, medical proxy, SOS emergency, lab direct upload, Stripe billing, service extraction begins | **Ecosystem expansion** |
| **3** | 18+ | Pharmacy integration, full microservices, AI drug interaction warnings, telemedicine, general wellness tips, monthly health intelligence journal | **Platform completion** |

**Deferred to Phase 2 (not Phase 1A):** iOS app, regional languages beyond Hindi/English, ABHA, lab direct upload, automated Stripe billing, offline mode, family accounts, SOS, NL query, pharmacy.

**Deferred to Phase 3 (no design work in Phase 1 or 2):** Pharmacy integration, full microservices migration, General Wellness Tips, Monthly Health Intelligence Journal (requires ~1 year of substantial user data; requires separate anonymisation design and DPDPA commercial data consent model).

---

## Evaluation Targets

| Metric | Target | Phase |
|--------|--------|-------|
| OCR accuracy — printed prescriptions | ≥ 85% | 1A |
| OCR accuracy — handwritten text | ≥ 70% | 1A |
| API p95 latency | < 300 ms | 1A |
| Search p95 latency | < 500 ms | 1A |
| System availability | ≥ 99.9% | 1A |
| Consent enforcement — zero-bypass rate | 100% | 1A |
| Audit trail integrity — zero mutation rate | 100% | 1A |
| AI Insights schema pass rate | ≥ 98% | 1B |
| AI Insights false positive rate (beta doctors) | < 5% | 1B |
| NL query — exact match rate | ≥ 80% | 2 |
| PHI in logs — zero tolerance | 0 occurrences | All phases |

---

## Final Code Review

CODEX will review your output once you are done. All code must pass the review checklist:

- [ ] No PHI in any log line
- [ ] No consent bypass — `ConsentGuard` applied to all cross-patient data access
- [ ] Audit trail INSERT-only — no UPDATE or DELETE on `audit_logs` or `nl_queries`
- [ ] UUIDs generated in TypeScript — not in the database
- [ ] No `any` types in production code
- [ ] Pre-signed URLs via `StorageProvider` only — no raw S3 key exposure
- [ ] All external provider calls via injected interfaces
- [ ] Premium gate via `@Premium()` decorator — not implemented in service logic
- [ ] AI insights pass schema validation before storage or delivery
- [ ] `npm run lint` and `npx tsc --noEmit` both pass

---

*Constitution version: 1.0 | Date: 2026-06-01 | Aligned with SYSTEM_DESIGN_OmniMedVault.md v2.0*

---

> **CONFIDENTIAL & PROPRIETARY** — This document is the confidential and proprietary intellectual property of **Rishi Sood**. Unauthorized reproduction, distribution, or use is strictly prohibited. © 2026 Rishi Sood. All rights reserved.
