# OmniMedVault - India-Only Demo Stack and Infra Cost Estimate

## Purpose

This document defines a lower-cost infrastructure stack for **initial tryouts, internal demos, pilot walkthroughs, and early investor/customer presentations**.

It does **not** change the product flow defined in [SYSTEM_DESIGN.md](./SYSTEM_DESIGN.md). It only changes the **deployment model and cost profile** for the early stage.

The target principles are:

1. Keep all primary application data in India.
2. Preserve the Phase 1A user journey and consent model.
3. Minimize idle infrastructure cost.
4. Avoid premature production-grade components like always-on containers, OpenSearch clusters, and Redis unless usage proves the need.

---

## What Stays the Same

The core Phase 1A flow remains unchanged:

1. Patient logs in with OTP.
2. Patient uploads prescription, lab report, receipt, or other medical document.
3. File is stored securely, metadata is recorded, and OCR is triggered asynchronously.
4. Extracted text is processed and attached back to the patient timeline.
5. Patient can search and view their own records.
6. Patient grants or revokes doctor access.
7. Doctor views only consented patient history.
8. Verified doctor creates a digital prescription.
9. Audit trail and notifications are still generated for access-sensitive actions.

This means the **business flow, consent lifecycle, document lifecycle, and doctor-patient interaction model do not change**.

---

## India-Only Constraint

For the current stage, all primary system data should remain inside Indian cloud regions.

### Regional policy

1. Primary AWS region: `ap-south-1` Mumbai
2. Optional backup region later: `ap-south-2` Hyderabad
3. Database, object storage, logs, queues, and secrets should remain in India-hosted AWS regions

### Important note on Groq

Groq is useful for fast model inference, but it is **not an India-hosted data plane by default**.

Because of that, the safe policy is:

1. **Do not send real patient-identifiable medical data to Groq** until legal, privacy, and residency requirements are cleared.
2. For demos, Groq may be used only with:
   - synthetic data
   - dummy sample reports
   - redacted or de-identified payloads
3. For real-user pilot data, keep the LLM layer disabled or strictly outside the critical record path until compliance is confirmed.

So for an India-only demo stack, **Lambda is a good fit now; Groq is optional and should stay outside the core medical-record flow unless the data is non-sensitive or fully de-identified**.

---

## Recommended Demo Stack

### Frontend

1. Next.js web app for demo UI, doctor portal, and admin walkthroughs
2. Optional Android app later, once the backend demo flow is stable

### Authentication

1. AWS Cognito for OTP-based login
2. JWT-based protected APIs

### Backend

1. AWS API Gateway
2. AWS Lambda for synchronous API handlers
3. Shared TypeScript codebase preserving the same modular boundaries as the main design:
   - auth
   - users
   - documents
   - ocr
   - search
   - prescriptions
   - consent
   - notifications
   - institutions
   - natural-language query

### Data and Storage

1. Amazon S3 in Mumbai for uploaded documents
2. PostgreSQL as the primary metadata store
3. Recommended for demo:
   - AWS RDS PostgreSQL Single-AZ, if you want AWS-only
   - Supabase with India-region support only if residency and vendor location are verified separately

### Async Processing

1. Amazon SQS for document processing queues
2. Lambda workers for OCR job orchestration
3. EventBridge optional for internal events if needed later

### OCR

1. Google Cloud Vision API on demand for scanned prescriptions and reports
2. OCR should be triggered asynchronously after upload
3. For early demos, OCR can be limited to selected documents to control spend

### Search

1. PostgreSQL full-text search for initial demos
2. No OpenSearch cluster initially
3. Add OpenSearch only after search volume or relevance requirements justify it

### Notifications

1. AWS SNS or a lightweight SMS provider for OTP and alerts
2. Email can be SES later if needed

### Monitoring and Security

1. CloudWatch logs and metrics
2. AWS Secrets Manager or SSM Parameter Store
3. S3 encryption enabled
4. TLS everywhere
5. Basic audit log stored in PostgreSQL from day one

---

## Flow-Preserving Technical Mapping

The product flow remains the same, but components are replaced with lower-cost equivalents.

| Capability | Production-leaning design | Demo stack replacement |
|---|---|---|
| API compute | ECS Fargate NestJS monolith | API Gateway + Lambda |
| Search | OpenSearch | PostgreSQL full-text search |
| Cache | Redis | Omit initially |
| Async events | Kafka | SQS + Lambda |
| Auth | Cognito | Cognito |
| Files | S3 | S3 |
| OCR | Google Vision | Google Vision |
| Database | RDS PostgreSQL Multi-AZ | RDS PostgreSQL Single-AZ |
| Notifications | SNS/SES/FCM | SNS initially |
| LLM/NLQ | Later-phase AI stack | Groq only for synthetic or de-identified demo data |

This keeps the user-visible flow intact while materially reducing fixed monthly cost.

---

## Proposed Demo Architecture

