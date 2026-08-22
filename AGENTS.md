# AGENTS.md — Permanent Rules for Autonomous AI Intake Agent

**Target System:** Marcus Vance Automotive — Autonomous AI Intake Agent & CRM Automation  
**Target Workflow:** `AI Customer Inquiry Intake & CRM Automation` (`zOwAQzXMECWaTcAp`)  
**Scope:** Any autonomous agent, pair programmer, or developer modifying or extending this business operations system.

---

## 🚨 CRITICAL DIRECTIVE: PERMANENT SOURCE OF TRUTH

These rules are permanent invariants. **Do NOT redesign the architecture, do NOT replace the system with simplified demos, and do NOT modify core invariants unless explicitly instructed by the user.**

---

## 1. Permanent Invariants (Non-Negotiable)

### 🔒 Rule #1: CRM Support Ticket First (Phase 3 Invariant)
The HubSpot Support Ticket **must always** be created immediately after email intake and **before** AI analysis, pricing lookup, Telegram notifications, or email replies. Inquiries must never be lost or processed without a guaranteed CRM ticket record.

### 🔒 Rule #2: Strict HubSpot Custom Property Limit
**Do NOT create additional custom properties in HubSpot.** The system is strictly constrained to the agreed custom properties:
- `inquiry_id` (pre-existing UUID)
- `tracking_number` (human-readable `TRK-YYYYMMDD-XXXX`)
- `inquiry_category` (dropdown select / primary intent)
- `vehicle_year`, `vehicle_make`, `vehicle_model` (or `vehicle_details`)
- `services_requested` (multi-line text)
- `estimated_cost` (number / currency USD)
- `is_sensitive` (single checkbox / boolean)

*All additional detailed summaries, sentiment scores, error traces, and advisor action notes must be recorded in the standard ticket `description` field and Google Sheets rather than creating new custom properties.*

### 🔒 Rule #3: Zero-Hallucination Deterministic Pricing
**Never allow the AI to invent, estimate, guess, or hallucinate a price.**
- All pricing calculations must be executed deterministically in JavaScript via the verified pricing matrix (`Deterministic Pricing Engine`).
- Pricing is calculated strictly by matching `Service Key` and `Vehicle Tier`.
- If a vehicle tier is unlisted (`unknown_manual`, `tier_4_exotic_commercial`) or any requested service is unmapped/custom, the engine MUST set `pricing_status = "manual_quote_required"` and `estimated_cost = null`.

### 🔒 Rule #4: Absolute Sensitivity Quarantine & Zero Auto-Email
**Sensitive inquiries must NEVER receive an automated customer email response.**
- Any message mentioning refunds, chargebacks, payment disputes, legal threats, lawyers, attorneys, lawsuits, court, BBB, regulatory complaints, damage claims, or extreme hostility MUST be quarantined.
- Actions:
  1. Move HubSpot Ticket to Stage 2 (`manual_review`).
  2. Post high-visibility escalation card to Telegram `🔴 Manual Review`.
  3. Log status `MANUAL_REVIEW` in Google Sheets.
  4. **TERMINATE the execution path immediately (zero downstream Gmail connection).**

### 🔒 Rule #5: Vehicle Model Catalog Verification
For inquiries requiring a vehicle/car model:
- Verify the model against the approved vehicle model catalog (`VEHICLE_TIER_CATALOG`).
- If the model is not found, do NOT invent a match. Mark `vehicle_model_found = false`, assign `unknown_manual` tier, set `pricing_status = "manual_quote_required"`, and confirm to the customer that an advisor is reviewing parts requirements.

### 🔒 Rule #6: Dual-Intent Classification Standards
Every inquiry must be classified using the agreed dual-intent model:
- **`primary_intent`**: Exactly one of: `Sales`, `Complaint`, `Payment`, `Booking`, `Internal Task`.
- **`secondary_intent`**: Exactly one of: `routine_maintenance`, `mechanical_repair`, `body_paint`, `diagnostic`, `quote_inquiry`, `appointment_reschedule`, `general_inquiry`, `other`.

### 🔒 Rule #7: Deterministic Dual-ID Scheme
Every transaction must generate and propagate both:
- `inquiry_id`: Machine-level UUID (`inq_<uuid>`) for database keys and idempotency.
- `tracking_number`: Human-readable format (`TRK-YYYYMMDD-XXXX`) in all email subjects, CRM tickets, Telegram messages, and Google Sheets rows.

### 🔒 Rule #8: Master Activity Audit Logging
Every lifecycle event (Created, Manual Review, Awaiting Info, Quote Success, Pipeline Error) must be logged to the Google Sheets 26-column `Master_Intake_Log`.

---

## 2. Technical & SDK Execution Rules

1. **Workflow SDK Compliance**:
   - When modifying the n8n workflow, always validate the code with `validate_workflow` before applying changes.
   - Node parameters must reside inside `config.parameters` (not at top level of config).
   - Use `expr("{{ $('Node Name').item.json.field }}")` when referencing data across non-adjacent nodes.
2. **Channel Separation**:
   - `🔴 Manual Review`: Sensitive escalations, legal/disputes, damage claims.
   - `📥 Intake Notifications`: Standard auto-quotes sent, routine inquiries, missing-info follow-up notices.
   - `⚠️ System Alerts`: Global system exceptions and API failures.
3. **No Overwrites of Unrelated Workflows**:
   - Always inspect workflow IDs before modifying. The primary production workflow ID is `zOwAQzXMECWaTcAp`.

---

## 3. Verification Protocol

- **Never claim an integration or node works without inspecting it or testing it through the connected n8n instance.**
- When verifying the system, cross-check against the 8 standardized test cases (TC-01 through TC-08 in `tests/test_cases.json`).
