# Setup & Deployment Checklist — Marcus Vance Automotive Intake Agent

This checklist outlines all prerequisites, credentials, CRM schema configurations, and verification steps required before deploying the n8n Autonomous AI Intake Agent.

---

## 1. Environment & Infrastructure Readiness

- [ ] **Node.js & n8n Runtime**
  - [ ] Verify Node.js (v18.x or v20.x LTS) or Docker is available.
  - [ ] Verify n8n instance is running (Self-hosted or n8n Cloud).
  - [ ] Ensure n8n Webhook / Execution URLs are reachable if using push webhooks.
- [ ] **Workspace Repository Structure**
  - [ ] `ARCHITECTURE.md` present and reviewed.
  - [ ] `CONFIG.example.json` copied to `config.json` (for runtime variables).
  - [ ] `.env` template prepared for secure credential storage.

---

## 2. HubSpot CRM Setup & Schema Configuration

### A. Create Private App Access Token
1. In HubSpot, navigate to **Settings > Integrations > Private Apps**.
2. Click **Create a private app** named `Marcus Vance Intake Engine`.
3. Under **Scopes**, grant the following permissions:
   - [ ] `crm.objects.contacts.read`
   - [ ] `crm.objects.contacts.write`
   - [ ] `crm.objects.tickets.read`
   - [ ] `crm.objects.tickets.write`
   - [ ] `crm.schemas.tickets.read`
   - [ ] `crm.schemas.tickets.write`
4. Click **Create app** and securely store the Access Token in n8n Credentials.

### B. Create Ticket Custom Properties
Navigate to **Settings > Data Management > Properties > Select an object: Ticket**.
Create a property group named `Intake Agent` (`intake_agent`) and add:

- [ ] `inquiry_id` (Single-line Text) — Unique internal UUID
- [ ] `tracking_number` (Single-line Text) — Format: `TRK-YYYYMMDD-XXXX`
- [ ] `inquiry_category` (Dropdown Select):
  - `routine_maintenance` (Routine Maintenance)
  - `mechanical_repair` (Mechanical Repair)
  - `body_paint` (Body & Paint)
  - `diagnostic` (Diagnostic Inspection)
  - `quote_inquiry` (Pricing / Quote Request)
  - `appointment_reschedule` (Reschedule / Cancellation)
  - `sensitive_complaint` (Sensitive / Escalation)
  - `general_inquiry` (General Question)
  - `other` (Other)
- [ ] `vehicle_year` (Number)
- [ ] `vehicle_make` (Single-line Text)
- [ ] `vehicle_model` (Single-line Text)
- [ ] `vehicle_vin` (Single-line Text)
- [ ] `vehicle_tier` (Dropdown Select):
  - `tier_1_sedan_coupe` (Tier 1: Sedan / Coupe)
  - `tier_2_suv_crossover` (Tier 2: SUV / Crossover)
  - `tier_3_truck_van_diesel` (Tier 3: Truck / Van / Diesel)
  - `tier_4_exotic_commercial` (Tier 4: Exotic / Commercial)
  - `unknown_manual` (Unknown / Manual Review)
- [ ] `services_requested` (Multi-line Text)
- [ ] `estimated_cost` (Number / Currency USD)
- [ ] `pricing_status` (Dropdown Select):
  - `quoted_automatically` (Quoted Automatically)
  - `manual_quote_required` (Manual Quote Required)
  - `not_applicable` (Not Applicable)
- [ ] `is_sensitive` (Single Checkbox / Boolean)
- [ ] `sensitivity_reason` (Single-line Text)
- [ ] `customer_sentiment` (Dropdown Select): `positive`, `neutral`, `frustrated`, `hostile_escalation`
- [ ] `ai_summary` (Multi-line Text)
- [ ] `action_taken` (Single-line Text)
- [ ] `gmail_thread_id` (Single-line Text)

### C. Configure Ticket Pipeline
Navigate to **Settings > Objects > Tickets > Pipelines**.
Create or customize pipeline: `Automotive Intake Pipeline` (`automotive_intake_pipeline`):
- [ ] Stage 1: `New Inquiry` (`new_inquiry`)
- [ ] Stage 2: `Manual Review Required` (`manual_review`)
- [ ] Stage 3: `Needs Customer Info` (`needs_info`)
- [ ] Stage 4: `Quote Generated / Auto-Responded` (`quote_generated`)
- [ ] Stage 5: `In Progress / Assigned` (`in_progress`)
- [ ] Stage 6: `Closed - Resolved` (`closed_resolved`)

---

## 3. Google Workspace & Google Sheets Setup

