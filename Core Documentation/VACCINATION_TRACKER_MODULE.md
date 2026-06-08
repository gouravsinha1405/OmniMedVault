> **CONFIDENTIAL & PROPRIETARY** — This document is the confidential and proprietary intellectual property of **Rishi Sood**, dated June 8, 2026. Unauthorized reproduction, distribution, or use of this document or any part of it, in any form, is strictly prohibited. © 2026 Rishi Sood. All rights reserved.

---

# OmniMedVault — Vaccination Tracker Module

**Version:** 1.0 | **Date:** 2026-06-08 | **Phase:** 1A | **Tier:** Free (all patients)

> This is the standalone deep-dive document for the Vaccination Tracker module. The authoritative cross-references are **SYSTEM_DESIGN_OmniMedVault.md §29** (architecture) and **SPECS_OmniMedVault.md S19** (engineering spec). Read those before implementing. This document provides the product rationale, the complete GOI schedule reference, and the UX design detail that would clutter the engineering spec.

---

## 1. Problem Statement

In India, every newborn is enrolled in the **Universal Immunisation Programme (UIP)** — a Government of India initiative administered by the Ministry of Health & Family Welfare (MoHFW). The UIP mandates a schedule of vaccines from birth through 15 years, protecting against 12 vaccine-preventable diseases.

Today, this schedule is tracked on a **paper MCP (Mother and Child Protection) Card** issued at the time of birth registration. The current situation:

| Problem | Real-World Consequence |
|---|---|
| Paper card is lost or damaged | No historical record; vaccination status unknown |
| Parent forgets upcoming due date | Vaccine is skipped or delayed — leaving the child unprotected |
| Child moves city or changes clinic | New clinic has no history; no way to verify what was given |
| School asks for vaccination proof | Parent scrambles to reconstruct records from memory or fragments |
| Paediatrician visits a child without the card | Cannot advise on overdue vaccines; may not ask |
| Handwriting on card is illegible | Ambiguous whether a vaccine was given or just scheduled |

This is a **preventable public health failure** caused entirely by the absence of a digital record. The solution is not complex — it is simply not yet built for the mass market in India.

---

## 2. Why This Is a Phase 1A Free Feature

This is not a premium feature. The rationale:

1. **Child safety** — reminding a parent about their infant's measles vaccine is not an upsell opportunity. Paywalling this would be ethically inconsistent with the product's mission.
2. **Trust driver** — parents who use OmniMedVault to protect their child's vaccination record become long-term, loyal users. This is the strongest possible onboarding hook for the family health use case.
3. **Data foundation** — vaccination records, once in the system, become part of the child's permanent medical history — directly supporting doctor consultations, document uploads, and (eventually) AI health insights for children.
4. **Differentiation** — no Indian personal health record app has implemented this well. It is a clear, understandable, and immediately valuable feature that gives parents a reason to download and keep using the app.

---

## 3. Government of India UIP Schedule (Full Reference)

Source: **MoHFW UIP Guidelines 2023** — this is the version seeded as `UIP_2023` in the `vaccination_schedule` table.

