/**
 * Master test runner executing all unit and integration test suites.
 */

const { execSync } = require('child_process');
const path = require('path');

const suites = [
  'tests/test_pricing_engine.js',
  'tests/test_sensitivity_filter.js',
  'tests/test_pipeline_simulator.js'
];

console.log('========================================================');
console.log('Marcus Vance Automotive Intake Agent — Master Test Suite');
console.log('========================================================\n');

for (const suite of suites) {
  const fullPath = path.resolve(__dirname, '..', suite);
  console.log(`>>> Running ${suite}...`);
  try {
    execSync(`node ${fullPath}`, { stdio: 'inherit' });
  } catch (err) {
    console.error(`\n❌ Test Suite Failed: ${suite}`);
    process.exit(1);
  }
}

console.log('✅ ALL TEST SUITES PASSED CLEANLY!\n');
