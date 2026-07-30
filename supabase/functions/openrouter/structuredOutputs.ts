import type { ModelRoute, OpenRouterTask } from "./modelRouting.ts";

const stringArray = {
  type: "array",
  items: { type: "string" },
} as const;

const nullableString = {
  type: ["string", "null"],
} as const;

const interviewSchema = {
  type: "object",
  additionalProperties: false,
  required: ["assistantMessage", "updates"],
  properties: {
    assistantMessage: {
      type: "string",
      minLength: 1,
    },
    updates: {
      type: "object",
      additionalProperties: false,
      required: [
        "intent",
        "scope",
        "capabilities",
        "requirements",
        "decisions",
        "themes",
      ],
      properties: {
        intent: {
          type: "object",
          additionalProperties: false,
          required: [
            "problem",
            "targetUsers",
            "expectedOutcome",
            "successIndicators",
          ],
          properties: {
            problem: nullableString,
            targetUsers: stringArray,
            expectedOutcome: nullableString,
            successIndicators: stringArray,
          },
        },
        scope: {
          type: "object",
          additionalProperties: false,
          required: ["lotName", "included", "excluded"],
          properties: {
            lotName: nullableString,
            included: stringArray,
            excluded: stringArray,
          },
        },
        capabilities: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["id", "name", "priority", "sourceIds"],
            properties: {
              id: { type: "string", minLength: 1 },
              name: { type: "string", minLength: 1 },
              priority: {
                type: "string",
                enum: ["required", "optional", "excluded"],
              },
              sourceIds: stringArray,
            },
          },
        },
        requirements: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: [
              "id",
              "capabilityId",
              "title",
              "description",
              "priority",
              "status",
              "acceptanceCriteria",
              "scenarios",
              "sourceIds",
            ],
            properties: {
              id: { type: "string", minLength: 1 },
              capabilityId: nullableString,
              title: { type: "string", minLength: 1 },
              description: { type: "string" },
              priority: {
                type: "string",
                enum: ["required", "optional"],
              },
              status: {
                type: "string",
                enum: ["confirmed", "hypothesis", "unknown", "contradiction"],
              },
              acceptanceCriteria: stringArray,
              scenarios: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["given", "when", "then"],
                  properties: {
                    given: { type: "string" },
                    when: { type: "string" },
                    then: { type: "string" },
                  },
                },
              },
              sourceIds: stringArray,
            },
          },
        },
        decisions: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["id", "label", "status", "sourceIds"],
            properties: {
              id: { type: "string", minLength: 1 },
              label: { type: "string", minLength: 1 },
              status: {
                type: "string",
                enum: ["confirmed", "hypothesis", "unknown", "contradiction"],
              },
              sourceIds: stringArray,
            },
          },
        },
        themes: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["id", "status", "missingDecisionIds"],
            properties: {
              id: {
                type: "string",
                enum: [
                  "scope",
                  "users",
                  "journey",
                  "rules",
                  "data",
                  "edge-cases",
                  "dependencies",
                ],
              },
              status: {
                type: "string",
                enum: ["to_explore", "incomplete", "complete", "blocked"],
              },
              missingDecisionIds: stringArray,
            },
          },
        },
      },
    },
  },
} as const;

const specSchema = {
  type: "object",
  additionalProperties: false,
  required: ["markdown"],
  properties: {
    markdown: {
      type: "string",
      minLength: 1,
    },
  },
} as const;

export function getStructuredResponseFormat(task: OpenRouterTask) {
  if (task === "summary") return null;

  return {
    type: "json_schema",
    json_schema: {
      name: task === "interview" ? "guided_interview" : "spec_document",
      strict: true,
      schema: task === "interview" ? interviewSchema : specSchema,
    },
  };
}

export function buildOpenRouterRequest(
  route: ModelRoute,
  messages: unknown[],
  maxTokens: number,
) {
  const responseFormat = getStructuredResponseFormat(route.task);
  return {
    model: route.model,
    max_tokens: maxTokens,
    messages,
    ...(responseFormat
      ? {
        response_format: responseFormat,
        provider: {
          require_parameters: true,
        },
      }
      : {}),
  };
}
