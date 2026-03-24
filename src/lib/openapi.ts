type OpenApiDocument = {
  openapi: string;
  info: {
    title: string;
    version: string;
    description: string;
  };
  servers: Array<{ url: string }>;
  tags: Array<{ name: string; description: string }>;
  paths: Record<string, unknown>;
  components: {
    schemas: Record<string, unknown>;
  };
};

export function buildOpenApiDocument(baseUrl: string): OpenApiDocument {
  return {
    openapi: "3.1.0",
    info: {
      title: "TinyNum API",
      version: "1.0.0",
      description:
        "Public API for creating temporary text or URL entries and retrieving them by integer key. Entries expire after 10 minutes.",
    },
    servers: [{ url: baseUrl }],
    tags: [
      {
        name: "Entries",
        description: "Create and retrieve temporary public entries.",
      },
    ],
    paths: {
      "/api/entries": {
        post: {
          tags: ["Entries"],
          summary: "Create an entry",
          description:
            "Stores public text or URL for 10 minutes and returns the smallest available positive integer key.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/CreateEntryRequest",
                },
              },
            },
          },
          responses: {
            "201": {
              description: "Entry created",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/CreateEntryResponse",
                  },
                },
              },
            },
            "400": {
              description: "Invalid payload",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/ErrorResponse",
                  },
                },
              },
            },
            "429": {
              description: "Rate limit exceeded",
              headers: {
                "Retry-After": {
                  description: "Seconds to wait before retrying",
                  schema: { type: "integer" },
                },
              },
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/ErrorResponse",
                  },
                },
              },
            },
          },
        },
      },
      "/api/entries/{key}": {
        get: {
          tags: ["Entries"],
          summary: "Retrieve an entry by key",
          description:
            "Returns text or URL payload if key exists and is not expired. Returns silent not found for missing or expired keys.",
          parameters: [
            {
              name: "key",
              in: "path",
              required: true,
              schema: {
                type: "integer",
                minimum: 1,
              },
            },
          ],
          responses: {
            "200": {
              description: "Entry found",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/RetrieveEntryResponse",
                  },
                },
              },
            },
            "404": {
              description: "Missing or expired key",
            },
            "429": {
              description: "Rate limit exceeded",
              headers: {
                "Retry-After": {
                  description: "Seconds to wait before retrying",
                  schema: { type: "integer" },
                },
              },
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/ErrorResponse",
                  },
                },
              },
            },
          },
        },
      },
    },
    components: {
      schemas: {
        CreateEntryRequest: {
          type: "object",
          required: ["value"],
          properties: {
            value: {
              type: "string",
              minLength: 1,
              maxLength: 10000,
              description: "Public text or URL.",
            },
          },
        },
        CreateEntryResponse: {
          type: "object",
          required: ["key"],
          properties: {
            key: {
              type: "integer",
              minimum: 1,
            },
          },
        },
        RetrieveEntryResponse: {
          type: "object",
          required: ["type", "value", "expiresInMs"],
          properties: {
            type: {
              type: "string",
              enum: ["text", "url"],
            },
            value: {
              type: "string",
            },
            expiresInMs: {
              type: "integer",
              minimum: 0,
            },
          },
        },
        ErrorResponse: {
          type: "object",
          required: ["error"],
          properties: {
            error: {
              type: "string",
            },
          },
        },
      },
    },
  };
}
