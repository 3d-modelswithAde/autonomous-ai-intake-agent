/**
 * Marcus Vance Automotive Intake Agent — Interactive Test Runner
 */
const fs = require('fs');
const path = require('path');
const { processIntakeInquiry } = require('../src/index');

const testCasesPath = path.join(__dirname, '..', 'tests', 'test_cases.json');
const testCases = JSON.parse(fs.readFileSync(testCasesPath, 'utf8'));

const args = process.argv.slice(2);
let command = args[0] || '--list';
let targetCaseId = args[1] || 'TC-01';

if (args.length === 1 && !args[0].startsWith('--')) {
  command = '--case';
  targetCaseId = args[0];
}

function printHeader() {
  console.log('\n===============================================================');
  console.log('  Marcus Vance Automotive — AI Intake Workflow Test Runner');
  console.log('===============================================================\n');
}

function listCases() {
  printHeader();
  console.log('Available Test Scenarios (8 Standardized Intake Conditions):\n');
  testCases.forEach((tc) => {
    const isSensitive = tc.expected.is_sensitive ? '🔴 SENSITIVE QUARANTINE' : '🟢 STANDARD';
    console.log(`  [${tc.id}] ${tc.name.padEnd(46)} | ${isSensitive}`);
  });
  console.log('\nCommands to run tests:');
  console.log('  node scripts/run_live_test.js --case TC-01    # Test specific condition');
  console.log('  node scripts/run_live_test.js --case TC-04    # Test sensitive quarantine');
  console.log('  node scripts/run_live_test.js --all          # Run all 8 conditions');
  console.log('  node scripts/run_live_test.js --curl TC-01   # Get curl command for live n8n webhook\n');
}

async function runCase(tc) {
  console.log(`\n---------------------------------------------------------------`);
  console.log(`▶ Executing [${tc.id}]: ${tc.name}`);
  console.log(`---------------------------------------------------------------`);
  console.log(`📧 Inbound Subject : "${tc.input.subject}"`);
  console.log(`📝 Inbound Body    : "${tc.input.body}"`);
  console.log(`👤 Customer        : ${tc.input.customer_name} <${tc.input.customer_email}>`);
  
  const mockConnectors = {
    hubspot: {
      findOrCreateContact: async (c) => ({ id: 'cnt_mock_123', ...c }),
      createTicket: async (t) => ({ id: 'tkt_mock_456', ...t }),
      updateTicket: async (id, u) => ({ id, ...u })
    },
    googleSheets: {
      appendRow: async (r) => ({ success: true, row: r }),
      updateRow: async (id, r) => ({ success: true, id, row: r })
    },
    slack: {
      postMessage: async (msg) => ({ ok: true, ts: '12345.67' })
    },
    gmail: {
      sendEmail: async (e) => ({ messageId: 'msg_mock_789' })
    }
  };

  const result = await processIntakeInquiry(tc.input, mockConnectors);

  console.log('\n📊 Execution Outcome:');
  console.log(`   • Tracking Number      : ${result.tracking_number}`);
  console.log(`   • Primary Intent       : ${result.primary_intent}`);
  console.log(`   • Secondary Intent     : ${result.secondary_intent}`);
  console.log(`   • Sensitive Quarantined: ${result.is_sensitive ? 'YES 🔴 (Automated Email Suppressed)' : 'NO 🟢'}`);
  if (result.is_sensitive) {
    console.log(`   • Sensitivity Reason   : ${result.sensitivity_reason}`);
  }
  console.log(`   • Pricing Status       : ${result.pricing_status || 'N/A'}`);
  console.log(`   • Estimated Cost       : ${result.estimated_cost ? '$' + result.estimated_cost : 'N/A (Manual Quote Required)'}`);
  console.log(`   • HubSpot Ticket Stage : ${result.stage}`);
  console.log(`   • Auto-Email Response  : ${result.automated_email_sent ? 'SENT ✅' : 'STRICTLY SUPPRESSED ⛔'}`);

  return result;
}

function showCurl(caseId) {
  const tc = testCases.find(c => c.id.toUpperCase() === caseId.toUpperCase());
  if (!tc) {
    console.error(`Error: Test case ${caseId} not found.`);
    return;
  }
  printHeader();
  console.log(`📡 Live Webhook Payload for [${tc.id}] (${tc.name}):\n`);
  const payload = {
    customer_email: tc.input.customer_email,
    customer_name: tc.input.customer_name,
    subject: tc.input.subject,
    textPlain: tc.input.body
  };
  
  console.log(`curl -X POST "https://code-it.app.n8n.cloud/webhook-test/test-intake-inbound" \\`);
  console.log(`  -H "Content-Type: application/json" \\`);
  console.log(`  -d '${JSON.stringify(payload, null, 2)}'\n`);
}

async function main() {
  if (command === '--list') {
    listCases();
  } else if (command === '--case') {
    const tc = testCases.find(c => c.id.toUpperCase() === targetCaseId.toUpperCase());
    if (!tc) {
      console.error(`Error: Test case '${targetCaseId}' not found. Use --list to see available IDs.`);
      process.exit(1);
    }
    printHeader();
    await runCase(tc);
  } else if (command === '--curl') {
    showCurl(targetCaseId);
  } else if (command === '--all') {
    printHeader();
    console.log(`Running all ${testCases.length} conditions in batch...\n`);
    for (const tc of testCases) {
      await runCase(tc);
    }
    console.log('\n===============================================================');
    console.log('✅ ALL TEST SCENARIOS COMPLETED SUCCESSFULLY!');
    console.log('===============================================================\n');
  } else {
    listCases();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
