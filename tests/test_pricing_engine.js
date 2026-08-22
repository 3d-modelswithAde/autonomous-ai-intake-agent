/**
 * Unit tests for the Zero-Hallucination Pricing Engine.
 */

const assert = require('assert');
const { calculateQuote, resolveVehicleTier, resolveServiceKey } = require('../src/pricing_engine');

console.log('--- Running Pricing Engine Unit Tests ---');

// 1. Tier Resolution Tests
console.log('1. Testing Tier Resolution...');
assert.strictEqual(resolveVehicleTier({ make: 'Toyota', model: 'Camry' }), 'tier_1_sedan_coupe');
assert.strictEqual(resolveVehicleTier({ make: 'Honda', model: 'Civic' }), 'tier_1_sedan_coupe');
assert.strictEqual(resolveVehicleTier({ make: 'Ford', model: 'Explorer' }), 'tier_2_suv_crossover');
assert.strictEqual(resolveVehicleTier({ make: 'Ford', model: 'F-150' }), 'tier_3_truck_van_diesel');
assert.strictEqual(resolveVehicleTier({ make: 'Porsche', model: '911' }), 'tier_4_exotic_commercial');
assert.strictEqual(resolveVehicleTier({ make: 'Mystery', model: 'VehicleXYZ' }), 'unknown_manual');
console.log('   ✓ Tier resolution passed');

// 2. Service Key Resolution Tests
console.log('2. Testing Service Key Resolution...');
assert.strictEqual(resolveServiceKey('synthetic oil change'), 'oil_change_synthetic');
assert.strictEqual(resolveServiceKey('front brake pads'), 'brake_pads_front');
assert.strictEqual(resolveServiceKey('brake pads and rotors'), 'brake_pads_rotors_front');
assert.strictEqual(resolveServiceKey('tire rotation'), 'tire_rotation');
assert.strictEqual(resolveServiceKey('coolant flush'), 'coolant_flush');
assert.strictEqual(resolveServiceKey('random engine swap'), null);
console.log('   ✓ Service key resolution passed');

// 3. Exact Price Calculation Tests (Rule #10 & Rule #11)
console.log('3. Testing Exact Price Calculations...');

// Tier 1 Sedan Oil Change -> $79.95
const res1 = calculateQuote(['oil change'], { make: 'Toyota', model: 'Camry' });
assert.strictEqual(res1.pricing_status, 'quoted_automatically');
assert.strictEqual(res1.estimated_cost, 79.95);

// Tier 2 SUV Front Brakes -> $219.00
const res2 = calculateQuote(['front brake pads'], { make: 'Toyota', model: 'RAV4' });
assert.strictEqual(res2.pricing_status, 'quoted_automatically');
assert.strictEqual(res2.estimated_cost, 219.00);

// Tier 3 Truck Front Brake Pads & Rotors -> $499.00
const res3 = calculateQuote(['front brake pads & rotors'], { make: 'Ford', model: 'F-150' });
assert.strictEqual(res3.pricing_status, 'quoted_automatically');
assert.strictEqual(res3.estimated_cost, 499.00);

// Multi-service: Sedan Oil Change ($79.95) + Tire Rotation ($29.95) -> $109.90
const res4 = calculateQuote(['oil change', 'tire rotation'], { make: 'Honda', model: 'Accord' });
assert.strictEqual(res4.pricing_status, 'quoted_automatically');
assert.strictEqual(res4.estimated_cost, 109.90);

// Exotic / Unmapped Tier -> Manual Quote Required, null cost
const res5 = calculateQuote(['oil change'], { make: 'Porsche', model: '911 GT3' });
assert.strictEqual(res5.pricing_status, 'manual_quote_required');
assert.strictEqual(res5.estimated_cost, null);

// Unmapped service -> Manual Quote Required, never guessed
const res6 = calculateQuote(['custom exhaust welding'], { make: 'Toyota', model: 'Camry' });
assert.strictEqual(res6.pricing_status, 'manual_quote_required');
assert.strictEqual(res6.estimated_cost, null);

// Unknown Vehicle -> Manual Quote Required, null cost
const res7 = calculateQuote(['synthetic oil change'], { make: 'CustomVehicle', model: 'Protocruiser' });
assert.strictEqual(res7.pricing_status, 'manual_quote_required');
assert.strictEqual(res7.estimated_cost, null);

// Empty service list -> Manual Quote Required, null cost
const res8 = calculateQuote([], { make: 'Toyota', model: 'Camry' });
assert.strictEqual(res8.pricing_status, 'manual_quote_required');
assert.strictEqual(res8.estimated_cost, null);

console.log('   ✓ Zero-hallucination pricing calculation tests passed');
console.log('All pricing engine tests passed successfully!\n');
