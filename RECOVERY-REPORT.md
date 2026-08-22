# Marcus Vance Automotive — Autonomous AI Intake Agent
## Recovery, Inspection, Validation & Readiness Report

**Date:** August 21, 2026  
**Auditor / Engineering Team:** Antigravity Engineering  
**Project Workspace:** `~/autonomous-ai-intake-agent`  
**Current Status:** All 8/8 end-to-end simulation test scenarios passing. Codebase and 24-node n8n workflow verified against all architectural invariants. Production deployment is paused awaiting live external credentials and CRM/Sheet/Slack schema provisioning.

---

## 1. Project Inventory & File Manifest

| File Path | Purpose / Description | Status |
| :--- | :--- | :---: |
| [workflows/marcus_vance_intake_agent.json](file:///home/wurathepmm/autonomous-ai-intake-agent/workflows/marcus_vance_intake_agent.json) | Master 24-node production n8n workflow definition | **Verified & Validated** |
| [ARCHITECTURE.md](file:///home/wurathepmm/autonomous-ai-intake-agent/ARCHITECTURE.md) | Complete technical specification, Mermaid diagrams, API specs | **Verified** |
| [SETUP-CHECKLIST.md](file:///home/wurathepmm/autonomous-ai-intake-agent/SETUP-CHECKLIST.md) | Operator setup runbook for HubSpot, Sheets, Slack, Gmail, AI | **Verified** |
| [CONFIG.example.json](file:///home/wurathepmm/autonomous-ai-intake-agent/CONFIG.example.json) | Configurable pricing matrix, vehicle tiers, sensitivity keywords | **Verified & Synced** |
| [README.md](file:///home/wurathepmm/autonomous-ai-intake-agent/README.md) | Operator guide, quickstart instructions, and runbooks | **Verified & Synced** |
| [package.json](file:///home/wurathepmm/autonomous-ai-intake-agent/package.json) | Node.js project manifest and test suite scripts | **Verified** |
| [src/index.js](file:///home/wurathepmm/autonomous-ai-intake-agent/src/index.js) | Master pipeline orchestrator & CRM-first execution engine | **Verified & Enhanced** |
| [src/config.js](file:///home/wurathepmm/autonomous-ai-intake-agent/src/config.js) | Configuration loader with fallback support | **Verified** |
| [src/id_generator.js](file:///home/wurathepmm/autonomous-ai-intake-agent/src/id_generator.js) | Machine UUID (`inq_<uuid>`) and Tracking Number (`TRK-YYYYMMDD-XXXX`) generator | **Verified** |
| [src/sensitivity_filter.js](file:///home/wurathepmm/autonomous-ai-intake-agent/src/sensitivity_filter.js) | Multi-layer sensitivity quarantine filter (Regex + Keyword + Auto-category) | **Verified & Expanded** |
| [src/pricing_engine.js](file:///home/wurathepmm/autonomous-ai-intake-agent/src/pricing_engine.js) | Zero-hallucination tier and service pricing calculation engine | **Verified** |
| [src/ai_extractor.js](file:///home/wurathepmm/autonomous-ai-intake-agent/src/ai_extractor.js) | AI system prompt specification, JSON schema, and fallback parser | **Verified** |
| [src/slack_formatter.js](file:///home/wurathepmm/autonomous-ai-intake-agent/src/slack_formatter.js) | Block Kit alert builders (`#manual-review`, `#intake-notifications`, `#intake-errors`) | **Verified** |
| [src/email_formatter.js](file:///home/wurathepmm/autonomous-ai-intake-agent/src/email_formatter.js) | Deterministic HTML & plain-text quote and missing-info email templates | **Verified** |
| [tests/test_cases.json](file:///home/wurathepmm/autonomous-ai-intake-agent/tests/test_cases.json) | 8 standardized test cases (TC-01 through TC-08) | **Verified & Aligned** |
| [tests/test_pricing_engine.js](file:///home/wurathepmm/autonomous-ai-intake-agent/tests/test_pricing_engine.js) | Pricing matrix unit tests (Tier resolution, service keys, zero-hallucination rates) | **Passed (6/6)** |
| [tests/test_sensitivity_filter.js](file:///home/wurathepmm/autonomous-ai-intake-agent/tests/test_sensitivity_filter.js) | Unit tests for sensitive quarantine keyword & phrase catches | **Passed (10/10)** |
| [tests/test_pipeline_simulator.js](file:///home/wurathepmm/autonomous-ai-intake-agent/tests/test_pipeline_simulator.js) | End-to-end pipeline simulator with mock connectors | **Passed (8/8)** |
| [tests/run_all_tests.js](file:///home/wurathepmm/autonomous-ai-intake-agent/tests/run_all_tests.js) | Master test suite runner executing all suites sequentially | **Passed (100%)** |
| `RECOVERY-REPORT.md` | Comprehensive recovery and validation report | **Created** |

---

## 2. n8n Workflow Architecture & Topology Analysis

The n8n workflow file (`workflows/marcus_vance_intake_agent.json`) contains **24 nodes** and establishes a deterministic routing graph.

### Complete Node Inventory (24 Nodes)

1. **`Gmail Inbound Polling Trigger`** (`n8n-nodes-base.gmailTrigger`): Polls for unread customer emails.
2. **`Idempotency & Format Input`** (`n8n-nodes-base.code`): Extracts headers, body, timestamp, and generates `inquiry_id` (`inq_<uuid>`) and `tracking_number` (`TRK-YYYYMMDD-XXXX`).
3. **`HubSpot: Find or Create Contact`** (`n8n-nodes-base.hubspot`): Lookups/upserts contact record by email address.
4. **`HubSpot: Create Support Ticket (First Invariant)`** (`n8n-nodes-base.hubspot`): **Creates support ticket immediately before any AI extraction, pricing, or email dispatch.**
5. **`Google Sheets: Log Initial Creation`** (`n8n-nodes-base.googleSheets`): Appends initial row with `Status = CREATED`.
6. **`AI Intake Analysis & Classifier`** (`@n8n/n8n-nodes-langchain.openAi`): Structured JSON extraction with temperature `0.0`.
7. **`Validate AI & Safety Gate`** (`n8n-nodes-base.code`): Validates JSON schema, normalizes vehicle tiers, runs secondary regex sensitivity safety filter.
8. **`If: Is Sensitive Inquiry?`** (`n8n-nodes-base.if`): Hard branching condition evaluating `is_sensitive`.
9. **`HubSpot: Move to Manual Review Required`** (`n8n-nodes-base.hubspot`): Moves ticket to stage 2 (`manual_review`).
10. **`Slack: Alert #manual-review (Block Kit)`** (`n8n-nodes-base.slack`): Dispatches high-visibility escalation card to `#manual-review`.
11. **`Google Sheets: Log Manual Review`** (`n8n-nodes-base.googleSheets`): Updates row to `Processing_Status = MANUAL_REVIEW`.
12. **`If: Missing Required Info?`** (`n8n-nodes-base.if`): Evaluates whether vehicle make/model/year or service details are missing.
13. **`HubSpot: Move to Needs Customer Info`** (`n8n-nodes-base.hubspot`): Moves ticket to stage 3 (`needs_info`).
14. **`Gmail: Send Missing Info Email`** (`n8n-nodes-base.gmail`): Sends polite customer follow-up email.
15. **`Slack: Post Needs Info to #intake-notifications`** (`n8n-nodes-base.slack`): Notifies team in `#intake-notifications`.
16. **`Google Sheets: Log Awaiting Info`** (`n8n-nodes-base.googleSheets`): Updates row to `Processing_Status = AWAITING_INFO`.
17. **`Deterministic Pricing Engine`** (`n8n-nodes-base.code`): Matches requested services and vehicle tier against the rate matrix.
18. **`HubSpot: Update Quote Generated`** (`n8n-nodes-base.hubspot`): Moves ticket to stage 4 (`quote_generated`) and sets price and vehicle properties.
19. **`Gmail: Send Quote / Confirmation Email`** (`n8n-nodes-base.gmail`): Sends itemized quote or custom estimate confirmation.
20. **`Slack: Post Quote to #intake-notifications`** (`n8n-nodes-base.slack`): Posts summary notification to `#intake-notifications`.
21. **`Google Sheets: Log Final Success`** (`n8n-nodes-base.googleSheets`): Updates row to `Processing_Status = SUCCESS`.
22. **`Global Error Trigger`** (`n8n-nodes-base.errorTrigger`): Catches any uncaught execution failures.
23. **`Slack: Alert #intake-errors`** (`n8n-nodes-base.slack`): Alerts `#intake-errors` with failed node name and stack trace.
24. **`Google Sheets: Log Error Trace`** (`n8n-nodes-base.googleSheets`): Appends error trace to master sheet with `Status = FAILED`.

### Verified Execution Path

```
INCOMING EMAIL (Gmail Inbound Polling Trigger)
  └──> ID GENERATION (Idempotency & Format Input)
        └──> CRM CONTACT (HubSpot: Find or Create Contact)
              └──> SUPPORT TICKET CREATION (HubSpot: Create Support Ticket — FIRST INVARIANT)
                    └──> ACTIVITY LOG (Google Sheets: Log Initial Creation)
                          └──> AI EXTRACTION & CLASSIFICATION (AI Intake Analysis & Classifier)
                                └──> VALIDATION & SENSITIVITY FILTER (Validate AI & Safety Gate)
                                      └──> SENSITIVITY GATE (If: Is Sensitive Inquiry?)
                                            ├── [TRUE] ──> CRM UPDATE (Stage 2: Manual Review)
                                            │               └──> SLACK ALERT (#manual-review)
                                            │                     └──> ACTIVITY LOG (Status: MANUAL_REVIEW)
                                            │                           └──> STOP: NO GMAIL SENT
                                            │
                                            └── [FALSE] ──> MISSING INFO GATE (If: Missing Required Info?)
                                                              ├── [TRUE] ──> CRM UPDATE (Stage 3: Needs Info)
                                                              │               └──> GMAIL (Send Missing Info Request)
                                                              │                     └──> SLACK (#intake-notifications)
                                                              │                           └──> ACTIVITY LOG (Status: AWAITING_INFO)
                                                              │
                                                              └── [FALSE] ──> PRICING ENGINE (Deterministic Matrix Match)
                                                                              └──> CRM UPDATE (Stage 4: Quote Generated)
                                                                                    └──> GMAIL (Send Quote Email)
                                                                                          └──> SLACK (#intake-notifications)
                                                                                                └──> ACTIVITY LOG (Status: SUCCESS)
```

---

## 3. Invariant Verification & Defect Audit

### A. Critical Ticket-First Rule (Phase 3) — VERIFIED & ENHANCED
- **Rule:** The HubSpot Support Ticket **must** be created immediately after email intake and **before** AI analysis, pricing lookup, Slack notifications, or email replies.
- **Audit Findings:** The workflow topology places `HubSpot: Create Support Ticket` as Node 4, executing prior to any AI or downstream dispatch. Initial properties (`inquiry_id`, `tracking_number`, `gmail_thread_id`, `content`, `customer_email`, `customer_name`) are populated immediately at intake, with missing fields explicitly initialized as `"Not provided"` without hallucination.

### B. Zero-Hallucination Pricing (Phase 4) — VERIFIED
- **Rule:** Pricing must never be invented or approximated by AI.
- **Audit Findings:** Pricing is computed exclusively by `src/pricing_engine.js` and n8n node `Deterministic Pricing Engine` using explicit rate lookups.
- **Tier & Service Separation:**
  - `tier_1_sedan_coupe` (e.g., Camry, Civic, 330i)
  - `tier_2_suv_crossover` (e.g., RAV4, Explorer, CR-V)
  - `tier_3_truck_van_diesel` (e.g., F-150, Silverado, RAM 1500)
  - `tier_4_exotic_commercial` (e.g., Porsche 911, Ferrari) -> Fallback to `pricing_status = "manual_quote_required"`, `estimated_cost = null`.
  - `unknown_manual` -> Fallback to `pricing_status = "manual_quote_required"`, `estimated_cost = null`.
- If any service is unlisted or custom, `pricing_status = "manual_quote_required"` with zero dollar suppression.

### C. Sensitivity Safety & Absolute Quarantine (Phase 5) — VERIFIED & EXPANDED
- **Rule:** Inquiries mentioning refunds, legal threats, lawyers, chargebacks, court, BBB, or damage claims must route to `#manual-review` and suppress automated email.
- **Audit Findings:** Multi-layer protection active:
  1. AI prompt extraction instructions (`is_sensitive`, `sensitivity_reason`).
  2. Secondary deterministic regex safety filter scanning raw subject and body for 25+ sensitive triggers: `refund`, `refund request`, `chargeback`, `dispute`, `payment dispute`, `serious payment dispute`, `attorney`, `lawyer`, `lawsuit`, `legal action`, `legal threat`, `sue`, `court`, `bbb`, `better business bureau`, `consumer protection`, `regulatory complaint`, `attorney general`, `damage`, `damaged my car`, `fraud`, `scam`, `stolen`, `threat`, `negligence`.
  3. Workflow topology contains **zero outbound email connections** on the sensitive branch.

### D. Google Sheets Master Activity Log (Phase 6) — VERIFIED
- All 26 audit columns (A through Z) are structured and maintained across every lifecycle transition (Initial creation, manual review quarantine, missing info follow-up, quote completion, and pipeline errors).

### E. HubSpot CRM Integration (Phase 7) — VERIFIED
- Standard object types (`contacts`, `tickets`) with association.
- 17 documented custom properties under group `intake_agent`.
- 6 standard pipeline stages in `automotive_intake_pipeline`.

### F. Gmail & Slack Routing (Phases 8 & 9) — VERIFIED
- Gmail is the **sole** outbound email provider (No SES, SendGrid, Mailgun, or Zoho).
- Dual Slack channel separation (`#manual-review` with rich Block Kit alert vs. `#intake-notifications` with status card).

---

## 4. Test Suite Execution & Verification Results

All 8 standardized end-to-end scenarios have been executed and verified:

| Test ID | Scenario | Input Description | CRM Stage | Slack Destination | Auto-Email | Google Sheets Status |
| :---: | :--- | :--- | :---: | :---: | :---: | :---: |
| **TC-01** | Normal service inquiry with known vehicle | 2022 Toyota Camry, Synthetic Oil Change | `quote_generated` | `#intake-notifications` | **YES** ($79.95) | `SUCCESS` |
| **TC-02** | Normal service inquiry with unknown vehicle | 2019 Apex Cruiser (unmapped model), Front Brakes | `quote_generated` | `#intake-notifications` | **YES** (Custom Quote) | `SUCCESS` |
| **TC-03** | Missing vehicle information | "Quote for brakes" (missing year/make/model) | `needs_info` | `#intake-notifications` | **YES** (Info Request) | `AWAITING_INFO` |
| **TC-04** | Refund request | Transmission repair refund demand | `manual_review` | `#manual-review` | **NO (BLOCKED)** | `MANUAL_REVIEW` |
| **TC-05** | Legal threat | Negligence claim / lawyer / lawsuit / court threat | `manual_review` | `#manual-review` | **NO (BLOCKED)** | `MANUAL_REVIEW` |
| **TC-06** | Booking request | 2020 Ford F-150 Truck, Front Brake Pads | `quote_generated` | `#intake-notifications` | **YES** ($269.00) | `SUCCESS` |
| **TC-07** | Complaint without legal threat | Severe turnaround delay and dirty seat complaint | `manual_review` | `#manual-review` | **NO (BLOCKED)** | `MANUAL_REVIEW` |
| **TC-08** | Payment dispute | Double billing dispute & chargeback warning | `manual_review` | `#manual-review` | **NO (BLOCKED)** | `MANUAL_REVIEW` |

---

## 5. Missing Credentials & External Configuration Requirements

Before activating the workflow in production, the following external items must be provisioned:

### 1. Missing Credentials (n8n Credential Store)
- [ ] **HubSpot CRM API**: Private App Access Token with scopes (`crm.objects.contacts.read`, `crm.objects.contacts.write`, `crm.objects.tickets.read`, `crm.objects.tickets.write`, `crm.schemas.tickets.read`, `crm.schemas.tickets.write`).
- [ ] **Gmail Inbound / Outbound**: Google Workspace OAuth2 app with scopes (`gmail.readonly`, `gmail.send`, `gmail.modify`).
- [ ] **Slack Bot Token**: Bot User OAuth Token (`xoxb-...`) with scopes (`chat:write`, `chat:write.public`, `channels:read`, `groups:read`).
- [ ] **Google Sheets**: Google Service Account JSON key or OAuth2 credentials with `spreadsheets` and `drive.file` scopes.
- [ ] **AI Model API Key**: OpenAI API Key (`sk-...`) or Google Gemini API Key.

### 2. Missing HubSpot CRM Configuration
- [ ] Create Property Group: `intake_agent` (Object: Ticket).
- [ ] Create 17 Custom Ticket Properties:
  - `inquiry_id` (Single-line Text)
  - `tracking_number` (Single-line Text)
  - `inquiry_category` (Dropdown Select)
  - `vehicle_year` (Number)
  - `vehicle_make` (Single-line Text)
  - `vehicle_model` (Single-line Text)
  - `vehicle_vin` (Single-line Text)
  - `vehicle_tier` (Dropdown Select)
  - `services_requested` (Multi-line Text)
  - `estimated_cost` (Number / Currency)
  - `pricing_status` (Dropdown Select)
  - `is_sensitive` (Single Checkbox / Boolean)
  - `sensitivity_reason` (Single-line Text)
  - `customer_sentiment` (Dropdown Select)
  - `ai_summary` (Multi-line Text)
  - `action_taken` (Single-line Text)
  - `gmail_thread_id` (Single-line Text)
- [ ] Configure Pipeline: `Automotive Intake Pipeline` (`automotive_intake_pipeline`) with stages `new_inquiry` (1), `manual_review` (2), `needs_info` (3), `quote_generated` (4), `in_progress` (5), `closed_resolved` (6).

### 3. Missing Google Sheets Configuration
- [ ] Create Google Spreadsheet: `Marcus Vance Automotive - Master Intake Activity Log`.
- [ ] Name Tab: `Master_Intake_Log`.
- [ ] Configure Columns A to Z headers: `Timestamp`, `Inquiry_ID`, `Tracking_Number`, `Customer_Email`, `Customer_Name`, `Customer_Phone`, `Vehicle_Year`, `Vehicle_Make`, `Vehicle_Model`, `Vehicle_VIN`, `Vehicle_Tier`, `Inquiry_Category`, `Services_Requested`, `Is_Sensitive`, `Sensitivity_Reason`, `Estimated_Cost`, `Pricing_Status`, `Customer_Sentiment`, `AI_Summary`, `HubSpot_Contact_ID`, `HubSpot_Ticket_ID`, `HubSpot_Stage`, `Slack_Channel_Notified`, `Automated_Email_Sent`, `Processing_Status`, `Error_Details`.
- [ ] Set `GOOGLE_SHEET_ID` environment variable in n8n.

### 4. Missing Slack Configuration
- [ ] Create channels: `#manual-review`, `#intake-notifications`, `#intake-errors`.
- [ ] Add the Bot User into all three channels.

### 5. Missing Gmail Configuration
- [ ] Verify intake mailbox is configured (e.g., `service@marcusvanceauto.example.com`).

---

## 6. Exact Next Steps to Go Live

1. **Step 1: HubSpot Schema Creation**: Create the custom ticket properties and pipeline stages in HubSpot CRM as specified in `SETUP-CHECKLIST.md`.
2. **Step 2: Google Sheet Creation**: Create the master spreadsheet and add the 26 header columns.
3. **Step 3: Slack Channels Setup**: Create `#manual-review`, `#intake-notifications`, and `#intake-errors`, and invite the bot user.
4. **Step 4: n8n Import & Credential Binding**: Import `workflows/marcus_vance_intake_agent.json` into your n8n instance and attach the OAuth2/API tokens for HubSpot, Gmail, Slack, Google Sheets, and OpenAI/Gemini.
5. **Step 5: Staging Dry Run**: Send 1 live test email through Gmail with a test subject to verify end-to-end ticket creation, Slack alerting, and Sheet logging before turning on production polling.