### A. Master Activity Log Sheet
1. Create a Google Sheet named `Marcus Vance Automotive - Master Intake Activity Log`.
2. Name the first tab `Master_Intake_Log`.
3. Set the first row headers (Columns A to Z) exactly as defined:
   - `A: Timestamp`
   - `B: Inquiry_ID`
   - `C: Tracking_Number`
   - `D: Customer_Email`
   - `E: Customer_Name`
   - `F: Customer_Phone`
   - `G: Vehicle_Year`
   - `H: Vehicle_Make`
   - `I: Vehicle_Model`
   - `J: Vehicle_VIN`
   - `K: Vehicle_Tier`
   - `L: Inquiry_Category`
   - `M: Services_Requested`
   - `N: Is_Sensitive`
   - `O: Sensitivity_Reason`
   - `P: Estimated_Cost`
   - `Q: Pricing_Status`
   - `R: Customer_Sentiment`
   - `S: AI_Summary`
   - `T: HubSpot_Contact_ID`
   - `U: HubSpot_Ticket_ID`
   - `V: HubSpot_Stage`
   - `W: Slack_Channel_Notified`
   - `X: Automated_Email_Sent`
   - `Y: Processing_Status`
   - `Z: Error_Details`
4. Copy the Sheet ID from the URL (`https://docs.google.com/spreadsheets/d/<SPREADSHEET_ID>/edit`).

### B. Google API Authentication
- [ ] Option 1 (Recommended): Google Service Account with `spreadsheets` and `drive.file` scopes, shared with edit permission to the Google Sheet.
- [ ] Option 2: Google OAuth2 App in n8n Credentials.

---

## 4. Gmail Inbound & Outbound Setup

- [ ] Ensure dedicated intake email address is active (e.g., `service@marcusvanceauto.com` or configured alias).
- [ ] Configure Gmail OAuth2 credential in n8n with:
  - `https://www.googleapis.com/auth/gmail.readonly`
  - `https://www.googleapis.com/auth/gmail.send`
  - `https://www.googleapis.com/auth/gmail.modify`
- [ ] Create test inbound label/filter in Gmail if testing against a subfolder before full inbox polling.

---

## 5. Slack Setup & Channel Configuration

### A. Create Dedicated Channels
- [ ] `#manual-review` (Private/Public for Marcus Vance and Senior Advisors)
- [ ] `#intake-notifications` (Public channel for routine intake notifications)
- [ ] `#intake-errors` (Private/Alert channel for DevOps / Admin error monitoring)

### B. Slack App Configuration
1. Create a Slack App at `api.slack.com/apps`.
2. Add Bot Token Scopes:
   - `chat:write`
   - `chat:write.public`
   - `channels:read`
   - `groups:read`
3. Install App to Workspace and invite bot user into `#manual-review`, `#intake-notifications`, and `#intake-errors`.
4. Copy the Bot User OAuth Token (`xoxb-...`) to n8n Credentials.

---

## 6. AI Model Configuration

- [ ] Select AI Provider (OpenAI `gpt-4o`, Google Gemini `gemini-1.5-pro`, or Anthropic `claude-3-5-sonnet`).
- [ ] Obtain API Key from provider portal.
- [ ] Configure AI Model node in n8n with strict JSON schema enforcement and `temperature = 0.0`.
- [ ] Verify prompt includes strict zero-hallucination and sensitive inquiry quarantine rules.

---

## 7. Pricing Table Verification

- [ ] Confirm base service pricing with Marcus Vance.
- [ ] Update `pricing_matrix` in `config.json` with agreed rates.
- [ ] Ensure all vehicle tier mappings and fallbacks (`unknown_manual`) are defined.

---

## 8. End-to-End Verification & Dry Run Steps

Once credentials are provided and workflow is active, execute the test scenarios:

- [ ] **Test 1: Standard Routine Service** (e.g., 2022 Toyota Camry, Oil Change)
  - Verify Ticket created in HubSpot first.
  - Verify Tracking Number format `TRK-YYYYMMDD-XXXX`.
  - Verify Google Sheet row appended.
  - Verify Quote confirmation email received with correct pricing ($79.95).
  - Verify Slack alert posted to `#intake-notifications`.
- [ ] **Test 2: Missing Vehicle Info** (e.g., "Need brake quote", no car model)
  - Verify Ticket moved to `Needs Customer Info`.
  - Verify polite info request email sent.
  - Verify Slack alert posted to `#intake-notifications`.
- [ ] **Test 3: Sensitive Dispute / Legal Threat** (e.g., "Full refund or I sue")
  - Verify Ticket moved to `Manual Review Required`.
  - Verify `is_sensitive = TRUE`.
  - Verify Slack alert posted to `#manual-review`.
  - **Verify NO automated email was sent.**
- [ ] **Test 4: Exotic / Unmapped Vehicle** (e.g., 2024 Porsche 911 GT3)
  - Verify Pricing Status is `Manual Quote Required`.
  - Verify no guessed pricing in email or CRM.
- [ ] **Test 5: Error Handler Verification** (Simulate temporary network/API block)
  - Verify Alert posted to `#intake-errors` with full trace.
  - Verify Google Sheet captures failure details without crashing system.
