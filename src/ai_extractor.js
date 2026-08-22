/**
 * AI Intake Prompt specification and structured output parser for Marcus Vance Automotive.
 */

const AI_SYSTEM_PROMPT = `
You are the AI intake analysis engine for Marcus Vance Automotive.
Your job is to extract structured details, classify customer intent, detect sensitive issues, and produce an executive summary.

INTENT CLASSIFICATION RULES:
1. "primary_intent" MUST be exactly one of: "Sales", "Complaint", "Payment", "Booking", "Internal Task".
   - Sales: Pricing inquiries, quote requests for new service.
   - Booking: Direct appointment requests, service scheduling, drop-off time inquiries.
   - Payment: Invoice questions, payment confirmations, billing inquiries, dispute notices.
   - Complaint: Dissatisfaction with prior service, delays, quality issues, damage claims.
   - Internal Task: Internal employee messages, vendor correspondence, parts deliveries.
2. "secondary_intent" MUST be exactly one of: "routine_maintenance", "mechanical_repair", "body_paint", "diagnostic", "quote_inquiry", "appointment_reschedule", "general_inquiry", "other".
3. For sensitive complaints, legal threats, or refund demands, set "primary_intent": "Complaint" and "is_sensitive": true.

STRICT INVARIANTS:
1. NEVER invent, assume, or hallucinate vehicle details, VINs, or phone numbers. If not explicitly stated, return null.
2. SENSITIVE DETECTION: Mark "is_sensitive": true if the message mentions:
   - Refunds, refund requests, chargebacks, or billing disputes
   - Threats of legal action, lawyers, attorneys, lawsuits, or court
   - Regulatory complaints (BBB, Consumer Protection, Attorney General)
   - Accusations of vehicle damage caused by shop
   - Extreme anger, threats, or hostility demanding manager escalation
3. If "is_sensitive" is true, provide the exact trigger phrase in "sensitivity_reason".
4. Determine if critical information is missing (specifically vehicle year/make/model OR requested service).
5. Output ONLY valid JSON adhering exactly to the provided schema.
`;

const AI_JSON_SCHEMA = {
  type: "object",
  properties: {
    customer_name: { type: ["string", "null"] },
    customer_phone: { type: ["string", "null"] },
    vehicle: {
      type: "object",
      properties: {
        year: { type: ["integer", "null"] },
        make: { type: ["string", "null"] },
        model: { type: ["string", "null"] },
        vin: { type: ["string", "null"] },
        tier_guess: {
          type: "string",
          enum: [
            "tier_1_sedan_coupe",
            "tier_2_suv_crossover",
            "tier_3_truck_van_diesel",
            "tier_4_exotic_commercial",
            "unknown"
          ]
        }
      },
      required: ["year", "make", "model", "vin", "tier_guess"]
    },
    primary_intent: {
      type: "string",
      enum: ["Sales", "Complaint", "Payment", "Booking", "Internal Task"]
    },
    secondary_intent: {
      type: "string",
      enum: [
        "routine_maintenance",
        "mechanical_repair",
        "body_paint",
        "diagnostic",
        "quote_inquiry",
        "appointment_reschedule",
        "general_inquiry",
        "other"
      ]
    },
    inquiry_category: {
      type: "string"
    },
    services_requested: {
      type: "array",
      items: { type: "string" }
    },
    missing_required_info: {
      type: "array",
      items: { type: "string" }
    },
    is_sensitive: { type: "boolean" },
    sensitivity_reason: { type: ["string", "null"] },
    customer_sentiment: {
      type: "string",
      enum: ["positive", "neutral", "frustrated", "hostile_escalation"]
    },
    ai_summary: { type: "string" }
  },
  required: [
    "customer_name",
    "customer_phone",
    "vehicle",
    "primary_intent",
    "secondary_intent",
    "services_requested",
    "missing_required_info",
    "is_sensitive",
    "sensitivity_reason",
    "customer_sentiment",
    "ai_summary"
  ]
};

/**
 * Validates and normalizes AI JSON response, applying fallback defaults if fields are missing or malformed.
 */
