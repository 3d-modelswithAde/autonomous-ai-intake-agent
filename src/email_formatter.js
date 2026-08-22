/**
 * Professional email templates for Marcus Vance Automotive.
 * Always includes the Tracking Number in the subject line and body.
 */

const { loadConfig } = require('./config');

function buildQuoteEmail(params) {
  const config = loadConfig();
  const business = config.business || {
    name: "Marcus Vance Automotive",
    support_phone: "(555) 019-2834",
    address: "100 Apex Motorway, Suite A, Automotive Center, CA 90001"
  };

  const {
    customer_name,
    tracking_number,
    vehicle_year,
    vehicle_make,
    vehicle_model,
    services_requested = [],
    quote_data
  } = params;

  const vehicleName = (vehicle_year || vehicle_make || vehicle_model)
    ? `${vehicle_year || ''} ${vehicle_make || ''} ${vehicle_model || ''}`.trim()
    : 'your vehicle';

  const subject = `[${tracking_number}] Service Estimate & Intake Confirmation — ${business.name}`;

  let priceSection = '';
  if (quote_data && quote_data.pricing_status === 'quoted_automatically' && quote_data.estimated_cost !== null) {
    priceSection = `
<p><strong>Estimated Total:</strong> $${quote_data.estimated_cost.toFixed(2)} (plus applicable taxes & environmental fees)</p>
<ul>
  ${(quote_data.line_items || []).map(item => `<li>${item.service_name}: $${item.rate ? item.rate.toFixed(2) : 'Included'}</li>`).join('\n')}
</ul>
    `;
  } else {
    priceSection = `
<p><strong>Estimated Total:</strong> <em>Custom Quotation in Progress</em></p>
<p>Due to the specific requirements or specialty tier of your ${vehicleName}, our senior master technician is preparing a tailored parts and labor estimate.</p>
    `;
  }

  const html = `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #222; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="border-bottom: 2px solid #c0392b; padding-bottom: 10px; margin-bottom: 20px;">
    <h2 style="color: #2c3e50; margin: 0;">${business.name}</h2>
    <span style="font-size: 13px; color: #7f8c8d;">Reference Tracking Number: <strong>${tracking_number}</strong></span>
  </div>

  <p>Dear ${customer_name || 'Valued Customer'},</p>

  <p>Thank you for reaching out to ${business.name}. We have logged your service inquiry for your <strong>${vehicleName}</strong> under tracking number <strong>${tracking_number}</strong>.</p>

  <div style="background-color: #f8f9fa; border-left: 4px solid #2980b9; padding: 15px; margin: 20px 0;">
    <h3 style="margin-top: 0; color: #2980b9;">Service Summary & Estimate</h3>
    ${priceSection}
  </div>

  <p><strong>Next Steps:</strong></p>
  <p>Our service advisors are ready to schedule your appointment. Please reply directly to this email or call us at <strong>${business.support_phone}</strong> to secure your preferred drop-off time.</p>

  <br>
  <p style="margin-bottom: 0;">Best regards,</p>
  <p style="margin-top: 4px;"><strong>Service & Intake Team</strong><br>${business.name}<br>${business.address}<br>Phone: ${business.support_phone}</p>
</body>
</html>
  `.trim();

  const text = `
Dear ${customer_name || 'Valued Customer'},

Thank you for reaching out to ${business.name}. We have logged your service inquiry for your ${vehicleName} under reference tracking number ${tracking_number}.

Service Summary:
${quote_data && quote_data.estimated_cost ? `Estimated Total: $${quote_data.estimated_cost.toFixed(2)}` : 'Custom quotation in progress by service team.'}

To confirm or schedule your appointment, please reply to this email or call us at ${business.support_phone}.

Best regards,
${business.name} Intake Team
Tracking #: ${tracking_number}
  `.trim();

  return { subject, html, text };
}

function buildMissingInfoEmail(params) {
  const config = loadConfig();
  const business = config.business || {
    name: "Marcus Vance Automotive",
    support_phone: "(555) 019-2834",
    address: "100 Apex Motorway, Suite A, Automotive Center, CA 90001"
  };

  const {
    customer_name,
    tracking_number,
    missing_fields = []
  } = params;

  const subject = `[${tracking_number}] Additional Vehicle Details Needed — ${business.name}`;

  const html = `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #222; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="border-bottom: 2px solid #c0392b; padding-bottom: 10px; margin-bottom: 20px;">
    <h2 style="color: #2c3e50; margin: 0;">${business.name}</h2>
    <span style="font-size: 13px; color: #7f8c8d;">Reference Tracking Number: <strong>${tracking_number}</strong></span>
  </div>

  <p>Dear ${customer_name || 'Valued Customer'},</p>

  <p>Thank you for contacting ${business.name}. We have opened your intake request under tracking number <strong>${tracking_number}</strong>.</p>

  <p>To provide you with an exact price quote and ensure we have the correct parts in stock, could you please reply with the following details?</p>

  <ul style="background-color: #fff3cd; border: 1px solid #ffeeba; padding: 15px 30px; border-radius: 4px;">
    <li><strong>Vehicle Year, Make, and Model</strong></li>
    <li><strong>Engine / Sub-model or VIN</strong> (if available)</li>
    <li><strong>Specific service or symptoms experienced</strong></li>
  </ul>

  <p>Simply reply directly to this email, and our team will immediately finalize your estimate.</p>

  <br>
  <p style="margin-bottom: 0;">Warm regards,</p>
  <p style="margin-top: 4px;"><strong>Service & Intake Team</strong><br>${business.name}<br>Phone: ${business.support_phone}</p>
</body>
</html>
  `.trim();

  const text = `
Dear ${customer_name || 'Valued Customer'},

Thank you for contacting ${business.name}. We have opened your intake request under tracking number ${tracking_number}.

To provide you with an accurate estimate, please reply with:
- Vehicle Year, Make, and Model
- Specific service or symptoms experienced

Simply reply directly to this email.

Best regards,
${business.name} Intake Team
Tracking #: ${tracking_number}
  `.trim();

  return { subject, html, text };
}

module.exports = {
  buildQuoteEmail,
  buildMissingInfoEmail
};
