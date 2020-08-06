import { values } from "./sep9-fields";

export const transactionSchema = {
  type: "object",
  properties: {
    transaction: {
      type: "object",
      properties: {
        id: { type: "string" },
        status: {
          type: "string",
          pattern:
            "pending_sender|pending_stellar|pending_info_update|pending_receiver|pending_external|completed|error",
        },
        status_eta: {
          type: ["number", "null"],
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
        stellar_account_id: {
          type: ["string", "null"],
        },
        stellar_memo_type: {
          type: ["string", "null"],
          pattern: "text|id|hash",
        },
        stellar_memo: {
          type: ["string", "null"],
        },
        stellar_transaction_id: {
          type: ["string", "null"],
        },
        external_transaction_id: {
          type: ["string", "null"],
        },
        required_info_message: {
          type: ["string", "null"],
        },
        required_info_updates: {
          type: ["object", "null"],
        },
        refunded: {
          type: "boolean",
        },
      },
      required: [
        "id",
        "status",
        "stellar_account_id",
        "stellar_memo",
        "stellar_memo_type",
      ],
    },
  },
  required: ["transaction"],
};

export const errorSchema = {
  type: "object",
  properties: {
    error: { type: "string" },
  },
  required: ["error"],
};

const fieldSchema = {
  type: "object",
  additionalProperties: {
    type: "object",
    patternProperties: {
      ".*": {
        properties: {
          description: { type: "string" },
          choices: { type: "array" },
        },
        required: ["description"],
      },
    },
  },
};

export const infoSchema = {
  type: "object",
  properties: {
    receive: {
      type: "object",
      patternProperties: {
        ".*": {
          properties: {
            enabled: { type: "boolean" },
            fee_fixed: { type: "number" },
            fee_percent: { type: "number" },
            min_amount: { type: "number" },
            max_amount: { type: "number" },
            sender_sep12_type: { type: "string" },
            receiver_sep12_type: { type: "string" },
            fields: {
              type: "object",
              properties: {
                transaction: fieldSchema,
              },
              required: ["transaction"],
            },
          },
          required: ["enabled", "fields"],
        },
      },
    },
  },
  required: ["receive"],
};

export const sep12FieldsSchema = {
  type: "object",
  propertyNames: { enum: Object.keys(values) },
  additionalProperties: {
    type: "object",
    properties: {
      description: { type: "string" },
      type: { type: "string" },
      choices: { type: "array" },
    },
    required: ["description", "type"],
  },
};
