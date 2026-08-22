/**
 * Zero-hallucination Pricing Engine for Marcus Vance Automotive.
 * Derived strictly from the configurable pricing matrix.
 * Never guesses or extrapolates unknown prices.
 */

const { loadConfig } = require('./config');

// Standard service aliases mapping customer requests to canonical service matrix keys
const SERVICE_ALIASES = {
  'brake pads and rotors': 'brake_pads_rotors_front',
  'front brake pads & rotors': 'brake_pads_rotors_front',
  'front brake pads and rotors': 'brake_pads_rotors_front',
  'pads and rotors': 'brake_pads_rotors_front',
  'synthetic oil change': 'oil_change_synthetic',
  'full synthetic oil': 'oil_change_synthetic',
  'full synthetic': 'oil_change_synthetic',
  'oil & filter': 'oil_change_synthetic',
  'oil change': 'oil_change_synthetic',
  'heavy duty diesel oil': 'oil_change_diesel',
  'diesel oil change': 'oil_change_diesel',
  'front brake pad replacement': 'brake_pads_front',
  'brake pad replacement': 'brake_pads_front',
  'front brake pads': 'brake_pads_front',
  'front brakes': 'brake_pads_front',
  'brake pads': 'brake_pads_front',
  '4-wheel tire rotation': 'tire_rotation',
  'tire rotation': 'tire_rotation',
  'rotate tires': 'tire_rotation',
  'coolant system flush': 'coolant_flush',
  'comprehensive coolant flush': 'coolant_flush',
  'coolant flush': 'coolant_flush',
  'antifreeze flush': 'coolant_flush',
  'transmission fluid exchange': 'transmission_flush',
  'transmission flush': 'transmission_flush',
  'transmission fluid': 'transmission_flush',
  'air conditioning recharge': 'ac_recharge_r134a',
  'a/c recharge': 'ac_recharge_r134a',
  'ac recharge': 'ac_recharge_r134a',
  'diagnostic inspection': 'diagnostic_fee',
  'standard diagnostic fee': 'diagnostic_fee',
  'diagnostic fee': 'diagnostic_fee',
  'check engine light': 'diagnostic_fee',
  'diagnostic': 'diagnostic_fee',
  'inspection': 'diagnostic_fee'
};

/**
 * Resolves canonical service key from requested service string.
 */
function resolveServiceKey(serviceName) {
  if (!serviceName || typeof serviceName !== 'string') return null;
  const cleaned = serviceName.trim().toLowerCase();

  // Exact match with matrix key
  const config = loadConfig();
  const matrix = config.pricing_matrix || {};
  if (matrix[cleaned]) {
    return cleaned;
  }

  // 1. Check exact match in aliases
  if (SERVICE_ALIASES[cleaned]) {
    return SERVICE_ALIASES[cleaned];
  }

  // 2. Check substring matching with longest keys first
  const sortedAliases = Object.keys(SERVICE_ALIASES).sort((a, b) => b.length - a.length);
  for (const alias of sortedAliases) {
    if (cleaned.includes(alias)) {
      return SERVICE_ALIASES[alias];
    }
  }

  return null;
}

/**
 * Resolves vehicle tier based on vehicle details and config examples.
 */
function resolveVehicleTier(vehicle) {
  if (!vehicle || typeof vehicle !== 'object') {
    return 'unknown_manual';
  }

  const { make = '', model = '', tier_guess = '' } = vehicle;
  const config = loadConfig();
  const tiers = config.vehicle_tiers || {};

  // If tier_guess is explicitly provided and valid
  if (tier_guess && tiers[tier_guess] && tier_guess !== 'unknown') {
    return tier_guess;
  }

  const fullVehicleName = `${make} ${model}`.toLowerCase().trim();
  if (!fullVehicleName) {
    return 'unknown_manual';
  }

  // Check tier examples in config
  for (const [tierKey, tierData] of Object.entries(tiers)) {
    if (tierKey === 'unknown_manual') continue;
    const examples = tierData.examples || [];
    for (const ex of examples) {
      const lowerEx = ex.toLowerCase();
      if (fullVehicleName.includes(lowerEx) || (model && model.toLowerCase().includes(lowerEx))) {
        return tierKey;
      }
    }
  }

  // Fallback heuristic if make/model is clear
  if (tier_guess && tiers[tier_guess]) {
    return tier_guess;
  }

  return 'unknown_manual';
}

/**
 * Calculates pricing for a list of requested services and vehicle.
 */
function calculateQuote(servicesRequested = [], vehicle = {}) {
  const config = loadConfig();
  const matrix = config.pricing_matrix || {};
  const tier = resolveVehicleTier(vehicle);

  // If tier is unknown, immediately return Manual Quote Required
  if (tier === 'unknown_manual' || tier === 'tier_4_exotic_commercial') {
    return {
      tier,
      tier_label: config.vehicle_tiers?.[tier]?.label || 'Manual Review Required',
      pricing_status: 'manual_quote_required',
      estimated_cost: null,
      line_items: [],
      notes: 'Vehicle tier requires manual service advisor quotation.'
    };
  }

  if (!servicesRequested || servicesRequested.length === 0) {
    return {
      tier,
      tier_label: config.vehicle_tiers?.[tier]?.label || 'Standard Tier',
      pricing_status: 'manual_quote_required',
      estimated_cost: null,
      line_items: [],
      notes: 'No specific standard services listed.'
    };
  }

  let total = 0;
  const lineItems = [];
  let requiresManualQuote = false;

  for (const rawService of servicesRequested) {
    const serviceKey = resolveServiceKey(rawService);
    if (!serviceKey || !matrix[serviceKey]) {
      // Unmapped service requires manual review
      requiresManualQuote = true;
      lineItems.push({
        service_name: rawService,
        service_key: null,
        rate: null,
        status: 'manual_quote_required'
      });
      continue;
    }

    const serviceDef = matrix[serviceKey];
    const rate = serviceDef.rates ? serviceDef.rates[tier] : null;

    if (rate === null || rate === undefined || typeof rate !== 'number') {
      requiresManualQuote = true;
      lineItems.push({
        service_name: serviceDef.name || rawService,
        service_key: serviceKey,
        rate: null,
        status: 'manual_quote_required'
      });
    } else {
      total += rate;
      lineItems.push({
        service_name: serviceDef.name || rawService,
        service_key: serviceKey,
        rate: parseFloat(rate.toFixed(2)),
        status: 'quoted'
      });
    }
  }

  if (requiresManualQuote) {
    return {
      tier,
      tier_label: config.vehicle_tiers?.[tier]?.label,
      pricing_status: 'manual_quote_required',
      estimated_cost: null,
      line_items: lineItems,
      notes: 'One or more requested services require manual pricing review.'
    };
  }

  return {
    tier,
    tier_label: config.vehicle_tiers?.[tier]?.label,
    pricing_status: 'quoted_automatically',
    estimated_cost: parseFloat(total.toFixed(2)),
    line_items: lineItems,
    notes: 'Standard service pricing calculated successfully.'
  };
}

module.exports = {
  resolveServiceKey,
  resolveVehicleTier,
  calculateQuote,
  SERVICE_ALIASES
};
