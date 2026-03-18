import { describe, it, expect } from "vitest";
import { validateSchema } from "../../src/services/SchemaValidator.js";

describe("SchemaValidator", () => {
    describe("basic validation", () => {
        it("returns empty errors for payload matching schema", () => {
            const schema = JSON.stringify({
                properties: {
                    name: { type: "string" },
                    age: { type: "number" },
                },
            });
            const payload = { name: "John", age: 30 };
            const errors = validateSchema(payload, schema);
            expect(errors).toHaveLength(0);
        });

        it("returns error for non-object payload", () => {
            const schema = JSON.stringify({ properties: {} });
            const errors = validateSchema("not an object", schema);
            expect(errors).toContain("Payload must be a JSON object.");
        });

        it("returns error for array payload", () => {
            const schema = JSON.stringify({ properties: {} });
            const errors = validateSchema([1, 2, 3], schema);
            expect(errors).toContain("Payload must be a JSON object.");
        });

        it("returns error for null payload", () => {
            const schema = JSON.stringify({ properties: {} });
            const errors = validateSchema(null, schema);
            expect(errors).toContain("Payload must be a JSON object.");
        });

        it("returns empty errors for empty schema", () => {
            const schema = JSON.stringify({});
            const payload = { anything: "goes" };
            const errors = validateSchema(payload, schema);
            expect(errors).toHaveLength(0);
        });
    });

    describe("required fields", () => {
        it("reports missing required field", () => {
            const schema = JSON.stringify({
                properties: {
                    name: { type: "string", required: true },
                },
            });
            const payload = {};
            const errors = validateSchema(payload, schema);
            expect(errors).toContain("Required field 'name' is missing.");
        });

        it("does not report missing optional field", () => {
            const schema = JSON.stringify({
                properties: {
                    name: { type: "string", required: false },
                },
            });
            const payload = {};
            const errors = validateSchema(payload, schema);
            expect(errors).toHaveLength(0);
        });

        it("reports multiple missing required fields", () => {
            const schema = JSON.stringify({
                properties: {
                    name: { type: "string", required: true },
                    email: { type: "string", required: true },
                },
            });
            const payload = {};
            const errors = validateSchema(payload, schema);
            expect(errors).toHaveLength(2);
        });
    });

    describe("type checking", () => {
        it("validates string type", () => {
            const schema = JSON.stringify({
                properties: { value: { type: "string" } },
            });
            expect(validateSchema({ value: "hello" }, schema)).toHaveLength(0);
            expect(validateSchema({ value: 123 }, schema).length).toBeGreaterThan(0);
        });

        it("validates number type", () => {
            const schema = JSON.stringify({
                properties: { value: { type: "number" } },
            });
            expect(validateSchema({ value: 42 }, schema)).toHaveLength(0);
            expect(validateSchema({ value: "42" }, schema).length).toBeGreaterThan(0);
        });

        it("validates boolean type", () => {
            const schema = JSON.stringify({
                properties: { value: { type: "boolean" } },
            });
            expect(validateSchema({ value: true }, schema)).toHaveLength(0);
            expect(validateSchema({ value: "true" }, schema).length).toBeGreaterThan(0);
        });

        it("validates array type", () => {
            const schema = JSON.stringify({
                properties: { value: { type: "array" } },
            });
            expect(validateSchema({ value: [1, 2, 3] }, schema)).toHaveLength(0);
            expect(validateSchema({ value: "not array" }, schema).length).toBeGreaterThan(0);
        });

        it("validates object type", () => {
            const schema = JSON.stringify({
                properties: { value: { type: "object" } },
            });
            expect(validateSchema({ value: { nested: true } }, schema)).toHaveLength(0);
            expect(validateSchema({ value: [1] }, schema).length).toBeGreaterThan(0);
            expect(validateSchema({ value: null }, schema).length).toBeGreaterThan(0);
        });

        it("accepts any type", () => {
            const schema = JSON.stringify({
                properties: { value: { type: "any" } },
            });
            expect(validateSchema({ value: "string" }, schema)).toHaveLength(0);
            expect(validateSchema({ value: 123 }, schema)).toHaveLength(0);
            expect(validateSchema({ value: null }, schema)).toHaveLength(0);
        });

        it("reports type mismatch with correct types", () => {
            const schema = JSON.stringify({
                properties: { name: { type: "string" } },
            });
            const errors = validateSchema({ name: 123 }, schema);
            expect(errors[0]).toContain("expected type 'string'");
            expect(errors[0]).toContain("got 'number'");
        });
    });

    describe("enum validation", () => {
        it("accepts value in enum", () => {
            const schema = JSON.stringify({
                properties: {
                    status: { enum: ["active", "inactive", "pending"] },
                },
            });
            const errors = validateSchema({ status: "active" }, schema);
            expect(errors).toHaveLength(0);
        });

        it("rejects value not in enum", () => {
            const schema = JSON.stringify({
                properties: {
                    status: { enum: ["active", "inactive"] },
                },
            });
            const errors = validateSchema({ status: "deleted" }, schema);
            expect(errors[0]).toContain("is not in [active, inactive]");
        });

        it("stringifies non-string values for enum comparison", () => {
            const schema = JSON.stringify({
                properties: {
                    code: { enum: ["1", "2", "3"] },
                },
            });
            const errors = validateSchema({ code: 1 }, schema);
            expect(errors).toHaveLength(0);
        });
    });

    describe("additional properties", () => {
        it("allows additional properties by default", () => {
            const schema = JSON.stringify({
                properties: { name: { type: "string" } },
            });
            const payload = { name: "John", extra: "allowed" };
            const errors = validateSchema(payload, schema);
            expect(errors).toHaveLength(0);
        });

        it("allows additional properties when explicitly true", () => {
            const schema = JSON.stringify({
                properties: { name: { type: "string" } },
                additionalProperties: true,
            });
            const payload = { name: "John", extra: "allowed" };
            const errors = validateSchema(payload, schema);
            expect(errors).toHaveLength(0);
        });

        it("rejects additional properties when false", () => {
            const schema = JSON.stringify({
                properties: { name: { type: "string" } },
                additionalProperties: false,
            });
            const payload = { name: "John", extra: "not allowed" };
            const errors = validateSchema(payload, schema);
            expect(errors[0]).toContain("Unexpected field 'extra'");
        });

        it("reports multiple unexpected fields", () => {
            const schema = JSON.stringify({
                properties: { name: { type: "string" } },
                additionalProperties: false,
            });
            const payload = { name: "John", extra1: 1, extra2: 2 };
            const errors = validateSchema(payload, schema);
            expect(errors).toHaveLength(2);
        });
    });

    describe("combined validations", () => {
        it("reports all validation errors together", () => {
            const schema = JSON.stringify({
                properties: {
                    name: { type: "string", required: true },
                    status: { type: "string", enum: ["active", "inactive"] },
                    count: { type: "number" },
                },
                additionalProperties: false,
            });
            const payload = { status: "deleted", count: "not-a-number", extra: true };
            const errors = validateSchema(payload, schema);
            expect(errors.some(e => e.includes("'name' is missing"))).toBe(true);
            expect(errors.some(e => e.includes("is not in"))).toBe(true);
            expect(errors.some(e => e.includes("expected type 'number'"))).toBe(true);
            expect(errors.some(e => e.includes("Unexpected field"))).toBe(true);
        });
    });
});
