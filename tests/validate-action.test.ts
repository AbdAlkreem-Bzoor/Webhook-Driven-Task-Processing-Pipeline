import { describe, it, expect } from "vitest";
import { ValidateAction } from "../src/processing-actions/ValidateAction.js";
import { ProcessingActionType } from "../src/processing-actions/ProcessingAction.js";


describe("ValidateAction", () => {
    const action = new ValidateAction();

    describe("Action Type", () => {
        it("should have correct action type identifier", () => {
            expect(action.actionType).toBe(ProcessingActionType.Validate);
        });
    });

    describe("Basic JSON Validation", () => {
        it("should accept valid JSON object", () => {
            const input = JSON.stringify({ key: "value", count: 42 });
            const result = action.execute(input, "{}");

            expect(result.success).toBe(true);
            expect(result.outputJson).toBe(input);
        });

        it("should reject invalid JSON syntax", () => {
            const result = action.execute("{invalid json}", "{}");

            expect(result.success).toBe(false);
            expect(result.reason).toBe("Invalid JSON payload.");
        });

        it("should reject JSON arrays (payload must be object)", () => {
            const input = JSON.stringify([1, 2, 3]);
            const result = action.execute(input, "{}");

            expect(result.success).toBe(false);
            expect(result.reason).toBe("Payload must be a JSON object.");
        });

        it("should reject null values", () => {
            const result = action.execute("null", "{}");

            expect(result.success).toBe(false);
            expect(result.reason).toBe("Payload must be a JSON object.");
        });

        it("should reject primitive values (string)", () => {
            const result = action.execute('"just a string"', "{}");

            expect(result.success).toBe(false);
            expect(result.reason).toBe("Payload must be a JSON object.");
        });

        it("should reject primitive values (number)", () => {
            const result = action.execute("42", "{}");

            expect(result.success).toBe(false);
            expect(result.reason).toBe("Payload must be a JSON object.");
        });
    });

    describe("Empty Payload Handling", () => {
        it("should reject empty objects by default", () => {
            const result = action.execute("{}", "{}");

            expect(result.success).toBe(false);
            expect(result.reason).toBe("Payload cannot be empty.");
        });

        it("should accept empty objects when allowEmpty is true", () => {
            const config = JSON.stringify({ allowEmpty: true });
            const result = action.execute("{}", config);

            expect(result.success).toBe(true);
        });
    });

    describe("Required Fields Validation", () => {
        const configWithRequired = JSON.stringify({
            requiredFields: ["orderId", "amount", "email"]
        });

        it("should accept payload with all required fields present", () => {
            const input = JSON.stringify({
                orderId: "ORD-001",
                amount: 99.99,
                email: "customer@example.com",
                optional: "extra data"
            });
            const result = action.execute(input, configWithRequired);

            expect(result.success).toBe(true);
        });

        it("should reject payload missing one required field", () => {
            const input = JSON.stringify({
                orderId: "ORD-001",
                amount: 99.99
                // missing email
            });
            const result = action.execute(input, configWithRequired);

            expect(result.success).toBe(false);
            expect(result.reason).toContain("Missing required fields");
            expect(result.reason).toContain("email");
        });

        it("should reject payload missing multiple required fields", () => {
            const input = JSON.stringify({
                orderId: "ORD-001"
                // missing amount and email
            });
            const result = action.execute(input, configWithRequired);

            expect(result.success).toBe(false);
            expect(result.reason).toContain("Missing required fields");
            expect(result.reason).toContain("amount");
            expect(result.reason).toContain("email");
        });

        it("should reject payload with required fields set to null", () => {
            const input = JSON.stringify({
                orderId: "ORD-001",
                amount: null,
                email: "test@example.com"
            });
            const result = action.execute(input, configWithRequired);

            expect(result.success).toBe(false);
            expect(result.reason).toContain("amount");
        });

        it("should reject payload with required fields set to undefined", () => {
            const input = JSON.stringify({
                orderId: "ORD-001",
                amount: 100,
                email: undefined
            });
            const result = action.execute(input, configWithRequired);

            expect(result.success).toBe(false);
        });

        it("should accept zero as valid value for required field", () => {
            const config = JSON.stringify({ requiredFields: ["count"] });
            const input = JSON.stringify({ count: 0 });
            const result = action.execute(input, config);

            expect(result.success).toBe(true);
        });

        it("should accept empty string as valid value for required field", () => {
            const config = JSON.stringify({ requiredFields: ["name"] });
            const input = JSON.stringify({ name: "" });
            const result = action.execute(input, config);

            expect(result.success).toBe(true);
        });

        it("should accept false as valid value for required field", () => {
            const config = JSON.stringify({ requiredFields: ["active"] });
            const input = JSON.stringify({ active: false });
            const result = action.execute(input, config);

            expect(result.success).toBe(true);
        });
    });

    describe("Configuration Handling", () => {
        it("should work with empty configuration string", () => {
            const input = JSON.stringify({ data: "test" });
            const result = action.execute(input, "");

            expect(result.success).toBe(true);
        });

        it("should work with empty object configuration", () => {
            const input = JSON.stringify({ data: "test" });
            const result = action.execute(input, "{}");

            expect(result.success).toBe(true);
        });

        it("should reject invalid configuration JSON", () => {
            const input = JSON.stringify({ data: "test" });
            const result = action.execute(input, "{invalid config}");

            expect(result.success).toBe(false);
            expect(result.reason).toBe("Invalid action configuration.");
        });

        it("should ignore unknown configuration properties", () => {
            const config = JSON.stringify({
                requiredFields: ["id"],
                unknownProp: "ignored"
            });
            const input = JSON.stringify({ id: "123" });
            const result = action.execute(input, config);

            expect(result.success).toBe(true);
        });
    });

    describe("Real-World Scenarios", () => {
        it("should validate e-commerce order webhook", () => {
            const config = JSON.stringify({
                requiredFields: ["orderId", "amount", "items"]
            });
            const payload = JSON.stringify({
                orderId: "ORD-2024-001",
                amount: 149.99,
                email: "customer@shop.com",
                items: [
                    { sku: "PROD-A", quantity: 2, price: 49.99 },
                    { sku: "PROD-B", quantity: 1, price: 50.01 }
                ],
                shipping: {
                    method: "express",
                    address: "123 Main St"
                }
            });

            const result = action.execute(payload, config);

            expect(result.success).toBe(true);
        });

        it("should validate payment notification webhook", () => {
            const config = JSON.stringify({
                requiredFields: ["transactionId", "status", "amount"]
            });
            const payload = JSON.stringify({
                transactionId: "TXN-12345",
                status: "completed",
                amount: 500.00,
                currency: "USD",
                metadata: { invoiceId: "INV-001" }
            });

            const result = action.execute(payload, config);

            expect(result.success).toBe(true);
        });

        it("should validate user registration webhook", () => {
            const config = JSON.stringify({
                requiredFields: ["userId", "email", "eventType"]
            });
            const payload = JSON.stringify({
                userId: "usr_abc123",
                email: "newuser@example.com",
                eventType: "user.created",
                profile: {
                    firstName: "John",
                    lastName: "Doe"
                }
            });

            const result = action.execute(payload, config);

            expect(result.success).toBe(true);
        });

        it("should filter invalid webhook with missing order details", () => {
            const config = JSON.stringify({
                requiredFields: ["orderId", "amount"]
            });
            const payload = JSON.stringify({
                description: "Incomplete order data",
                timestamp: "2024-01-15T10:30:00Z"
            });

            const result = action.execute(payload, config);

            expect(result.success).toBe(false);
            expect(result.reason).toContain("orderId");
            expect(result.reason).toContain("amount");
        });
    });
});
