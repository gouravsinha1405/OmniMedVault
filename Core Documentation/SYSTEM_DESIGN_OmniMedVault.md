> **CONFIDENTIAL & PROPRIETARY** — This document is the confidential and proprietary intellectual property of **Rishi Sood**, dated May 19, 2026. Unauthorized reproduction, distribution, or use of this document or any part of it, in any form, is strictly prohibited. © 2026 Rishi Sood. All rights reserved.

---

# OmniMedVault — System Design Document
**Version:** 2.2 | **Date:** 2026-07-07 | **Status:** Provider Ratings module added (Phase 1)

---

## Table of Contents
1. [Problem Statement](#1-problem-statement)
2. [Actors & Use Cases](#2-actors--use-cases)
3. [Assumptions](#3-assumptions)
4. [Functional Requirements](#4-functional-requirements)
5. [Non-Functional Requirements](#5-non-functional-requirements)
6. [Phased Delivery Plan](#6-phased-delivery-plan) ← **Start here for implementation planning**
7. [High-Level Architecture](#7-high-level-architecture)
8. [Phase 1 Architecture: Modular Monolith](#8-phase-1-architecture-modular-monolith)
9. [Microservices Breakdown (Full Vision)](#9-microservices-breakdown-full-vision)
10. [Data Models](#10-data-models)
11. [API Design](#11-api-design)
12. [OCR Pipeline](#12-ocr-pipeline)
13. [Search Architecture](#13-search-architecture)
14. [Security & Compliance Design](#14-security--compliance-design)
15. [Doctor-Patient Consent Model](#15-doctor-patient-consent-model)
16. [CRM Embedding Strategy](#16-crm-embedding-strategy)
17. [Infrastructure & Cloud Design](#17-infrastructure--cloud-design)
18. [CI/CD Pipeline](#18-cicd-pipeline)
19. [Monitoring & Observability](#19-monitoring--observability)
20. [Disaster Recovery & Backup](#20-disaster-recovery--backup)
21. [Scalability Strategy](#21-scalability-strategy)
22. [AI Health Insights Engine](#22-ai-health-insights-engine) ← **New — Phase 1B**
23. [Monetisation & Billing Model](#23-monetisation--billing-model)
24. [Language & Localisation Strategy](#24-language--localisation-strategy)
25. [Resolved Decisions](#25-resolved-decisions)
26. [Family Medical Proxy — Remote Access for Trusted Family Members](#26-family-medical-proxy--remote-access-for-trusted-family-members)
27. [Natural Language Query Interface](#27-natural-language-query-interface)
28. [Future Scope](#28-future-scope)
29. [Vaccination Tracker Module](#29-vaccination-tracker-module) ← **New — Phase 1A**
30. [Provider Ratings Module](#30-provider-ratings-module) ← **New — Phase 1**

---

## 1. Problem Statement

In India, most citizens lack a fixed family doctor. Medical records are fragmented across countless clinics, hospitals, and labs — written on paper, often lost or forgotten. This creates:
- Repeated diagnostic tests (wasteful, expensive)
- Incorrect drug prescriptions (doctor unaware of patient's existing medications)
- No continuity of care
- Emergency situations where history is unknown

**Goal:** A unified, secure, lifelong digital medical record system accessible by both patients and authorised doctors.

---

## 2. Actors & Use Cases

### Actor 1: Patient (Individual)
- Register and create a profile
- Scan/upload prescriptions, lab reports, receipts
- View their own complete medical history
- Search records by date, disease, doctor, test name
- Grant or revoke access to a specific doctor
- Receive medication reminders
- Register children as managed dependents and track their vaccination schedule
- Receive timely reminders before upcoming vaccinations are due
- Rate doctors, hospitals, and clinics they have visited
- View consolidated provider ratings (OmniMedVault + external sources)

### Actor 2: Doctor
- Register with verified credentials (NMC ID)
- Request access to a patient's history (requires patient consent)
- Search patient's history by date, disease, medicine, lab result
- Create and submit a new digital prescription
- Access via mobile app AND via CRM-embedded web widget

### Actor 3: Hospital / Clinic Admin
- Onboard their institution to the platform
- Manage their doctors' accounts
- Embed the OmniMedVault widget into their existing CRM/HIS

### Actor 4: Lab (Future scope)
- Directly upload structured lab reports linked to a patient

### Actor 5: Platform Admin
- Manage users, resolve disputes, monitor system health

---

## 3. Assumptions

> These are decisions made where requirements were not explicitly specified.
> Any assumption marked **[CONFIRM]** needs your input before final design is locked.

| # | Assumption | Rationale |
|---|-----------|-----------|
| A1 | Android-first mobile app (iOS second phase) | ~95% smartphone users in India use Android |
| A2 | Data will be stored exclusively in Indian AWS regions (Mumbai / Hyderabad) | DPDPA 2023 data localisation requirements for sensitive personal data |
| A3 | ABHA (Ayushman Bharat Health Account) integration is Phase 2, not Phase 1 | ABHA adoption is growing but not universal; adds complexity |
| A4 | Doctor identity is verified via NMC (National Medical Commission) registration number | NMC provides a public lookup API for doctor verification |
| A5 | Patient grants explicit consent per doctor (not per visit) | Consent must be active for any access; it can be time-bound or permanent |
| A6 | OCR will handle both printed and handwritten text | The core value proposition requires this; Google Cloud Vision handles Indian handwriting |
| A7 | The system will support English and Hindi in Phase 1; other regional languages in Phase 2 | Hindi + English covers the largest segment |
| A8 | The mobile app requires internet connectivity; a "last-seen" offline cache is a Phase 2 feature | Simplifies Phase 1 significantly |
| A9 | Receipts ARE parsed for financial data — total amount, date, vendor, category extracted via OCR. Enables illness episode expense summaries and annual spend reports. This is a **PREMIUM** patient feature. | Confirmed — reverses original assumption |
| A10 | Patient model is **Freemium**: core features free; premium features (financial reports, AI Health Insights, family accounts, unlimited storage) require a paid subscription. Hospitals/clinics remain B2B SaaS paid. | Confirmed |
| A11 | Video/audio consultation is out of scope | Keeps the system focused |
| A12 | Pharmacy integration is out of scope (low priority, future) | Confirmed |
| A13 | Lab reports uploaded manually by patients; direct lab-to-platform integration is Phase 2 | Confirmed |
| A14 | Doctor can register and use the app with "pending NMC verification" status; prescription creation is locked until verified | Confirmed — avoids blocking legitimate doctors while NMC API is slow |
| A15 | Emergency access QR code is in scope: shows blood group, allergies, current medications — no consent required | Confirmed — life-safety feature |
| A16 | Phase 1 launches with English + Hindi OCR/UI; 9 additional regional languages in Phase 2 | Confirmed — i18n framework built from day 1 |
| A17 | CRM integration means easy web embedding (REST API + JS widget); no pre-built integrations with specific CRM vendors | Confirmed |
| A18 | Android-only for Phase 1; iOS in Phase 2 | Confirmed — consistent with India smartphone market |
| A19 | Team size is 2 engineers; Phase 1 architecture uses a modular monolith + managed services, not full microservices | Confirmed — microservices are the long-term target, not Phase 1 reality |

---

## 4. Functional Requirements

### Patient-Facing
- FR01: Register via phone number (OTP-based), with optional Aadhaar-based eKYC
- FR02: Upload documents via camera scan, file upload (PDF/image)
- FR03: Categorise documents as: Prescription / Lab Report / Receipt / Other
- FR04: OCR extraction from scanned handwritten or printed documents
- FR05: Search own history by: date range, doctor name, disease/diagnosis, medicine name, lab test name, **doctor specialty** (e.g. "eye", "ortho", "skin")
- FR06: Grant access to a doctor (QR code scan or doctor ID entry)
- FR07: Revoke access from any previously granted doctor
- FR08: View complete audit log of who accessed their records
- FR09: Download their records as a PDF report
- FR10: Emergency QR code — a scannable code in the app showing blood group, allergies, and current active medications; no login or consent required to view; patient controls what is shown; designed for medical emergencies when patient is unconscious

### Doctor-Facing
- FR11: Register with NMC ID; account is active in "pending verification" state immediately
  - Pending state: can view consented patient history, search records, add notes
  - Verified state: additionally can create and issue digital prescriptions
  - NMC verification happens asynchronously in the background; doctor notified when complete
- FR12: Request patient history after patient consent
- FR13: Search patient history (same dimensions as FR05)
- FR14: View current active medications and allergies (highlighted summary card at top of patient view)
- FR15: Create a new digital prescription linked to the patient's profile (verified doctors only)
- FR16: Access the full feature set from mobile app AND from embedded web widget in hospital software

### Patient-Facing — Financial Tracking (Premium, Phase 2)
- FR20: Receipt OCR parses financial data — vendor name, date, amount, itemized costs (where available), and auto-categorises as: Consultation / Medicine / Lab Test / Imaging / Procedure / IPD / Other
- FR21: Patient creates an **illness episode** (e.g., "Bone Fracture Surgery — July 2025") and links relevant documents (prescriptions, lab reports, receipts) to it — either manually or via system-suggested grouping
- FR22: Episode expense summary — total spend broken down by category: pre-hospitalisation, IPD, post-hospitalisation, OPD, medicines, consultations
- FR23: Ad-hoc financial query — "How much did I spend on medical expenses in the last 12 months?" filterable by year, category, family member, **and doctor specialty** (e.g. "how much spent on dental in 6 months")
- FR24: Downloadable PDF expense report — shareable with employer (for reimbursement), insurer, or tax purposes

### Patient-Facing — Family Account Management (Premium, Phase 2)
- FR25: Primary account holder can add **dependents** (spouse, children, parents) to their family group
- FR26: Two types of dependents:
  - **Managed dependent** — no smartphone / elderly / child; primary holder creates and fully manages their profile (uploads records, sees full history)
  - **Linked dependent** — has their own OmniMedVault account; grants primary holder view-only access to their financial summary (medical records remain private; dependent controls consent)
- FR27: Family financial dashboard — aggregated medical spend across all family members, filterable per member
- FR28: SOS feature (Phase 2) covers all family members in the same group

### Patient-Facing — Family Medical Proxy (Premium, Phase 2)
- FR35: A patient can grant a **trusted family member** (who has their own OmniMedVault account) read-only access to their medical history — this person is called a **Medical Proxy**. Typical example: a son living in another city who needs to consult a local doctor on behalf of a parent, or purchase medicines that were prescribed to the parent
- FR36: The Medical Proxy can view the patient's full medical timeline, search records, view current active medications and known allergies, and download document PDFs (prescriptions, lab reports) — all read-only
- FR37: Proxy access is consent-governed with the same lifecycle as doctor consent: patient approves, optionally sets an expiry date (30 days / 90 days / custom / permanent), and can revoke at any time with immediate effect
- FR38: Every record access by a Medical Proxy generates an immutable audit log entry and triggers a push notification to the patient: *"Rahul viewed your records at 2:15 PM today"*
- FR39: The Medical Proxy can forward a document PDF externally (e.g., share a prescription with a local doctor via WhatsApp or email) — they can share documents but cannot upload, edit, or delete anything in the patient's record

### Patient-Facing — Vaccination Tracker (Free, Phase 1A)
- FR50: Parent registers a child (as a managed dependent) and the system auto-generates the complete Government of India (GOI) immunisation schedule based on the child's date of birth, covering all mandatory vaccinations from birth through 15 years of age
- FR51: View the full vaccination timeline for each child — past vaccinations (with date and administering doctor/clinic recorded), upcoming vaccinations (with expected due date), and overdue vaccinations (highlighted prominently)
- FR52: Mark a vaccination as administered: record the date given, vaccine brand name (optional), dose number, clinic/hospital name, and administering doctor (optional)
- FR53: Upload a scanned copy of the physical vaccination card or certificate and link it to the corresponding vaccination record
- FR54: Reminder system — send push notification + SMS to the parent at configurable lead times before each due vaccination (default: 7 days before, 1 day before, and on the due date)
- FR55: Reminder acknowledgement — parent can snooze (reschedule reminder by 7 days) or mark vaccination as done directly from the notification
- FR56: Overdue alert — if a vaccination date passes without being marked administered, escalate the reminder cadence (weekly reminders) until resolved
- FR57: Download a printable PDF vaccination card for the child — formatted to resemble the standard GOI immunisation booklet; useful for school admissions, visa applications, and paediatric consultations
- FR58: Support for additional/optional vaccinations beyond the mandatory GOI schedule (e.g., Varicella, Hepatitis A, HPV, Influenza, Meningococcal) — parent can add these manually
- FR59: Vaccination history is visible to any doctor who has active consent from the parent's account, in the same child's record view (no separate consent needed if the doctor already has access to the child's medical profile)

### Patient-Facing — Provider Ratings (Free, Phase 1)
- FR60: A patient can rate a **doctor**, **hospital**, or **individual clinic** after any verified visit (a document — prescription, lab report, or receipt — from that provider must exist in their record)
- FR61: OmniMedVault in-app rating dimensions — **Doctor:** Expertise, Communication, Wait Time, Overall; **Hospital/Clinic:** Infrastructure, Cleanliness, Staff Behaviour, Wait Time, Overall — each on a 1–5 star scale with optional free-text review (max 300 chars)
- FR62: One rating per patient per provider per visit episode; editable within 30 days of submission; cannot re-rate the same visit after 30 days
- FR63: External ratings are read from open/free third-party sources: Google Places API (all provider types) and Practo (doctors and clinics) — displayed as a supplementary signal alongside the OmniMedVault community rating; never written back
- FR64: A **Composite Rating** is computed per provider as: `(OmniMedVault_avg × 0.70) + (ExternalAvg × 0.30)`; displayed on the provider's detail screen with source breakdown
- FR65: External ratings are cached (Redis, 24-hour TTL for doctors/clinics, 7-day TTL for hospitals); the cache miss triggers a background fetch — the API never blocks the UI on a live external call
- FR66: Minimum thresholds before composite is shown: ≥ 3 OmniMedVault ratings; ≥ 5 external reviews across all sources; below threshold, each available source is shown separately with a label
- FR67: Badges auto-assigned to providers based on composite score and review count — `Highly Rated` (≥ 4.5), `Community Favourite` (OmniMedVault score ≥ 4.3, ≥ 30 in-app ratings), `Avoid` (composite ≤ 2.5 with ≥ 10 reviews)
- FR68: Provider search within the app (find a doctor, hospital, or clinic) surfaces the composite rating and badges in search results
- FR69: A doctor with active patient consent can view the ratings their institution or clinic has received, but cannot see individual patient reviewer identities (ratings are anonymous by default; reviewer name is only shown if the patient opts in)

### Patient & Doctor — Natural Language Query Interface (Premium, Phase 2)
- FR40: A patient can type any question about their own medical history in plain everyday language — English or Hindi — and receive a direct, factual answer drawn exclusively from their actual records. Example: *"What was my haemoglobin in August 2021?"*
- FR41: If an exact record exists for the requested time period, the system returns the precise value with the document date and source. Example response: *"Your haemoglobin was 13.3 g/dL as per the lab report dated August 5, 2021."*
- FR42: If no exact record exists for the requested period, the system automatically searches within ±6 months and returns the nearest available records, clearly labelled as approximations. Example response: *"No lab report found from August 2021. Nearby records: HB = 12.8 g/dL on April 18, 2021 and HB = 13.2 g/dL on December 3, 2021."* The system never interpolates or estimates values — it only returns records that actually exist
- FR43: A doctor with active patient consent can use the same query interface against that patient's records. Example: *"Is this patient currently on any blood thinners?"* Every doctor query against a patient's records via this interface is logged to the audit trail and triggers a push notification to the patient
- FR44: The query interface supports multiple intent types: lab value lookup, medication lookup, doctor/visit lookup, document search, trend queries, expense queries (patient only), and diagnosis history lookup
- FR45: A query history (last 50 queries) is accessible in-app, allowing users to re-run previous queries with one tap

### Hospital/Clinic Admin
- FR29: Register institution, onboard their doctors
- FR30: Get an API key + embeddable JavaScript widget for their in-house medical software
- FR31: Monthly usage dashboard (number of prescriptions created, active doctors, patients served)

---

## 5. Non-Functional Requirements

| Category | Requirement |
|----------|------------|
| **Availability** | 99.9% uptime (≤ 8.7 hrs downtime/year) |
| **Latency** | API response < 300ms (p95); Search < 500ms (p95) |
| **Scalability** | Support 10M patients and 500K doctors in Year 2 |
| **Security** | AES-256 encryption at rest; TLS 1.3 in transit; zero plaintext PII in logs |
| **Compliance** | DPDPA 2023 (India); ABDM guidelines for health data |
| **Auditability** | Immutable audit log for every data read/write |
| **OCR Accuracy** | ≥ 85% accuracy on printed prescriptions; ≥ 70% on handwritten |
| **Data Retention** | Patient data retained for lifetime of account + 7 years after deletion request |
| **Recovery** | RTO ≤ 4 hours; RPO ≤ 1 hour |

---

## 6. Phased Delivery Plan

> With a 2-engineer team, sequencing is everything. This section is the authoritative guide to what gets built when.

### Phase 1A — Core Product (Target: months 1–6)

**Goal:** Prove the core value loop — patient stores records → doctor views them → doctor prescribes digitally.

| Area | Phase 1A Scope |
|------|--------------|
| Platform | Android mobile app + Doctor web interface |
| Auth | OTP phone login (patients and doctors) |
| Patient features | Upload docs (photo/PDF), OCR, categorise, search, view timeline, grant/revoke consent, emergency QR |
| Doctor features | Register (pending + verified state), view consented patients, search history, create digital Rx (verified only) |
| OCR languages | English + Hindi only |
| Hospital admin | Register institution, manage doctors, get embed widget + API key |
| CRM embedding | REST API + basic JS widget (iFrame embed — drop into any web software) |
| Monetisation | Manual invoicing for hospitals; Stripe integration Phase 2 |
| Infrastructure | Modular monolith on AWS ECS Fargate; managed services throughout |
| Languages/UI | English + Hindi |
| **Financial Tracking (Premium)** | Receipt OCR financial parsing; illness episode grouping; expense summaries by episode + annual; PDF expense report export |
| **Vaccination Tracker (Free)** | GOI schedule auto-generation from child DOB; vaccination record management; push + SMS reminders; PDF vaccination card export |
| **Provider Ratings (Free)** | In-app ratings for doctors/hospitals/clinics; external ratings from Google Places + Practo; weighted composite score (70% OmniMedVault / 30% external); badges; provider search integration |

**Not in Phase 1A:** AI Health Insights, iOS, remaining 9 languages, ABHA, lab direct upload, offline mode, pharmacy, automated billing, family accounts, SOS.

---

### Phase 1B — AI Health Insights (Target: months 5–8, after Phase 1A core is stable)

**Goal:** Add predictive health risk alerts backed by medical research — the key differentiating feature.

**Why 1B and not 1A:**
- Requires structured lab value extraction (built on top of Phase 1A OCR)
- Requires medical knowledge base curation (ongoing — needs a medical advisor)
- Requires CDSCO regulatory review before public launch (see Section 22 for detail)
- With 2 engineers, building both simultaneously risks shipping neither well

| Area | Phase 1B Scope |
|------|--------------|
| Lab value extraction | Parse numeric values from OCR'd lab reports (HbA1c, glucose, hemoglobin, etc.) |
| Health profile builder | Aggregate patient metrics over time; detect trends |
| Medical knowledge base | Curated, embedded medical research (PubMed, ICMR, WHO, Lancet India) using pgvector |
| Risk assessment engine | Rule-based thresholds + Claude API with RAG for nuanced, cited insights |
| Insight delivery | In-app notification + health insights dashboard card |
| Disclaimer system | Legally reviewed disclaimer on every insight; source citations visible |
| Diseases targeted (Phase 1B) | Diabetes, hypertension, thyroid, anemia, vitamin deficiencies, cardiovascular risk, kidney function |

---

### Phase 2 — Scale & Ecosystem (Target: months 9–18)

| Area | Phase 2 Scope |
|------|--------------|
| Platform | iOS app; Progressive Web App for patients |
| Languages | Telugu, Tamil, Marathi, Bengali, Punjabi, Gujarati, Kannada, Malayalam, Assamese (9 languages + existing 2 = 11 total) |
| OCR | Extend to all 11 languages/scripts |
| ABHA | Ayushman Bharat Health Account linking |
| Lab integration | Labs push structured reports directly to patient account |
| Architecture | Begin extracting high-load services (OCR, Search) from monolith into separate services |
| Billing | Stripe subscription management for hospitals |
| Offline mode | "Last-seen" cache for mobile; read-only offline access |
| Analytics | Hospital dashboard: prescription trends, common diagnoses |
| **SOS Emergency Feature** | One-tap emergency alert to last doctor, active hospitals, and nearest hospitals via GPS; multi-channel delivery (push + SMS); auto-prompt to dial 108; temporary shareable emergency profile link |
| **Family Account Management (Premium)** | Add managed and linked dependents; aggregated family spend view; SOS covers all family members |
| **Family Medical Proxy (Premium)** | A patient grants a trusted family member (e.g., son in another city) read-only access to their medical records — to consult a local doctor or buy prescribed medicines — with patient's explicit, revocable, optionally time-limited consent |
| **Natural Language Query Interface (Premium — patients; included for doctors)** | Ask questions about medical history in plain language; exact match returned if record exists; nearest available records returned with fallback label if not; supports lab values, medications, visit history, documents, trends, expenses |

---

### Phase 3 — Ecosystem Completion (18+ months)

- Pharmacy integration (verify and dispense against digital prescriptions)
- Full microservices migration
- AI-driven drug interaction warnings
- Direct integration with major hospital HIS (hospital information systems)
- Telemedicine referral handoff
- **General Wellness Tips** — geo-customised wellness content sourced from global wellness journals, tailored to the patient's geographical location (country, state, region). A tip valid in Punjab may not apply in Kerala; a tip from a European journal may not be relevant in India. Completely separate from the medical history feature set. *Detail design deferred to Phase 3 planning.*

---

## 7. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          CLIENT LAYER                               │
│                                                                     │
│   [Mobile App - Flutter]   [Web App - Next.js]   [CRM Widget]      │
│         Android/iOS             Browser           iFrame/SDK        │
└──────────────┬──────────────────────┬──────────────────┬───────────┘
               │                      │                  │
               └──────────────────────┴──────────────────┘
                                      │ HTTPS / TLS 1.3
                                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         API GATEWAY LAYER                           │
│           (AWS API Gateway + Kong — Rate Limiting, Auth,            │
│            Routing, DDoS Protection, SSL Termination)               │
└──┬──────┬────────┬──────────┬───────────┬──────────┬───────────────┘
   │      │        │          │           │          │
   ▼      ▼        ▼          ▼           ▼          ▼
┌──────────────────────────────────────────────────────────────────┐
│                      MICROSERVICES LAYER                         │
│                                                                  │
│  [Auth]  [User]  [Document]  [OCR]  [Search]  [Prescription]    │
│  [Consent/Audit]  [Notification]  [CRM Integration]             │
└──────────────────────────────┬───────────────────────────────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        │                      │                      │
        ▼                      ▼                      ▼
┌───────────────┐   ┌──────────────────┐   ┌─────────────────────┐
│  DATA STORES  │   │  MESSAGE BROKER  │   │  DOCUMENT STORAGE   │
│               │   │                  │   │                     │
│ PostgreSQL    │   │  Apache Kafka    │   │  AWS S3             │
│ Elasticsearch │   │  (Async events)  │   │  (Encrypted blobs)  │
│ Redis Cache   │   │                  │   │                     │
└───────────────┘   └──────────────────┘   └─────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────────────────┐
│                    INFRASTRUCTURE LAYER                           │
│   AWS EKS (Kubernetes)  |  AWS Mumbai + Hyderabad Regions         │
│   CloudFront CDN  |  Route 53 DNS  |  AWS WAF                    │
│   AWS KMS (Key Management)  |  AWS CloudTrail (Audit)             │
└───────────────────────────────────────────────────────────────────┘
```

---

## 8. Phase 1 Architecture: Modular Monolith

> A 2-engineer team cannot operate 9 independently deployed microservices. The full microservices vision in Section 9 is the target end-state. Phase 1 uses a **modular monolith** — the code is structured in modules (same boundaries as the future microservices) but deployed as a single application. This keeps operational complexity low while preserving the ability to extract services later without rewriting.

### Phase 1 Technology Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Mobile | Flutter (Android) | Single codebase; iOS readiness built in |
| Web | Next.js (React) | Doctor web interface + hospital admin panel |
| Backend | NestJS (Node.js) | Module system maps perfectly to future microservices; TypeScript |
| Auth | AWS Cognito | Fully managed OTP + JWT; zero auth code to write or maintain |
| Database | AWS RDS PostgreSQL (Multi-AZ) | Managed; reliable; familiar |
| Search | AWS OpenSearch (managed Elasticsearch) | No cluster to manage |
| File Storage | AWS S3 | Standard; unlimited; cheap |
| OCR | Google Cloud Vision API | Best accuracy for Indian handwriting; pay-per-use |
| Cache | AWS ElastiCache (Redis) | Managed; session caching |
| Hosting | AWS ECS Fargate | No Kubernetes to manage; just Docker containers |
| CDN | AWS CloudFront | Static assets + pre-signed document URLs |
| CI/CD | GitHub Actions | Free; simple; sufficient for 2-person team |
| Monitoring | AWS CloudWatch + Sentry | Managed; minimal setup |

### Phase 1 Deployment Topology

```
                    Internet
                       │
              AWS CloudFront (CDN)
                       │
              AWS ALB (Load Balancer)
                       │
        ┌──────────────┴──────────────┐
        │                             │
  ECS Fargate Task               ECS Fargate Task
  (NestJS Monolith)              (NestJS Monolith)
  Container 1                    Container 2
  (Active)                       (Active — 2 replicas min)
        │
        ├── AWS RDS PostgreSQL (Multi-AZ)
        ├── AWS OpenSearch
        ├── AWS ElastiCache Redis
        ├── AWS S3 (documents)
        └── Google Cloud Vision API (external)

  AWS Cognito  ←── handles all OTP / JWT / sessions
```

### Monolith Module Structure (maps to future microservices)
```
src/
  modules/
    auth/          ← will become Auth Service
    users/         ← will become User Service
    documents/     ← will become Document Service
    ocr/           ← will become OCR Service
    search/        ← will become Search Service
    prescriptions/ ← will become Prescription Service
    consent/       ← will become Consent & Audit Service
    notifications/ ← will become Notification Service
    institutions/  ← will become CRM Integration Service
    nl-query/      ← will become Natural Language Query Service
    vaccinations/  ← will become Vaccination Tracker Service
    ratings/       ← will become Provider Ratings Service
  shared/
    database/
    guards/
    middleware/
```

This structure means: when the team grows and it's time to extract a service, the code boundaries already exist. The migration is operational (split the deployment), not a code rewrite.

---

## 9. Microservices Breakdown (Full Vision)

### 7.1 Auth Service
**Responsibility:** Identity, authentication, token management
- OTP-based login (Twilio/AWS SNS for SMS)
- JWT access tokens (15-min expiry) + Refresh tokens (30-day expiry)
- Role assignment: PATIENT | DOCTOR | HOSPITAL_ADMIN | PLATFORM_ADMIN
- Optional: Aadhaar OTP-based eKYC via DigiLocker API
- MFA support (OTP via SMS/email)

### 7.2 User Service
**Responsibility:** Patient and Doctor profile management
- Patient profile: name, DOB, gender, blood group, known allergies, ABHA ID (optional)
- Doctor profile: name, NMC registration number, specialisation, affiliated institution
- NMC verification: async call to NMC public lookup on doctor registration
- Aadhaar/PAN stored only in encrypted, tokenised form (never as plaintext)

### 7.3 Document Service
**Responsibility:** Upload, categorise, store, retrieve medical documents
- Accepts image (JPG/PNG) and PDF uploads
- Virus/malware scan on upload (AWS Macie / ClamAV)
- Generates a secure, time-limited pre-signed S3 URL for download
- Stores metadata in PostgreSQL: patientId, type, date, doctorId, tags, ocrStatus
- Triggers OCR pipeline via Kafka event on upload

### 7.4 OCR Service
**Responsibility:** Extract text from scanned documents
- Consumes Kafka events from Document Service
- Sends image to Google Cloud Vision API (handles Indian handwriting)
- Post-processes extracted text: identifies medicine names, dosage, doctor name, date
- Uses a curated Indian drug name dictionary for entity recognition
- Stores structured output back in Elasticsearch for search indexing
- Flags low-confidence extractions for patient review

### 7.5 Search Service
**Responsibility:** Full-text and structured search across a patient's records
- Powered by Elasticsearch
- Indices: `documents`, `prescriptions`, `lab_reports`
- Supports search by: date range, free text (diagnosis, symptoms), doctor name, medicine name, lab test name
- Access-controlled: a doctor can only search within records of patients who have granted them access

### 7.6 Prescription Service
**Responsibility:** Digital prescription creation and management
- Doctor creates a prescription: diagnosis, medicines (name, dose, frequency, duration), notes, follow-up date
- Stored in PostgreSQL; indexed in Elasticsearch
- Generates a QR-coded PDF prescription (patient can share/print)
- Links automatically to patient's medical history timeline

### 7.7 Consent & Audit Service
**Responsibility:** Patient consent tracking and immutable audit trail
- Consent records: patientId, doctorId, grantedAt, expiresAt (nullable), revokedAt
- Every data access event (read/write) generates an audit record
- Audit records are write-once, stored in an append-only table
- Patient can view their full audit log from the app
- Alerts patient via notification when a doctor accesses their record

### 7.8 Notification Service
**Responsibility:** All outbound communications
- Channels: SMS (AWS SNS), Email (AWS SES), Push Notification (Firebase FCM)
- Events: access granted/revoked, new prescription added, doctor viewed your record, medication reminder
- Template-based, multi-language

### 7.9 CRM Integration Service
**Responsibility:** Enables hospitals to embed OmniMedVault into their existing systems
- Issues API keys per institution
- Provides an embeddable JavaScript widget (React component)
- OAuth2 flow: hospital's CRM authenticates doctors via OmniMedVault Auth
- Webhooks: hospital's CRM can subscribe to events (new prescription created, etc.)

---

## 8. Data Models

### Medical Specialties (Lookup Table)

A normalised reference table — not a hardcoded enum — so new specialties can be added without a schema migration.

```
medical_specialties
  id           UUID (PK)
  code         VARCHAR (unique)  -- e.g. "OPHTHALMOLOGY", "DENTISTRY"
  display_name VARCHAR           -- e.g. "Ophthalmology (Eye)", "Dentistry"
  common_name  VARCHAR           -- e.g. "Eye", "Tooth/Dental"  ← for natural language search
  is_active    BOOLEAN
```

**Seeded specialties (Phase 1A):**

| Code | Display Name | Common Name |
|------|-------------|-------------|
| GENERAL_MEDICINE | General Medicine / GP | GP, Family Doctor |
| PEDIATRICS | Pediatrics | Child, Paeds |
| ORTHOPEDICS | Orthopedics | Bone, Ortho |
| CARDIOLOGY | Cardiology | Heart |
| NEUROLOGY | Neurology | Brain, Neuro |
| DERMATOLOGY | Dermatology | Skin |
| OPHTHALMOLOGY | Ophthalmology | Eye |
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
| AYURVEDA | Ayurveda / Homeopathy / Naturopathy | Ayurveda |
| EMERGENCY | Emergency Medicine | Emergency, Casualty |

The `common_name` field enables natural language search mapping — when a patient types "tooth" or "dental," the system resolves it to `DENTISTRY` before querying.

### Patient
```
patients
  id             UUID (PK)
  phone          VARCHAR (unique, encrypted)
  name           VARCHAR (encrypted)
  date_of_birth  DATE (encrypted)
  gender         ENUM
  blood_group    VARCHAR
  abha_id        VARCHAR (nullable, encrypted)
  allergies      TEXT[] (encrypted)
  created_at     TIMESTAMP
  is_active      BOOLEAN
```

### Doctor
```
doctors
  id             UUID (PK)
  user_id        UUID (FK → users)
  nmc_id         VARCHAR (unique)
  nmc_verified   BOOLEAN
  specialty_id   UUID (FK → medical_specialties)
  sub_specialty  VARCHAR (nullable)  -- e.g. "Spine Surgery" under Orthopedics
  institution_id UUID (FK → institutions, nullable)
  created_at     TIMESTAMP
```

### Document (Prescription / Lab Report / Receipt)
```
documents
  id               UUID (PK)
  patient_id       UUID (FK → patients)
  type             ENUM (PRESCRIPTION, LAB_REPORT, RECEIPT, OTHER)
  source           ENUM (PATIENT_UPLOAD, DOCTOR_CREATED, LAB_UPLOAD)
  s3_key           VARCHAR (path to encrypted blob)
  ocr_status       ENUM (PENDING, COMPLETED, FAILED, REVIEW_NEEDED)
  ocr_text         TEXT (extracted text, encrypted)
  tags             VARCHAR[] (auto-tagged: disease, medicine, doctor)
  document_date    DATE (date on the document, not upload date)
  uploaded_by      UUID
  doctor_id        UUID (nullable)
  doctor_specialty_id UUID (FK → medical_specialties, nullable)
                        -- snapshot at upload time; populated from doctor
                        -- profile if doctor is on platform, or OCR-
                        -- extracted from prescription header if not
  created_at       TIMESTAMP
```

### Prescription (Doctor-created digital prescription)
```
prescriptions
  id                  UUID (PK)
  patient_id          UUID (FK → patients)
  doctor_id           UUID (FK → doctors)
  doctor_specialty_id UUID (FK → medical_specialties)
                          -- snapshot; stored even if doctor changes specialty later
  diagnosis           TEXT
  medicines           JSONB  [{name, dose, frequency, duration, instructions}]
  notes               TEXT
  follow_up_date      DATE (nullable)
  created_at          TIMESTAMP
  document_id         UUID (FK → documents — the generated PDF)
```

### Consent
```
consents
  id             UUID (PK)
  patient_id     UUID (FK → patients)
  doctor_id      UUID (FK → doctors)
  granted_at     TIMESTAMP
  expires_at     TIMESTAMP (nullable — null means indefinite)
  revoked_at     TIMESTAMP (nullable)
  status         ENUM (ACTIVE, EXPIRED, REVOKED)
```

### Audit Log
```
audit_logs
  id             UUID (PK)
  actor_id       UUID (who performed the action)
  actor_role     ENUM
  action         ENUM (VIEW, UPLOAD, PRESCRIBE, CONSENT_GRANT, CONSENT_REVOKE, ...)
  resource_type  ENUM (DOCUMENT, PRESCRIPTION, PROFILE, ...)
  resource_id    UUID
  patient_id     UUID
  ip_address     VARCHAR
  user_agent     VARCHAR
  timestamp      TIMESTAMP
  -- This table is INSERT-only. No UPDATE or DELETE ever.
```

---

## 9. API Design

All APIs follow REST principles, versioned under `/api/v1/`.
Authentication via `Authorization: Bearer <JWT>` header on all protected routes.

### Key Endpoints

```
# AUTH
POST   /api/v1/auth/otp/request          → Send OTP to phone
POST   /api/v1/auth/otp/verify           → Verify OTP, return JWT + refresh token
POST   /api/v1/auth/token/refresh        → Refresh access token
POST   /api/v1/auth/logout               → Invalidate refresh token

# PATIENT
GET    /api/v1/patients/me               → Get own profile
PUT    /api/v1/patients/me               → Update profile
GET    /api/v1/patients/me/timeline      → Chronological medical history
GET    /api/v1/patients/me/audit-log     → Who accessed my records

# DOCUMENTS
POST   /api/v1/documents                 → Upload document (multipart/form-data)
GET    /api/v1/documents/:id             → Get document metadata
GET    /api/v1/documents/:id/download    → Get pre-signed download URL
GET    /api/v1/documents                 → List own documents (paginated, filterable)

# SEARCH
GET    /api/v1/search?q=&type=&from=&to=&doctorId=&specialty=   → Search own records (patient)
GET    /api/v1/patients/:id/search?...                           → Search patient records (doctor, needs consent)
GET    /api/v1/specialties                                       → List all medical specialties (for filter dropdowns)

# EXPENSES (Premium)
GET    /api/v1/expenses?from=&to=&specialty=&category=           → Expense list with filters
GET    /api/v1/expenses/summary?year=&specialty=&patientId=      → Aggregated spend summary
GET    /api/v1/expenses/report?episodeId=                        → Episode expense report (PDF)

# PRESCRIPTIONS
POST   /api/v1/prescriptions             → Doctor creates prescription
GET    /api/v1/prescriptions/:id         → Get prescription detail
GET    /api/v1/patients/:id/prescriptions → Get patient's prescription list

# CONSENT
POST   /api/v1/consent                   → Patient grants access to doctor
DELETE /api/v1/consent/:doctorId         → Patient revokes access
GET    /api/v1/consent                   → Patient views all active consents

# DOCTOR
POST   /api/v1/doctors/register          → Doctor registration
GET    /api/v1/doctors/:id/patients      → Doctor's consented patient list

# FAMILY MEDICAL PROXY
POST   /api/v1/family-proxy/request              → Proxy sends access request to a patient
GET    /api/v1/family-proxy/pending              → Patient views incoming pending requests
POST   /api/v1/family-proxy/:id/approve          → Patient approves request (body: { expiresAt? })
POST   /api/v1/family-proxy/:id/decline          → Patient declines request
DELETE /api/v1/family-proxy/:id                  → Patient revokes an active proxy grant
GET    /api/v1/family-proxy/given                → Patient lists everyone they have granted proxy access
GET    /api/v1/family-proxy/received             → Proxy lists all patients who have granted them access

GET    /api/v1/proxy/:patientId/timeline         → Proxy views patient's full medical timeline
GET    /api/v1/proxy/:patientId/documents        → Proxy lists patient's documents (paginated)
GET    /api/v1/proxy/:patientId/documents/:id/download  → Proxy gets pre-signed download URL
GET    /api/v1/proxy/:patientId/prescriptions    → Proxy views patient's prescriptions
GET    /api/v1/proxy/:patientId/search?q=...     → Proxy searches patient's records
GET    /api/v1/proxy/:patientId/summary          → Proxy views active medications + allergy card

# NATURAL LANGUAGE QUERY
POST   /api/v1/query                             → Patient queries their own records in natural language
GET    /api/v1/query/history                     → Last 50 queries by the authenticated user
POST   /api/v1/query/patient/:patientId          → Doctor or proxy queries a patient's records
                                                    (requires active consent; triggers audit log + patient push notification)

# CRM / INSTITUTION
POST   /api/v1/institutions/register     → Register hospital/clinic
GET    /api/v1/institutions/widget-config → Widget embed config + API key

# PROVIDER RATINGS
GET    /api/v1/providers/search?q=&type=&city=&page=             → Search doctors/hospitals/clinics; returns composite rating + badges
GET    /api/v1/providers/:providerId                             → Provider detail with full rating breakdown (OmniMedVault + external + composite)
POST   /api/v1/ratings                                           → Patient submits a rating for a provider (requires visit evidence)
GET    /api/v1/ratings/me                                        → Patient lists their own submitted ratings
PATCH  /api/v1/ratings/:ratingId                                 → Patient edits a rating (within 30-day window)
GET    /api/v1/providers/:providerId/ratings                     → Public list of OmniMedVault ratings for a provider (paginated; reviewer identity anonymised by default)

# VACCINATION TRACKER
GET    /api/v1/vaccinations/schedule                              → Get GOI master schedule (lookup — all vaccines + age milestones)
GET    /api/v1/patients/:patientId/vaccinations                   → Get full vaccination timeline for a child (parent or consented doctor)
PATCH  /api/v1/patients/:patientId/vaccinations/:vaccinationId    → Mark a vaccination as administered (or overdue/skipped)
POST   /api/v1/patients/:patientId/vaccinations/extra             → Add an optional/non-GOI vaccination record
GET    /api/v1/patients/:patientId/vaccinations/pdf               → Download printable PDF vaccination card
GET    /api/v1/patients/:patientId/vaccinations/reminders         → List scheduled reminders for upcoming vaccinations
PATCH  /api/v1/patients/:patientId/vaccinations/reminders/:id     → Snooze or dismiss a vaccination reminder
```

---

## 10. OCR Pipeline

```
Patient uploads image
         │
         ▼
  Document Service
  ┌─────────────────────┐
  │ 1. Virus scan        │
  │ 2. Store in S3       │
  │ 3. Save metadata     │
  │    (status=PENDING)  │
  │ 4. Publish Kafka     │
  │    event             │
  └──────────┬──────────┘
             │ Kafka: document.uploaded
             ▼
      OCR Service (async)
  ┌──────────────────────────────────┐
  │ 1. Fetch image from S3           │
  │ 2. Send to Google Cloud Vision   │
  │    (or AWS Textract as fallback) │
  │ 3. Receive raw extracted text    │
  │ 4. NLP post-processing:          │
  │    - Extract: date, doctor name, │
  │      diagnosis, medicine names,  │
  │      dosage, lab test names      │
  │    - Match medicines against     │
  │      Indian drug name dictionary │
  │ 5. Confidence score check:       │
  │    if score < threshold →        │
  │    status = REVIEW_NEEDED        │
  │    else status = COMPLETED       │
  │ 6. Store structured data in      │
  │    PostgreSQL + Elasticsearch    │
  │ 7. Publish Kafka event           │
  └──────────────────────────────────┘
             │ Kafka: document.ocr.completed
             ▼
  Notification Service → Push notification to patient
  ("Your prescription has been digitised — please verify")

  Patient reviews → can correct extracted text in app
```

**Technology choices:**
- **Google Cloud Vision API:** Best accuracy for handwritten Indian text; handles multilingual (Hindi + English mixed)
- **AWS Textract:** Fallback, better for printed forms and structured documents
- **Indian drug dictionary:** Custom curated list (~15,000 generic + brand names) used for entity matching

**Specialty extraction from uploaded prescriptions:**
Most printed prescriptions in India include the doctor's qualifications and specialty in the header (e.g., *"Dr. R. Mehta — MS (Ortho), MBBS"* or *"Consultant Cardiologist"*). The OCR post-processor attempts to:
1. Extract degree/specialty string from the top of the prescription
2. Match against the `medical_specialties` lookup table (by display name and common synonyms)
3. If matched with confidence ≥ 75% → set `doctor_specialty_id` on the document
4. If the uploading doctor is a registered OmniMedVault user → use their registered specialty directly (more reliable)
5. If neither succeeds → `doctor_specialty_id` remains null; patient can manually tag the specialty from a dropdown when reviewing the document

---

## 11. Search Architecture

### Elasticsearch Indices

**Index: `documents`**
```json
{
  "patient_id": "keyword",
  "type": "keyword",
  "document_date": "date",
  "ocr_text": "text (analysed)",
  "tags": "keyword[]",
  "doctor_name": "text",
  "doctor_specialty_code": "keyword",
  "doctor_specialty_display": "text",
  "diagnosis": "text",
  "medicines": "text[]"
}
```

**Index: `prescriptions`**
```json
{
  "patient_id": "keyword",
  "doctor_id": "keyword",
  "doctor_specialty_code": "keyword",
  "doctor_specialty_display": "text",
  "diagnosis": "text",
  "medicines.name": "text",
  "created_at": "date"
}
```

**Index: `medical_expenses`**
```json
{
  "patient_id": "keyword",
  "expense_date": "date",
  "category": "keyword",
  "specialty_code": "keyword",
  "specialty_display": "text",
  "vendor_name": "text",
  "total_amount": "float"
}
```

### Search Flow
1. Request arrives at Search Service with `patientId`, query params
2. Service verifies: does the requesting user have consent to search this patient?
3. **Specialty resolution:** if `specialty` param is provided (e.g., "tooth" or "dental"), resolve via `common_name` lookup in `medical_specialties` table → `DENTISTRY` code before querying
4. Build Elasticsearch query:
   - Filter by `patient_id` (mandatory — never cross-patient leakage)
   - Optional filters: date range, type, doctorId, **specialty_code**
   - Full-text match on `ocr_text`, `diagnosis`, `medicines`
5. Return ranked results with snippet highlights
6. Log search event to Audit Service

### Example Queries Enabled

| Patient asks | Search parameters |
|---|---|
| "When did I last visit an eye specialist?" | specialty=OPHTHALMOLOGY, sort=date DESC, limit=1 |
| "All my visits to a skin doctor" | specialty=DERMATOLOGY, type=PRESCRIPTION |
| "How much did I spend on dental in last 6 months?" | expenses index, specialty=DENTISTRY, date range = last 6 months, SUM(total_amount) |
| "What did the cardiologist diagnose in 2024?" | specialty=CARDIOLOGY, date range=2024, return diagnosis field |
| "Total spent on my child's paediatrician this year" | expenses index, specialty=PEDIATRICS, patient=child_id, SUM |

### Access Control in Search
- A patient can only search their own records
- A doctor can only search records of patients who have granted them consent
- This check happens at the application layer AND is enforced as a mandatory `filter` clause in every Elasticsearch query (defence in depth)

---

## 12. Security & Compliance Design

### Encryption
| Layer | Method |
|-------|--------|
| Data in transit | TLS 1.3 (enforced; TLS 1.2 deprecated) |
| Data at rest (S3) | AES-256 (Server-Side Encryption with AWS KMS) |
| PII in database | Column-level encryption (AWS KMS + application-layer AES-256) |
| Backup data | Encrypted with separate KMS key |
| JWT tokens | RS256 (asymmetric signing) |

### Personally Identifiable Information (PII) Handling
- Phone numbers, names, DOB, Aadhaar references are encrypted in the database
- PII is **never** written to logs — log scrubbing middleware applied to all services
- Search indices store only de-identified tokens for matching; actual PII is retrieved from the encrypted DB

### Role-Based Access Control (RBAC)
```
PATIENT           → own records only
DOCTOR            → consented patients' records only (read + create prescription)
FAMILY_PROXY      → approved patient's records only (read-only; no upload, edit, or prescribe)
HOSPITAL_ADMIN    → manage institution's doctors (no patient data access)
PLATFORM_ADMIN    → system management (no PHI access; audit only)
```

### DPDPA 2023 Compliance (India)
- **Consent-first:** No data processing without explicit, informed patient consent
- **Right to erasure:** Patient can request account deletion; data purged within 30 days
- **Data localisation:** All data stored in Indian AWS regions (ap-south-1, ap-south-2)
- **Breach notification:** Automated pipeline to notify CERT-In and affected users within 72 hours
- **Data minimisation:** Only data necessary for the service is collected

### Network Security
- AWS WAF (Web Application Firewall) — blocks OWASP Top 10 attacks
- API rate limiting (per IP and per user) at API Gateway
- DDoS protection via AWS Shield Standard
- VPC isolation: no service is publicly accessible except through API Gateway
- Private subnets for all databases and internal services

### Vulnerability Management
- Automated dependency scanning (Snyk) on every code push
- Container image scanning (AWS ECR built-in + Trivy) before deployment
- Penetration testing: quarterly external pen-test by third party
- SAST (Static Application Security Testing) in CI pipeline (SonarQube)

---

## 13. Doctor-Patient Consent Model

This is the most critical privacy mechanism in the system.

```
┌──────────────────────────────────────────────────────────────┐
│                    CONSENT LIFECYCLE                         │
│                                                              │
│  1. Doctor requests access → patient receives notification   │
│                                                              │
│  2. Patient approves:                                        │
│     Option A: Permanent (until revoked)                      │
│     Option B: Time-limited (e.g., for 30 days)              │
│     Option C: Single session (expires when doctor logs out)  │
│                                                              │
│  3. Doctor can now search/view patient's history             │
│                                                              │
│  4. Every access by doctor → push alert to patient           │
│     "Dr. Sharma viewed your records at 10:32 AM today"       │
│                                                              │
│  5. Patient can revoke at any time → immediate effect        │
│                                                              │
│  6. Expired/revoked consent → doctor loses access instantly  │
└──────────────────────────────────────────────────────────────┘
```

### Consent Grant Methods
- **QR Code:** Doctor shows their QR code; patient scans with their app → instant consent
- **Doctor ID:** Patient enters doctor's unique ID in app → manual verification
- **Institution Link:** Patient checks into a hospital via the app; consents to all registered doctors at that institution for the session duration

---

### Consent Scope — Two-Layer Model

Consent controls *duration* (above) and *scope* (what the doctor actually sees). Scope is configured via two independent layers at the time of access grant.

#### Layer 1: Specialty Records (Patient-Configurable)

The patient selects which category of records the authorised doctor can access:

| Option | What the doctor sees | Default for |
|---|---|---|
| **Full History** | All records across all specialties | GPs, family doctors |
| **Specialty-Specific** | Only records linked to the doctor's registered specialty — consultations, prescriptions, lab reports, imaging | Specialists (auto-detected from doctor's profile) |
| **Custom** | Patient manually selects individual record categories or specific documents | Advanced / power users |

When a specialist is granted access, the system defaults to Specialty-Specific scope and pre-selects the matching specialty. The patient can widen or narrow this before confirming.

---

#### Layer 2: Active Medication Context (ON by default — safety layer)

Regardless of the Layer 1 scope selected, every authorised doctor is shown a **cross-specialty Active Medication List** — all medications the patient is currently taking, regardless of which specialist prescribed them.

**Clinical rationale:**
A specialist treating a patient for one condition who prescribes without knowledge of the patient's full medication picture risks:
- Prescribing a drug whose active salt is already in use under a different brand name
- Creating a dangerous drug–drug interaction (e.g., combining an anticoagulant with an NSAID prescribed by another doctor)
- Duplicating a drug class (e.g., prescribing a second antacid when one is already active from a gastroenterologist)
- Compounding side effects from drugs with overlapping mechanisms

Example: A cardiologist treating a patient for heart complications may prescribe a diuretic or ACE inhibitor without realising the patient is already on an antihypertensive from their physician, metformin from a diabetologist, and a proton pump inhibitor from a gastroenterologist. The Active Medication Context makes this visible — immediately, automatically, without requiring the patient to remember and verbalise every drug they take.

This directly addresses one of the root causes of preventable medical errors identified in the Problem Statement (§1): *"Incorrect drug prescriptions — doctor unaware of patient's existing medications."*

**What the Active Medication List contains:**

| Field | Source |
|---|---|
| Medicine name (brand + generic/salt) | OCR-extracted from prescription or doctor-entered |
| Dose and frequency | Prescription record |
| Prescribing doctor name and specialty | Doctor profile or OCR-extracted |
| Prescription date | Document date |
| Duration / ongoing flag | Prescription record; `ongoing = true` for chronic conditions |

**Computation:** Derived in real time from all prescription records where `current_date ≤ prescription_date + duration_days`, or where `ongoing = true`. Updated automatically as new prescriptions are uploaded or created.

**Patient override:** The patient may toggle off Layer 2 for a specific doctor. The system displays a prominent, non-dismissible safety warning before permitting this. The override decision is recorded in the audit log.

---

#### Consent Configuration UI Flow (at time of access grant)

```
Step 1 — Duration
  ○ Permanent (until revoked)
  ○ Time-limited  →  [  30  ] days
  ○ Single session only

Step 2 — What can they see?
  ○ Full medical history
  ● Only [Cardiology] records             ← auto-selected from doctor's specialty

  ┌─────────────────────────────────────────────────────────────┐
  │ ✅ Also share my current medication list (Recommended)      │
  │    Dr. Sharma will see all medicines you are taking now,    │
  │    regardless of which doctor prescribed them.              │
  │                                                             │
  │    ⚠ Turning this off means the doctor will not see your   │
  │    complete medication picture. This may affect their       │
  │    prescription decisions and your safety.                  │
  └─────────────────────────────────────────────────────────────┘
```

---

#### Doctor-Facing: Medication Context Display

When a doctor opens an authorised patient's record and Layer 2 is active, a persistent **Medication Context card** is shown at the top of the patient view:

```
┌──────────────────────────────────────────────────────────────┐
│  💊 Currently Active Medications (5)                         │
│  ─────────────────────────────────────────────────────────── │
│  Metoprolol 25mg · once daily       [Dr. Patel — Cardiology] │
│  Metformin 500mg · twice daily   [Dr. Singh — Diabetology]   │
│  Amlodipine 5mg · once daily        [Dr. Patel — Cardiology] │
│  Pantoprazole 40mg · once daily [Dr. Iyer — Gastroenterology]│
│  Atorvastatin 10mg · once daily     [Dr. Patel — Cardiology] │
│                                                              │
│  [View full prescription history]                            │
└──────────────────────────────────────────────────────────────┘
```

This card is rendered before any specialty-specific records, ensuring the doctor sees the full medication picture before reviewing any notes or creating a new prescription.

**Phase 2 addition (flagged, not in current scope):** When the doctor uses the in-app prescription tool (Vault Notes) to issue a new prescription, an optional drug interaction check will run the proposed medicine against the Active Medication List and flag: same active salt already prescribed; known drug–drug interaction; same pharmacological class. This positions OmniMedVault as an active clinical safety layer, not merely a record store.

---

## 14. CRM Embedding Strategy

### Architecture
```
Hospital's CRM (browser)
         │
         │  <script> embed tag
         ▼
  OmniMedVault Widget (React)
  ┌───────────────────────────┐
  │  iframe (sandboxed)       │
  │  ┌───────────────────┐    │
  │  │ Doctor UI:        │    │
  │  │ - Patient search  │    │
  │  │ - History view    │    │
  │  │ - Rx creation     │    │
  │  └───────────────────┘    │
  └──────────┬────────────────┘
             │ API calls with institution API key + doctor JWT
             ▼
     OmniMedVault API Gateway
```

### Integration Flow
1. Hospital registers on OmniMedVault → gets `institutionId` + `apiKey`
2. Hospital embeds one `<script>` tag in their CRM
3. When doctor logs into CRM, the widget appears in the sidebar
4. Doctor authenticates with OmniMedVault (one-time OAuth2 link between CRM identity and OmniMedVault account)
5. Patient context (if CRM sends `patientPhone`) auto-looks up patient (only if consent exists)
6. Widget is fully sandboxed in an iframe — hospital's CRM cannot intercept OmniMedVault data

### Webhooks (for CRM push events)
- `prescription.created` → CRM is notified when doctor creates an Rx
- `consent.granted` → patient granted access for this doctor
- Hospital configures webhook URL during onboarding

---

## 15. Infrastructure & Cloud Design

### Cloud Provider: AWS (India Regions)
```
Primary Region:  ap-south-1 (Mumbai)
Secondary Region: ap-south-2 (Hyderabad)  ← Disaster recovery
```

### Infrastructure Components

```
Internet → CloudFront CDN → AWS WAF → AWS Shield
                                          │
                                          ▼
                              Route 53 (DNS + Health checks)
                                          │
                            ┌─────────────┴─────────────┐
                            │                           │
                     Public ALB                  Internal ALB
                    (API Gateway)              (Service mesh)
                            │                           │
                  ┌─────────┴──────────────────────────┐
                  │      EKS Cluster (Kubernetes)       │
                  │                                     │
                  │  Node Group 1: Application Pods     │
                  │  Node Group 2: Memory/CPU heavy     │
                  │               (OCR, Search)         │
                  └─────────────────────────────────────┘
                                    │
          ┌─────────────────────────┼──────────────────────┐
          │                         │                      │
   RDS PostgreSQL             Elasticsearch          ElastiCache
   (Multi-AZ)                 (Managed via           (Redis)
   Primary + Replica          AWS OpenSearch)        (Session cache)
```

### Storage Architecture (AWS S3)
```
Bucket: omnimedvault-documents-prod
  ├── /patient-uploads/     (raw scans, encrypted)
  ├── /ocr-processed/       (post-OCR cleaned versions)
  └── /prescriptions/       (doctor-generated PDFs)

Bucket: omnimedvault-backups-prod
  └── /rds-snapshots/
  └── /elasticsearch-snapshots/

S3 Policies:
  - Versioning enabled (protects against accidental deletion)
  - Lifecycle: move to S3 Glacier after 1 year (cost optimisation)
  - Access: only via pre-signed URLs (never public)
```

### Kubernetes Architecture
- Namespaces per service (`auth`, `document`, `ocr`, `search`, `prescription`, etc.)
- Horizontal Pod Autoscaler (HPA) on all services
- Pod Disruption Budgets (ensure availability during node maintenance)
- Istio service mesh: mTLS between all services (mutual authentication)
- Secrets stored in AWS Secrets Manager (not in Kubernetes secrets)

---

## 16. CI/CD Pipeline

```
Developer workstation
        │
        │  git push / PR
        ▼
    GitHub Repository
        │
        ▼
  GitHub Actions (CI) ─────────────────────────────────────────────┐
  ┌─────────────────────────────────────────────────────────────┐   │
  │  Stage 1: Code Quality                                      │   │
  │    - Lint (ESLint / Flake8 / ktlint)                        │   │
  │    - Unit Tests                                             │   │
  │    - Code coverage check (must be ≥ 80%)                    │   │
  │    - SonarQube SAST scan                                    │   │
  │                                                             │   │
  │  Stage 2: Security                                          │   │
  │    - Snyk dependency vulnerability scan                     │   │
  │    - Trivy container image scan                             │   │
  │    - Secret detection (GitGuardian / TruffleHog)            │   │
  │    ❌ FAIL → block merge, notify developer                  │   │
  │                                                             │   │
  │  Stage 3: Build                                             │   │
  │    - Build Docker image                                     │   │
  │    - Tag with: git SHA + branch + timestamp                 │   │
  │    - Push to AWS ECR                                        │   │
  │                                                             │   │
  │  Stage 4: Deploy to STAGING                                 │   │
  │    - ArgoCD syncs from `staging` branch                     │   │
  │    - Kubernetes rolling update                              │   │
  │    - Smoke tests (automated Postman / Playwright)           │   │
  │    - Integration tests against staging DB                   │   │
  │    - Performance test (k6 — must meet latency targets)      │   │
  │                                                             │   │
  │  Stage 5: Manual Approval Gate                              │   │
  │    - Tech lead or QA lead reviews staging                   │   │
  │    - Clicks "Approve" in GitHub Actions                     │   │
  │                                                             │   │
  │  Stage 6: Deploy to PRODUCTION                              │   │
  │    - Strategy: Blue-Green deployment                        │   │
  │      (new version deployed in parallel; traffic switched    │   │
  │       only when health checks pass)                         │   │
  │    - Automated rollback trigger:                            │   │
  │      if error rate > 1% in 5 min → auto-rollback           │   │
  │    - Post-deploy health check (15 min monitoring window)    │   │
  │    - Deployment notification (Slack)                        │   │
  └─────────────────────────────────────────────────────────────┘   │
        │                                                            │
        │ Environments:                                              │
        │   dev     → developer local / ephemeral preview           │
        │   staging → mirrors prod, used for integration testing     │
        │   prod    → live, India regions, full HA                  │
        └────────────────────────────────────────────────────────────┘
```

### Branch Strategy (GitFlow)
```
main          ← production-ready code only
develop       ← integration branch
feature/*     ← individual features (PR → develop)
hotfix/*      ← urgent fixes (PR → main + develop)
release/*     ← release candidate (develop → main)
```

### Key CI/CD Principles
- No human can directly push to `main`; only merges via approved PRs
- Every PR requires: passing CI + 1 code review approval
- Secrets are never in code; injected at runtime from AWS Secrets Manager
- Immutable infrastructure: never SSH into a running pod to fix things

---

## 17. Monitoring & Observability

### Three Pillars of Observability

**Metrics (Prometheus + Grafana)**
- Service-level: request rate, error rate, latency (p50/p95/p99)
- Business-level: uploads per hour, OCR success rate, active consents, prescriptions created
- Infrastructure: CPU, memory, disk, network for all pods
- Custom dashboards per service + executive dashboard

**Logs (ELK Stack: Elasticsearch + Logstash + Kibana)**
- Structured JSON logging from all services
- Correlation ID on every request (traces a single user action across all services)
- PII scrubbing middleware ensures no sensitive data in logs
- Log retention: 90 days in hot storage; 1 year in cold storage (S3 archive)

**Distributed Tracing (AWS X-Ray / OpenTelemetry)**
- Full trace of every request across microservices
- Identifies latency bottlenecks (e.g., "OCR service is the slowest step")
- Errors traced to exact line of code

### Alerting
| Alert | Threshold | Action |
|-------|-----------|--------|
| API error rate | > 1% for 5 min | PagerDuty → on-call engineer |
| Latency p95 | > 1s for 5 min | PagerDuty → on-call engineer |
| OCR failure rate | > 20% | Alert OCR team |
| Disk usage | > 80% | Slack alert → ops team |
| Audit log write failure | Any | Critical alert → immediate |
| Unusual data access pattern | Anomaly | Security alert |

---

## 18. Disaster Recovery & Backup

| Component | Backup Method | Frequency | Retention | RTO | RPO |
|-----------|---------------|-----------|-----------|-----|-----|
| PostgreSQL | RDS automated snapshots + Multi-AZ | Continuous | 35 days | 1hr | 5min |
| Elasticsearch | Snapshot to S3 | Every 6 hours | 30 days | 2hr | 6hr |
| S3 documents | Cross-region replication (Mumbai → Hyderabad) | Continuous | Lifetime | 30min | Near-zero |
| Redis | ElastiCache with Multi-AZ | N/A (cache only) | — | Minutes | Acceptable loss |

**Failover Strategy:**
- RDS: automatic failover to Multi-AZ replica (< 60 seconds)
- Kubernetes: pod restarts managed by Kubernetes
- Region failover: Route 53 health checks trigger DNS failover to Hyderabad region (manual approval required for full region failover)

---

## 19. Scalability Strategy

### Expected Growth
- Phase 1: 100K patients, 5K doctors
- Year 1: 1M patients, 50K doctors
- Year 2: 10M patients, 500K doctors

### Scaling Approach
- **Horizontal scaling:** All microservices are stateless and scale via Kubernetes HPA
- **Database read replicas:** PostgreSQL read replicas for heavy read workloads (patient timeline view)
- **Elasticsearch:** Horizontal sharding; number of shards increased as data grows
- **S3:** Inherently unlimited; no scaling concern
- **Caching layer:** Redis caches frequently accessed patient summaries; reduces DB load by ~60%
- **OCR queue:** Kafka partitions scaled as upload volume grows; OCR service auto-scales
- **CDN:** Static assets and document thumbnails served via CloudFront (reduces origin load)

---

## 22. AI Health Insights Engine

> This is the most technically complex and most differentiated feature in the product. It must be built carefully, with safety guardrails, regulatory awareness, and a strict "never diagnose" constraint baked into every layer.

---

### 22.1 Critical Flags Before Architecture

#### Flag 1: Regulatory — Software as a Medical Device (SaMD)
Under India's **Medical Devices Rules 2017 (MDR 2017)**, software that provides individually tailored health risk information to patients and assists in clinical decision-making may be classified as a **Software as a Medical Device (SaMD)** by the CDSCO (Central Drugs Standard Control Organisation).

A disease prediction tool — even with disclaimers — may require:
- Registration with CDSCO as a Class B or Class C medical device
- Clinical validation studies demonstrating accuracy
- A licensed manufacturing/software site

**Recommended action before launching Phase 1B:** Engage a healthcare regulatory lawyer (CDSCO specialist) to determine whether a disclaimer is sufficient or formal SaMD registration is needed. This is not optional — CDSCO enforcement has increased significantly since 2023.

The disclaimer text the product owner proposed is a strong start, but legal sign-off is required.

#### Flag 2: Liability
A false negative (app says "you look fine" but patient has early-stage diabetes and delays seeing a doctor) creates real liability exposure. The design must:
- Never surface a "low risk" message that could be read as "all clear"
- Only surface alerts when risk indicators are above a confident threshold
- Always direct users to a real doctor, not reassure them

#### Flag 3: Data Quality Gate
Predictions are only as trustworthy as the data feeding them. An OCR error that reads "HbA1c: 6.2" as "HbA1c: 62" would generate a wildly wrong prediction. A **confidence gate** must block predictions when lab value extraction confidence is below threshold.

---

### 22.2 Target Disease Set (Phase 1B)

These diseases are chosen because: (a) extremely prevalent in India, (b) detectable from standard blood panel tests patients already upload, (c) well-studied with clear, quantitative thresholds in peer-reviewed literature, (d) highly actionable with lifestyle changes before clinical onset.

| Disease | Key Lab Markers | Established Threshold Source |
|---------|----------------|------------------------------|
| Type 2 Diabetes / Pre-diabetes | HbA1c, fasting glucose, post-prandial glucose | ADA guidelines; ICMR India-specific thresholds |
| Hypertension | BP readings (from prescriptions), weight trend | WHO / Indian hypertension guidelines |
| Thyroid disorder | TSH, T3, T4 | ATA / Endocrine Society |
| Iron-deficiency Anemia | Hemoglobin, serum ferritin, TIBC | WHO hemoglobin thresholds; ICMR |
| Vitamin D deficiency | 25-OH Vitamin D | ICMR / Endocrine Society |
| Vitamin B12 deficiency | Serum B12 | ICMR / Indian dietary reference values |
| Cardiovascular risk | LDL, HDL, triglycerides, total cholesterol | ACC/AHA + Indian Heart Association |
| Kidney function decline | Serum creatinine, eGFR, urea | KDIGO guidelines |

---

### 22.3 Full Data Pipeline

```
 ┌─────────────────────────────────────────────────────────────────┐
 │               PHASE 1A FOUNDATION (prerequisite)               │
 │  Patient uploads lab report → OCR extracts text                │
 └──────────────────────────────┬──────────────────────────────────┘
                                │
                                ▼
 ┌─────────────────────────────────────────────────────────────────┐
 │  STEP 1: LAB VALUE EXTRACTOR  (new — Phase 1B)                 │
 │                                                                 │
 │  Runs after OCR completes (Kafka event: document.ocr.complete)  │
 │  Only activates for document type = LAB_REPORT                 │
 │                                                                 │
 │  1. Regex + NLP patterns to identify:                          │
 │       "HbA1c : 6.2 %"  →  { marker: "HbA1c", value: 6.2,     │
 │                              unit: "%", ref_range: "4.0-5.6" } │
 │  2. Match against master lab marker dictionary                  │
 │     (~200 standard markers, Indian lab naming conventions)      │
 │  3. Confidence score per extracted value                        │
 │  4. If confidence < 80% for a marker → marked as UNVERIFIED,   │
 │     excluded from prediction input                              │
 │  5. Store in health_metrics table (timestamped)                 │
 └──────────────────────────────┬──────────────────────────────────┘
                                │
                                ▼
 ┌─────────────────────────────────────────────────────────────────┐
 │  STEP 2: HEALTH PROFILE BUILDER                                 │
 │                                                                 │
 │  Aggregates health_metrics over time per patient:               │
 │  - Trend detection: is HbA1c rising over last 6 months?        │
 │  - Threshold comparison: is LDL above clinical cutoff?          │
 │  - Cross-marker analysis: high glucose + high BMI pattern       │
 │  - Only uses VERIFIED confidence-gated values                   │
 │                                                                 │
 │  Outputs: PatientRiskProfile (JSON) — structured, not text      │
 └──────────────────────────────┬──────────────────────────────────┘
                                │
                                ▼
 ┌─────────────────────────────────────────────────────────────────┐
 │  STEP 3: RISK ASSESSMENT ENGINE (two layers)                    │
 │                                                                 │
 │  ── Layer A: Rule-Based (deterministic) ───────────────────     │
 │  Pre-coded clinical thresholds from established guidelines:     │
 │  if HbA1c >= 5.7% AND trend = "rising over 6 months"           │
 │    → risk_flag: PRE_DIABETES, confidence: HIGH                 │
 │                                                                 │
 │  Only flags that pass rule-based layer proceed to Layer B.      │
 │  This prevents the LLM from fabricating risks that have         │
 │  no clinical basis in the patient's actual data.               │
 │                                                                 │
 │  ── Layer B: LLM + RAG (Claude API) ──────────────────────     │
 │  Input:                                                         │
 │    - PatientRiskProfile (structured, anonymised)                │
 │    - Retrieved research chunks from Medical Knowledge Base      │
 │      (only chunks matching the flagged risk domain)             │
 │  Strict system prompt:                                          │
 │    - You are a health information assistant, NOT a doctor       │
 │    - ONLY cite the provided research documents                  │
 │    - NEVER use the word "diagnosis" or "prognosis"              │
 │    - ALWAYS recommend consulting a licensed doctor              │
 │    - Output MUST follow the InsightSchema (JSON)               │
 │  Output validated against InsightSchema before use             │
 │  If validation fails → insight is discarded, never shown       │
 └──────────────────────────────┬──────────────────────────────────┘
                                │
                                ▼
 ┌─────────────────────────────────────────────────────────────────┐
 │  STEP 4: MEDICAL KNOWLEDGE BASE (RAG Source)                    │
 │                                                                 │
 │  Sources (curated, verified, regularly updated):               │
 │   • PubMed Central (free API — NCBI)                           │
 │   • Indian Journal of Medical Research (IJMR)                  │
 │   • Lancet Digital Health                                       │
 │   • WHO Clinical Guidelines                                     │
 │   • ICMR (Indian Council of Medical Research) publications      │
 │   • ADA, AHA, ACC, KDIGO international guidelines              │
 │                                                                 │
 │  Storage: pgvector extension on existing PostgreSQL             │
 │  (avoids adding a separate vector DB service)                   │
 │  Embedding model: text-embedding-3-small (OpenAI) or           │
 │  Claude embeddings                                              │
 │                                                                 │
 │  Update cadence:                                                │
 │   - Automated: monthly PubMed ingestion via NCBI API            │
 │   - Manual review: medical advisor reviews flagged new papers   │
 │   - A paper is only added to the knowledge base after          │
 │     human review — no automatic trust of raw PubMed results    │
 └──────────────────────────────┬──────────────────────────────────┘
                                │
                                ▼
 ┌─────────────────────────────────────────────────────────────────┐
 │  STEP 5: INSIGHT PUBLISHER                                      │
 │                                                                 │
 │  Before delivering an insight:                                  │
 │   - De-duplicate: has same insight been sent in last 90 days?  │
 │   - Throttle: max 2 insights per patient per month             │
 │     (prevent alert fatigue)                                     │
 │   - Severity gate: only MEDIUM or HIGH risk insights surface   │
 │     (LOW risk quietly logged, never notified)                   │
 │                                                                 │
 │  Delivery:                                                      │
 │   - Push notification → "You have a new health insight"        │
 │   - In-app: Health Insights tab, full card with sources        │
 │   - Mandatory disclaimer on every card (cannot be dismissed    │
 │     without acknowledgment on first view)                       │
 └─────────────────────────────────────────────────────────────────┘
```

---

### 22.4 InsightSchema — The Output Contract

Every AI-generated insight must conform to this schema before it is stored or shown to any user. If any field is missing or invalid, the insight is silently discarded.

```json
{
  "insight_id": "uuid",
  "patient_id": "uuid",
  "risk_domain": "PRE_DIABETES | HYPERTENSION | THYROID | ANEMIA | ...",
  "risk_level": "MEDIUM | HIGH",
  "insight_headline": "string (max 120 chars, precautionary tone)",
  "insight_body": "string (max 400 chars, no diagnostic language)",
  "evidence": [
    {
      "journal": "Indian Journal of Medical Research",
      "paper_title": "string",
      "year": 2024,
      "doi": "string",
      "relevant_finding": "string (one sentence, directly quoted or paraphrased)"
    }
  ],
  "supporting_markers": [
    {
      "marker": "HbA1c",
      "patient_value": 6.1,
      "unit": "%",
      "reference_range": "4.0–5.6",
      "trend": "RISING"
    }
  ],
  "call_to_action": "Kindly consult your doctor and take necessary precautions.",
  "disclaimer": "This app is not a certified medical doctor. It provides information based on your medical history corroborated with published medical research. This is not a diagnosis.",
  "generated_at": "ISO8601 timestamp",
  "llm_model": "claude-sonnet-4-6",
  "confidence_gate_passed": true
}
```

---

### 22.5 Sample Insight Message (Exactly as Shown to Patient)

```
┌──────────────────────────────────────────────────────────┐
│  ⚠  Health Insight — For Your Awareness                  │
│                                                          │
│  Based on your lab reports from the past 12 months,     │
│  your HbA1c has risen from 5.4% to 6.1% over three      │
│  tests. This trend may indicate an elevated risk of      │
│  developing Type 2 Diabetes in the future.               │
│                                                          │
│  Based on research published in the Indian Journal of    │
│  Medical Research (2023) and WHO Diabetes Prevention     │
│  Guidelines, individuals with HbA1c between 5.7–6.4%    │
│  and a rising trend benefit significantly from early     │
│  lifestyle changes.                                      │
│                                                          │
│  Kindly consult your doctor and take necessary           │
│  precautions.                                            │
│                                                          │
│  [View Sources]          [Find a Doctor]                 │
│                                                          │
│  ─────────────────────────────────────────────────────  │
│  DISCLAIMER: OmniMedVault is not a certified medical     │
│  doctor. This insight is generated from your personal    │
│  medical history corroborated with published research.   │
│  It is not a diagnosis or prognosis. Always consult a   │
│  qualified medical professional.                         │
└──────────────────────────────────────────────────────────┘
```

---

### 22.6 New Data Model: Health Metrics & Insights

```sql
-- Structured lab values extracted from OCR'd reports
health_metrics
  id                UUID (PK)
  patient_id        UUID (FK → patients)
  document_id       UUID (FK → documents)
  marker_name       VARCHAR  -- "HbA1c", "Hemoglobin", "LDL", etc.
  marker_value      DECIMAL
  marker_unit       VARCHAR
  reference_low     DECIMAL (nullable)
  reference_high    DECIMAL (nullable)
  extraction_confidence  DECIMAL  -- 0.0–1.0; values < 0.8 excluded from predictions
  report_date       DATE
  created_at        TIMESTAMP

-- Insights generated by the AI engine
health_insights
  id                UUID (PK)
  patient_id        UUID (FK → patients)
  risk_domain       ENUM
  risk_level        ENUM (MEDIUM, HIGH)
  insight_json      JSONB  -- full InsightSchema stored
  status            ENUM (PENDING_REVIEW, DELIVERED, DISMISSED, EXPIRED)
  delivered_at      TIMESTAMP (nullable)
  dismissed_at      TIMESTAMP (nullable)
  expires_at        TIMESTAMP  -- insights expire after 90 days
  created_at        TIMESTAMP
```

---

### 22.7 What Is Deliberately Excluded from This Feature

These exclusions are safety decisions, not oversights:

| Excluded | Why |
|----------|-----|
| "LOW risk" notifications to patients | A "you're fine" message is the most dangerous output; patient may stop monitoring |
| Cancer / rare disease prediction | Insufficient common lab markers; high false-positive rate; serious psychological harm potential |
| Mental health indicators | Requires specialist input; stigma risk; out of scope |
| Drug interaction warnings | Requires full pharmacy database; regulatory complexity; separate feature if ever |
| Predictions from a single data point | Minimum 2 lab readings required before any trend is flagged; prevents single-test false alarms |
| Sharing insights with doctors | Doctor views the raw data; insight messages are for patient awareness only |

---

### 22.8 Recommended Pre-Launch Actions (Regulatory)

Before Phase 1B goes live publicly:

1. **Engage a CDSCO healthcare regulatory consultant** — determine if this feature requires SaMD registration under MDR 2017
2. **Legal review of disclaimer text** — disclaimer must be legally sound in India; current text is a good starting point
3. **Medical advisor partnership** — the knowledge base requires ongoing curation by a qualified medical professional (MBBS minimum; MD preferred); this is a non-negotiable quality gate
4. **Beta testing with doctors** — before patient-facing launch, show a sample of generated insights to 5–10 doctors for accuracy validation
5. **Accuracy audit** — document false positive and false negative rates during beta; establish internal thresholds below which the feature is paused

---

## 23. Financial Tracking & Expense Reports (Phase 1A — Premium)

> Receipts are first-class documents in OmniMedVault, not just image attachments. The financial layer transforms a patient's receipt history into actionable expense intelligence — per illness, per year, per family member.

---

### 23.1 Receipt Parsing Pipeline

Runs as an extension of the existing OCR pipeline. Activated only for documents categorised as **RECEIPT**.

```
Receipt uploaded (photo or PDF)
         │
         ▼
  Existing OCR Service (extracts raw text)
         │
         ▼
  Receipt Parser (new — Phase 2)
  ┌───────────────────────────────────────┐
  │ 1. Identify receipt type:             │
  │    Hospital bill / Pharmacy /         │
  │    Lab / Clinic / Diagnostic centre   │
  │                                       │
  │ 2. Extract fields:                    │
  │    - Vendor name                      │
  │    - Date of service                  │
  │    - Total amount (₹)                 │
  │    - Itemized lines (if structured)   │
  │    - GSTIN (if present)               │
  │    - Receipt / Bill number            │
  │                                       │
  │ 3. Auto-categorise expense:           │
  │    CONSULTATION | MEDICINE |          │
  │    LAB_TEST | IMAGING |              │
  │    PROCEDURE | IPD | OTHER           │
  │                                       │
  │ 4. Confidence score per field         │
  │    Low confidence → flag for          │
  │    patient to manually verify         │
  │                                       │
  │ 5. Store in medical_expenses table    │
  └───────────────────────────────────────┘
```

**Why receipts are harder than prescriptions for OCR:**
Receipts vary enormously — a hospital bill from Apollo looks nothing like a handwritten bill from a local pharmacy. The parser must handle:
- Printed structured bills (Apollo, Fortis) → high accuracy
- Printed but unstructured (small clinics) → medium accuracy
- Handwritten bills (local pharmacies) → low accuracy, flag for manual entry

For low-confidence cases, the app shows: *"We couldn't fully read this receipt. Please verify the amount."* — with a pre-filled form using whatever was extracted, for the patient to correct.

---

### 23.2 Illness Episode — The Core Concept

An **illness episode** is a patient-created container that groups all medical activity (and spend) related to one health event.

```
ILLNESS EPISODE: "Bone Fracture Surgery — Right Leg"
  Period: 15 Jun 2025 – 30 Sep 2025
  Status: Recovered / Closed

  Linked Documents:
  ┌──────────────────────────────────────────────────────┐
  │ PRE-HOSPITALISATION                                  │
  │   [Receipt]  Apollo Diagnostics X-Ray  ₹1,200        │
  │   [Receipt]  Dr. Mehta Consultation    ₹800           │
  │   [Rx]       Prescription — Dr. Mehta  (no cost)     │
  │                                                      │
  │ HOSPITALISATION (IPD)                                │
  │   [Receipt]  Lilavati Hospital Bill    ₹1,24,500     │
  │   [Receipt]  Surgical Implants         ₹38,000       │
  │                                                      │
  │ POST-HOSPITALISATION                                 │
  │   [Receipt]  Physiotherapy (12 sessions) ₹9,600      │
  │   [Receipt]  MedPlus Pharmacy           ₹3,200        │
  │   [Receipt]  Follow-up OPD × 3         ₹2,400        │
  │   [Rx]       Post-op prescription      (no cost)     │
  │   [Report]   3-month check X-Ray       (no cost)     │
  └──────────────────────────────────────────────────────┘

  TOTAL SPEND:  ₹1,79,700
  ─────────────────────────────
  Consultation:  ₹3,200
  Lab/Imaging:   ₹1,200
  IPD:           ₹1,62,500
  Physiotherapy: ₹9,600
  Medicines:     ₹3,200
```

**How documents get linked to an episode:**
- **System suggestion:** When a patient creates an episode with a date range, the system surfaces all documents (prescriptions, reports, receipts) from that period and asks: *"Were these related to this illness?"* — patient confirms or removes each
- **Manual:** Patient can drag/link any document to any episode at any time
- **One document can belong to one episode only** — prevents double-counting in spend reports

---

### 23.3 Ad-Hoc Financial Queries

Available from a "My Expenses" section in the app. Pre-built query cards:

| Query | Filter Options |
|-------|---------------|
| Total spend — last 12 months | Year picker |
| Spend by category | Pie chart: Consultation / Medicine / Lab / IPD / Other |
| Spend by family member | Per person (if family account) |
| Spend by month | Bar chart — monthly trend |
| All receipts from a specific hospital | Search by vendor name |
| Total unlinked receipts (not in any episode) | — |

All views are filterable by: date range, family member, expense category.

**For tax / employer reimbursement:** Many Indian employers reimburse medical expenses up to ₹15,000/year under Section 17(2) of the Income Tax Act (pre-2018 rules; note: this exemption was removed in 2018 but many employers still run reimbursement schemes). The PDF export covers this use case regardless.

---

### 23.4 PDF Expense Report

Generated on demand. Two report types:

**Episode Report:**
- Episode summary (illness, dates, treating doctors)
- Itemized receipt list with amounts
- Category-wise subtotals
- Total spend
- List of linked prescriptions and lab reports (as appendix)
- Suitable for: insurance claims, employer reimbursement, personal records

**Annual Report:**
- All medical spend in a calendar/financial year
- Breakdown by month, category, family member
- List of all episodes in the year
- Grand total
- Suitable for: tax records, annual health review

---

### 23.5 Family Account Design

```
PRIMARY ACCOUNT HOLDER (e.g., Ramesh Kumar)
         │
         ├── MANAGED DEPENDENT: Mother (Savitri Kumar, 72)
         │     - No smartphone; Ramesh manages her profile
         │     - Ramesh can upload her records, view full history
         │     - Her medical records are stored under her own patientId
         │     - Ramesh is flagged as her guardian (guardianId)
         │
         ├── LINKED DEPENDENT: Wife (Priya Kumar)
         │     - Has her own OmniMedVault account
         │     - Consented to share financial summary with Ramesh
         │     - Ramesh sees: her expense totals, episode names
         │     - Ramesh CANNOT see: her prescriptions, lab reports,
         │                          doctor names, diagnoses
         │     - Priya can revoke this consent at any time
         │
         └── MANAGED DEPENDENT: Son (Arjun Kumar, 10)
               - Child; Ramesh manages his profile fully
               - Same as managed dependent above
               - When Arjun turns 18, nothing changes automatically.
                 Account stays managed until the primary holder
                 manually converts it, or Arjun registers his own
                 OmniMedVault account and claims his records.
```

**Key privacy rule:** A linked dependent's medical records are never accessible to the primary account holder — only their financial summary is. This is enforced at the data layer, not just the UI layer.

---

### 23.6 New Data Models

```sql
-- Parsed financial data from receipts
medical_expenses
  id                UUID (PK)
  patient_id        UUID (FK → patients)
  document_id       UUID (FK → documents — the receipt)
  episode_id        UUID (FK → illness_episodes, nullable)
  vendor_name       VARCHAR
  expense_date      DATE
  total_amount      DECIMAL(10,2)
  currency          CHAR(3)  DEFAULT 'INR'
  category          ENUM (CONSULTATION, MEDICINE, LAB_TEST,
                          IMAGING, PROCEDURE, IPD, OTHER)
  specialty_id      UUID (FK → medical_specialties, nullable)
                        -- enables "how much spent on dental in 6 months"
                        -- inferred from linked document's doctor_specialty_id
  itemized_lines    JSONB (nullable — [{description, amount}])
  bill_number       VARCHAR (nullable)
  parse_confidence  DECIMAL  -- 0.0–1.0
  manually_verified BOOLEAN  DEFAULT false
  created_at        TIMESTAMP

-- Patient-created illness episodes
illness_episodes
  id                UUID (PK)
  patient_id        UUID (FK → patients)
  title             VARCHAR  -- "Bone Fracture Surgery — Right Leg"
  primary_diagnosis VARCHAR (nullable)
  started_on        DATE
  ended_on          DATE (nullable — null if ongoing)
  status            ENUM (ACTIVE, RECOVERED, CHRONIC, ARCHIVED)
  created_at        TIMESTAMP
  updated_at        TIMESTAMP

-- Family account links
family_members
  id                UUID (PK)
  primary_patient_id  UUID (FK → patients)
  member_patient_id   UUID (FK → patients)
  relation            VARCHAR  -- "Spouse", "Mother", "Son", etc.
  member_type         ENUM (MANAGED, LINKED)
  financial_share_consent BOOLEAN  -- for LINKED type only
  consent_granted_at  TIMESTAMP (nullable)
  added_at            TIMESTAMP
  is_active           BOOLEAN

-- Medical Proxy access grants (Phase 2 — separate from family_members)
-- Allows a trusted family member with their own account to read a patient's records remotely
family_medical_proxies
  id                UUID (PK)
  patient_id        UUID (FK → patients)       -- the record owner (e.g., father)
  proxy_patient_id  UUID (FK → patients)       -- the trusted viewer (e.g., son)
  relation          VARCHAR                    -- "Son", "Daughter", "Sibling", "Spouse", etc. (free text — not verified)
  request_message   TEXT (nullable)            -- reason written by requester: "I need to show your prescription to a doctor in Bangalore"
  status            ENUM (PENDING, ACTIVE, DECLINED, EXPIRED, REVOKED)
  granted_at        TIMESTAMP (nullable)       -- null until patient approves
  expires_at        TIMESTAMP (nullable)       -- null = permanent until revoked
  revoked_at        TIMESTAMP (nullable)
  declined_at       TIMESTAMP (nullable)
  created_at        TIMESTAMP                  -- when the request was sent
  -- Note: no sub-delegation. A proxy cannot grant access to anyone else.

-- Natural language query log (Phase 2)
-- INSERT-only; never updated or deleted
nl_queries
  id                  UUID (PK)
  patient_id          UUID (FK → patients)       -- whose records were queried
  querying_user_id    UUID (FK → users)          -- who asked
  querying_role       ENUM (PATIENT, DOCTOR, FAMILY_PROXY)
  query_text          TEXT (encrypted)           -- original user-typed query
  detected_intent     VARCHAR                    -- LAB_VALUE_LOOKUP | MEDICATION_LOOKUP | DOCTOR_LOOKUP | DOCUMENT_SEARCH | EXPENSE_QUERY | TREND_QUERY | DIAGNOSIS_LOOKUP
  extracted_entities  JSONB                      -- structured output of NLP parsing {marker, date_range, ...}
  result_found        BOOLEAN                    -- true if exact match found in primary query
  fallback_used       BOOLEAN                    -- true if ±6-month temporal expansion was triggered
  fallback_range_months INTEGER                  -- how far the expansion searched (default 6)
  records_returned    INTEGER                    -- number of records included in the response
  response_text       TEXT (encrypted)           -- the final natural language response shown to user
  latency_ms          INTEGER                    -- end-to-end response time for monitoring
  created_at          TIMESTAMP
```

---

### 23.7 Premium Feature Access Control

A middleware check runs on every request to a premium endpoint:

```
Request arrives
      │
      ▼
Check patient.subscription_tier
      │
      ├── PREMIUM → proceed
      │
      └── FREE → return HTTP 402 with:
                  {
                    "error": "PREMIUM_REQUIRED",
                    "feature": "expense_reports",
                    "upgrade_url": "/subscribe"
                  }
```

**Free vs Premium — Patient Feature Matrix:**

| Feature | Free | Premium |
|---------|------|---------|
| Document upload & storage (up to 50 docs) | ✓ | ✓ |
| Unlimited document storage | — | ✓ |
| OCR & categorisation | ✓ | ✓ |
| Search own history | ✓ | ✓ |
| Consent & doctor access | ✓ | ✓ |
| Emergency QR code | ✓ | ✓ |
| Basic timeline view | ✓ | ✓ |
| Receipt parsing (amount + date only) | ✓ | ✓ |
| AI Health Insights | — | ✓ |
| Illness episode grouping | — | ✓ |
| Expense summaries & reports | — | ✓ |
| PDF export (history + expense reports) | — | ✓ |
| Family account (add dependents) | — | ✓ (up to 5 members) |
| Priority support | — | ✓ |

> **Design note on free receipt parsing:** Basic amount + date extraction is kept free intentionally — it populates data that makes the premium expense report valuable. If free users can't parse receipts, they have no data to upgrade for. This is the freemium hook.

---

> Designed for the most critical scenario: a patient who is alone and experiencing a medical emergency — such as the onset of a heart attack — and needs immediate help dispatched to their location. Speed, reliability, and zero friction are the non-negotiable design constraints.

---

### 23.1 Core Design Principles

1. **One-tap to trigger** — a person in cardiac distress may have impaired motor control and cognitive function. Every extra step costs lives.
2. **Multi-channel, not single-channel** — push notifications alone are unreliable (app may be closed, server may lag). Every SOS fires push + SMS simultaneously.
3. **Alert non-platform recipients too** — most nearby hospitals will not be on the OmniMedVault platform. They receive an SMS with the patient's location and a public emergency profile link regardless.
4. **Never replace 108** — the app must prompt the patient to call 108 (India's national ambulance) immediately. OmniMedVault alerts the doctor and hospital but is not a substitute for official emergency services.
5. **Accidental-press prevention without friction** — press-and-hold (3 seconds) prevents accidental triggers, but is still operable by someone in distress.

---

### 23.2 SOS Trigger — UI/UX Design

```
HOME SCREEN
┌──────────────────────────────────────┐
│  [Health Timeline]  [Upload]  [Search]│
│                                      │
│  ┌────────────────────────────────┐  │
│  │         🆘  SOS               │  │
│  │    Press & Hold 3 seconds      │  │
│  │    to send emergency alert     │  │
│  └────────────────────────────────┘  │
│  (Always visible, bottom of screen)  │
└──────────────────────────────────────┘

ON HOLD (haptic feedback every second):
  1s → "Sending in 2..."
  2s → "Sending in 1..."
  3s → SOS FIRES

POST-TRIGGER SCREEN (5-second cancel window):
┌──────────────────────────────────────┐
│  🆘 SOS SENT                        │
│                                      │
│  Alerting:                           │
│  ✓ Dr. Priya Sharma (last doctor)   │
│  ✓ Apollo Clinic, Andheri           │
│  ✓ 3 nearest hospitals              │
│                                      │
│  Your location is being shared.      │
│                                      │
│  ┌──────────────────────────────┐   │
│  │  📞 CALL 108 NOW (Ambulance) │   │
│  └──────────────────────────────┘   │
│                                      │
│  [Cancel SOS — 4s remaining]         │
└──────────────────────────────────────┘
```

**Calling 108:** The "Call 108 Now" button is a `tel:108` deep link. It dials immediately. This button is shown prominently because the app cannot guarantee how quickly a doctor or hospital will respond — the ambulance service is always the primary safety net.

---

### 23.3 Recipient Identification Logic

When SOS fires, the system identifies recipients in priority order:

```
Priority 1 — Treating Doctor(s)
  Query: doctors who created a prescription for this patient
         in the last 12 months, ordered by most recent
  Limit: top 3 most recent doctors
  Channel: push notification (high-priority) + SMS

Priority 2 — Active Consultation Hospital(s)
  Query: institutions linked to the treating doctors above
         where the patient has an active or recent consent
  Channel: push notification (to hospital admin) + SMS

Priority 3 — Nearest Hospitals (Google Places API)
  Query: Google Maps Places API —
         "hospital" OR "emergency" within 5km of patient GPS
  Limit: top 3 results by distance
  Channel: SMS only (they may not be on the platform)
         includes: Google Maps link to patient location
                   temporary emergency profile URL
                   patient blood group, allergies, active meds

Priority 4 — Emergency Contacts (patient-configured)
  Patient pre-configures 1–3 emergency contacts (name + phone)
  Channel: SMS + (future) WhatsApp via WhatsApp Business API
```

---

### 23.4 What Each Recipient Receives

**Doctor / Hospital (on platform) — Push Notification:**
```
🆘 EMERGENCY: [Patient Name] has triggered an SOS
Blood group: B+  |  Allergies: Penicillin
Location: [tap to open in Maps]
[View Full History]  [Call Patient]
```

**Doctor / Hospital (on platform) — SMS (simultaneous):**
```
EMERGENCY SOS from OmniMedVault
Patient: Ramesh Kumar | Blood: B+ | Allergies: Penicillin
Location: https://maps.google.com/?q=19.0760,72.8777
Emergency profile: https://omnimedvault.com/e/abc123 (valid 4hrs)
Call patient: +91-XXXXXXXXXX
```

**Nearest Hospital (NOT on platform) — SMS:**
```
MEDICAL EMERGENCY - OmniMedVault Alert
A patient near your hospital needs urgent help.
Name: Ramesh Kumar | Blood: B+ | Allergies: Penicillin
Location: https://maps.google.com/?q=19.0760,72.8777
Medical profile (no login needed): https://omnimedvault.com/e/abc123
Active medications listed at link above. Valid for 4 hours.
```

**Emergency Contact (family/friend) — SMS:**
```
🆘 EMERGENCY: Ramesh Kumar has triggered an SOS on OmniMedVault.
He may need urgent medical assistance.
His current location: https://maps.google.com/?q=19.0760,72.8777
Call him: +91-XXXXXXXXXX
```

---

### 23.5 Emergency Profile URL

A time-limited, public URL generated at SOS trigger time.

- **No login required** to view (critical — receiver may not have the app)
- **Expires:** 4 hours after generation
- **Contains:** name, blood group, allergies, current active medications, last doctor name and phone, patient's emergency contact
- **Does NOT contain:** full medical history, lab reports, prescriptions (privacy preserved even in emergencies)
- **URL format:** `https://omnimedvault.com/e/{random-12-char-token}` (token is single-use, non-guessable)
- **Same concept as Emergency QR** (Phase 1A) but dynamically generated at trigger time and pushed to recipients

---

### 23.6 Technical Architecture

```
Patient presses SOS (3-second hold)
           │
           ▼
   Mobile app captures:
   - Current GPS coordinates (foreground location)
   - Timestamp
           │
           ▼
   POST /api/v1/sos/trigger  (authenticated)
           │
           ▼
   SOS Service (backend):
   ┌──────────────────────────────────────┐
   │ 1. Generate emergency profile token  │
   │ 2. Store SOS event in DB            │
   │ 3. Identify recipients (3 queries)   │
   │ 4. Fire all notifications in PARALLEL│
   │    via Kafka → Notification Service  │
   │      - Push (Firebase FCM)           │
   │      - SMS (AWS SNS / Twilio)        │
   │ 5. Return confirmation to mobile     │
   │    (< 2 second total response time)  │
   └──────────────────────────────────────┘
           │
           ▼
   Notification Service:
   - Push: Firebase FCM high-priority channel
     (bypasses device battery optimisation)
   - SMS: Twilio/AWS SNS — delivered in parallel
     to all recipients simultaneously
           │
           ▼
   SOS Dashboard (doctor/hospital app):
   - Active SOS events shown in real-time
   - Doctor can tap "I'm responding" to acknowledge
   - Patient sees acknowledgements on their screen
```

**Location note:** The app uses foreground location at trigger time (no background location permission needed — the patient is actively using the app when they press SOS). This avoids Android's strict background location permission requirements.

---

### 23.7 New Data Models

```sql
sos_events
  id                    UUID (PK)
  patient_id            UUID (FK → patients)
  triggered_at          TIMESTAMP
  latitude              DECIMAL(9,6)
  longitude             DECIMAL(9,6)
  location_accuracy_m   INTEGER  -- GPS accuracy in metres
  emergency_token       VARCHAR  -- random token for public URL
  token_expires_at      TIMESTAMP
  cancelled_at          TIMESTAMP (nullable — if cancelled within 5s)
  status                ENUM (ACTIVE, CANCELLED, RESOLVED, EXPIRED)

sos_recipients
  id                    UUID (PK)
  sos_event_id          UUID (FK → sos_events)
  recipient_type        ENUM (DOCTOR, HOSPITAL, NEAREST_HOSPITAL, EMERGENCY_CONTACT)
  recipient_id          UUID (nullable — null for non-platform hospitals)
  recipient_phone       VARCHAR (for SMS)
  push_sent_at          TIMESTAMP (nullable)
  sms_sent_at           TIMESTAMP (nullable)
  acknowledged_at       TIMESTAMP (nullable)
  acknowledged_by_name  VARCHAR (nullable)

patient_emergency_contacts
  id                    UUID (PK)
  patient_id            UUID (FK → patients)
  name                  VARCHAR
  phone                 VARCHAR (encrypted)
  relation              VARCHAR  -- "Spouse", "Son", "Friend", etc.
  priority              INTEGER  -- 1 = primary, 2 = secondary, 3 = tertiary
```

---

### 23.8 Edge Cases & Handling

| Scenario | Handling |
|----------|----------|
| Patient has no GPS signal | Use last known location (stored in app cache); label it "Last known location — may not be current" in the SMS |
| Patient has no internet | SOS cannot reach our servers; app shows message: "No connection. Call 108 immediately." and auto-opens the dialler |
| Accidental press | 5-second cancel window after trigger; if cancelled, all notifications are suppressed before delivery |
| No doctor in last 12 months | Skip Priority 1; go directly to Priority 2 and 3 |
| No nearby hospitals in Google Places | Expand search radius to 10km; if still none, send to emergency contacts and prompt 108 call |
| Doctor has uninstalled app | SMS is the fallback; SMS does not require app installation |
| Patient is unconscious after triggering | The 5-second cancel window is designed to time out naturally — if the patient collapses after pressing, SOS still fires |

---

### 23.9 What This Feature Must NEVER Do

- **Never store real-time location continuously** — location is captured only at trigger time, point-in-time, not tracked over time
- **Never show this feature as a replacement for 108** — the 108 call button is always shown on the SOS confirmation screen
- **Never send SOS to all doctors the patient has ever seen** — only last 12 months, max 3 doctors; prevents spam to old or irrelevant doctors
- **Never expose full medical history via the emergency URL** — the public token shows only emergency-critical fields: blood group, allergies, active medications

---

## 24. Monetisation & Billing Model

### Patient Side — Freemium

**Free tier:** Core medical history features — document storage (up to 50 documents), OCR, search, consent management, doctor access, emergency QR, basic receipt amount extraction. Free forever. This is the adoption engine.

**Premium tier (paid):** AI Health Insights, illness episode grouping, full expense reports, PDF exports, family account management (up to 5 members), unlimited document storage, priority support.

- Pricing: monthly or annual subscription (annual at a discount)
- Payment: Stripe (Phase 2 — Phase 1 uses manual payment / UPI link)
- A free user hitting a premium feature sees a clear, non-aggressive upgrade prompt — not a hard block with no explanation
- **Why some features are free:** Free receipt amount extraction seeds the data that makes premium expense reports valuable. Free AI Health Insights teaser (one insight per quarter) shows value before asking for payment.

### Hospital / Clinic Side — B2B SaaS Subscription

**Pricing tiers (indicative — to be validated with market):**

| Tier | Who | What's included |
|------|-----|----------------|
| Clinic (Small) | 1–5 doctors | Widget embed, up to 5 doctor accounts, standard support |
| Hospital (Medium) | 6–25 doctors | All clinic features + usage analytics dashboard, priority support |
| Enterprise (Large) | 25+ doctors | All medium features + custom SLA, dedicated onboarding, API rate limit increase |

**Phase 1 billing:** Manual invoicing (no automated payment system yet).
**Phase 2 billing:** Stripe subscription integration; monthly/annual plans; self-serve upgrade/downgrade.

### Key Design Implications
- Every doctor account is linked to an `institution_id`
- Institutions have a subscription `status` and `tier` in the DB
- A doctor at a verified paying institution gets the CRM widget; an unaffiliated doctor (independent practice) uses the standard mobile/web interface
- Independent doctors (no institution) are free — they are the gateway to hospital adoption

---

## 25. Language & Localisation Strategy

### Phase 1 Languages: English + Hindi
- UI, notifications, OCR language hints: English and Hindi
- i18n framework (i18next for web; Flutter Intl for mobile) configured from day 1 — adding a language later is adding translation files, not code changes

### Phase 2 Languages (9 additional)
Telugu, Tamil, Marathi, Bengali, Punjabi, Gujarati, Kannada, Malayalam, Assamese

**Total Phase 2 target: 11 languages**

### OCR Language Strategy
Google Cloud Vision API supports all of these scripts:
- Devanagari (Hindi, Marathi)
- Tamil script
- Telugu script
- Kannada script
- Malayalam script
- Gujarati script
- Gurmukhi (Punjabi)
- Bengali script

**Implementation:** OCR requests include a `languageHints` array. In Phase 1: `["en", "hi"]`. In Phase 2: all 11 language codes. The architecture does not change — only the hint array grows.

### Mixed-Script Prescriptions
A very common real-world case: a doctor writes a prescription in English but includes medicine names in Hindi. Google Cloud Vision handles multi-language detection automatically when multiple hints are provided. No special handling needed.

---

## 26. Resolved Decisions

All open questions from the initial design have been answered. Recorded here for traceability.

| # | Question | Decision |
|---|---------|----------|
| Q1 | Monetisation model | Free for patients; B2B SaaS (paid) for hospitals and private clinics |
| Q2 | ABHA integration | Phase 2 |
| Q3 | Offline mobile capability | Phase 2+ (i18n + data layer designed to support it; not built in Phase 1) |
| Q4 | Regional languages at launch | Phase 1: English + Hindi. Phase 2: + Telugu, Tamil, Marathi, Bengali, Punjabi, Gujarati, Kannada, Malayalam, Assamese |
| Q5 | Pharmacy integration | Low priority; Phase 3 or later |
| Q6 | Doctor pending verification | Yes — doctors can use the app immediately after registration; prescription creation locked until NMC verified |
| Q7 | Lab direct upload | Phase 2 |
| Q8 | Emergency access QR | Yes — in scope for Phase 1. Shows blood group, allergies, current active meds. No consent required. Patient controls content |
| Q9 | Specific CRM integrations | None targeted. Product provides REST API + embeddable JS widget; hospitals integrate it into their own software |
| Q10 | Team size | 2 engineers. Phase 1 uses modular monolith + fully managed AWS services. Microservices migration begins in Phase 2 as team grows |

---

---

## 26. Family Medical Proxy — Remote Access for Trusted Family Members

> A son lives in Pune. His parents are in Delhi. His father just visited a doctor and has a new prescription. The son wants to take his father to a cardiologist in Pune during their next visit — or needs to buy the medicines now. He needs to see the prescription. Today, the father photographs it and sends it on WhatsApp — unencrypted, unstructured, and lost the next time the phone is replaced.
>
> This feature replaces that workaround with a secure, consent-governed, audited channel.

---

### 26.1 What This Feature Is — And Is Not

**It is:**
A mechanism for a patient to grant a trusted family member read-only access to their medical history, so that family member can:
- Show the history or a specific prescription to a doctor in their city
- Purchase prescribed medicines on behalf of the patient
- Monitor ongoing treatment from a distance

**It is not:**
- A replacement for the managed dependent model (which is for patients who have no smartphone)
- A way for a family member to modify, upload, or add anything to the patient's records
- A backdoor — the patient controls access completely and can revoke it instantly

---

### 26.2 How This Differs from the Existing Family Account Feature

| | Managed Dependent | Linked Dependent | **Medical Proxy** |
|---|---|---|---|
| **Who uses it** | Elderly/child with no smartphone | Spouse/adult with their own account | Son/sibling in another city, both have accounts |
| **Primary holder controls** | Everything — uploads, views, manages | Only sees financial summary | Nothing — patient remains in control |
| **Medical record access** | Full (primary holder manages) | None | Read-only (proxy views only) |
| **Financial access** | Full | Financial summary only | None |
| **Who initiates** | Primary holder adds them | Primary holder adds them | Either party can initiate |
| **Use case** | Managing elderly parent's health | Family spending visibility | Remote consultation / medicine purchase |

---

### 26.3 Consent Flow

```
┌──────────────────────────────────────────────────────────────────┐
│               FAMILY MEDICAL PROXY — CONSENT LIFECYCLE           │
│                                                                  │
│  Step 1 — Request                                                │
│    Son opens app → "Request access to family member's records"   │
│    Enters parent's phone number or OmniMedVault ID               │
│    Optionally writes a reason:                                   │
│    "Baba, I need to show your knee prescription to a doctor      │
│     here in Bangalore when I visit next week"                    │
│                                                                  │
│  Step 2 — Notification to Patient (Father)                       │
│    Push notification + SMS:                                      │
│    "Rahul Sharma (your son) wants to view your medical records.  │
│     Reason: [message]. Tap to approve or decline."              │
│                                                                  │
│  Step 3 — Patient Approves (in app)                              │
│    Option A: Permanent (until revoked)                           │
│    Option B: Time-limited (7 / 30 / 90 days / custom date)      │
│    Option C: Single-use (access expires after 24 hours)          │
│                                                                  │
│  Step 4 — Proxy Access Active                                    │
│    Son can now view all of father's medical records              │
│    Father receives push on every access:                         │
│    "Rahul viewed your records at 3:42 PM today"                  │
│                                                                  │
│  Step 5 — Revocation (at any time)                               │
│    Father opens app → My Proxies → Revoke                        │
│    Son loses access immediately                                  │
│    Son receives: "Your access to Ramesh Kumar's records          │
│    has been revoked"                                             │
│                                                                  │
│  Step 6 — Expiry (if time-limited)                               │
│    3 days before expiry: proxy notified ("your access expires    │
│    in 3 days — ask for renewal if needed")                       │
│    On expiry: access automatically revoked, both parties         │
│    notified                                                      │
└──────────────────────────────────────────────────────────────────┘
```

---

### 26.4 What a Medical Proxy Can and Cannot Do

| Action | Allowed |
|--------|---------|
| View patient's full medical timeline | ✓ |
| Search patient's records (by date, diagnosis, medicine, doctor) | ✓ |
| View active medications and known allergies (summary card) | ✓ |
| Download a document PDF (prescription, lab report) | ✓ |
| Share a document PDF externally (forward to a doctor via WhatsApp/email) | ✓ |
| Upload documents on behalf of the patient | ✗ |
| Edit or delete any record | ✗ |
| Create a prescription | ✗ |
| Grant this access to another person (sub-delegation) | ✗ |
| View patient's financial data or expense reports | ✗ |
| See the list of other people who have access to the patient | ✗ |

**Key principle:** A Medical Proxy can see and share, but cannot touch. The patient's record is read-only from the proxy's perspective.

---

### 26.5 Notification Flow

| Event | Who receives it | Channel |
|-------|----------------|---------|
| Proxy sends access request | Patient | Push + SMS |
| Patient approves request | Proxy | Push |
| Patient declines request | Proxy | Push |
| Proxy views any record | Patient | Push |
| Proxy downloads a document | Patient | Push |
| Access expires in 3 days | Proxy | Push + SMS |
| Access expires | Both | Push |
| Patient revokes access | Proxy | Push + SMS |

**Notification fatigue guard:** If the proxy views multiple records in a single session (within 30 minutes), the patient receives only one consolidated notification: *"Rahul viewed 4 records in your history at 3:42 PM"* — not one per document.

---

### 26.6 Proxy UI — How It Looks in the App

When a proxy opens the app and has active access to a family member's records, a separate section appears: **"Viewing as Proxy"**.

```
MY RECORDS      PROXY ACCESS
┌────────────────────────────────────────────────┐
│  Viewing: Ramesh Kumar (your father)           │
│  Access granted: permanent | [Revoke request] │
│  ─────────────────────────────────────────── │
│  [Active Medications]  [Allergies: Penicillin] │
│                                                │
│  Timeline                                      │
│  ──────────────────────────────────────────── │
│  May 2026 — Dr. Mehta (Orthopedics)           │
│    [Prescription]  [Download PDF]  [Share]    │
│                                                │
│  Mar 2026 — Apollo Diagnostics                │
│    [Lab Report — Blood Panel]  [Download]      │
│                                                │
│  Jan 2026 — Dr. Sharma (Cardiology)           │
│    [Prescription]  [Download PDF]  [Share]    │
└────────────────────────────────────────────────┘
```

The proxy interface is clearly labelled. It is not possible to accidentally believe you are viewing your own records.

The **[Share]** button on a prescription opens the device share sheet (native Android/iOS) — it does not upload the document to any third-party service. The pre-signed PDF URL is fetched and attached to a standard share intent.

---

### 26.7 Data Model

```sql
-- Medical Proxy access grants
-- Each row represents one patient-to-proxy access grant
family_medical_proxies
  id                UUID (PK)
  patient_id        UUID (FK → patients)       -- record owner (e.g., father)
  proxy_patient_id  UUID (FK → patients)       -- trusted viewer (e.g., son)
  relation          VARCHAR                    -- "Son", "Daughter", "Sibling", "Spouse", etc.
  request_message   TEXT (nullable)            -- reason written by requester at time of request
  status            ENUM (PENDING, ACTIVE, DECLINED, EXPIRED, REVOKED)
  granted_at        TIMESTAMP (nullable)
  expires_at        TIMESTAMP (nullable)       -- null = permanent until revoked
  revoked_at        TIMESTAMP (nullable)
  declined_at       TIMESTAMP (nullable)
  created_at        TIMESTAMP
  -- Constraint: a proxy cannot have two ACTIVE rows for the same patient_id
  -- Constraint: proxy_patient_id cannot equal patient_id (cannot proxy yourself)
```

The `audit_logs` table (Section 8) already records every access event. For proxy access, `actor_role = FAMILY_PROXY`. No new table needed for audit — the existing append-only audit infrastructure covers it.

---

### 26.8 API Endpoints

```
# Request management (both parties)
POST   /api/v1/family-proxy/request              → Proxy requests access (body: { patientPhone or patientId, relation, message? })
GET    /api/v1/family-proxy/pending              → Patient lists incoming pending requests
POST   /api/v1/family-proxy/:id/approve          → Patient approves (body: { expiresAt?: ISO8601 | null })
POST   /api/v1/family-proxy/:id/decline          → Patient declines
DELETE /api/v1/family-proxy/:id                  → Patient revokes active grant
GET    /api/v1/family-proxy/given                → Patient lists all proxy grants they have made
GET    /api/v1/family-proxy/received             → Proxy lists all patients who have granted them access

# Proxy data access (requires active grant; every call is audit-logged)
GET    /api/v1/proxy/:patientId/summary          → Active medications + allergies card
GET    /api/v1/proxy/:patientId/timeline         → Full medical timeline (paginated, filterable)
GET    /api/v1/proxy/:patientId/documents        → Document list (paginated)
GET    /api/v1/proxy/:patientId/documents/:id/download  → Pre-signed download URL (24hr expiry)
GET    /api/v1/proxy/:patientId/prescriptions    → Prescription list
GET    /api/v1/proxy/:patientId/search?q=...     → Search records (same params as patient search)
```

**Access control enforcement:** The `/api/v1/proxy/:patientId/*` routes check two conditions before any data is returned:
1. The caller has an active (non-expired, non-revoked) `family_medical_proxies` row linking them to `patientId`
2. The current timestamp is before `expires_at` (if set)

Both checks happen at the application layer AND are logged to the audit trail.

---

### 26.9 Security Considerations

| Risk | Mitigation |
|------|-----------|
| Attacker poses as a family member to gain access | Patient always receives the request notification and must actively approve; the app shows requester's full name and profile photo |
| Proxy account is compromised and attacker reads records | Patient sees every access in real-time (push notification per session); easy one-tap revocation |
| Patient is coerced into granting access | Not preventable via software; same limitation as any consent-based system; time-limited options reduce long-term coercion risk |
| Proxy forwards downloaded PDFs to unauthorised parties | Once a PDF is on the device, we cannot prevent forwarding; this is an accepted limitation disclosed to the patient at consent time |
| Proxy hoards access to records for a long time | Patient can revoke at any time; time-limited options expire automatically; we recommend showing "last accessed" date on the proxy list so patients can see stale grants |
| Sub-delegation — proxy shares their credentials | Prevented at account level (each OmniMedVault account requires OTP login tied to a phone number); cannot be eliminated but is not specific to this feature |

**Warning shown to patient before approving:**
> *"Only grant access to people you personally know and trust. They will be able to view and download your complete medical history for the duration you choose. You will be notified every time they access your records, and you can revoke this access at any time."*

---

### 26.10 Premium Access Gate

This is a **Premium** feature for both parties:
- The **proxy** must have a Premium subscription to request or maintain proxy access
- The **patient** (record owner) does not need Premium to be the target of a proxy grant — they are sharing their own data, not consuming a premium feature

A free-tier proxy who has received access will see a prompt to upgrade when attempting to view records, with a clear explanation: *"Viewing a family member's medical records requires a Premium account."*

This matches the overall freemium model: the capability to share is free for the patient, the capability to receive and act on that shared access requires Premium.

---

---

## 27. Natural Language Query Interface

> A patient should never have to navigate a timeline, apply date filters, open a document, and manually scan for a value. They should be able to ask — the same way they would ask a trusted assistant — and get a direct answer.

---

### 27.1 Feature Overview

A conversational query interface where patients and doctors type a question in everyday language and receive a factual, grounded answer drawn exclusively from actual records in the system.

**For patients (Premium):** Ask anything about your own medical history — lab values, medications, doctor visits, expenses — and get an answer that cites the exact record it came from.

**For doctors (included in all tiers):** Ask about a consented patient's history without scrolling through years of records. Every query is audited and the patient is notified.

**What this is not:** A medical advisory tool. The query interface retrieves and presents facts. It does not diagnose, interpret against clinical norms, or recommend. That is the domain of the AI Health Insights Engine (Phase 1B). These two features are complementary and architecturally separate.

---

### 27.2 Supported Query Types

| Intent | Example Patient Query | Example Doctor Query |
|--------|----------------------|----------------------|
| **Lab value lookup** | "What was my HB in August 2021?" | "What is this patient's latest creatinine?" |
| **Medication lookup** | "What medicines was I on in 2023?" | "Is the patient currently on any blood thinners?" |
| **Doctor / visit lookup** | "Who treated my knee problem?" | "When did this patient last see a cardiologist?" |
| **Document search** | "Do I have any reports from Apollo Hospital?" | "Are there any MRI reports from last year?" |
| **Trend query** | "Has my blood sugar been going up or down?" | "Show me this patient's TSH over the last 2 years" | Response is **textual or graphical**, chosen automatically based on how many actual records are available. See §27.11 for display rules. |
| **Expense query** *(patient only)* | "How much did I spend on medicines in 2024?" | N/A |
| **Diagnosis history** | "When was I first prescribed blood pressure medicine?" | "Does this patient have any history of kidney disease?" |

---

### 27.3 Query Processing Pipeline

```
User types a query
         │
         ▼
┌──────────────────────────────────────────────────────────────────┐
│  STEP 1: QUERY PARSING (one LLM call with structured output)     │
│                                                                  │
│  Input: raw query text                                           │
│  Output (structured JSON):                                       │
│  {                                                               │
│    intent: "LAB_VALUE_LOOKUP",                                   │
│    marker: "Hemoglobin",          ← resolved from "HB"          │
│    date_range: {                                                 │
│      from: "2021-08-01",                                         │
│      to:   "2021-08-31"           ← parsed from "Aug 2021"      │
│    },                                                            │
│    fallback_range_months: 6                                      │
│  }                                                               │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│  STEP 2: PRIMARY QUERY  (deterministic — no LLM)                 │
│                                                                  │
│  Query health_metrics:                                           │
│    WHERE patient_id = :id                                        │
│    AND   marker_name = 'Hemoglobin'                              │
│    AND   report_date BETWEEN '2021-08-01' AND '2021-08-31'      │
│    AND   extraction_confidence >= 0.80                           │
│                                                                  │
│  ── EXACT MATCH FOUND? ────────────────────────────────────────  │
│     YES → go to Step 4 with result                               │
│     NO  → go to Step 3                                           │
└────────────────────────────┬─────────────────────────────────────┘
                             │ (no exact match)
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│  STEP 3: FALLBACK — TEMPORAL RANGE EXPANSION                     │
│                                                                  │
│  Expand window by ±6 months:                                     │
│    from: 2021-02-01   to: 2022-02-28                            │
│                                                                  │
│  Query again. Return up to 3 records, sorted by proximity        │
│  to the original target date (closest first).                    │
│  A record from April 2021 ranks above one from January 2020.    │
│                                                                  │
│  Flag: fallback_used = true                                      │
│                                                                  │
│  If still no records found within ±6 months:                    │
│  → response = "No [marker] records found within 6 months of     │
│               [requested period]."                               │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│  STEP 4: GROUNDED RESPONSE GENERATION (second LLM call)          │
│                                                                  │
│  Input to LLM:                                                   │
│    - Original user query                                         │
│    - Retrieved records (structured data, not free text)          │
│    - fallback_used flag (true/false)                             │
│    - System instruction: "Format only the retrieved data as      │
│      a clear, human-readable answer. Do not add any             │
│      information not present in the provided records.            │
│      Do not interpret, advise, or diagnose."                     │
│                                                                  │
│  ── Exact match output: ──────────────────────────────────────   │
│  "Your haemoglobin was 13.3 g/dL as per the lab report          │
│   dated August 5, 2021."                                         │
│                                                                  │
│  ── Fallback output: ─────────────────────────────────────────   │
│  "There is no lab report from August 2021, but here are         │
│   records from nearby dates:                                     │
│   1.  HB = 12.8 g/dL — April 18, 2021                          │
│   2.  HB = 13.2 g/dL — December 3, 2021"                       │
│                                                                  │
│  ── No records at all: ───────────────────────────────────────   │
│  "No haemoglobin records found within 6 months of               │
│   August 2021."                                                  │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
         Response returned to user
         Query logged to nl_queries table (INSERT-only)
```

---

### 27.4 The Nearby Records Fallback — Exact Rules

This is the core intelligence the user experiences when their requested record does not exist.

**Expansion rules:**
- Expand to ±6 months from the midpoint of the requested date range
- Return up to 3 records, sorted by proximity to the original requested date (nearest first)
- Each result shows: value, unit, exact report date, source document label
- The response explicitly states that these are not from the requested period

**What the fallback never does:**
- **No interpolation** — the system never estimates or calculates what the value might have been on the requested date based on surrounding readings
- **No averaging** — if two nearby readings exist, both are presented separately
- **No clinical judgement** — the system does not comment on whether the nearby readings are "close enough" or "too old to rely on"

**±6 months rationale:** Six months is a clinically reasonable window for stable markers like HbA1c and kidney function. It is configurable per marker type in a future enhancement — faster-moving markers (infection markers, acute readings) may warrant a tighter window; lifestyle markers may warrant a wider one.

---

### 27.5 Marker Synonym Resolution

Between query parsing and the database query, a lookup table maps informal query terms to canonical marker names as stored in `health_metrics`.

| User says | Resolves to |
|-----------|-------------|
| HB, haemoglobin, blood count, khoon | Hemoglobin |
| sugar, blood sugar, fasting sugar, diabetes test | Fasting Glucose AND HbA1c (both queried) |
| thyroid, thyroid test | TSH, T3, T4 (all three queried) |
| BP, blood pressure | Systolic BP, Diastolic BP |
| kidney test, creatinine, kidney function | Serum Creatinine, eGFR, BUN |
| cholesterol, lipid profile, lipids | Total Cholesterol, LDL, HDL, Triglycerides |
| liver test, LFT | ALT, AST, ALP, Bilirubin, Total Protein |
| CBC, full blood count, blood test | Hemoglobin, WBC, Platelet Count, RBC |
| vitamin D | 25-OH Vitamin D |
| B12, vitamin B12 | Serum B12 |
| blood thinners *(medication query)* | Drug class: Anticoagulants, Antiplatelets |

This table is maintained as a curated lookup file, extended over time as query logs reveal new informal terms patients actually use.

---

### 27.6 Doctor-Facing Queries

When a doctor uses the query interface against a patient's records, the pipeline is identical with two mandatory additions:

1. **Consent check:** An active `consents` row must exist linking the doctor to this patient. If not, the query is rejected before any data is retrieved.
2. **Audit + notification:** The query, its intent, and which records were returned are logged to `audit_logs` with `actor_role = DOCTOR`. The patient receives a push notification: *"Dr. Sharma queried your records at 3:42 PM today."*

The doctor's interface pre-loads the patient context from whoever they currently have open in their session — the doctor never specifies "which patient" in the query text itself.

---

### 27.7 Multi-Language Support

The query interface accepts Hindi-language queries from Phase 2 onward:

*"अगस्त 2021 में मेरा HB क्या था?"* — same pipeline; the query parsing LLM handles Hindi natively; marker synonym resolution includes Hindi equivalents; the response is generated in the same language as the query.

---

### 27.8 What This Feature Will NOT Do

| Excluded | Reason |
|----------|--------|
| Medical advice ("Should I be worried about my HB?") | Advisory belongs to Health Insights (Phase 1B), not this interface |
| Clinical interpretation ("Your HB is below normal") | Comparing to reference ranges is Health Insights territory |
| Diagnosis ("Do I have anaemia?") | No clinical conclusions — only factual retrieval |
| Predictions ("Will my HB improve?") | Out of scope for this feature at any phase |
| Answers not grounded in actual records | The response LLM is strictly constrained to format retrieved data only; it cannot use general medical knowledge |
| Cross-patient queries | A doctor can only query one consented patient per session |
| Sub-6-month fallback expansion | The maximum fallback window is ±6 months; no open-ended search across all time |
| Trend lines / best-fit lines on charts | A regression line implies a value at dates with no record — not allowed |
| Smooth curves between data points on charts | A smooth curve implies continuity and interpolated values between actual measurements — not allowed |
| Estimated or synthetic data points on charts | Every plotted point must correspond to an actual record; no manufactured points |
| Future projections on charts | Extending the chart beyond the last actual record is a clinical prediction, not retrieval |

---

### 27.9 Premium Access Gate

| User | Access |
|------|--------|
| Patient — Free tier | Not available; upgrade prompt shown |
| Patient — Premium | Full access to own records |
| Doctor (any hospital tier) | Included — not a premium upsell; querying patient records is core clinical workflow |
| Family Medical Proxy — Premium | Available for records they have been granted access to |

A free patient who types a query sees: *"Asking questions about your medical history in plain language is a Premium feature. Upgrade to get instant answers from your records."*

---

### 27.10 In-App Query History

The last 50 queries by the authenticated user are stored and accessible in-app as a scrollable history list. Each entry shows:
- The original query text
- A one-line preview of the response
- The date and time of the query
- A **Re-run** button (re-executes the exact query against current records — useful for recurring checks like "what is my latest HbA1c?")

Query history is personal — a doctor's query history is separate from the patient's. A proxy's query history is separate from both.

---

### 27.11 Trend Query — Textual and Graphical Display

Trend queries are the only query type where the response can be graphical. The format is chosen automatically based on the number of actual records found, and the user can always toggle between views.

---

#### Display Format Selection

| Records found | Default display | Toggle available |
|---------------|----------------|-----------------|
| 0 | Text: "No [marker] records found in this period." | No |
| 1 | Text only — a single value with date and source | No (one point cannot form a trend) |
| 2 | Graph (default) + text toggle | Yes |
| 3 or more | Graph (default) + text toggle | Yes |

---

#### Chart Specification — What Is Rendered

```
Example: "Show me my TSH over the last 2 years"
3 actual records found: Jun 2024, Nov 2024, Mar 2026

  TSH (mIU/L)
  |
4.5|                              * Mar 2026 — 4.2
  |                            /
3.0|          * Nov 2024 — 2.9/
  |         /
1.5|* Jun 2024 — 1.4
  |
  +-------------------------------------------> Date
    Jun 2024       Nov 2024         Mar 2026
       ^               ^                ^
   Actual report   Actual report   Actual report
   (tap to open)   (tap to open)   (tap to open)
```

**Chart type:** Scatter plot with straight-line segments connecting consecutive actual data points — NOT a smooth curve.

**Every plotted point:**
- Corresponds to exactly one actual record in the system
- Shows the exact value and exact date on tap/hover
- Is tappable — opens the source document (the lab report it came from)
- Is labelled with value + date directly on the chart for readability

**Lines between points:**
- Straight lines only — connecting dot to dot
- A straight line between two real readings does not claim to know what happened in between; it connects only what is known
- For large time gaps (> 6 months between consecutive readings), the connecting line is rendered **dashed** to visually signal the discontinuity and that the gap contains no records

**Axes:**
- X-axis: spans only from the date of the earliest actual record to the date of the latest actual record — does not extend into the future
- Y-axis: scaled to the actual value range of the returned records

---

#### What the Chart Will Never Show

| Prohibited element | Why |
|-------------------|-----|
| Smooth or curved line between data points | Implies interpolated values that were never measured |
| Any plotted point not from an actual record | Fabrication — prohibited at every layer of the stack |
| A trend line or regression line | Claims to know the value at every date on the x-axis |
| Future projection beyond the last record | A prediction, not retrieval |
| Reference range bands overlaid | Clinical interpretation — belongs to Health Insights (Phase 1B), not this feature |
| Averaged or merged points | If 3 HbA1c tests exist in one month, all 3 are plotted separately |

---

#### Text View (toggle from graph)

When the user switches to text view, the response is a flat chronological list:

```
Your TSH readings over the last 2 years (3 records found):

  1. 1.4 mIU/L  —  June 12, 2024       [Apollo Diagnostics Lab Report]
  2. 2.9 mIU/L  —  November 3, 2024    [SRL Diagnostics Lab Report]
  3. 4.2 mIU/L  —  March 7, 2026       [Apollo Diagnostics Lab Report]
```

No commentary is added ("readings are rising" is Health Insights territory). The list presents the facts; the user draws their own conclusion or consults a doctor.

---

#### API Response Structure for Trend Queries

The backend returns chart data and text list together in a single response, so the frontend renders either view without a second API call:

```json
{
  "response_type": "TREND",
  "text_summary": "3 TSH records found from June 2024 to March 2026.",
  "records": [
    {
      "value": 1.4,
      "unit": "mIU/L",
      "date": "2024-06-12",
      "source_label": "Apollo Diagnostics Lab Report",
      "document_id": "uuid-of-source-document"
    },
    {
      "value": 2.9,
      "unit": "mIU/L",
      "date": "2024-11-03",
      "source_label": "SRL Diagnostics Lab Report",
      "document_id": "uuid-of-source-document"
    },
    {
      "value": 4.2,
      "unit": "mIU/L",
      "date": "2026-03-07",
      "source_label": "Apollo Diagnostics Lab Report",
      "document_id": "uuid-of-source-document"
    }
  ],
  "chart_config": {
    "type": "scatter_connected",
    "dashed_gap_threshold_days": 180,
    "x_axis": "date",
    "y_axis": { "label": "TSH", "unit": "mIU/L" }
  },
  "fallback_used": false
}
```

The `records` array contains only actual data points from `health_metrics`. No estimated or interpolated values are ever present in this array. The `dashed_gap_threshold_days` field tells the frontend to render the connecting segment as dashed whenever the gap between two consecutive records exceeds 180 days.

---

---

## 28. Future Scope

> Features in this section are **not scheduled for any current phase**. They require a critical mass of real user data — estimated at approximately one year of continuous data collection from a substantial number of active users — before development can begin. Details will be refined over time.

---

### 28.1 Monthly Health Intelligence Journal

#### Overview

Once OmniMedVault accumulates sufficient anonymised, aggregated health data, the platform will generate a **Monthly Health Intelligence Journal** — an internal publication that surfaces real-world health trends observed across the user base. The journal is strictly **developer-facing**: only OmniMedVault developers can access, review, and publish each edition. No patient or doctor ever sees this journal.

#### Data Trigger Condition

Development of this feature should not begin until:
- Approximately **one year** of continuous, production-grade data has been collected.
- The active user base is large enough to produce statistically meaningful, anonymised aggregates without any risk of individual identification.

#### Journal Content Categories

Each monthly edition covers one or more of the following analytical dimensions:

| Dimension | Description |
|---|---|
| **Geography × Season** | Diseases and illnesses most prevalent in a given state/region during a specific month or season (e.g., dengue spikes in Maharashtra post-monsoon, respiratory illness peaks in Delhi winters) |
| **Age Group × Condition** | Categorisation of common conditions by age bracket (paediatric, adult, geriatric) — useful for identifying cohort-specific risk patterns |
| **Geography × Medicine / Active Salt** | Most-prescribed drugs and active pharmaceutical ingredients (APIs/salts) in a region during a given period, broken down by season or month |

Additional dimensions may be added as the data model matures.

#### Access Model

| Role | Access |
|---|---|
| Developer (OmniMedVault team) | Full read + publish rights |
| Patient | None |
| Doctor | None |
| Hospital admin | None |

Publication requires explicit developer review and approval before a journal edition is marked published. No automated publishing.

#### Commercialisation Intent

The compiled journals and the underlying anonymised dataset represent a high-value health intelligence asset. Planned monetisation channels include:

- **Pharma companies** — regional demand forecasting, drug supply planning, seasonal stocking
- **Government health bodies** — evidence base for targeted public health schemes in specific states or demographic groups
- **Health insurance providers, NGOs, research institutions** — as additional channels identified over time

This positions OmniMedVault as a **Public Health Intelligence** platform alongside its core patient-facing product, opening a B2B / B2G revenue stream separate from the existing B2C and B2B SaaS models.

#### Key Design Constraints (to resolve during planning)

- **Anonymisation architecture** — individual users must never be identifiable from journal content or the underlying exported dataset; differential privacy or k-anonymity techniques should be evaluated.
- **User consent model** — patients must explicitly opt-in to their anonymised data being used for commercial intelligence purposes; this consent is separate from the core product consent.
- **Regulatory compliance** — DPDP Act 2023 (India), and GDPR if international users are onboarded; legal review required before any data commercialisation.
- **Minimum cohort size guardrail** — no aggregate stat should be published if it is derived from fewer than a defined minimum number of users in a cohort (prevents indirect identification).
- **Journal format** — PDF report, internal dashboard, or structured API export; to be decided during planning.
- **Publisher access control** — role-gated admin panel with audit log of who reviewed and published each edition.

---

---

## 29. Vaccination Tracker Module

> In India, every newborn is required to receive a prescribed set of government-mandated vaccinations at specific age milestones — from birth through 15 years of age. Today this is tracked on a paper immunisation card issued at birth, which parents frequently lose, forget to update, or cannot read after the child moves between clinics. The result: missed doses, duplicate doses, and no reliable source of truth for whether a child received protection against a given disease. This module solves that problem — digitally, proactively, and permanently.

---

### 29.1 Problem Statement (Specific)

| Current-State Problem | Impact |
|---|---|
| Paper vaccination card lost or damaged | No record of what was given; duplicate doses or missed protection |
| Parent forgets upcoming due date | Vaccination delayed or skipped entirely |
| Child moves city or changes clinic | New clinic has no history; cannot verify past vaccines |
| School/visa asks for vaccination proof | Parent scrambles to reconstruct history from memory |
| Doctor doesn't know what vaccines the child has received | Cannot advise correctly or flag gaps during a consultation |

---

### 29.2 Government of India (GOI) Immunisation Schedule

The **Universal Immunisation Programme (UIP)** mandated by the Ministry of Health & Family Welfare (MoHFW) defines the following schedule. This is seeded into the system as a lookup table and used to auto-generate each child's personal schedule.

| Age Milestone | Vaccines |
|---|---|
| At Birth | BCG, OPV-0 (Oral Polio), Hepatitis B (Birth dose) |
| 6 Weeks | DPT-1 (Diphtheria, Pertussis, Tetanus), OPV-1, Hepatitis B-2, Hib-1, IPV-1, Rotavirus-1, PCV-1 |
| 10 Weeks | DPT-2, OPV-2, Hib-2, Rotavirus-2, PCV-2 |
| 14 Weeks | DPT-3, OPV-3, Hib-3, IPV-2, Rotavirus-3, PCV-3 |
| 9 Months | Measles-Rubella (MR-1), JE-1 (Japanese Encephalitis — selected districts) |
| 12 Months | Hepatitis A-1 (optional — increasingly standard), PCV Booster |
| 15–18 Months | DPT Booster-1, OPV Booster, MR-2, JE-2, Hib Booster |
| 18 Months | Hepatitis A-2 (if applicable) |
| 2 Years | Typhoid Conjugate Vaccine (TCV) |
| 5–6 Years | DPT Booster-2, OPV Booster |
| 10 Years | Td (Tetanus + reduced diphtheria) |
| 15–16 Years | Td (Tetanus + reduced diphtheria) |

> **Note:** The schedule above reflects the 2023 UIP guidelines. The system stores the schedule in a versioned lookup table (`vaccination_schedule_versions`) so future MoHFW revisions can be applied without schema changes. Children born before a revision retain the schedule version applicable at their birth date.

**Optional (non-GOI) vaccines supported:**
Varicella, Hepatitis A (full series), HPV (Gardasil/Cervarix), Influenza (annual), Meningococcal, Typhoid (Vi-polysaccharide as alternative to TCV), and any custom entry the parent adds.

---

### 29.3 Core Functional Design

#### Auto-Schedule Generation

When a parent registers a child as a managed dependent and enters the child's date of birth, the system:
1. Looks up the applicable GOI schedule version for the child's birth date
2. Computes the exact due date for each vaccine: `child_dob + age_milestone_days`
3. Creates one row per vaccine in `child_vaccinations` with `status = UPCOMING` (or `status = DUE` if the due date is today or past)
4. Optionally sets all past-milestone vaccines to `status = NEEDS_VERIFICATION` — prompting the parent to confirm whether those were given (common for children added to the app after birth)

#### Vaccination Status Lifecycle

```
UPCOMING     ← due date is in the future; reminder not yet sent
    │
    ▼ (7 days before due date)
REMINDER_SENT  ← first reminder dispatched
    │
    ▼ (on due date)
DUE          ← due date reached; daily escalation begins
    │
    ├── Parent marks as administered → ADMINISTERED
    │
    └── Due date passes without action → OVERDUE
              │
              ▼ (weekly reminders until resolved)
    Parent marks administered → ADMINISTERED
    Parent marks skipped      → SKIPPED (with reason)
```

#### Reminder Engine

The reminder engine runs as a scheduled job (cron, daily at 8 AM IST) and:

1. Queries all `child_vaccinations` rows where:
   - `status = UPCOMING` AND `due_date = TODAY + 7`  → send 7-day reminder
   - `status IN (UPCOMING, REMINDER_SENT)` AND `due_date = TOMORROW`  → send 1-day reminder
   - `status IN (UPCOMING, REMINDER_SENT)` AND `due_date = TODAY`  → send due-today reminder (update status to `DUE`)
   - `status = DUE` AND `due_date < TODAY`  → update to `OVERDUE`; send overdue reminder
   - `status = OVERDUE`  → send weekly follow-up reminder until `ADMINISTERED` or `SKIPPED`

2. All reminders sent via the existing `NotificationService`:
   - **Push** (high-priority FCM channel)
   - **SMS** (AWS SNS / Twilio) — because a reminder on a device the parent isn't looking at is a missed reminder

3. Reminder template (English):
   > *"Vaccination due soon — [Child Name]'s [Vaccine Name] is due on [Date]. Tap to mark as done or find a nearby clinic."*

4. Overdue template:
   > *"Overdue vaccination — [Child Name] was due for [Vaccine Name] on [Date]. Please visit a clinic soon. Tap to mark as done or snooze."*

---

### 29.4 Data Models

```sql
-- Master GOI schedule (lookup — seeded at deployment; versioned)
vaccination_schedule
  id                UUID (PK)
  schedule_version  VARCHAR(10)  NOT NULL  -- "UIP_2023", "UIP_2025", etc.
  vaccine_code      VARCHAR(50)  NOT NULL  -- "BCG", "OPV_0", "DPT_1", "MR_1", etc.
  vaccine_name      VARCHAR(200) NOT NULL  -- "BCG (Bacillus Calmette-Guérin)"
  disease_protected VARCHAR(500) NOT NULL  -- "Tuberculosis"
  age_days_min      INTEGER      NOT NULL  -- earliest acceptable age in days from birth
  age_days_target   INTEGER      NOT NULL  -- ideal due age in days from birth (used for schedule generation)
  age_days_max      INTEGER                -- latest acceptable age (nullable — some have no hard cap)
  dose_number       INTEGER      NOT NULL  -- 1, 2, 3, etc. (for multi-dose vaccines)
  is_mandatory      BOOLEAN      NOT NULL  -- true = GOI UIP; false = optional/recommended
  notes             TEXT                   -- catch-up instructions, regional notes
  sort_order        INTEGER      NOT NULL  -- display order on the vaccination card
  is_active         BOOLEAN      NOT NULL DEFAULT TRUE
  valid_from_dob    DATE         NOT NULL  -- schedule version applies to children born on or after this date
  valid_until_dob   DATE                   -- nullable — open-ended for the current version

-- Per-child vaccination schedule (generated from master; one row per vaccine per child)
child_vaccinations
  id                   UUID (PK)
  patient_id           UUID (FK → patients)        -- the child's patient record
  guardian_patient_id  UUID (FK → patients)        -- the parent/primary account holder managing this child
  schedule_entry_id    UUID (FK → vaccination_schedule)
  vaccine_code         VARCHAR(50)  NOT NULL        -- snapshot from schedule at generation time
  vaccine_name         VARCHAR(200) NOT NULL        -- snapshot
  dose_number          INTEGER      NOT NULL
  due_date             DATE         NOT NULL        -- child_dob + age_days_target
  status               VARCHAR(20)  NOT NULL DEFAULT 'UPCOMING'
                       -- UPCOMING | REMINDER_SENT | DUE | ADMINISTERED | OVERDUE | SKIPPED | NEEDS_VERIFICATION
  administered_date    DATE                         -- set when parent marks as done
  vaccine_brand        VARCHAR(200)                 -- optional: "Pentavac SD", "Rotarix", etc.
  administering_clinic VARCHAR(300)                 -- optional: clinic/hospital name
  administering_doctor VARCHAR(200)                 -- optional: doctor name
  document_id          UUID (FK → documents, nullable)  -- link to uploaded vaccination card scan
  notes                TEXT                         -- parent notes (e.g., "slight fever post-dose")
  skip_reason          TEXT                         -- reason if status = SKIPPED
  last_reminder_sent_at TIMESTAMPTZ
  reminder_snooze_until DATE                        -- set when parent snoozes a reminder
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()

INDEX idx_child_vax_patient_id         ON child_vaccinations(patient_id)
INDEX idx_child_vax_guardian_id        ON child_vaccinations(guardian_patient_id)
INDEX idx_child_vax_status_due_date    ON child_vaccinations(status, due_date)
INDEX idx_child_vax_patient_status     ON child_vaccinations(patient_id, status)

-- Vaccination reminder log (for audit and deduplication)
vaccination_reminder_logs
  id                UUID (PK)
  child_vaccination_id UUID (FK → child_vaccinations)
  reminder_type     VARCHAR(20)  NOT NULL  -- SEVEN_DAY | ONE_DAY | DUE_TODAY | OVERDUE | WEEKLY_OVERDUE
  sent_at           TIMESTAMPTZ  NOT NULL
  channel           VARCHAR(10)  NOT NULL  -- PUSH | SMS
  delivery_status   VARCHAR(20)  NOT NULL  -- SENT | FAILED | SNOOZED
```

---

### 29.5 API Design

```
# VACCINATION TRACKER

GET    /api/v1/vaccinations/schedule
  → Returns the full GOI master schedule (all vaccines, due ages, disease info)
  → Used to populate the "what does this vaccine protect against?" info screen
  → Cached; rarely changes

GET    /api/v1/patients/:patientId/vaccinations
  → Returns the child's full vaccination timeline
  → Auth: parent (guardian_patient_id = authenticated user) OR consented DOCTOR
  → Query params: status (filter), from/to (date range)
  → Response: grouped by status (UPCOMING, DUE, OVERDUE, ADMINISTERED, SKIPPED)

PATCH  /api/v1/patients/:patientId/vaccinations/:vaccinationId
  → Mark a vaccination as administered, skipped, or update details
  → Auth: parent only (not doctor — doctors observe, not update vaccination records)
  → Body: { status, administeredDate?, vaccineBrand?, administeringClinic?,
             administeringDoctor?, notes?, skipReason? }

POST   /api/v1/patients/:patientId/vaccinations/extra
  → Add an optional or non-GOI vaccination not on the auto-generated schedule
  → Auth: parent only
  → Body: { vaccineName, diseaseProtected, administeredDate, dose?, vaccineBrand?,
             administeringClinic?, administeringDoctor?, notes?, documentId? }

GET    /api/v1/patients/:patientId/vaccinations/pdf
  → Generate and return a pre-signed URL to a downloadable PDF vaccination card
  → Auth: parent OR consented DOCTOR
  → PDF resembles the standard GOI immunisation booklet layout

GET    /api/v1/patients/:patientId/vaccinations/reminders
  → List all upcoming reminder schedules for this child's vaccinations
  → Auth: parent only

PATCH  /api/v1/patients/:patientId/vaccinations/reminders/:vaccinationId
  → Snooze (push reminder by N days) or dismiss a reminder
  → Auth: parent only
  → Body: { action: 'SNOOZE' | 'DISMISS', snoozeDays?: number }
```

---

### 29.6 Notification Events

Added to the Notification Service event catalogue:

| Event | Trigger | Recipient | Channels |
|---|---|---|---|
| `vaccination.reminder_7day` | 7 days before due_date | Parent | Push + SMS |
| `vaccination.reminder_1day` | 1 day before due_date | Parent | Push + SMS |
| `vaccination.due_today` | On due_date | Parent | Push + SMS |
| `vaccination.overdue` | due_date passed without ADMINISTERED | Parent | Push + SMS |
| `vaccination.overdue_weekly` | Every 7 days while OVERDUE | Parent | Push + SMS |

All vaccination notification templates are added to `src/modules/notifications/templates/vaccination/` in English and Hindi.

---

### 29.7 PDF Vaccination Card

Generated on demand via the existing PDF generation infrastructure (Puppeteer/PDFKit). The card is formatted to resemble the standard GOI **Mother and Child Protection (MCP) Card** layout:

- Child's name, date of birth, blood group
- Each vaccine row: vaccine name, disease, due date, date administered, clinic name, batch number (if recorded)
- GOI and OmniMedVault branding footer
- QR code linking to the child's vaccination record (parent-controlled visibility)
- Suitable for: school admissions, paediatric consultations, travel visas, international vaccination requirements

---

### 29.8 Integration with Existing Modules

| Integration Point | Detail |
|---|---|
| **Document Module (S04)** | Uploaded vaccination card scans are stored as `type = VACCINATION_CARD` documents, linked to the corresponding `child_vaccinations` row via `document_id` |
| **Patient Profile (S02)** | Child's `dateOfBirth` on the patient profile is the anchor for schedule generation; `guardian_patient_id` links to the managing parent's account |
| **Notification Service (S10)** | Vaccination reminders are additional events consumed by the existing notification pipeline — no separate notification infrastructure |
| **Consent Module (S08)** | A paediatrician with active consent to a child's records can view the vaccination timeline via `GET /api/v1/patients/:patientId/vaccinations` — same consent gate as all other patient data |
| **Search Module (S07)** | Vaccination records are indexed in OpenSearch (new index `omnimedvault_vaccinations`) enabling search by vaccine name, disease, status, date |
| **Emergency QR (S12)** | The Emergency QR for a child optionally shows overdue vaccinations as a clinical alert alongside blood group and allergies |

---

### 29.9 Monolith Module Structure Addition

```
src/
  modules/
    vaccinations/          ← NEW — Phase 1A
      controllers/
        vaccinations.controller.ts
      services/
        vaccinations.service.ts
        reminder-scheduler.service.ts   ← cron job; daily 8 AM IST
        schedule-generator.service.ts   ← generates child_vaccinations rows from master schedule
        pdf-card.service.ts             ← vaccination card PDF generation
      repositories/
        child-vaccinations.repository.ts
        vaccination-schedule.repository.ts
      workers/
        reminder.worker.ts              ← dispatches reminders via NotificationService
      dto/
        mark-administered.dto.ts
        add-extra-vaccine.dto.ts
        snooze-reminder.dto.ts
```

---

### 29.10 Key Design Decisions & Rationale

| Decision | Rationale |
|---|---|
| **Free feature (not Premium)** | Vaccination tracking is a fundamental child health safety tool. Paywalling it would contradict the product's mission. Reminders for a vaccine that protects against measles should not be a luxury. The freemium model applies for premium add-ons (expense reports, AI insights); child immunisation is core. |
| **Auto-generate the full 15-year schedule at birth** | Parents don't need to know when the next vaccine is due — the system tells them. Zero cognitive load. |
| **Push + SMS for every reminder** | A push-only reminder fails if the app is uninstalled or the phone is switched. For something as critical as a missed vaccination, SMS is the fallback that works on any device. |
| **Parent marks administered; doctor observes only** | Doctors don't administer vaccines in this workflow — they observe history. The parent is the record-keeper. This avoids trust/liability issues if a doctor accidentally marks something administered incorrectly. |
| **Versioned schedule table** | The GOI UIP is periodically updated (new vaccines added, timings revised). A versioned lookup ensures children born under different schedule versions retain accurate history. |
| **NEEDS_VERIFICATION status for children added after birth** | A child added to the app at age 3 cannot have vaccines auto-marked ADMINISTERED for the first 3 years. Instead, each past-due row is flagged for the parent to confirm. This prevents false positives. |
| **Optional vaccine support** | Many urban, educated parents give optional vaccines (Varicella, HPV). Excluding them would leave gaps in the record and reduce completeness. The system supports them without making them seem mandatory. |

---

---

---

## 30. Provider Ratings Module

> In India, choosing a doctor, hospital, or clinic is largely word-of-mouth — a cousin's recommendation, a WhatsApp group post, or a quick Google search. Ratings on consumer platforms exist (Practo, Google) but are unverified: anyone can rate, including people who never visited. OmniMedVault has a structural advantage: every rating is backed by a real document (prescription, lab report, or receipt) from that provider in the patient's own record. This module surfaces that verified, first-party community signal alongside aggregated external ratings — giving patients a trustworthy composite score for every provider they interact with.

---

### 30.1 Problem Statement (Specific)

| Current-State Problem | Impact |
|---|---|
| Google and Practo ratings are unverified | Fake reviews inflate or deflate scores; patients cannot trust them |
| No single source covers all provider types | Google covers most; Practo covers doctors/clinics; neither is complete or verified |
| Patients have no structured way to rate providers within their health record system | Feedback is siloed from the medical context |
| Doctors and hospitals have no mechanism to receive verified feedback from their actual patients | No actionable signal for quality improvement |

---

### 30.2 Provider Types Covered

| Provider Type | In-App Rating Dimensions | External Sources |
|---|---|---|
| **Doctor** (individual) | Expertise, Communication, Wait Time, Overall | Google Places, Practo |
| **Hospital** | Infrastructure, Cleanliness, Staff Behaviour, Wait Time, Overall | Google Places |
| **Individual Clinic** | Cleanliness, Staff Behaviour, Wait Time, Value for Money, Overall | Google Places, Practo |

All ratings are 1–5 stars per dimension. Overall is a single top-level score; dimension scores are optional. Free-text review: max 300 chars; optional.

---

### 30.3 Rating Eligibility — Visit Verification

A patient can only rate a provider if at least one document (prescription, lab report, or receipt) from that provider exists in their OmniMedVault record. This is the structural anti-fake-review guarantee.

```
Patient taps "Rate this provider"
        │
System checks: does patient have ≥ 1 document where
  doctor_name matches provider  OR
  institution_id matches provider?
        │
  YES → Rating form shown; provider pre-filled from the document context
  NO  → "You can only rate providers you have visited. Upload a document from this visit first."
```

Verification happens at the application layer against `documents` and `prescriptions` tables. No ML, no heuristics — just a simple JOIN.

---

### 30.4 Composite Score Calculation

```
CompositeScore = (OmniMedVaultAvg × 0.70) + (ExternalAvg × 0.30)

OmniMedVaultAvg  = average of all in-app `overall` ratings for this provider
                   (minimum 3 ratings before this component is used)

ExternalAvg      = weighted average across available external sources:
                     Google Places   → weight 0.60 of the external 30%
                     Practo          → weight 0.40 of the external 30%
                   (only sources with data for this provider type are included;
                    weights normalised if a source has no data)

If OmniMedVault component is below threshold (< 3 ratings):
  CompositeScore = ExternalAvg only, clearly labelled "External ratings only"

If External component is below threshold (< 5 reviews across all sources):
  CompositeScore = OmniMedVaultAvg only, clearly labelled "OmniMedVault ratings only"

If both are below threshold:
  No composite; each available source shown separately with review count
```

**Why 70/30?** OmniMedVault ratings are verified (visit-backed, account-linked). External ratings include unverified reviews. The weight reflects relative trustworthiness, not volume. This is tunable via admin config — no code change needed.

---

### 30.5 External Ratings Aggregation

| Source | Provider Types | API / Method | Cache TTL |
|---|---|---|---|
| Google Places API | Doctors, Hospitals, Clinics | Official Places API (place details endpoint) | 24 hours (doctors/clinics), 7 days (hospitals) |
| Practo | Doctors, Clinics | Practo public data (partner API if available; structured web data as fallback) | 24 hours |

**Entity ID Mapping:**
- Google Place ID is the primary external key for all provider types.
- Practo doctor/clinic IDs are mapped to Google Place IDs via a pre-built `provider_external_ids` table, populated when a provider is first registered or searched.
- Mapping updated via a background sync job (nightly for active providers).

**External fetch flow:**
```
Patient views a provider detail screen
        │
Ratings Service checks Redis:
  cache key: ext_rating:{source}:{google_place_id}  →  HIT → return cached
        │
  MISS → background SQS job triggered (non-blocking for the API call)
       → API returns cached-or-empty immediately
       → SQS worker fetches from Google Places + Practo in parallel
       → stores result in Redis (TTL per above) + snapshot in MongoDB
       → Kafka event: ratings.external.refreshed → app receives push if score changed significantly
```

**Important:** The UI never waits for a live external API call. External data is always served from cache. First-time views show "External ratings loading…" until the background job completes (typically < 5 seconds).

---

### 30.6 Anti-Gaming Controls

| Control | Detail |
|---|---|
| Visit verification | Rating blocked without a matching document (FR60) |
| One rating per visit episode | Patient can rate a provider once per illness episode; re-rates require a new document from a new visit |
| 30-day edit window | Rating editable for 30 days post-submission; after that it is locked |
| New account gate | Accounts < 7 days old cannot submit ratings |
| Spike detection | If a provider receives > 5 in-app ratings within 1 hour, new ratings are quarantined for review before being included in the aggregate |
| Sentiment cross-check | If free-text review sentiment (Claude API moderation pass) contradicts the star rating significantly, the rating is flagged for moderation queue |
| Anonymity by default | Reviewer identity is not shown publicly; patient can opt in to show their name |

---

### 30.7 Data Models

```sql
-- Provider registry (doctors, hospitals, clinics)
providers
  id                    VARCHAR(36)   PRIMARY KEY
  type                  VARCHAR(20)   NOT NULL  -- DOCTOR | HOSPITAL | CLINIC
  name                  VARCHAR(300)  NOT NULL
  city                  VARCHAR(100)
  state                 VARCHAR(100)
  google_place_id       VARCHAR(200)            -- primary external key; nullable until mapped
  practo_id             VARCHAR(200)            -- nullable
  doctor_id             VARCHAR(36)   REFERENCES doctors(id)  -- null unless type = DOCTOR
  institution_id        VARCHAR(36)   REFERENCES institutions(id)  -- null unless type = HOSPITAL|CLINIC
  omv_avg_overall       DECIMAL(3,2)            -- rolling average of in-app overall ratings; updated async
  omv_rating_count      INTEGER       NOT NULL DEFAULT 0
  composite_score       DECIMAL(3,2)            -- recomputed after each rating or external refresh
  composite_updated_at  TIMESTAMPTZ
  is_active             BOOLEAN       NOT NULL DEFAULT TRUE
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()

INDEX idx_providers_type           ON providers(type)
INDEX idx_providers_google_place   ON providers(google_place_id)
INDEX idx_providers_doctor_id      ON providers(doctor_id)
INDEX idx_providers_institution_id ON providers(institution_id)
INDEX idx_providers_city_type      ON providers(city, type)

-- Patient in-app ratings
provider_ratings
  id                    VARCHAR(36)   PRIMARY KEY
  provider_id           VARCHAR(36)   NOT NULL  REFERENCES providers(id)
  patient_id            VARCHAR(36)   NOT NULL  REFERENCES patients(id)
  evidence_document_id  VARCHAR(36)   NOT NULL  REFERENCES documents(id)  -- visit verification anchor
  overall_score         DECIMAL(3,2)  NOT NULL  -- 1.0 – 5.0
  dimension_scores      JSONB         NOT NULL DEFAULT '{}'
    -- Doctor:   { expertise, communication, wait_time }
    -- Hospital: { infrastructure, cleanliness, staff_behaviour, wait_time }
    -- Clinic:   { cleanliness, staff_behaviour, wait_time, value_for_money }
  review_text           VARCHAR(300)            -- optional; passes content moderation before storage
  is_anonymous          BOOLEAN       NOT NULL DEFAULT TRUE
  is_flagged            BOOLEAN       NOT NULL DEFAULT FALSE  -- set by spike detection or moderation
  edit_locked_at        TIMESTAMPTZ             -- set to submitted_at + 30 days; null until then
  submitted_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()

UNIQUE CONSTRAINT uq_rating_patient_document ON provider_ratings(patient_id, evidence_document_id)
  -- one rating per visit document (not per provider — a patient can rate multiple visits)
INDEX idx_ratings_provider_id      ON provider_ratings(provider_id)
INDEX idx_ratings_patient_id       ON provider_ratings(patient_id)
INDEX idx_ratings_provider_score   ON provider_ratings(provider_id, overall_score)

-- External ratings cache snapshot (also stored in Redis for fast reads)
external_ratings_snapshots
  id                    VARCHAR(36)   PRIMARY KEY
  provider_id           VARCHAR(36)   NOT NULL  REFERENCES providers(id)
  source                VARCHAR(20)   NOT NULL  -- GOOGLE | PRACTO
  external_id           VARCHAR(200)  NOT NULL  -- source-specific ID (google_place_id, practo_id)
  avg_rating            DECIMAL(3,2)
  review_count          INTEGER
  raw_payload           JSONB                   -- full API response snapshot
  fetched_at            TIMESTAMPTZ   NOT NULL
  expires_at            TIMESTAMPTZ   NOT NULL

UNIQUE CONSTRAINT uq_ext_rating ON external_ratings_snapshots(provider_id, source)
INDEX idx_ext_ratings_provider     ON external_ratings_snapshots(provider_id)
INDEX idx_ext_ratings_expiry       ON external_ratings_snapshots(expires_at)

-- ID mapping table (Google Place ID ↔ Practo ID)
provider_external_ids
  provider_id           VARCHAR(36)   NOT NULL  REFERENCES providers(id)
  source                VARCHAR(20)   NOT NULL
  external_id           VARCHAR(200)  NOT NULL
  verified              BOOLEAN       NOT NULL DEFAULT FALSE
  mapped_at             TIMESTAMPTZ   NOT NULL DEFAULT NOW()

PRIMARY KEY (provider_id, source)
```

---

### 30.8 API Design

```
# PROVIDER RATINGS (full contracts in S20)

GET    /api/v1/providers/search
  → ?q=&type=DOCTOR|HOSPITAL|CLINIC&city=&page=&pageSize=
  → Returns paginated provider list with composite score + badges

GET    /api/v1/providers/:providerId
  → Full provider detail: name, type, OmniMedVault rating breakdown by dimension,
    external ratings by source, composite score, badges, review count

POST   /api/v1/ratings
  → Patient submits a rating
  → Requires: providerId, evidenceDocumentId, overallScore, dimensionScores?, reviewText?
  → Validates visit evidence before accepting

GET    /api/v1/ratings/me
  → Patient lists all their own submitted ratings (paginated)

PATCH  /api/v1/ratings/:ratingId
  → Patient edits a rating (within 30-day edit window; returns 403 if locked)

GET    /api/v1/providers/:providerId/ratings
  → Public list of in-app ratings for a provider
  → Reviewer name shown only when is_anonymous = false
  → Excludes flagged ratings
  → Paginated; sortable by date or score
```

---

### 30.9 Rating Badges

| Badge | Condition |
|---|---|
| `Highly Rated` | Composite score ≥ 4.5 with sufficient review count |
| `Community Favourite` | OmniMedVault score ≥ 4.3 with ≥ 30 in-app ratings |
| `Avoid` | Composite score ≤ 2.5 with ≥ 10 reviews |

Badges are re-evaluated after every rating submission and external rating refresh. Stored on the `providers` row for fast search-result rendering (no join needed).

---

### 30.10 Notification Events

| Event | Trigger | Recipient | Channel |
|---|---|---|---|
| `rating.submitted` | Patient submits a rating | Patient (confirmation) | In-app |
| `rating.external_refreshed` | External rating changes by ≥ 0.3 stars | Internal monitoring | Log only (no patient notification) |

No notification to rated providers in Phase 1 — provider-facing rating dashboard is Phase 2.

---

### 30.11 Integration with Existing Modules

| Integration Point | Detail |
|---|---|
| **Document Module (S04)** | `evidence_document_id` on `provider_ratings` links to the visit document; validated at rating submission time |
| **Doctor Module (S03)** | If the provider is a doctor registered on OmniMedVault, `providers.doctor_id` links to their `doctors` row; their ratings surface in search and their profile page |
| **Institution Module (S11)** | If the provider is a hospital or clinic registered on OmniMedVault, `providers.institution_id` links to their `institutions` row |
| **Notification Service (S10)** | Rating submission confirmation dispatched via existing notification pipeline |
| **Search Module (S07)** | Provider search index includes composite score and badges for fast filtered retrieval |

---

### 30.12 Monolith Module Structure Addition

```
src/
  modules/
    ratings/               ← NEW — Phase 1
      controllers/
        ratings.controller.ts
        providers.controller.ts
      services/
        ratings.service.ts
        composite-score.service.ts     ← computes 70/30 weighted score
        external-ratings.service.ts    ← fetches + caches Google + Practo data
        provider-registry.service.ts   ← CRUD for providers table
      repositories/
        provider-ratings.repository.ts
        providers.repository.ts
        external-ratings-snapshots.repository.ts
      workers/
        external-fetch.worker.ts       ← SQS worker; fetches external ratings on cache miss
        composite-recalculator.worker.ts  ← recomputes composite after each new rating
      dto/
        submit-rating.dto.ts
        search-providers.dto.ts
        update-rating.dto.ts
```

---

### 30.13 Key Design Decisions & Rationale

| Decision | Rationale |
|---|---|
| **Free feature** | Ratings are a trust and discovery feature for all patients. A verified rating system benefits the entire community; paywalling it would reduce contribution volume and defeat the purpose. |
| **70% OmniMedVault / 30% External** | OmniMedVault ratings are visit-verified; external ratings are open to gaming. Higher internal weight reflects higher signal quality, not just quantity. |
| **Google + Practo only (Phase 1)** | These two cover the majority of searchable providers in India. Additional sources (Justdial, 1mg, Lybrate) can be added in Phase 2 without schema changes. |
| **Non-blocking external fetch** | Medical app users should not wait for a third-party API. Cache-first, background-refresh is the correct pattern. |
| **Evidence document as anti-fake anchor** | No external ID verification, no OTP to the clinic — just proof the patient's own medical record contains a document from that provider. Simple, private, hard to fake at scale. |
| **One rating per visit document** | Prevents rating the same visit twice. A patient with 5 visits to the same doctor can submit 5 separate ratings, each tied to a different document. This is correct — multiple interactions generate multiple data points. |
| **30-day edit window** | Gives patients time to reconsider but prevents indefinite gaming where a patient holds their rating hostage. |

---

*End of System Design Document v2.2*

---

> **CONFIDENTIAL & PROPRIETARY** — This document is the confidential and proprietary intellectual property of **Rishi Sood**, dated May 19, 2026. Unauthorized reproduction, distribution, or use of this document or any part of it, in any form, is strictly prohibited. © 2026 Rishi Sood. All rights reserved.
