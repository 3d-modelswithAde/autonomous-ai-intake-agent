/**
 * Unit tests for Sensitivity Quarantine Filter.
 */

const assert = require('assert');
const { checkSensitivity } = require('../src/sensitivity_filter');

console.log('--- Running Sensitivity Quarantine Unit Tests ---');

// 1. Safe Standard Inquiries
const safe1 = checkSensitivity("Hi, I'd like to book an oil change for my Honda Civic next Wednesday.", "routine_maintenance");
assert.strictEqual(safe1.is_sensitive, false, 'Routine oil change should be safe');

const safe2 = checkSensitivity("Can you give me an estimate for front brakes on a 2020 Ford F-150?", "quote_inquiry");
assert.strictEqual(safe2.is_sensitive, false, 'Quote inquiry should be safe');

console.log('   ✓ Safe inquiries correctly passed through');

// 2. Sensitive Inquiries (Legal / Refund / Dispute / Hostility)
const sens1 = checkSensitivity("I want a full refund immediately or I am calling my lawyer to sue your shop.", "sensitive_complaint");
assert.strictEqual(sens1.is_sensitive, true);
assert.strictEqual(sens1.matched_keyword, 'sensitive_complaint');

const sens2 = checkSensitivity("If this is not resolved today I will file a chargeback with Visa.", "billing_dispute");
assert.strictEqual(sens2.is_sensitive, true);

const sens3 = checkSensitivity("Your mechanic damaged my car during the brake service!", "mechanical_repair");
assert.strictEqual(sens3.is_sensitive, true);
assert.strictEqual(sens3.matched_keyword, 'damage');

const sens4 = checkSensitivity("I am reporting Marcus Vance Automotive to the Better Business Bureau and Attorney General.", "other");
assert.strictEqual(sens4.is_sensitive, true);

// Phase 5 specific keywords:
const sens5 = checkSensitivity("I am formally submitting a refund request.", "general_inquiry");
assert.strictEqual(sens5.is_sensitive, true);

const sens6 = checkSensitivity("We have a serious payment dispute regarding this transaction.", "quote_inquiry");
assert.strictEqual(sens6.is_sensitive, true);

const sens7 = checkSensitivity("Take this as a legal threat if you don't call me.", "routine_maintenance");
assert.strictEqual(sens7.is_sensitive, true);

const sens8 = checkSensitivity("I will take legal action against your company.", "routine_maintenance");
assert.strictEqual(sens8.is_sensitive, true);

const sens9 = checkSensitivity("I am filing a regulatory complaint with consumer protection.", "other");
assert.strictEqual(sens9.is_sensitive, true);

const sens10 = checkSensitivity("We will settle this in small claims court.", "other");
assert.strictEqual(sens10.is_sensitive, true);

console.log('   ✓ Sensitive inquiries correctly caught by quarantine filters');

// 3. AI Extractor & Intent Normalization Tests
console.log('3. Testing AI Extractor & Intent Normalization...');
const { parseAndValidateAiOutput, AI_JSON_SCHEMA, AI_SYSTEM_PROMPT } = require('../src/ai_extractor');

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

assert.deepStrictEqual(AI_JSON_SCHEMA.properties.primary_intent.enum, VALID_PRIMARY_INTENTS);
assert.deepStrictEqual(AI_JSON_SCHEMA.properties.secondary_intent.enum, VALID_SECONDARY_INTENTS);

// Test Sensitive Complaint produces primary_intent = Complaint & is_sensitive = true
const sensComplaint = parseAndValidateAiOutput({
  customer_name: 'John Test',
  vehicle: { year: 2020, make: 'Ford', model: 'F-150', vin: null, tier_guess: 'tier_3_truck_van_diesel' },
  primary_intent: 'Sales', // AI misclassified as Sales
  secondary_intent: 'mechanical_repair',
  services_requested: ['brakes'],
  missing_required_info: [],
  is_sensitive: true,
  sensitivity_reason: 'Lawyer and legal action threat',
  customer_sentiment: 'hostile_escalation',
  ai_summary: 'Customer threatens lawyer.'
});
assert.strictEqual(sensComplaint.data.primary_intent, 'Complaint', 'Sensitive issue must enforce primary_intent=Complaint');
assert.strictEqual(sensComplaint.data.is_sensitive, true);

// Test Booking / Maintenance
const bookingTest = parseAndValidateAiOutput({
  customer_name: 'Jane Test',
  vehicle: { year: 2021, make: 'Toyota', model: 'RAV4', vin: '2T3F1REV1MW123456', tier_guess: 'tier_2_suv_crossover' },
  primary_intent: 'Booking',
  secondary_intent: 'routine_maintenance',
  services_requested: ['oil change'],
  missing_required_info: [],
  is_sensitive: false,
  sensitivity_reason: null,
  customer_sentiment: 'positive',
  ai_summary: 'Booking regular maintenance.'
});
assert.strictEqual(bookingTest.data.primary_intent, 'Booking');
assert.strictEqual(bookingTest.data.secondary_intent, 'routine_maintenance');
assert.strictEqual(bookingTest.data.is_sensitive, false);

// Test Fallback
const fallbackTest = parseAndValidateAiOutput("bad json payload");
assert.strictEqual(fallbackTest.success, false);
assert.ok(VALID_PRIMARY_INTENTS.includes(fallbackTest.data.primary_intent));
assert.ok(VALID_SECONDARY_INTENTS.includes(fallbackTest.data.secondary_intent));

console.log('   ✓ AI extractor and intent normalization unit tests passed');
console.log('All sensitivity and AI extraction filter tests passed successfully!\n');
