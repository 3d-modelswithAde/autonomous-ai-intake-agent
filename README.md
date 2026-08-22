# Marcus Vance Automotive — Autonomous AI Intake Agent

An enterprise-grade, deterministic intake automation pipeline designed to process all inbound customer communications for **Marcus Vance Automotive**. Built with **n8n**, **HubSpot CRM**, **Gmail**, **Slack**, and **Google Sheets**, powered by strict zero-hallucination AI classification.

---

## 📑 Core Architecture & Business Invariants

1. **CRM Ticket First (Rule #6)**: The HubSpot Support Ticket is **always** created prior to AI classification, pricing calculation, Slack notification, CRM pipeline movement, or automated email. Inquiries are never lost if downstream services encounter transient errors.
2. **Deterministic Dual-ID Scheme (Rule #7)**:
   - **Internal Inquiry ID**: Machine-level UUID (`inq_<uuid>`) for database keys and idempotency.
   - **Customer Tracking Number**: Human-readable reference (`TRK-YYYYMMDD-XXXX`) in all email subjects, CRM tickets, Slack alerts, and Google Sheet rows.
3. **Absolute Sensitivity Quarantine (Rules #5, #12, #13)**: Any inquiry mentioning refunds, chargebacks, billing disputes, attorney/legal threats, regulatory complaints (BBB, Consumer Protection), or damage claims is quarantined immediately. It routes strictly to `#manual-review`, and automated email replies are **strictly suppressed**.
4. **Zero-Hallucination Pricing Engine (Rules #4, #10, #11)**: Prices are calculated strictly from an explicit, configurable rate matrix based on Vehicle Tier and Service Code. Unknown or exotic vehicles automatically fallback to `"Manual Quote Required"` ($null).
5. **Master Activity Audit Log (Rule #8)**: Every state transition is written in real time to the Google Sheets 25-column master log.
6. **Graceful Degradation (Rule #9)**: Missing vehicle or service information routes to polite customer follow-up without throwing unhandled exceptions.

---

## 📂 Project Structure

```
autonomous-ai-intake-agent/
├── ARCHITECTURE.md                  # Comprehensive technical specification & diagrams
├── SETUP-CHECKLIST.md               # Step-by-step credentials & CRM setup checklist
├── CONFIG.example.json              # Configurable rates, tiers, channels & keywords
├── README.md                        # Master documentation & operator guide
├── package.json                     # Node.js dependencies and test runners
├── workflows/
│   └── marcus_vance_intake_agent.json # Importable production n8n workflow definition
├── src/
│   ├── index.js                     # Master pipeline orchestrator
│   ├── config.js                    # Configuration loader
│   ├── id_generator.js              # Deterministic UUID & Tracking Number generator
│   ├── sensitivity_filter.js        # Multi-layer sensitivity quarantine filter
│   ├── pricing_engine.js            # Zero-hallucination tier & service pricing table
│   ├── ai_extractor.js              # AI system prompt & JSON schema parser
│   ├── slack_formatter.js           # Block Kit message builders
│   └── email_formatter.js           # Quote & missing info email templates
└── tests/
    ├── test_cases.json              # 8 standardized test scenarios (TC-01 to TC-08)
    ├── test_pricing_engine.js       # Pricing matrix unit tests
    ├── test_sensitivity_filter.js   # Sensitivity quarantine unit tests
    ├── test_pipeline_simulator.js   # End-to-end simulation runner
    └── run_all_tests.js             # Master test suite
```

---

## 🚀 Quickstart & Verification

### 1. Run Automated Test Suite
Run the full test suite verifying all 8 end-to-end scenarios, pricing edge cases, and safety filters:

```bash
npm test
```

### 2. Import Workflow into n8n
1. Open your n8n web interface.
2. In the left navigation, click **Workflows > Import from File**.
3. Select `workflows/marcus_vance_intake_agent.json`.
4. Bind your credentials:
   - **Gmail OAuth2**: Inbound monitoring & Outbound send permissions.
   - **HubSpot CRM API**: Private App Token with contact and ticket read/write permissions.
   - **Google Sheets**: OAuth2 or Service Account edit access to the Master Log.
   - **Slack**: Bot User OAuth Token (`xoxb-...`).
   - **OpenAI / Gemini**: Model inference key.
5. Set environment variable `GOOGLE_SHEET_ID` with your Google Spreadsheet ID.
6. Toggle workflow to **Active**.

---

## 🧪 Validated Test Matrix

| Test ID | Scenario | Input | Pipeline Stage | Slack Channel | Auto-Email | Google Sheets Status |
| :---: | :--- | :--- | :--- | :--- | :---: | :---: |
| **TC-01** | Normal service inquiry with known vehicle | 2022 Toyota Camry (Oil Change) | `quote_generated` | `#intake-notifications` | **YES** ($79.95) | `SUCCESS` |
| **TC-02** | Normal service inquiry with unknown vehicle | 2019 Apex Cruiser (Front Brakes) | `quote_generated` | `#intake-notifications` | **YES** (Custom Quote) | `SUCCESS` |
| **TC-03** | Missing vehicle information | "Quote for brakes" (No model) | `needs_info` | `#intake-notifications` | **YES** (Info request) | `AWAITING_INFO` |
| **TC-04** | Refund request | Transmission repair refund demand | `manual_review` | `#manual-review` | **NO (SUPPRESSED)** | `MANUAL_REVIEW` |
| **TC-05** | Legal threat | Brake failure negligence / lawyer threat | `manual_review` | `#manual-review` | **NO (SUPPRESSED)** | `MANUAL_REVIEW` |
| **TC-06** | Booking request | 2020 Ford F-150 (Front Brakes) | `quote_generated` | `#intake-notifications` | **YES** ($269.00) | `SUCCESS` |
| **TC-07** | Complaint without legal threat | Service delay & dirty seat complaint | `manual_review` | `#manual-review` | **NO (SUPPRESSED)** | `MANUAL_REVIEW` |
| **TC-08** | Payment dispute | Double charge & chargeback threat | `manual_review` | `#manual-review` | **NO (SUPPRESSED)** | `MANUAL_REVIEW` |

---

## 👥 Service Advisor Runbook

- **Urgent Sensitive Alerts (`#manual-review`)**:
  - Advisor acknowledges ticket on Slack by reacting with 👀.
  - Opens direct HubSpot Ticket link.
  - Reviews AI summary and customer history.
  - Calls customer directly via phone.
- **Missing Information Follow-up (`needs_info`)**:
  - Once customer replies to the tracking thread, the ticket is updated and moved to quote generation.
- **Manual Quote Queue**:
  - For exotic or complex custom repairs, advisor generates custom estimate in HubSpot and dispatches the verified quote.