| Milestone | Age (Approx) | Vaccine | Disease Protected | Notes |
|---|---|---|---|---|
| At Birth | Day 0 | BCG | Tuberculosis | Single dose; left upper arm |
| At Birth | Day 0 | OPV-0 | Poliomyelitis | Oral; 2 drops |
| At Birth | Day 0 | Hepatitis B (Birth dose) | Hepatitis B | Within 24 hours of birth |
| 6 Weeks | 42 days | DPT-1 | Diphtheria, Pertussis (Whooping Cough), Tetanus | First of 3 primary doses |
| 6 Weeks | 42 days | OPV-1 | Poliomyelitis | Oral |
| 6 Weeks | 42 days | Hepatitis B-2 | Hepatitis B | Second dose |
| 6 Weeks | 42 days | Hib-1 | Haemophilus influenzae type b | First of 3 |
| 6 Weeks | 42 days | IPV-1 | Poliomyelitis | Injected (replaces OPV in select districts) |
| 6 Weeks | 42 days | Rotavirus-1 | Rotavirus diarrhoea | First of 3; oral |
| 6 Weeks | 42 days | PCV-1 | Pneumococcal disease | First of 3 |
| 10 Weeks | 70 days | DPT-2 | Diphtheria, Pertussis, Tetanus | Second dose |
| 10 Weeks | 70 days | OPV-2 | Poliomyelitis | Oral |
| 10 Weeks | 70 days | Hib-2 | Haemophilus influenzae type b | Second dose |
| 10 Weeks | 70 days | Rotavirus-2 | Rotavirus diarrhoea | Second dose |
| 10 Weeks | 70 days | PCV-2 | Pneumococcal disease | Second dose |
| 14 Weeks | 98 days | DPT-3 | Diphtheria, Pertussis, Tetanus | Third dose |
| 14 Weeks | 98 days | OPV-3 | Poliomyelitis | Oral |
| 14 Weeks | 98 days | Hib-3 | Haemophilus influenzae type b | Third dose |
| 14 Weeks | 98 days | IPV-2 | Poliomyelitis | Injected |
| 14 Weeks | 98 days | Rotavirus-3 | Rotavirus diarrhoea | Third dose |
| 14 Weeks | 98 days | PCV-3 | Pneumococcal disease | Third dose |
| 9 Months | 270 days | MR-1 | Measles, Rubella | First dose; subcutaneous |
| 9 Months | 270 days | JE-1 | Japanese Encephalitis | First dose; endemic districts only |
| 12 Months | 365 days | PCV Booster | Pneumococcal disease | |
| 15 Months | 456 days | MR-2 | Measles, Rubella | Second dose (booster) |
| 16–18 Months | 480–540 days | DPT Booster-1 | Diphtheria, Pertussis, Tetanus | First booster |
| 16–18 Months | 480–540 days | OPV Booster | Poliomyelitis | Oral booster |
| 16–18 Months | 480–540 days | Hib Booster | Haemophilus influenzae type b | |
| 16–18 Months | 480–540 days | JE-2 | Japanese Encephalitis | Second dose; endemic districts only |
| 2 Years | 730 days | TCV | Typhoid | Typhoid Conjugate Vaccine |
| 5–6 Years | 1825–2190 days | DPT Booster-2 | Diphtheria, Pertussis, Tetanus | Second booster |
| 5–6 Years | 1825–2190 days | OPV Booster | Poliomyelitis | |
| 10 Years | 3650 days | Td | Tetanus + reduced Diphtheria | Adolescent booster |
| 15–16 Years | 5475–5840 days | Td | Tetanus + reduced Diphtheria | Final adolescent booster |

**Diseases covered by the full GOI UIP schedule:**
Tuberculosis, Poliomyelitis, Hepatitis B, Diphtheria, Pertussis (Whooping Cough), Tetanus, Haemophilus influenzae type b (Hib), Rotavirus diarrhoea, Pneumococcal disease, Measles, Rubella, Japanese Encephalitis, Typhoid.

---

### 3.1 Optional Vaccines (Non-GOI, Parent-Added)

| Vaccine | Disease | Typical Schedule | Notes |
|---|---|---|---|
| Varicella | Chickenpox | 12–15 months, 4–6 years (2 doses) | Recommended by IAP |
| Hepatitis A | Hepatitis A | 12 months + 18–24 months (2 doses) | Urban recommendation |
| HPV | Cervical Cancer | 9–14 years for girls (2 doses) | Gardasil / Cervarix |
| Influenza | Flu | Annual; 6 months+ | Reformulated yearly |
| Meningococcal | Meningococcal disease | 9 months–55 years | Travellers, high-risk |
| Typhoid (Vi-PS) | Typhoid | 2 years+ | Alternative to TCV |

These are added by the parent via `POST /vaccinations/extra` — not auto-generated.

---

## 4. Vaccination Status Lifecycle

