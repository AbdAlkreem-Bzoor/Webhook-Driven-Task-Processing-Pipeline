// SchemaValidator.ts

interface FieldDefinition {
    type?: string;
    required?: boolean;
    enum?: string[];
}

interface Schema {
    properties?: Record<string, FieldDefinition>;
    additionalProperties?: boolean;
}

export function validateSchema(payload: unknown, schemaJson: string): string[] {
    const errors: string[] = [];
    const schema: Schema = JSON.parse(schemaJson);

    if (!schema.properties) return errors;

    if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
        errors.push("Payload must be a JSON object.");
        return errors;
    }

    const record = payload as Record<string, unknown>;

    for (const [fieldName, fieldDef] of Object.entries(schema.properties)) {
        const exists = fieldName in record;
        const value = record[fieldName];

        if (!exists) {
            if (fieldDef.required) {
                errors.push(`Required field '${fieldName}' is missing.`);
            }
            continue;
        }

        if (fieldDef.type && !matchesType(value, fieldDef.type)) {
            errors.push(
                `Field '${fieldName}' expected type '${fieldDef.type}' but got '${describeType(value)}'.`,
            );
        }

        if (fieldDef.enum) {
            const actual = String(value);
            if (!fieldDef.enum.includes(actual)) {
                errors.push(
                    `Field '${fieldName}' value '${actual}' is not in [${fieldDef.enum.join(", ")}].`,
                );
            }
        }
    }

    const allowAdditional = schema.additionalProperties !== false;

    if (!allowAdditional) {
        const knownFields = new Set(Object.keys(schema.properties));

        for (const key of Object.keys(record)) {
            if (!knownFields.has(key)) {
                errors.push(`Unexpected field '${key}' — additional properties not allowed.`);
            }
        }
    }

    return errors;
}

function matchesType(value: unknown, expected: string): boolean {
    switch (expected) {
        case "string":  return typeof value === "string";
        case "number":  return typeof value === "number";
        case "boolean": return typeof value === "boolean";
        case "array":   return Array.isArray(value);
        case "object":  return typeof value === "object" && value !== null && !Array.isArray(value);
        case "any":     return true;
        default:        return true;
    }
}

function describeType(value: unknown): string {
    if (value === null)          return "null";
    if (Array.isArray(value))    return "array";
    return typeof value;
}