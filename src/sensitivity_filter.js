/**
 * Sensitivity detection & quarantine module for Marcus Vance Automotive Intake Agent.
 * Detects refund requests, legal threats, billing disputes, chargebacks, regulatory complaints,
 * and hostility to strictly suppress automated email responses and route to #manual-review.
 */

const { loadConfig } = require('./config');

function checkSensitivity(text, category = null) {
  if (!text || typeof text !== 'string') {
    text = '';
  }

  const config = loadConfig();
  const rules = config.sensitivity_rules || {};
  const keywords = rules.quarantine_keywords || [
    "refund",
    "refund request",
    "chargeback",
    "dispute",
    "payment dispute",
    "serious payment dispute",
    "attorney",
    "lawyer",
    "lawsuit",
    "legal action",
    "legal threat",
    "sue",
    "court",
    "bbb",
    "better business bureau",
    "consumer protection",
    "regulatory complaint",
    "attorney general",
    "damage",
    "damaged my car",
    "police",
    "fraud",
    "scam",
    "stolen",
    "threat",
    "negligence"
  ];

  const autoCategories = rules.auto_quarantine_categories || [
    "sensitive_complaint",
    "legal_threat",
    "billing_dispute"
  ];

  // 1. Check auto-quarantine category
  if (category && autoCategories.includes(category.toLowerCase())) {
    return {
      is_sensitive: true,
      reason: `Inquiry categorized as ${category}`,
      matched_keyword: category
    };
  }

  // 2. Normalize text and check keywords / phrases
  const lowerText = text.toLowerCase();
  for (const keyword of keywords) {
    const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escapedKeyword}\\b`, 'i');
    if (regex.test(lowerText) || lowerText.includes(keyword.toLowerCase())) {
      return {
        is_sensitive: true,
        reason: `Matched sensitivity trigger: "${keyword}"`,
        matched_keyword: keyword
      };
    }
  }

  return {
    is_sensitive: false,
    reason: null,
    matched_keyword: null
  };
}

module.exports = {
  checkSensitivity
};