function parseAndValidateAiOutput(rawResponse) {
  let parsed = null;
  try {
    if (typeof rawResponse === 'string') {
      // Remove any markdown code fences if present
      const cleaned = rawResponse.replace(/```json/gi, '').replace(/```/g, '').trim();
      parsed = JSON.parse(cleaned);
    } else if (typeof rawResponse === 'object' && rawResponse !== null) {
      parsed = rawResponse;
    } else {
      throw new Error('Invalid AI response payload');
    }
  } catch (err) {
    return {
      success: false,
      error: `AI JSON parse failure: ${err.message}`,
      data: getSafeAiFallback()
    };
  }

  // Normalize primary & secondary intent
  const validPrimaryIntents = ['Sales', 'Complaint', 'Payment', 'Booking', 'Internal Task'];
  const validSecondaryIntents = [
    'routine_maintenance',
    'mechanical_repair',
    'body_paint',
    'diagnostic',
    'quote_inquiry',
    'appointment_reschedule',
    'general_inquiry',
    'other'
  ];

  let is_sensitive = Boolean(parsed.is_sensitive);
  let sensitivity_reason = parsed.sensitivity_reason || null;

  let primary_intent = parsed.primary_intent;
  if (!validPrimaryIntents.includes(primary_intent)) {
    if (is_sensitive || parsed.inquiry_category === 'sensitive_complaint' || parsed.inquiry_category === 'legal_threat') {
      primary_intent = 'Complaint';
    } else if (parsed.inquiry_category === 'billing_dispute') {
      primary_intent = 'Payment';
    } else if (parsed.inquiry_category === 'quote_inquiry') {
      primary_intent = 'Sales';
    } else if (['routine_maintenance', 'mechanical_repair', 'appointment_reschedule'].includes(parsed.inquiry_category)) {
      primary_intent = 'Booking';
    } else {
      primary_intent = 'Sales';
    }
  }

  // Enforce sensitive complaint invariant
  if (is_sensitive && primary_intent !== 'Payment') {
    primary_intent = 'Complaint';
  }

  let secondary_intent = parsed.secondary_intent;
  if (!validSecondaryIntents.includes(secondary_intent)) {
    if (validSecondaryIntents.includes(parsed.inquiry_category)) {
      secondary_intent = parsed.inquiry_category;
    } else {
      secondary_intent = 'general_inquiry';
    }
  }

  // Normalize fields
  const normalized = {
    customer_name: parsed.customer_name || null,
    customer_phone: parsed.customer_phone || null,
    vehicle: {
      year: parsed.vehicle?.year ? parseInt(parsed.vehicle.year, 10) : null,
      make: parsed.vehicle?.make || null,
      model: parsed.vehicle?.model || null,
      vin: parsed.vehicle?.vin || null,
      tier_guess: parsed.vehicle?.tier_guess || 'unknown'
    },
    primary_intent,
    secondary_intent,
    inquiry_category: secondary_intent,
    services_requested: Array.isArray(parsed.services_requested) ? parsed.services_requested : [],
    missing_required_info: Array.isArray(parsed.missing_required_info) ? parsed.missing_required_info : [],
    is_sensitive,
    sensitivity_reason,
    customer_sentiment: parsed.customer_sentiment || 'neutral',
    ai_summary: parsed.ai_summary || 'Customer inquiry received.'
  };

  // Check missing required vehicle/service info
  if (!normalized.vehicle.year || !normalized.vehicle.make || !normalized.vehicle.model) {
    if (!normalized.missing_required_info.includes('vehicle_details')) {
      normalized.missing_required_info.push('vehicle_details');
    }
  }
  if (!normalized.services_requested.length && normalized.primary_intent !== 'Complaint') {
    if (!normalized.missing_required_info.includes('service_details')) {
      normalized.missing_required_info.push('service_details');
    }
  }

  return {
    success: true,
    data: normalized
  };
}

function getSafeAiFallback() {
  return {
    customer_name: null,
    customer_phone: null,
    vehicle: {
      year: null,
      make: null,
      model: null,
      vin: null,
      tier_guess: 'unknown'
    },
    primary_intent: 'Complaint',
    secondary_intent: 'other',
    inquiry_category: 'other',
    services_requested: [],
    missing_required_info: ['vehicle_details', 'service_details'],
    is_sensitive: false,
    sensitivity_reason: null,
    customer_sentiment: 'neutral',
    ai_summary: 'Inquiry requires manual review due to raw extraction parsing fallback.'
  };
}

module.exports = {
  AI_SYSTEM_PROMPT,
  AI_JSON_SCHEMA,
  parseAndValidateAiOutput,
  getSafeAiFallback
};