```
┌─────────────────────────────────────────────────────────────────┐
│                  VACCINATION STATUS FLOW                        │
│                                                                 │
│  UPCOMING ──(7 days before due date)──► REMINDER_SENT          │
│      │                                        │                 │
│      │                                        │                 │
│      └──────────(due date arrives)────────────►  DUE           │
│                                               │                 │
│                        ┌──────────────────────┤                 │
│                        │                      │                 │
│                        ▼                      ▼                 │
│                  ADMINISTERED            (due date passes)      │
│                                               │                 │
│                                               ▼                 │
│                                           OVERDUE               │
│                                     (weekly reminders)          │
│                                               │                 │
│                              ┌────────────────┤                 │
│                              │                │                 │
│                              ▼                ▼                 │
│                        ADMINISTERED        SKIPPED              │
│                                         (with reason)           │
│                                                                 │
│  NEEDS_VERIFICATION ── (for children added after birth) ──►     │
│    Parent confirms → ADMINISTERED or SKIPPED                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. Reminder Cadence Design

The reminder engine is designed to be persistent without being annoying. The key insight: **for infant vaccines, a missed reminder = a missed vaccine**. The stakes are high enough to justify SMS + push, unlike most other app reminders.

| When | What Fires | Channels |
|---|---|---|
| 7 days before due_date | First advance warning | Push + SMS |
| 1 day before due_date | Final warning | Push + SMS |
| On due_date | "Today is the day" | Push + SMS |
| Due date passed, no action | Status → OVERDUE; first overdue alert | Push + SMS |
| Every 7 days while OVERDUE | Follow-up until resolved | Push + SMS |

**Snooze behaviour:** Parent can snooze any reminder by 7 days. The reminder engine skips the vaccination until after `reminder_snooze_until` — but does not permanently suppress. A snoozed overdue vaccination continues to show as OVERDUE in the UI.

**Dismiss:** Dismisses the current reminder notification only. Does not snooze or change status. The next scheduled reminder will still fire.

---

## 6. Mobile UI Design

### Vaccination Tab (on child's health profile)

```
ARJUN KUMAR  |  Age: 14 months
──────────────────────────────────────────────────────
 2 OVERDUE    4 UPCOMING    18 ADMINISTERED

OVERDUE (tap to act)
──────────────────────────────────────────────────────
🔴 MR-2 (Measles-Rubella, Dose 2)    Due: 23 Apr 2026
   Was due 6 weeks ago · [Mark as Done]  [Snooze 7d]

🔴 DPT Booster-1                      Due: 15 Apr 2026
   Was due 8 weeks ago · [Mark as Done]  [Snooze 7d]

UPCOMING
──────────────────────────────────────────────────────
🟡 OPV Booster                        Due: 15 May 2026
🟡 Hib Booster                        Due: 15 May 2026
🟢 TCV (Typhoid)                      Due: 12 Jun 2027
🟢 DPT Booster-2                      Due: 5 Aug 2030

ADMINISTERED (18)
──────────────────────────────────────────────────────
✅ BCG                     Given: 12 Jun 2024 · AIIMS Delhi
✅ OPV-0                   Given: 12 Jun 2024 · AIIMS Delhi
✅ Hepatitis B (Birth)     Given: 12 Jun 2024 · AIIMS Delhi
... [show all]

[ 📄 Download Vaccination Card PDF ]
```

### Mark as Administered Screen

```
Mark Vaccination as Done
──────────────────────────────────────────────────────
Vaccine:    DPT Booster-1
Disease:    Diphtheria, Pertussis, Tetanus
Due Date:   15 April 2026

Date Given:     [  15 April 2026  ]  ← date picker; max = today
Vaccine Brand:  [  optional  ]
Clinic/Hospital:[  optional  ]
Doctor Name:    [  optional  ]
Notes:          [  optional  ]

Upload vaccination card photo? [ 📷 Add photo ]

[ Save ]
```

### Reminder Notification (Push)

```
OmniMedVault · Vaccination Reminder
──────────────────────────────────────
Arjun's DPT Booster-1 is due tomorrow
(15 April 2026). Visit your nearest
health centre.

