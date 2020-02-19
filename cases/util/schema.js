export const transactionSchema = {
  type: "object",
  properties: {
    transaction: {
      type: "object",
      properties: {
        id: { type: "string" },
        kind: { type: "string", pattern: "deposit|withdraw" },
        status: {
          type: "string",
          pattern:
            "completed|pending_external|pending_anchor|pending_stellar|pending_trust|pending_user|pending_user_transfer_start|incomplete|no_market|too_small|too_large|error",
        },
        more_info_url: {
          type: "string",
          format: "uri",
        },
        status_eta: {
          type: "number",
        },
        amount_in: {
          type: ["string", "null"],
        },
        amount_out: {
          type: ["string", "null"],
        },
        amount_fee: {
          type: ["string", "null"],
        },
        started_at: {
          type: "string",
          format: "date-time",
        },
        completed_at: {
          type: ["string", "null"],
          format: "date-time",
        },
        stellar_transaction_id: {
          type: ["string", "null"],
          pattern: "G[A-Z0-9]{55}",
        },
        external_transaction_id: {
          type: ["string", "null"],
        },
        message: {
          type: ["string", "null"],
        },
        refunded: {
          type: "boolean",
        },
      },
      required: ["id", "kind", "status", "more_info_url"],
    },
  },
  required: ["transaction"],
};
