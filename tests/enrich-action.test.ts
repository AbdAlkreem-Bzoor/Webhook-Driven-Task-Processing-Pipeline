import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EnrichAction } from "../src/processing-actions/EnrichAction.js";
import { ProcessingActionType } from "../src/processing-actions/ProcessingAction.js";


describe("EnrichAction", () => {
    const action = new EnrichAction();

    describe("Action Type", () => {
        it("should have correct action type identifier", () => {
            expect(action.actionType).toBe(ProcessingActionType.Enrich);
        });
    });

    describe("Timestamp Enrichment", () => {
        beforeEach(() => {
            vi.useFakeTimers();
            vi.setSystemTime(new Date("2024-01-15T10:30:00.000Z"));
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it("should add processedAt timestamp by default", () => {
            const input = JSON.stringify({ orderId: "ORD-001" });
            const result = action.execute(input, "{}");

            expect(result.success).toBe(true);
            const output = JSON.parse(result.outputJson);
            expect(output.processedAt).toBe("2024-01-15T10:30:00.000Z");
        });

        it("should add timestamp when explicitly enabled", () => {
            const input = JSON.stringify({ data: "test" });
            const config = JSON.stringify({ addTimestamp: true });
            const result = action.execute(input, config);

            const output = JSON.parse(result.outputJson);
            expect(output.processedAt).toBe("2024-01-15T10:30:00.000Z");
        });

        it("should not add timestamp when disabled", () => {
            const input = JSON.stringify({ data: "test" });
            const config = JSON.stringify({ addTimestamp: false });
            const result = action.execute(input, config);

            const output = JSON.parse(result.outputJson);
            expect(output).not.toHaveProperty("processedAt");
        });

        it("should preserve original data when adding timestamp", () => {
            const input = JSON.stringify({
                orderId: "ORD-001",
                amount: 99.99,
                items: ["A", "B"]
            });
            const result = action.execute(input, "{}");

            const output = JSON.parse(result.outputJson);
            expect(output.orderId).toBe("ORD-001");
            expect(output.amount).toBe(99.99);
            expect(output.items).toEqual(["A", "B"]);
            expect(output.processedAt).toBe("2024-01-15T10:30:00.000Z");
        });
    });

    describe("Hash Generation", () => {
        it("should generate SHA-256 hash of specified string field", () => {
            const input = JSON.stringify({ orderId: "ORD-001" });
            const config = JSON.stringify({ addHash: "orderId", addTimestamp: false });
            const result = action.execute(input, config);

            expect(result.success).toBe(true);
            const output = JSON.parse(result.outputJson);

            // SHA-256 hash of "ORD-001"
            expect(output.payloadHash).toMatch(/^[a-f0-9]{64}$/);
            expect(output.payloadHash).toBe(
                "5b75daab06a2ef216c9fe0a8d2a50ebca404cafb6155e98e7e3a1992165a32a4"
            );
        });

        it("should generate hash for numeric field (stringified)", () => {
            const input = JSON.stringify({ amount: 100 });
            const config = JSON.stringify({ addHash: "amount", addTimestamp: false });
            const result = action.execute(input, config);

            const output = JSON.parse(result.outputJson);
            expect(output.payloadHash).toMatch(/^[a-f0-9]{64}$/);
        });

        it("should generate hash for object field (JSON stringified)", () => {
            const input = JSON.stringify({
                data: { key: "value", nested: true }
            });
            const config = JSON.stringify({ addHash: "data", addTimestamp: false });
            const result = action.execute(input, config);

            const output = JSON.parse(result.outputJson);
            expect(output.payloadHash).toMatch(/^[a-f0-9]{64}$/);
        });

        it("should generate hash for array field (JSON stringified)", () => {
            const input = JSON.stringify({
                items: ["A", "B", "C"]
            });
            const config = JSON.stringify({ addHash: "items", addTimestamp: false });
            const result = action.execute(input, config);

            const output = JSON.parse(result.outputJson);
            expect(output.payloadHash).toMatch(/^[a-f0-9]{64}$/);
        });

        it("should not add hash if field does not exist", () => {
            const input = JSON.stringify({ orderId: "ORD-001" });
            const config = JSON.stringify({ addHash: "nonexistent", addTimestamp: false });
            const result = action.execute(input, config);

            const output = JSON.parse(result.outputJson);
            expect(output).not.toHaveProperty("payloadHash");
        });

        it("should generate different hashes for different values", () => {
            const config = JSON.stringify({ addHash: "id", addTimestamp: false });

            const result1 = action.execute(JSON.stringify({ id: "A" }), config);
            const result2 = action.execute(JSON.stringify({ id: "B" }), config);

            const output1 = JSON.parse(result1.outputJson);
            const output2 = JSON.parse(result2.outputJson);

            expect(output1.payloadHash).not.toBe(output2.payloadHash);
        });

        it("should generate same hash for same value", () => {
            const config = JSON.stringify({ addHash: "id", addTimestamp: false });

            const result1 = action.execute(JSON.stringify({ id: "TEST" }), config);
            const result2 = action.execute(JSON.stringify({ id: "TEST" }), config);

            const output1 = JSON.parse(result1.outputJson);
            const output2 = JSON.parse(result2.outputJson);

            expect(output1.payloadHash).toBe(output2.payloadHash);
        });
    });

    describe("UUID Generation", () => {
        it("should add enrichmentId UUID when enabled", () => {
            const input = JSON.stringify({ data: "test" });
            const config = JSON.stringify({ addUuid: true, addTimestamp: false });
            const result = action.execute(input, config);

            const output = JSON.parse(result.outputJson);

            // UUID v4 format
            expect(output.enrichmentId).toMatch(
                /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
            );
        });

        it("should not add UUID by default", () => {
            const input = JSON.stringify({ data: "test" });
            const result = action.execute(input, "{}");

            const output = JSON.parse(result.outputJson);
            expect(output).not.toHaveProperty("enrichmentId");
        });

        it("should generate unique UUIDs for each execution", () => {
            const config = JSON.stringify({ addUuid: true, addTimestamp: false });

            const result1 = action.execute(JSON.stringify({ a: 1 }), config);
            const result2 = action.execute(JSON.stringify({ a: 1 }), config);

            const output1 = JSON.parse(result1.outputJson);
            const output2 = JSON.parse(result2.outputJson);

            expect(output1.enrichmentId).not.toBe(output2.enrichmentId);
        });
    });

    describe("Custom Fields", () => {
        it("should add string custom fields", () => {
            const input = JSON.stringify({ data: "test" });
            const config = JSON.stringify({
                addTimestamp: false,
                customFields: {
                    source: "webhook",
                    version: "1.0"
                }
            });
            const result = action.execute(input, config);

            const output = JSON.parse(result.outputJson);
            expect(output.source).toBe("webhook");
            expect(output.version).toBe("1.0");
        });

        it("should add numeric custom fields", () => {
            const input = JSON.stringify({ data: "test" });
            const config = JSON.stringify({
                addTimestamp: false,
                customFields: {
                    priority: 1,
                    weight: 0.5
                }
            });
            const result = action.execute(input, config);

            const output = JSON.parse(result.outputJson);
            expect(output.priority).toBe(1);
            expect(output.weight).toBe(0.5);
        });

        it("should add boolean custom fields", () => {
            const input = JSON.stringify({ data: "test" });
            const config = JSON.stringify({
                addTimestamp: false,
                customFields: {
                    verified: true,
                    test: false
                }
            });
            const result = action.execute(input, config);

            const output = JSON.parse(result.outputJson);
            expect(output.verified).toBe(true);
            expect(output.test).toBe(false);
        });

        it("should overwrite existing fields with custom fields", () => {
            const input = JSON.stringify({
                data: "test",
                source: "original"
            });
            const config = JSON.stringify({
                addTimestamp: false,
                customFields: {
                    source: "overwritten"
                }
            });
            const result = action.execute(input, config);

            const output = JSON.parse(result.outputJson);
            expect(output.source).toBe("overwritten");
        });
    });

    describe("Combined Enrichments", () => {
        beforeEach(() => {
            vi.useFakeTimers();
            vi.setSystemTime(new Date("2024-06-20T15:45:00.000Z"));
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it("should apply all enrichments together", () => {
            const input = JSON.stringify({
                orderId: "ORD-2024-001",
                amount: 150.00
            });
            const config = JSON.stringify({
                addTimestamp: true,
                addHash: "orderId",
                addUuid: true,
                customFields: {
                    pipeline: "orders",
                    environment: "production"
                }
            });
            const result = action.execute(input, config);

            expect(result.success).toBe(true);
            const output = JSON.parse(result.outputJson);

            // Original fields preserved
            expect(output.orderId).toBe("ORD-2024-001");
            expect(output.amount).toBe(150.00);

            // Timestamp added
            expect(output.processedAt).toBe("2024-06-20T15:45:00.000Z");

            // Hash added
            expect(output.payloadHash).toMatch(/^[a-f0-9]{64}$/);

            // UUID added
            expect(output.enrichmentId).toMatch(
                /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
            );

            // Custom fields added
            expect(output.pipeline).toBe("orders");
            expect(output.environment).toBe("production");
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

        it("should reject invalid JSON payload", () => {
            const result = action.execute("{invalid}", "{}");

            expect(result.success).toBe(false);
            expect(result.reason).toBe("Invalid JSON payload.");
        });

        it("should reject invalid configuration JSON", () => {
            const input = JSON.stringify({ data: "test" });
            const result = action.execute(input, "{invalid config}");

            expect(result.success).toBe(false);
            expect(result.reason).toBe("Invalid action configuration.");
        });
    });

    describe("Real-World Scenarios", () => {
        beforeEach(() => {
            vi.useFakeTimers();
            vi.setSystemTime(new Date("2024-03-10T08:00:00.000Z"));
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it("should enrich e-commerce order for audit trail", () => {
            const input = JSON.stringify({
                orderId: "ORD-2024-12345",
                customerId: "CUST-001",
                items: [
                    { sku: "PROD-A", quantity: 2 },
                    { sku: "PROD-B", quantity: 1 }
                ],
                total: 299.99
            });
            const config = JSON.stringify({
                addTimestamp: true,
                addHash: "orderId",
                addUuid: true,
                customFields: {
                    source: "checkout-webhook",
                    version: "2.1",
                    region: "us-east-1"
                }
            });
            const result = action.execute(input, config);

            const output = JSON.parse(result.outputJson);

            // Verify all original data preserved
            expect(output.orderId).toBe("ORD-2024-12345");
            expect(output.customerId).toBe("CUST-001");
            expect(output.items).toHaveLength(2);
            expect(output.total).toBe(299.99);

            // Verify enrichments for audit trail
            expect(output.processedAt).toBe("2024-03-10T08:00:00.000Z");
            expect(output.payloadHash).toBeDefined();
            expect(output.enrichmentId).toBeDefined();
            expect(output.source).toBe("checkout-webhook");
            expect(output.version).toBe("2.1");
            expect(output.region).toBe("us-east-1");
        });

        it("should enrich payment notification for compliance", () => {
            const input = JSON.stringify({
                transactionId: "TXN-9876543",
                amount: 1000.00,
                currency: "USD",
                status: "completed",
                payer: {
                    id: "PAY-001",
                    name: "John Doe"
                }
            });
            const config = JSON.stringify({
                addTimestamp: true,
                addHash: "transactionId",
                customFields: {
                    compliance: "PCI-DSS",
                    processorVersion: "3.2.1"
                }
            });
            const result = action.execute(input, config);

            const output = JSON.parse(result.outputJson);

            expect(output.transactionId).toBe("TXN-9876543");
            expect(output.processedAt).toBe("2024-03-10T08:00:00.000Z");
            expect(output.payloadHash).toBeDefined();
            expect(output.compliance).toBe("PCI-DSS");
        });

        it("should enrich user event for analytics", () => {
            const input = JSON.stringify({
                eventType: "user.signup",
                userId: "usr_new_user_123",
                properties: {
                    plan: "premium",
                    referrer: "google"
                }
            });
            const config = JSON.stringify({
                addTimestamp: true,
                addUuid: true,
                customFields: {
                    analyticsVersion: "4.0",
                    environment: "production",
                    processed: true
                }
            });
            const result = action.execute(input, config);

            const output = JSON.parse(result.outputJson);

            expect(output.eventType).toBe("user.signup");
            expect(output.enrichmentId).toBeDefined();
            expect(output.analyticsVersion).toBe("4.0");
            expect(output.processed).toBe(true);
        });
    });

    describe("Edge Cases", () => {
        it("should handle payload with existing processedAt field", () => {
            const input = JSON.stringify({
                data: "test",
                processedAt: "2020-01-01T00:00:00.000Z"
            });
            const result = action.execute(input, "{}");

            const output = JSON.parse(result.outputJson);
            // Should overwrite with new timestamp
            expect(output.processedAt).not.toBe("2020-01-01T00:00:00.000Z");
        });

        it("should handle empty payload", () => {
            const input = JSON.stringify({});
            const result = action.execute(input, "{}");

            expect(result.success).toBe(true);
            const output = JSON.parse(result.outputJson);
            expect(output.processedAt).toBeDefined();
        });

        it("should handle payload with nested structures", () => {
            const input = JSON.stringify({
                level1: {
                    level2: {
                        level3: {
                            deep: "value"
                        }
                    }
                }
            });
            const config = JSON.stringify({
                addUuid: true,
                addTimestamp: false
            });
            const result = action.execute(input, config);

            const output = JSON.parse(result.outputJson);
            expect(output.level1.level2.level3.deep).toBe("value");
            expect(output.enrichmentId).toBeDefined();
        });

        it("should handle payload with arrays", () => {
            const input = JSON.stringify({
                items: [1, 2, 3],
                tags: ["a", "b", "c"]
            });
            const config = JSON.stringify({
                addTimestamp: false,
                customFields: { count: 6 }
            });
            const result = action.execute(input, config);

            const output = JSON.parse(result.outputJson);
            expect(output.items).toEqual([1, 2, 3]);
            expect(output.tags).toEqual(["a", "b", "c"]);
            expect(output.count).toBe(6);
        });
    });
});
