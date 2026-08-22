/**
 * Slack Block Kit notification builders for Marcus Vance Automotive Intake Agent.
 */

function buildManualReviewAlert(payload) {
  const {
    tracking_number,
    inquiry_id,
    customer_name,
    customer_email,
    customer_phone,
    sensitivity_reason,
    customer_sentiment,
    ai_summary,
    hubspot_ticket_url = "https://app.hubspot.com",
    google_sheets_url = "https://docs.google.com/spreadsheets"
  } = payload;

  return {
    channel: "#manual-review",
    text: `🚨 URGENT: Sensitive Customer Inquiry [${tracking_number}]`,
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "🚨 URGENT: Sensitive Inquiry Escalation",
          emoji: true
        }
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*Tracking Number:*\n\`${tracking_number}\``
          },
          {
            type: "mrkdwn",
            text: `*Inquiry ID:*\n\`${inquiry_id}\``
          },
          {
            type: "mrkdwn",
            text: `*Customer:*\n${customer_name || 'Unknown'} (<mailto:${customer_email}|${customer_email}>)`
          },
          {
            type: "mrkdwn",
            text: `*Phone:*\n${customer_phone || 'Not provided'}`
          },
          {
            type: "mrkdwn",
            text: `*Sensitivity Trigger:*\n⚠️ ${sensitivity_reason || 'Escalation detected'}`
          },
          {
            type: "mrkdwn",
            text: `*Sentiment:*\n${customer_sentiment?.toUpperCase() || 'HOSTILE/ESCALATION'}`
          }
        ]
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*AI Executive Summary:*\n${ai_summary}`
        }
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: "⛔ *AUTOMATED EMAIL RESPONSE HAS BEEN STRICTLY SUPPRESSED.* Please review and contact customer directly."
          }
        ]
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "Open in HubSpot",
              emoji: true
            },
            url: hubspot_ticket_url,
            style: "primary"
          },
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "View Activity Log",
              emoji: true
            },
            url: google_sheets_url
          }
        ]
      }
    ]
  };
}

function buildRoutineNotification(payload) {
  const {
    tracking_number,
    customer_name,
    customer_email,
    vehicle_year,
    vehicle_make,
    vehicle_model,
    vehicle_tier_label,
    services_requested,
    estimated_cost,
    pricing_status,
    hubspot_stage,
    hubspot_ticket_url = "https://app.hubspot.com"
  } = payload;

  const vehicleStr = (vehicle_year || vehicle_make || vehicle_model)
    ? `${vehicle_year || ''} ${vehicle_make || ''} ${vehicle_model || ''}`.trim()
    : 'Unknown Vehicle';

  const servicesStr = Array.isArray(services_requested) && services_requested.length > 0
    ? services_requested.join(', ')
    : 'General Inquiry / Diagnostic';

  const isQuoted = pricing_status === 'quoted_automatically' && estimated_cost !== null;
  const headerText = isQuoted
    ? "📋 Intake Processed: Auto-Quote Sent"
    : "ℹ️ Intake Notice: " + (hubspot_stage || "Review Required");

  const quoteDisplay = isQuoted
    ? `$${estimated_cost.toFixed(2)} (Standard Tier Rate)`
    : "Manual Quote Required (Advisor will review)";

  return {
    channel: "#intake-notifications",
    text: `New Intake [${tracking_number}]: ${customer_name || customer_email}`,
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: headerText,
          emoji: true
        }
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*Tracking Number:*\n\`${tracking_number}\``
          },
          {
            type: "mrkdwn",
            text: `*Customer:*\n${customer_name || 'Customer'} (<mailto:${customer_email}|${customer_email}>)`
          },
          {
            type: "mrkdwn",
            text: `*Vehicle:*\n${vehicleStr} (${vehicle_tier_label || 'Standard'})`
          },
          {
            type: "mrkdwn",
            text: `*Services Requested:*\n${servicesStr}`
          },
          {
            type: "mrkdwn",
            text: `*Quote Status:*\n${quoteDisplay}`
          },
          {
            type: "mrkdwn",
            text: `*Pipeline Stage:*\n${hubspot_stage || 'Quote Ready'}`
          }
        ]
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "View Ticket in HubSpot",
              emoji: true
            },
            url: hubspot_ticket_url
          }
        ]
      }
    ]
  };
}

function buildErrorAlert(payload) {
  const {
    node_name,
    error_message,
    tracking_number,
    inquiry_id,
    timestamp = new Date().toISOString()
  } = payload;

  return {
    channel: "#intake-errors",
    text: `🛑 Intake Pipeline Error: ${node_name || 'Workflow Error'}`,
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "🛑 System Alert: Intake Pipeline Error",
          emoji: true
        }
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*Failed Node:*\n\`${node_name || 'Unknown'}\``
          },
          {
            type: "mrkdwn",
            text: `*Timestamp:*\n${timestamp}`
          },
          {
            type: "mrkdwn",
            text: `*Tracking Number:*\n\`${tracking_number || 'N/A'}\``
          },
          {
            type: "mrkdwn",
            text: `*Inquiry ID:*\n\`${inquiry_id || 'N/A'}\``
          }
        ]
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Error Details:*\n\`\`\`${error_message || 'Unhandled Exception'}\`\`\``
        }
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: "Payload has been logged to Google Sheets error audit log. Safe state maintained."
          }
        ]
      }
    ]
  };
}

module.exports = {
  buildManualReviewAlert,
  buildRoutineNotification,
  buildErrorAlert
};
