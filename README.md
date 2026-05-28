# OmniMedVault

This repository currently contains the **India demo stack** for OmniMedVault: a NestJS backend that runs locally and on AWS Lambda, plus a browser-based demo console for the patient, doctor, consent, document, and audit flows.

## Current branch

The active demo work is on the branch:

`feat/india-demo-backend-bootstrap`

## What contributors can run today

The current branch includes:

1. Demo OTP authentication
2. Patient self profile read and update
3. Patient document upload, list, detail, and download URL generation
4. Patient consent grant, list, and revoke
5. Doctor consented-patient list
6. Patient audit log
7. Browser demo console

## Local setup

### 1. Clone and switch to the branch

```bash
git clone https://github.com/gouravsinha1405/OmniMedVault.git
cd OmniMedVault
git fetch origin
git checkout feat/india-demo-backend-bootstrap
```

### 2. Install dependencies

```bash
npm install
```

### 3. Start the app

```bash
npm start
```

The API runs locally at:

```text
http://127.0.0.1:3000/api/v1
```

The browser demo runs at:

```text
http://127.0.0.1:3000/demo
```

## Useful commands

```bash
npm run build
npm run test:e2e
```

## Demo walkthrough

### Patient demo flow

1. Open `http://127.0.0.1:3000/demo`
2. Use role `PATIENT`
3. Use phone `+919812345678`
4. Click `Request OTP`
5. Copy the debug OTP shown in the UI
6. Click `Verify OTP`
7. Use the profile, documents, consent, and audit panels

### Doctor demo flow

1. In the same demo UI, switch role to `DOCTOR`
2. Use phone `+919876543210`
3. Request and verify OTP
4. Use the doctor panel to load consented patients

### Suggested end-to-end demo sequence

1. Sign in as patient
2. Update the patient profile
3. Upload a prescription document
4. Grant consent to `+919876543210`
5. Load the audit log
6. Switch to doctor
7. Load doctor patients and verify the patient appears

## Current implementation notes

1. Storage is still in-memory for the demo stage
2. OTP is demo-mode and exposes a debug OTP instead of sending SMS
3. Download URLs are demo placeholders, not real S3 pre-signed URLs yet
4. PostgreSQL persistence is the next major backend step

## Demo stack notes

See [INDIA_DEMO_STACK.md](/workspaces/OmniMedVault/INDIA_DEMO_STACK.md) for the India-only demo infrastructure plan and rough cost estimate.
