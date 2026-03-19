import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ValidateAction } from "../src/processing-actions/ValidateAction.js";
import { TransformAction } from "../src/processing-actions/TransformAction.js";
import { EnrichAction } from "../src/processing-actions/EnrichAction.js";
import { ProcessingActionResult, ProcessingActionType } from "../src/processing-actions/ProcessingAction.js";


describe("Pipeline Integration - Full Data Flow", () => {
    const validateAction = new ValidateAction();
    const transformAction = new TransformAction();
    const enrichAction = new EnrichAction();

    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2024-06-15T12:00:00.000Z"));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    function executePipeline(
        payload: string,
        actions: Array<{
            action: { execute: (input: string, config: string) => ProcessingActionResult };
            config: string;
        }>
    ): ProcessingActionResult {
        let currentPayload = payload;

        for (const { action, config } of actions) {
            const result = action.execute(currentPayload, config);

            if (!result.success) {
                return result;
            }

            currentPayload = result.outputJson;
        }

        return { success: true, outputJson: currentPayload };
    }

    describe("Successful Pipeline Execution", () => {
        it("should process e-commerce order through complete pipeline", () => {
            const incomingPayload = JSON.stringify({
                orderId: "  ORD-2024-001  ",
                amount: 149.9999,
                email: "   CUSTOMER@SHOP.COM   ",
                status: "  completed  ",
                items: [
                    { sku: "  SKU-A  ", name: "  Widget Pro  ", quantity: 2, price: 49.995 },
                    { sku: "  SKU-B  ", name: "  Gadget Plus  ", quantity: 1, price: 50.005 }
                ]
            });

            const result = executePipeline(incomingPayload, [
                {
                    action: validateAction,
                    config: JSON.stringify({ requiredFields: ["orderId", "amount", "email"] })
                },
                {
                    action: transformAction,
                    config: JSON.stringify({
                        trimStrings: true,
                        lowercaseFields: ["email"],
                        roundNumbers: 2
                    })
                },
                {
                    action: enrichAction,
                    config: JSON.stringify({
                        addTimestamp: true,
                        addHash: "orderId",
                        addUuid: true,
                        customFields: { pipeline: "orders", version: "1.0" }
                    })
                }
            ]);

            expect(result.success).toBe(true);

            const processedPayload = JSON.parse(result.outputJson);

            expect(processedPayload.orderId).toBeDefined();
            expect(processedPayload.amount).toBeDefined();
            expect(processedPayload.email).toBeDefined();

            expect(processedPayload.orderId).toBe("ORD-2024-001"); 
            expect(processedPayload.amount).toBe(150); // rounded
            expect(processedPayload.email).toBe("customer@shop.com");
            expect(processedPayload.status).toBe("completed");
            expect(processedPayload.items[0].name).toBe("Widget Pro");
            expect(processedPayload.items[0].price).toBe(50); 

            expect(processedPayload.processedAt).toBe("2024-06-15T12:00:00.000Z");
            expect(processedPayload.payloadHash).toMatch(/^[a-f0-9]{64}$/);
            expect(processedPayload.enrichmentId).toMatch(
                /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
            );
            expect(processedPayload.pipeline).toBe("orders");
            expect(processedPayload.version).toBe("1.0");
        });

        it("should process payment webhook through pipeline", () => {
            const incomingPayload = JSON.stringify({
                transactionId: "  TXN-99999  ",
                amount: 500.12345,
                currency: "usd",
                recipientEmail: "  RECIPIENT@BANK.COM  ",
                status: "success",
                metadata: {
                    invoiceId: "  INV-001  ",
                    description: "  Monthly subscription  "
                }
            });

            const result = executePipeline(incomingPayload, [
                {
                    action: validateAction,
                    config: JSON.stringify({ requiredFields: ["transactionId", "amount", "status"] })
                },
                {
                    action: transformAction,
                    config: JSON.stringify({
                        trimStrings: true,
                        uppercaseFields: ["currency"],
                        lowercaseFields: ["recipientEmail"],
                        roundNumbers: 2
                    })
                },
                {
                    action: enrichAction,
                    config: JSON.stringify({
                        addTimestamp: true,
                        addHash: "transactionId",
                        customFields: { processor: "stripe", region: "us-west-2" }
                    })
                }
            ]);

            expect(result.success).toBe(true);

            const processedPayload = JSON.parse(result.outputJson);

            expect(processedPayload.transactionId).toBe("TXN-99999");
            expect(processedPayload.amount).toBe(500.12);
            expect(processedPayload.currency).toBe("USD");
            expect(processedPayload.recipientEmail).toBe("recipient@bank.com");
            expect(processedPayload.metadata.invoiceId).toBe("INV-001");

            expect(processedPayload.processedAt).toBeDefined();
            expect(processedPayload.payloadHash).toBeDefined();
            expect(processedPayload.processor).toBe("stripe");
        });

        it("should process user registration event through pipeline", () => {
            const incomingPayload = JSON.stringify({
                eventType: "  USER.CREATED  ",
                userId: "  usr_abc123  ",
                email: "   NEWUSER@COMPANY.COM   ",
                profile: {
                    firstName: "  John  ",
                    lastName: "  Doe  ",
                    company: "  Acme Corp  "
                },
                createdAt: "2024-06-15T11:00:00Z"
            });

            const result = executePipeline(incomingPayload, [
                {
                    action: validateAction,
                    config: JSON.stringify({ requiredFields: ["eventType", "userId", "email"] })
                },
                {
                    action: transformAction,
                    config: JSON.stringify({
                        trimStrings: true,
                        lowercaseFields: ["email", "eventType"]
                    })
                },
                {
                    action: enrichAction,
                    config: JSON.stringify({
                        addTimestamp: true,
                        addUuid: true,
                        customFields: { source: "auth-service", environment: "production" }
                    })
                }
            ]);

            expect(result.success).toBe(true);

            const processedPayload = JSON.parse(result.outputJson);

            expect(processedPayload.eventType).toBe("user.created");
            expect(processedPayload.userId).toBe("usr_abc123");
            expect(processedPayload.email).toBe("newuser@company.com");
            expect(processedPayload.profile.firstName).toBe("John");
            expect(processedPayload.enrichmentId).toBeDefined();
            expect(processedPayload.source).toBe("auth-service");
        });
    });

    describe("Pipeline Filtering (Validation Failures)", () => {
        it("should filter payload missing required fields", () => {
            const incomingPayload = JSON.stringify({
                description: "Incomplete order",
                notes: "Missing orderId and amount"
            });

            const result = executePipeline(incomingPayload, [
                {
                    action: validateAction,
                    config: JSON.stringify({ requiredFields: ["orderId", "amount"] })
                },
                {
                    action: transformAction,
                    config: JSON.stringify({ trimStrings: true })
                },
                {
                    action: enrichAction,
                    config: JSON.stringify({ addTimestamp: true })
                }
            ]);

            expect(result.success).toBe(false);
            expect(result.reason).toContain("Missing required fields");
            expect(result.reason).toContain("orderId");
            expect(result.reason).toContain("amount");
        });

        it("should filter empty payload", () => {
            const incomingPayload = "{}";

            const result = executePipeline(incomingPayload, [
                {
                    action: validateAction,
                    config: JSON.stringify({})
                },
                {
                    action: transformAction,
                    config: JSON.stringify({ trimStrings: true })
                },
                {
                    action: enrichAction,
                    config: JSON.stringify({ addTimestamp: true })
                }
            ]);

            expect(result.success).toBe(false);
            expect(result.reason).toBe("Payload cannot be empty.");
        });

        it("should filter payload with null required field", () => {
            const incomingPayload = JSON.stringify({
                orderId: "ORD-001",
                amount: null,
                email: "test@example.com"
            });

            const result = executePipeline(incomingPayload, [
                {
                    action: validateAction,
                    config: JSON.stringify({ requiredFields: ["orderId", "amount", "email"] })
                },
                {
                    action: transformAction,
                    config: JSON.stringify({ trimStrings: true })
                },
                {
                    action: enrichAction,
                    config: JSON.stringify({ addTimestamp: true })
                }
            ]);

            expect(result.success).toBe(false);
            expect(result.reason).toContain("amount");
        });
    });

    describe("Partial Pipeline Configurations", () => {
        it("should work with validation only", () => {
            const incomingPayload = JSON.stringify({
                id: "123",
                data: "test value"
            });

            const result = executePipeline(incomingPayload, [
                {
                    action: validateAction,
                    config: JSON.stringify({ requiredFields: ["id", "data"] })
                }
            ]);

            expect(result.success).toBe(true);
            const output = JSON.parse(result.outputJson);
            expect(output.id).toBe("123");
            expect(output.data).toBe("test value");
        });

        it("should work with transform only", () => {
            const incomingPayload = JSON.stringify({
                email: "  USER@EXAMPLE.COM  ",
                amount: 99.999
            });

            const result = executePipeline(incomingPayload, [
                {
                    action: transformAction,
                    config: JSON.stringify({
                        trimStrings: true,
                        lowercaseFields: ["email"],
                        roundNumbers: 2
                    })
                }
            ]);

            expect(result.success).toBe(true);
            const output = JSON.parse(result.outputJson);
            expect(output.email).toBe("user@example.com");
            expect(output.amount).toBe(100);
        });

        it("should work with enrich only", () => {
            const incomingPayload = JSON.stringify({
                eventId: "EVT-001"
            });

            const result = executePipeline(incomingPayload, [
                {
                    action: enrichAction,
                    config: JSON.stringify({
                        addTimestamp: true,
                        addUuid: true,
                        customFields: { source: "direct" }
                    })
                }
            ]);

            expect(result.success).toBe(true);
            const output = JSON.parse(result.outputJson);
            expect(output.eventId).toBe("EVT-001");
            expect(output.processedAt).toBeDefined();
            expect(output.enrichmentId).toBeDefined();
            expect(output.source).toBe("direct");
        });

        it("should work with validate + transform (no enrich)", () => {
            const incomingPayload = JSON.stringify({
                orderId: "  ORD-001  ",
                amount: 99.999,
                email: "  TEST@MAIL.COM  "
            });

            const result = executePipeline(incomingPayload, [
                {
                    action: validateAction,
                    config: JSON.stringify({ requiredFields: ["orderId", "amount"] })
                },
                {
                    action: transformAction,
                    config: JSON.stringify({
                        trimStrings: true,
                        lowercaseFields: ["email"],
                        roundNumbers: 2
                    })
                }
            ]);

            expect(result.success).toBe(true);
            const output = JSON.parse(result.outputJson);
            expect(output.orderId).toBe("ORD-001");
            expect(output.amount).toBe(100);
            expect(output.email).toBe("test@mail.com");
            expect(output.processedAt).toBeUndefined();
        });

        it("should work with validate + enrich (no transform)", () => {
            const incomingPayload = JSON.stringify({
                id: "123",
                data: "  not trimmed  "
            });

            const result = executePipeline(incomingPayload, [
                {
                    action: validateAction,
                    config: JSON.stringify({ requiredFields: ["id"] })
                },
                {
                    action: enrichAction,
                    config: JSON.stringify({
                        addTimestamp: true,
                        addHash: "id"
                    })
                }
            ]);

            expect(result.success).toBe(true);
            const output = JSON.parse(result.outputJson);
            expect(output.data).toBe("  not trimmed  ");
            expect(output.processedAt).toBeDefined();
            expect(output.payloadHash).toBeDefined();
        });
    });

    describe("Data Transformation Visibility", () => {
        it("should show complete before/after comparison", () => {
            const beforePayload = {
                orderId: "  ORD-DEMO-001  ",
                amount: 199.9876543,
                customerEmail: "   DEMO.CUSTOMER@EXAMPLE.COM   ",
                status: "  PENDING  ",
                items: [
                    { name: "  Demo Product  ", price: 99.99666, quantity: 2 }
                ],
                shipping: {
                    address: "  123 Demo Street  ",
                    countryCode: "us"
                }
            };

            const result = executePipeline(JSON.stringify(beforePayload), [
                {
                    action: validateAction,
                    config: JSON.stringify({ requiredFields: ["orderId", "amount"] })
                },
                {
                    action: transformAction,
                    config: JSON.stringify({
                        trimStrings: true,
                        lowercaseFields: ["customerEmail"],
                        uppercaseFields: ["countryCode"],
                        roundNumbers: 2
                    })
                },
                {
                    action: enrichAction,
                    config: JSON.stringify({
                        addTimestamp: true,
                        addHash: "orderId",
                        addUuid: true,
                        customFields: {
                            pipelineName: "demo-pipeline",
                            processedBy: "webhook-service"
                        }
                    })
                }
            ]);

            expect(result.success).toBe(true);

            const afterPayload = JSON.parse(result.outputJson);

            console.log("\n=== PIPELINE TRANSFORMATION DEMO ===\n");
            console.log("BEFORE (Raw Webhook):");
            console.log(JSON.stringify(beforePayload, null, 2));
            console.log("\nAFTER (Processed Payload):");
            console.log(JSON.stringify(afterPayload, null, 2));
            console.log("\n=== TRANSFORMATIONS APPLIED ===");
            console.log(`orderId: "${beforePayload.orderId}" -> "${afterPayload.orderId}"`);
            console.log(`amount: ${beforePayload.amount} -> ${afterPayload.amount}`);
            console.log(`customerEmail: "${beforePayload.customerEmail}" -> "${afterPayload.customerEmail}"`);
            console.log(`countryCode: "${beforePayload.shipping.countryCode}" -> "${afterPayload.shipping.countryCode}"`);
            console.log("\n=== ENRICHMENTS ADDED ===");
            console.log(`processedAt: ${afterPayload.processedAt}`);
            console.log(`payloadHash: ${afterPayload.payloadHash}`);
            console.log(`enrichmentId: ${afterPayload.enrichmentId}`);
            console.log(`pipelineName: ${afterPayload.pipelineName}`);
            console.log("=====================================\n");

            expect(afterPayload.orderId).toBe("ORD-DEMO-001");
            expect(afterPayload.amount).toBe(199.99);
            expect(afterPayload.customerEmail).toBe("demo.customer@example.com");
            expect(afterPayload.shipping.countryCode).toBe("US");
            expect(afterPayload.processedAt).toBeDefined();
            expect(afterPayload.payloadHash).toBeDefined();
            expect(afterPayload.enrichmentId).toBeDefined();
        });
    });

    describe("Action Type Identifiers", () => {
        it("should have correct action types for pipeline ordering", () => {
            expect(validateAction.actionType).toBe(ProcessingActionType.Validate);
            expect(transformAction.actionType).toBe(ProcessingActionType.Transform);
            expect(enrichAction.actionType).toBe(ProcessingActionType.Enrich);

            expect(ProcessingActionType.Validate).toBe("Validate");
            expect(ProcessingActionType.Transform).toBe("Transform");
            expect(ProcessingActionType.Enrich).toBe("Enrich");
        });
    });
});
