/**
 * Master Pipeline Orchestrator for Marcus Vance Automotive Intake Agent.
 * Implements deterministic safety rules, CRM-first persistence,
 * zero-hallucination pricing, sensitivity quarantine, and multi-channel routing.
 */

const { loadConfig } = require('./config');
const { generateInquiryIdentifiers } = require('./id_generator');
const { checkSensitivity } = require('./sensitivity_filter');
const { calculateQuote } = require('./pricing_engine');
const { parseAndValidateAiOutput } = require('./ai_extractor');
const { buildManualReviewAlert, buildRoutineNotification, buildErrorAlert } = require('./slack_formatter');
const { buildQuoteEmail, buildMissingInfoEmail } = require('./email_formatter');

/**
 * Executes the full intake pipeline on an inbound inquiry.
 * Supports injected mock connectors for testing and live connectors for production execution.
 */
async function processIntakeInquiry(rawInbound, connectors = {}) {
  const config = loadConfig();
  const logs = [];

  // Step 1: Idempotency & Unique ID Generation
  const { inquiry_id, tracking_number } = generateInquiryIdentifiers();
  const timestamp = new Date().toISOString();

  const customer_email = rawInbound.from || rawInbound.customer_email || 'unknown@example.com';
  const customer_subject = rawInbound.subject || '';
  const customer_body = rawInbound.body || rawInbound.text || '';
  const raw_text = `${customer_subject} \n ${customer_body}`;

  logs.push({ step: '1_ID_GENERATED', inquiry_id, tracking_number, timestamp });

  try {
    // Step 2 & 3: CRM Support Ticket Creation (Rule #6: Ticket MUST be created first)
    const contactPayload = {
      email: customer_email,
      name: rawInbound.customer_name || null
    };

    let hubspotContactId = 'cnt_' + inquiry_id.substring(4, 12);
    let hubspotTicketId = 'tkt_' + inquiry_id.substring(4, 12);

    if (connectors.hubspot) {
      const contactRes = await connectors.hubspot.findOrCreateContact(contactPayload);
      hubspotContactId = contactRes.id || hubspotContactId;

      const ticketRes = await connectors.hubspot.createTicket({
        subject: `[${tracking_number}] Inbound Customer Intake: ${customer_subject || 'General Inquiry'}`,
        inquiry_id,
        tracking_number,
        client_name: rawInbound.customer_name || 'Not provided',
        contact_email: customer_email || 'Not provided',
        contact_phone: rawInbound.customer_phone || 'Not provided',
        vehicle_year: rawInbound.vehicle?.year || 'Not provided',
        vehicle_model: rawInbound.vehicle?.model || 'Not provided',
        service_request: (rawInbound.services_requested && rawInbound.services_requested.length > 0) ? rawInbound.services_requested.join(', ') : 'Not provided',
        original_inquiry: customer_body || customer_subject || 'Not provided',
        timestamp,
        pipeline_stage: 'new_inquiry',
        contact_id: hubspotContactId
      });
      hubspotTicketId = ticketRes.id || hubspotTicketId;
    }

    logs.push({
      step: '2_CRM_TICKET_CREATED_FIRST',
      hubspot_contact_id: hubspotContactId,
      hubspot_ticket_id: hubspotTicketId,
      stage: 'new_inquiry'
    });

    // Step 4: Initial Google Sheets Row (Rule #8: Logging every action)
    const initialSheetRow = {
      Timestamp: timestamp,
      Inquiry_ID: inquiry_id,
      Tracking_Number: tracking_number,
      Customer_Email: customer_email,
      Customer_Name: rawInbound.customer_name || 'Not provided',
      Subject: customer_subject || 'Inquiry',
      AI_Summary: 'Initial intake logged',
      HubSpot_Contact_ID: hubspotContactId,
      HubSpot_Ticket_ID: hubspotTicketId,
      HubSpot_Stage: 'new_inquiry',
      Action_Taken: 'Ticket Created & Intake Logged',
      Processing_Status: 'CREATED'
    };

    if (connectors.googleSheets) {
      await connectors.googleSheets.appendRow(initialSheetRow);
    }
    logs.push({ step: '3_SHEETS_LOGGED_INITIAL', status: 'CREATED' });

    // Step 5: AI Analysis & Classification
    let aiParsedData;
    if (connectors.aiModel) {
      const rawAiResponse = await connectors.aiModel.analyze({
        subject: customer_subject,
        body: customer_body
      });
      const parsedRes = parseAndValidateAiOutput(rawAiResponse);
      aiParsedData = parsedRes.data;
    } else {
      // In-engine extraction heuristic if no external AI provided
      const rawCat = rawInbound.inquiry_category || rawInbound.secondary_intent || 'general_inquiry';
      let rawPrimary = rawInbound.primary_intent;
      if (!rawPrimary) {
        if (rawInbound.is_sensitive || rawCat === 'sensitive_complaint' || rawCat === 'legal_threat') rawPrimary = 'Complaint';
        else if (rawCat === 'billing_dispute') rawPrimary = 'Payment';
        else if (rawCat === 'quote_inquiry') rawPrimary = 'Sales';
        else if (['routine_maintenance', 'mechanical_repair', 'appointment_reschedule'].includes(rawCat)) rawPrimary = 'Booking';
        else rawPrimary = 'Sales';
      }

      aiParsedData = rawInbound.mock_ai_output || {
        customer_name: rawInbound.customer_name || null,
        customer_phone: rawInbound.customer_phone || null,
        vehicle: rawInbound.vehicle || { year: null, make: null, model: null, vin: null, tier_guess: 'unknown' },
        primary_intent: rawPrimary,
        secondary_intent: rawInbound.secondary_intent || rawCat,
        inquiry_category: rawInbound.secondary_intent || rawCat,
        services_requested: rawInbound.services_requested || [],
        missing_required_info: rawInbound.missing_required_info || [],
        is_sensitive: Boolean(rawInbound.is_sensitive),
        sensitivity_reason: rawInbound.sensitivity_reason || null,
        customer_sentiment: rawInbound.customer_sentiment || 'neutral',
        ai_summary: rawInbound.ai_summary || customer_subject
      };
    }

    // Step 6: Sensitivity Verification Gate (Dual-Layer: AI + Regex Filter)
    const regexSensitivity = checkSensitivity(raw_text, aiParsedData.secondary_intent || aiParsedData.inquiry_category);
    const is_sensitive = aiParsedData.is_sensitive || regexSensitivity.is_sensitive;
    const sensitivity_reason = aiParsedData.sensitivity_reason || regexSensitivity.reason;
    if (is_sensitive && aiParsedData.primary_intent !== 'Payment') {
      aiParsedData.primary_intent = 'Complaint';
    }

    logs.push({
      step: '4_SENSITIVITY_EVALUATED',
      is_sensitive,
      sensitivity_reason
    });

    // BRANCH A: Sensitive Inquiry Quarantine Path (Rules #5, #12, #13)
    if (is_sensitive) {
      const manualStage = 'manual_review';
      const actionTaken = 'Quarantined to Manual Review - Email Suppressed';

      if (connectors.hubspot) {
        await connectors.hubspot.updateTicket(hubspotTicketId, {
          pipeline_stage: manualStage,
          is_sensitive: true,
          sensitivity_reason,
          customer_sentiment: aiParsedData.customer_sentiment || 'frustrated',
          ai_summary: aiParsedData.ai_summary,
          action_taken: actionTaken
        });
      }

      const slackAlert = buildManualReviewAlert({
        tracking_number,
        inquiry_id,
        customer_name: aiParsedData.customer_name || rawInbound.customer_name,
        customer_email,
        customer_phone: aiParsedData.customer_phone || rawInbound.customer_phone,
        sensitivity_reason,
        customer_sentiment: aiParsedData.customer_sentiment || 'hostile_escalation',
        ai_summary: aiParsedData.ai_summary
      });

      if (connectors.slack) {
        await connectors.slack.postMessage(slackAlert);
      }

      if (connectors.googleSheets) {
        await connectors.googleSheets.updateRow(inquiry_id, {
          Subject: customer_subject || 'Inquiry',
          Inquiry_Category: aiParsedData.primary_intent || 'Complaint',
          Is_Sensitive: true,
          Sensitivity_Reason: sensitivity_reason,
          AI_Summary: aiParsedData.ai_summary,
          HubSpot_Stage: manualStage,
          Slack_Channel_Notified: '#manual-review',
          Automated_Email_Sent: false,
          Action_Taken: actionTaken,
          Processing_Status: 'MANUAL_REVIEW'
        });
      }

      logs.push({
        step: '5_SENSITIVE_QUARANTINE_EXECUTED',
        slack_channel: '#manual-review',
        automated_email_sent: false,
        status: 'MANUAL_REVIEW'
      });

      return {
        success: true,
        inquiry_id,
        tracking_number,
        is_sensitive: true,
        sensitivity_reason,
        primary_intent: aiParsedData.primary_intent || 'Complaint',
        secondary_intent: aiParsedData.secondary_intent || 'other',
        stage: manualStage,
        automated_email_sent: false,
        slack_channel: '#manual-review',
        logs
      };
    }

    // BRANCH B: Non-Sensitive Path
    const vehicle = aiParsedData.vehicle || {};
    const hasRequiredVehicle = Boolean(vehicle.year && vehicle.make && vehicle.model);
    const hasServices = Array.isArray(aiParsedData.services_requested) && aiParsedData.services_requested.length > 0;

    // Sub-Branch B1: Missing Critical Information
    if (!hasRequiredVehicle || !hasServices || (aiParsedData.missing_required_info && aiParsedData.missing_required_info.length > 0)) {
      const needsInfoStage = 'needs_info';

      if (connectors.hubspot) {
        await connectors.hubspot.updateTicket(hubspotTicketId, {
          pipeline_stage: needsInfoStage,
          ai_summary: aiParsedData.ai_summary
        });
      }

      const missingEmail = buildMissingInfoEmail({
        customer_name: aiParsedData.customer_name,
        tracking_number,
        missing_fields: aiParsedData.missing_required_info
      });

      if (connectors.gmail) {
        await connectors.gmail.sendEmail({
          to: customer_email,
          subject: missingEmail.subject,
          html: missingEmail.html,
          text: missingEmail.text
        });
      }

      const slackCard = buildRoutineNotification({
        tracking_number,
        customer_name: aiParsedData.customer_name,
        customer_email,
        vehicle_year: vehicle.year,
        vehicle_make: vehicle.make,
        vehicle_model: vehicle.model,
        vehicle_tier_label: 'Needs Info',
        services_requested: aiParsedData.services_requested,
        estimated_cost: null,
        pricing_status: 'not_applicable',
        hubspot_stage: 'Needs Customer Info'
      });

      if (connectors.slack) {
        await connectors.slack.postMessage(slackCard);
      }

      if (connectors.googleSheets) {
        await connectors.googleSheets.updateRow(inquiry_id, {
          Customer_Name: aiParsedData.customer_name,
          Customer_Phone: aiParsedData.customer_phone,
          Subject: customer_subject || 'Inquiry',
          Inquiry_Category: aiParsedData.primary_intent || 'Booking',
          Services_Requested: (aiParsedData.services_requested || []).join(', '),
          Is_Sensitive: false,
          Pricing_Status: 'not_applicable',
          AI_Summary: aiParsedData.ai_summary,
          HubSpot_Stage: needsInfoStage,
          Slack_Channel_Notified: '#intake-notifications',
          Automated_Email_Sent: true,
          Action_Taken: 'Requested Missing Details via Automated Email',
          Processing_Status: 'AWAITING_INFO'
        });
      }

      logs.push({
        step: '5_NEEDS_INFO_EXECUTED',
        slack_channel: '#intake-notifications',
        automated_email_sent: true,
        status: 'AWAITING_INFO'
      });

      return {
        success: true,
        inquiry_id,
        tracking_number,
        is_sensitive: false,
        primary_intent: aiParsedData.primary_intent,
        secondary_intent: aiParsedData.secondary_intent,
        stage: needsInfoStage,
        automated_email_sent: true,
        slack_channel: '#intake-notifications',
        logs
      };
    }

    // Sub-Branch B2: Deterministic Pricing Calculation (Rules #4, #10, #11)
    const quoteResult = calculateQuote(aiParsedData.services_requested, vehicle);
    const quoteStage = 'quote_generated';

    logs.push({
      step: '5_PRICING_CALCULATED',
      tier: quoteResult.tier,
      pricing_status: quoteResult.pricing_status,
      estimated_cost: quoteResult.estimated_cost
    });

    if (connectors.hubspot) {
      await connectors.hubspot.updateTicket(hubspotTicketId, {
        pipeline_stage: quoteStage,
        vehicle_year: vehicle.year,
        vehicle_make: vehicle.make,
        vehicle_model: vehicle.model,
        vehicle_vin: vehicle.vin,
        vehicle_tier: quoteResult.tier,
        services_requested: aiParsedData.services_requested.join(', '),
        estimated_cost: quoteResult.estimated_cost,
        pricing_status: quoteResult.pricing_status,
        customer_sentiment: aiParsedData.customer_sentiment || 'neutral',
        ai_summary: aiParsedData.ai_summary,
        action_taken: 'Quote Sent / Confirmation Dispatched'
      });
    }

    const quoteEmail = buildQuoteEmail({
      customer_name: aiParsedData.customer_name,
      tracking_number,
      vehicle_year: vehicle.year,
      vehicle_make: vehicle.make,
      vehicle_model: vehicle.model,
      services_requested: aiParsedData.services_requested,
      quote_data: quoteResult
    });

    if (connectors.gmail) {
      await connectors.gmail.sendEmail({
        to: customer_email,
        subject: quoteEmail.subject,
        html: quoteEmail.html,
        text: quoteEmail.text
      });
    }

    const slackCard = buildRoutineNotification({
      tracking_number,
      customer_name: aiParsedData.customer_name,
      customer_email,
      vehicle_year: vehicle.year,
      vehicle_make: vehicle.make,
      vehicle_model: vehicle.model,
      vehicle_tier_label: quoteResult.tier_label,
      services_requested: aiParsedData.services_requested,
      estimated_cost: quoteResult.estimated_cost,
      pricing_status: quoteResult.pricing_status,
      hubspot_stage: 'Quote Generated'
    });

    if (connectors.slack) {
      await connectors.slack.postMessage(slackCard);
    }

    if (connectors.googleSheets) {
      await connectors.googleSheets.updateRow(inquiry_id, {
        Customer_Name: aiParsedData.customer_name,
        Customer_Phone: aiParsedData.customer_phone,
        Subject: customer_subject || 'Inquiry',
        Vehicle_Year: vehicle.year,
        Vehicle_Make: vehicle.make,
        Vehicle_Model: vehicle.model,
        Vehicle_VIN: vehicle.vin,
        Vehicle_Tier: quoteResult.tier,
        Inquiry_Category: aiParsedData.primary_intent || 'Sales',
        Services_Requested: aiParsedData.services_requested.join(', '),
        Is_Sensitive: false,
        Estimated_Cost: quoteResult.estimated_cost,
        Pricing_Status: quoteResult.pricing_status,
        Customer_Sentiment: aiParsedData.customer_sentiment,
        AI_Summary: aiParsedData.ai_summary,
        HubSpot_Stage: quoteStage,
        Slack_Channel_Notified: '#intake-notifications',
        Automated_Email_Sent: true,
        Action_Taken: 'Quote Sent / Confirmation Dispatched',
        Processing_Status: 'SUCCESS'
      });
    }

    logs.push({
      step: '6_QUOTE_PROCESSED_SUCCESS',
      pricing_status: quoteResult.pricing_status,
      estimated_cost: quoteResult.estimated_cost,
      slack_channel: '#intake-notifications',
      automated_email_sent: true,
      status: 'SUCCESS'
    });

    return {
      success: true,
      inquiry_id,
      tracking_number,
      is_sensitive: false,
      primary_intent: aiParsedData.primary_intent || 'Sales',
      secondary_intent: aiParsedData.secondary_intent || 'quote_inquiry',
      quote: quoteResult,
      stage: quoteStage,
      automated_email_sent: true,
      slack_channel: '#intake-notifications',
      logs
    };

  } catch (pipelineErr) {
    // Global Catch & Resilience Handler
    const errorAlert = buildErrorAlert({
      node_name: 'Pipeline_Execution',
      error_message: pipelineErr.message || String(pipelineErr),
      tracking_number,
      inquiry_id,
      timestamp
    });

    if (connectors.slack) {
      await connectors.slack.postMessage(errorAlert);
    }

    if (connectors.googleSheets) {
      await connectors.googleSheets.updateRow(inquiry_id, {
        Processing_Status: 'FAILED',
        Error_Details: pipelineErr.message || String(pipelineErr)
      });
    }

    logs.push({
      step: 'ERROR_CAUGHT_SAFE_STATE',
      error: pipelineErr.message,
      status: 'FAILED'
    });

    return {
      success: false,
      inquiry_id,
      tracking_number,
      error: pipelineErr.message,
      logs
    };
  }
}

module.exports = {
  processIntakeInquiry
};