[Mark as Done]  [Snooze 7 days]
```

---

## 7. PDF Vaccination Card Layout

The downloadable PDF is formatted to resemble the standard GOI MCP Card. It is useful for:
- School admissions (many schools require vaccination proof)
- International travel (some countries require vaccination certificates)
- Paediatric second opinions (new doctor needs vaccination history)
- Insurance forms

**PDF Sections:**
1. **Header** — child name, date of birth, blood group, OmniMedVault branding
2. **GOI Mandatory Vaccines** — table with vaccine name, disease, due date, date given, clinic, batch number (if recorded)
3. **Optional Vaccines** — separate section for non-GOI vaccines added by parent
4. **Footer** — QR code linking to the child's vaccination record (parent-controlled), disclaimer: *"This record is maintained by the parent/guardian on OmniMedVault. For official verification, refer to the original MCP Card issued at the time of birth."*

---

## 8. Edge Cases & Handling

| Scenario | Handling |
|---|---|
| Child added to app at age 3 | All past-due vaccines set to `NEEDS_VERIFICATION`; parent prompted to confirm one by one |
| Parent marks a vaccine with a future date | API returns 400 / errorCode 1005 — administered_date must be ≤ today |
| Two parents both have access to the same child | Both parents see vaccination records; either can update — whoever makes the change first is recorded in the audit log |
| GOI updates the schedule (e.g., adds a new vaccine) | New schedule version (`UIP_2025`) seeded; children born on or after the effective date get the new version; existing children retain their birth-date version |
| Vaccine given early (e.g., before the minimum age) | System accepts it (parent knows their child's situation); a warning note is added to the record |
| JE vaccine (only endemic districts) | Initially seeded for all children with `notes = "Required only in JE-endemic districts"`; parent marks as N/A via skip with reason if not applicable |
| Parent wants to delete a vaccination record | Soft delete via `status = DELETED` (not exposed in UI as "delete" — shown as "Remove this entry") — record retained per DPDPA compliance |

---

## 9. Integration with Doctor Workflow

When a paediatrician (or any doctor with consent) views a child patient's record, the vaccination timeline appears as a dedicated tab in the patient view:

```
PATIENT: Arjun Kumar (14 months)
──────────────────────────────────────────────
[ Medical History ] [ Prescriptions ] [ Vaccinations ] [ Lab Reports ]

                           ↑ NEW TAB

VACCINATION SUMMARY
──────────────────────────────────────────────
⚠ 2 vaccinations overdue    ← red alert card

MR-2 (Measles-Rubella)      Due: 23 Apr 2026   OVERDUE
DPT Booster-1               Due: 15 Apr 2026   OVERDUE

[ View full vaccination history ]
```

The doctor sees this in read-only mode. They cannot mark vaccinations as done — only the managing parent can. However, the doctor can:
- See which vaccines are overdue and advise the parent accordingly
- Use this information to advise on catch-up vaccinations
- Include vaccination history context in a digital prescription

---

## 10. Product Backlog Items (for xlsx)

### New Epic: Vaccination Tracker

| Item | Priority | Phase | Tier | Story Points (est.) |
|---|---|---|---|---|
| GOI UIP schedule seed data (UIP_2023) | P0 | 1A | — | 3 |
| Schedule generation on child registration | P0 | 1A | Free | 5 |
| View vaccination timeline (parent + doctor) | P0 | 1A | Free | 5 |
| Mark vaccination as administered | P0 | 1A | Free | 3 |
| 7-day, 1-day, due-today reminder (push + SMS) | P0 | 1A | Free | 8 |
| Overdue detection + weekly reminder | P0 | 1A | Free | 5 |
| Snooze reminder | P1 | 1A | Free | 2 |
| Upload vaccination card scan (VACCINATION_CARD doc type) | P1 | 1A | Free | 3 |
| Add optional/non-GOI vaccine | P1 | 1A | Free | 3 |
| PDF vaccination card generation | P1 | 1A | Free | 5 |
| NEEDS_VERIFICATION flow for children added after birth | P1 | 1A | Free | 5 |
| OpenSearch index for vaccinations | P1 | 1A | Free | 3 |
| Doctor read-only vaccination view | P1 | 1A | Free | 2 |
| Hindi notification templates | P2 | 1A | Free | 2 |
| JE vaccine district-specific handling | P2 | 1A | Free | 2 |
| GOI schedule versioning (UIP_2025 when released) | P2 | 2 | Free | 3 |

---

> **CONFIDENTIAL & PROPRIETARY** — © 2026 Rishi Sood. All rights reserved.
