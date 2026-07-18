const normalizedPointSchema = {
  type: "array",
  minItems: 2,
  maxItems: 2,
  items: { type: "number", minimum: 0, maximum: 1 },
} as const;

export const overlayPrimitiveSchema = {
  anyOf: [
    {
      type: "object",
      additionalProperties: false,
      required: ["type", "from", "to"],
      properties: {
        type: { type: "string", const: "arrow" },
        from: normalizedPointSchema,
        to: normalizedPointSchema,
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["type", "from", "to"],
      properties: {
        type: { type: "string", const: "crease_line" },
        from: normalizedPointSchema,
        to: normalizedPointSchema,
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["type", "from", "to"],
      properties: {
        type: { type: "string", const: "fold_curve" },
        from: normalizedPointSchema,
        to: normalizedPointSchema,
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["type", "at"],
      properties: {
        type: { type: "string", const: "dot" },
        at: normalizedPointSchema,
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["type", "at", "text"],
      properties: {
        type: { type: "string", const: "label" },
        at: normalizedPointSchema,
        text: { type: "string" },
      },
    },
  ],
} as const;