```text
User / Doctor Web App
        |
        v
   CloudFront or Vercel-style hosting
        |
        v
   API Gateway (Mumbai)
        |
        +--> Lambda: Auth / Users / Consent / Search / Prescriptions
        |
        +--> S3: document uploads
        |
        +--> PostgreSQL: patients, doctors, docs, consent, prescriptions, audit
        |
        +--> SQS: document.uploaded
                 |
                 v
             Lambda OCR worker
                 |
                 +--> Google Vision API
                 +--> PostgreSQL update
                 +--> audit / notification write
```

Optional:

1. Groq sits outside the core data path and is invoked only for synthetic or de-identified demo prompts.
2. Hyderabad can be added later as backup or DR once the pilot becomes real.

---

## Monthly Infra Cost Estimate for Initial Tryouts and Demos

These are rough estimates for **low initial traffic**, such as:

1. 50 to 300 demo users
2. Mostly guided demos and test accounts
3. 500 to 2,000 document uploads per month
4. Limited OCR usage
5. No large-scale search traffic

### Option A - Bare-minimum internal demo

| Component | Monthly estimate (INR) | Notes |
|---|---:|---|
| API Gateway + Lambda | 500 - 2,000 | Low at demo traffic |
| Cognito | 0 - 1,000 | Depends on OTP volume and MAUs |
| RDS PostgreSQL Single-AZ | 2,500 - 5,500 | Small instance |
| S3 storage + requests | 200 - 1,000 | Depends on doc volume |
| SQS | 100 - 500 | Usually negligible at this stage |
| CloudWatch logs/metrics | 300 - 1,500 | Can grow if logs are noisy |
| OCR usage | 1,500 - 6,000 | Usually the biggest variable cost |
| SMS / OTP | 500 - 2,500 | Depends on login frequency |
| Domain / TLS / misc | 200 - 800 | Very small overhead |
| **Estimated total** | **5,800 - 20,800** | Good for first demos |

### Option B - Cleaner pilot-ready demo

| Component | Monthly estimate (INR) | Notes |
|---|---:|---|
| API Gateway + Lambda | 1,000 - 3,500 | More active testing |
| Cognito | 500 - 1,500 | More OTP traffic |
| RDS PostgreSQL Single-AZ | 4,000 - 8,000 | Slightly better instance/storage |
| S3 storage + requests | 500 - 1,500 | More demo documents |
| SQS | 200 - 800 | Still low |
| CloudWatch logs/metrics | 700 - 2,000 | Controlled logging |
| OCR usage | 4,000 - 12,000 | If OCR is used in live demos often |
| SMS / OTP | 1,000 - 4,000 | Depends on usage pattern |
| Security / secrets / misc | 300 - 1,000 | KMS, secrets, overhead |
| **Estimated total** | **12,200 - 34,300** | Safer for external demos and pilot onboarding |

### Option C - If Groq is added for demo-only AI features

Add approximately:

1. INR 1,000 to 6,000 per month for light synthetic-data demo usage
2. More if prompts become frequent or large-context NLQ demos are used repeatedly

This cost should be treated as **optional**, because Groq should not be in the critical path for real medical-record processing while the India-only policy is strict.

---

## What to Skip for Now

To keep the infra bill low, do **not** add these in the first demo environment:

1. ECS Fargate with multiple always-on replicas
2. RDS Multi-AZ
3. OpenSearch cluster
4. Redis / ElastiCache
5. Kafka
6. Full observability stack beyond CloudWatch basics
7. Cross-region failover
8. AI health insights on real patient data

These are valid later, but they are unnecessary for the demo stage.

---

## Recommended Decision

For the current phase, the best tradeoff is:

1. Use **AWS Lambda + API Gateway + Cognito + S3 + RDS PostgreSQL Single-AZ + SQS** in Mumbai.
2. Use **Google Vision only when needed**, not on every test document automatically.
3. Use **PostgreSQL full-text search** first.
4. Keep **Groq optional and outside real patient data flows** until residency and compliance are cleared.

### Practical budget to plan for

If the goal is only early demos and pilot walkthroughs, a realistic monthly budget is:

1. **Lean internal demo:** INR 6,000 to 12,000 per month
2. **External demo / small pilot:** INR 12,000 to 25,000 per month
3. **Heavy demo usage with OCR and optional AI experiments:** INR 25,000 to 40,000 per month

That is materially cheaper than adopting the full Phase 1 production-oriented stack too early.

---

## Final Position

Yes, Lambda is a strong fit for the current stage.

Yes, Groq can be leveraged for demo intelligence features.

But under an **India-only handling policy**, Groq should be treated as **optional and non-core** unless the data sent to it is synthetic, redacted, or otherwise cleared from a compliance perspective.

The safest near-term path is:

1. Keep the record system entirely in India on AWS.
2. Preserve the existing patient-to-doctor product flow.
3. Use serverless infrastructure to keep fixed costs low.
4. Add model inference only where it does not compromise residency constraints.
