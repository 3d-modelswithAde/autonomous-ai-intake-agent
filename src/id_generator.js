/**
 * Dual-ID generator for Marcus Vance Automotive Intake Agent.
 * Generates:
 * 1. Internal Inquiry ID: inq_<uuid>
 * 2. Human-readable Tracking Number: TRK-YYYYMMDD-XXXX
 */

const crypto = require('crypto');

function generateInquiryId() {
  return `inq_${crypto.randomUUID()}`;
}

function generateTrackingNumber(date = new Date()) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const randomSuffix = Math.floor(1000 + Math.random() * 9000); // 4-digit number
  return `TRK-${yyyy}${mm}${dd}-${randomSuffix}`;
}

function generateInquiryIdentifiers(date = new Date()) {
  return {
    inquiry_id: generateInquiryId(),
    tracking_number: generateTrackingNumber(date)
  };
}

module.exports = {
  generateInquiryId,
  generateTrackingNumber,
  generateInquiryIdentifiers
};
