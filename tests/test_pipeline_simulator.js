/**
 * End-to-End Pipeline Simulator for Marcus Vance Automotive Intake Agent.
 * Runs all 8 test cases defined in test_cases.json with mock connectors.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { processIntakeInquiry } = require('../src/index');

console.log('--- Running End-to-End Pipeline Simulation (8 Test Scenarios) ---');

const testCases = JSON.parse(fs.readFileSync(path.join(__dirname, 'test_cases.json'), 'utf8'));

const VALID_PRIMARY_INTENTS = ['Sales', 'Complaint', 'Payment', 'Booking', 'Internal Task'];
const VALID_SECONDARY_INTENTS = [
  'routine_maintenance',
  'mechanical_repair',
  'body_paint',
  'diagnostic',
  'quote_inquiry',
  'appointment_reschedule',
  'general_inquiry',
  'other'
];

async function runSimulation() {
  let passedCount = 0;

  for (const tc of testCases) {
    console.log(`\nExecuting [${tc.id}] — ${tc.name}...`);

    // In-memory mock stores to track every external call
    const mockState = {
      contacts: [],
      tickets: [],
      ticketUpdates: [],
      emailsSent: [],
      slackMessages: [],
      sheetAppends: [],
      sheetUpdates: []
    };

    const mockConnectors = {
      hubspot: {
        findOrCreateContact: async (contact) => {
          const id = 'cnt_' + Math.floor(100000 + Math.random() * 900000);
          mockState.contacts.push({ id, ...contact });
          return { id, ...contact };
        },
        createTicket: async (ticket) => {
          const id = 'tkt_' + Math.floor(100000 + Math.random() * 900000);
          mockState.tickets.push({ id, ...ticket });
          return { id, ...ticket };
        },
        updateTicket: async (id, update) => {
          mockState.ticketUpdates.push({ id, ...update });
          return { id, ...update };
        }
      },
      googleSheets: {
        appendRow: async (row) => {
          mockState.sheetAppends.push(row);
          return { success: true };
        },
        updateRow: async (inquiryId, update) => {
          mockState.sheetUpdates.push({ inquiryId, ...update });
          return { success: true };
        }
      },
      gmail: {
        sendEmail: async (email) => {
          mockState.emailsSent.push(email);
          return { messageId: 'msg_' + Math.random() };
        }
      },
      slack: {
        postMessage: async (msg) => {
          mockState.slackMessages.push(msg);
          return { ok: true, ts: '1234567.89' };
        }
      }
    };

    const result = await processIntakeInquiry(tc.input, mockConnectors);

    // INVARIANT 1 (Rule #7): Valid ID formats
    assert.ok(result.inquiry_id && result.inquiry_id.startsWith('inq_'), 'Inquiry ID must start with inq_');
    assert.ok(result.tracking_number && /^TRK-\d{8}-\d{4}$/.test(result.tracking_number), 'Tracking number must match TRK-YYYYMMDD-XXXX');

    // INVARIANT 2 (Rule #6 & Req 5): Ticket-first ordering remains intact
    assert.strictEqual(mockState.tickets.length, 1, 'Ticket must be created exactly once');
    assert.strictEqual(result.logs[1].step, '2_CRM_TICKET_CREATED_FIRST', 'Ticket creation must precede AI and email');

    // INVARIANT 3 (Rule #8 & Req 4): Google Sheets initial append contains required mappings
    assert.strictEqual(mockState.sheetAppends.length, 1, 'Initial state must be logged to Google Sheets');
    const initialSheet = mockState.sheetAppends[0];
    assert.ok(initialSheet.Subject !== undefined, 'Google Sheets initial row must include Subject');
    assert.ok(initialSheet.AI_Summary !== undefined, 'Google Sheets initial row must include AI_Summary');
    assert.ok(initialSheet.Action_Taken !== undefined, 'Google Sheets initial row must include Action_Taken');

    // Google Sheets update row contains required mappings
    if (mockState.sheetUpdates.length > 0) {
      const updateSheet = mockState.sheetUpdates[0];
      assert.ok(updateSheet.Subject !== undefined, 'Google Sheets update row must include Subject');
      assert.ok(updateSheet.AI_Summary !== undefined, 'Google Sheets update row must include AI_Summary');
      assert.ok(updateSheet.Action_Taken !== undefined, 'Google Sheets update row must include Action_Taken');
    }

    // REQ 1: Primary intent is one of the 5 canonical categories
    assert.ok(VALID_PRIMARY_INTENTS.includes(result.primary_intent), `Primary intent '${result.primary_intent}' must be one of: ${VALID_PRIMARY_INTENTS.join(', ')}`);

    // REQ 2: Secondary intent preserves automotive classification
    assert.ok(VALID_SECONDARY_INTENTS.includes(result.secondary_intent), `Secondary intent '${result.secondary_intent}' must be one of: ${VALID_SECONDARY_INTENTS.join(', ')}`);

    // REQ 3: Sensitive complaint produces primary_intent = Complaint & is_sensitive = true
    if (result.is_sensitive && result.primary_intent !== 'Payment') {
      assert.strictEqual(result.primary_intent, 'Complaint', `Sensitive complaint must produce primary_intent=Complaint, got: ${result.primary_intent}`);
      assert.strictEqual(result.is_sensitive, true);
    }

    // TEST-SPECIFIC ASSERTIONS
    const exp = tc.expected;

    // Check Sensitivity & REQ 6: Sensitive inquiries still cannot reach Gmail
    assert.strictEqual(result.is_sensitive, exp.is_sensitive, `Sensitivity flag mismatch for ${tc.id}`);
    assert.strictEqual(result.automated_email_sent, exp.automated_email_sent, `Automated email sent mismatch for ${tc.id}`);
    if (result.is_sensitive || !exp.automated_email_sent) {
      assert.strictEqual(mockState.emailsSent.length, 0, `CRITICAL (REQ 6): Automated email was sent for sensitive case ${tc.id}!`);
    } else {
      assert.strictEqual(mockState.emailsSent.length, 1, `Expected 1 email sent for ${tc.id}`);
      assert.ok(mockState.emailsSent[0].subject.includes(result.tracking_number), 'Email subject must include tracking number');
    }

    // Check Slack Channel
    assert.strictEqual(result.slack_channel, exp.slack_channel, `Slack channel mismatch for ${tc.id}`);
    assert.strictEqual(mockState.slackMessages[0].channel, exp.slack_channel, `Slack post channel mismatch for ${tc.id}`);

    // REQ 7: Check Pricing & Unknown vehicle handling
    if (exp.pricing_status) {
      assert.strictEqual(result.quote.pricing_status, exp.pricing_status, `Pricing status mismatch for ${tc.id}`);
      assert.strictEqual(result.quote.estimated_cost, exp.estimated_cost, `Estimated cost mismatch for ${tc.id}`);
    }

    if (tc.input.vehicle && (tc.input.vehicle.tier_guess === 'unknown_manual' || tc.input.vehicle.tier_guess === 'unknown')) {
      if (result.quote) {
        assert.strictEqual(result.quote.estimated_cost, null, 'Unknown vehicle must produce estimated_cost = null');
        assert.strictEqual(result.quote.pricing_status, 'manual_quote_required', 'Unknown vehicle must produce pricing_status = manual_quote_required');
      }
    }

    console.log(`   ✓ [${tc.id}] Passed: Primary="${result.primary_intent}", Secondary="${result.secondary_intent}", Stage=${result.stage}, Slack=${result.slack_channel}, AutoEmail=${result.automated_email_sent}`);
    passedCount++;
  }

  // REQ 4: Verify n8n workflow file Google Sheets node mappings for Node 5, Node 11, Node 16, Node 21
  console.log('\n--- Verifying n8n Workflow JSON Node Mappings ---');
  const workflowPath = path.join(__dirname, '..', 'workflows', 'marcus_vance_intake_agent.json');
  const workflow = JSON.parse(fs.readFileSync(workflowPath, 'utf8'));

  const requiredSheetsNodes = [
    { id: 'node-sheets-log-initial', name: 'Google Sheets: Log Initial Creation' },
    { id: 'node-sheets-update-manual-review', name: 'Google Sheets: Log Manual Review' },
    { id: 'node-sheets-update-needs-info', name: 'Google Sheets: Log Awaiting Info' },
    { id: 'node-sheets-update-success', name: 'Google Sheets: Log Final Success' }
  ];

  for (const target of requiredSheetsNodes) {
    const node = workflow.nodes.find(n => n.id === target.id || n.name === target.name);
    assert.ok(node, `Workflow missing required Google Sheets node: ${target.name}`);
    const cols = node.parameters?.columns || {};
    assert.ok(cols.Subject, `Node '${target.name}' missing 'Subject' column mapping`);
    assert.ok(cols.AI_Summary, `Node '${target.name}' missing 'AI_Summary' column mapping`);
    assert.ok(cols.Action_Taken, `Node '${target.name}' missing 'Action_Taken' column mapping`);
    console.log(`   ✓ Node '${target.name}' verified (contains Subject, AI_Summary, Action_Taken)`);
  }

  console.log(`\n==============================================`);
  console.log(`🎉 ALL ${passedCount}/${testCases.length} SIMULATION SCENARIOS & WORKFLOW NODE VERIFICATIONS PASSED PERFECTLY!`);
  console.log(`==============================================\n`);
}

runSimulation().catch(err => {
  console.error('Test simulation failed:', err);
  process.exit(1);
});
