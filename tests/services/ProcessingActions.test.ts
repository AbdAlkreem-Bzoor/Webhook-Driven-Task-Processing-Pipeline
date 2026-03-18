import { describe, it, expect } from "vitest";
import { ValidateSchemaAction } from "../../src/services/ProcessingActions/ValidateSchemaAction.js";
import { NormalizePaymentAction } from "../../src/services/ProcessingActions/NormalizePaymentAction.js";
import { EnrichPaymentAction } from "../../src/services/ProcessingActions/EnrichPaymentAction.js";
import { VerifyPaymentAction } from "../../src/services/ProcessingActions/VerifyPaymentAction.js";
import { SummarizeLineItemsAction } from "../../src/services/ProcessingActions/SummarizeLineItemsAction.js";
import { ProcessingActionType } from "../../src/services/ProcessingActions/ProcessingAction.js";

const validPayload = {
    transactionId: "txn-123",
    amount: 99.99,
    currency: "USD",
    status: "completed",
    customerEmail: "test@example.com",
};

const validPayloadWithLineItems = {
    ...validPayload,
    lineItems: [
        { name: "Item 1", quantity: 2, unitPrice: 10.00 },
        { name: "Item 2", quantity: 1, unitPrice: 25.50 },
    ],
};

describe("ValidateSchemaAction", () => {
    const action = new ValidateSchemaAction();

    it("has correct action type", () => {
        expect(action.actionType).toBe(ProcessingActionType.ValidateSchema);
    });

    it("accepts valid payload", () => {
        const result = action.execute(JSON.stringify(validPayload), "{}");
        expect(result.success).toBe(true);
        expect(result.outputJson).toBe(JSON.stringify(validPayload));
    });

    it("accepts valid payload with line items", () => {
        const result = action.execute(JSON.stringify(validPayloadWithLineItems), "{}");
        expect(result.success).toBe(true);
    });

    it("rejects invalid JSON", () => {
        const result = action.execute("not valid json", "{}");
        expect(result.success).toBe(false);
        expect(result.reason).toContain("Invalid JSON");
    });

    it("rejects non-object payload", () => {
        const result = action.execute(JSON.stringify([1, 2, 3]), "{}");
        expect(result.success).toBe(false);
        expect(result.reason).toContain("must be a JSON object");
    });

    it("rejects missing transactionId", () => {
        const payload = { ...validPayload, transactionId: undefined };
        const result = action.execute(JSON.stringify(payload), "{}");
        expect(result.success).toBe(false);
        expect(result.reason).toContain("transactionId");
    });

    it("rejects missing amount", () => {
        const payload = { ...validPayload, amount: undefined };
        const result = action.execute(JSON.stringify(payload), "{}");
        expect(result.success).toBe(false);
        expect(result.reason).toContain("amount");
    });

    it("rejects invalid amount type", () => {
        const payload = { ...validPayload, amount: "not-a-number" };
        const result = action.execute(JSON.stringify(payload), "{}");
        expect(result.success).toBe(false);
        expect(result.reason).toContain("amount");
    });

    it("rejects missing currency", () => {
        const payload = { ...validPayload, currency: "" };
        const result = action.execute(JSON.stringify(payload), "{}");
        expect(result.success).toBe(false);
        expect(result.reason).toContain("currency");
    });

    it("rejects missing status", () => {
        const payload = { ...validPayload, status: "" };
        const result = action.execute(JSON.stringify(payload), "{}");
        expect(result.success).toBe(false);
        expect(result.reason).toContain("status");
    });

    it("rejects missing customerEmail", () => {
        const payload = { ...validPayload, customerEmail: "" };
        const result = action.execute(JSON.stringify(payload), "{}");
        expect(result.success).toBe(false);
        expect(result.reason).toContain("customerEmail");
    });

    it("rejects invalid lineItems structure", () => {
        const payload = { ...validPayload, lineItems: "not-an-array" };
        const result = action.execute(JSON.stringify(payload), "{}");
        expect(result.success).toBe(false);
        expect(result.reason).toContain("lineItems");
    });

    it("rejects invalid line item fields", () => {
        const payload = {
            ...validPayload,
            lineItems: [{ name: 123, quantity: "two", unitPrice: null }],
        };
        const result = action.execute(JSON.stringify(payload), "{}");
        expect(result.success).toBe(false);
        expect(result.reason).toContain("lineItems[0]");
    });
});

describe("NormalizePaymentAction", () => {
    const action = new NormalizePaymentAction();

    it("has correct action type", () => {
        expect(action.actionType).toBe(ProcessingActionType.NormalizePayment);
    });

    it("uppercases currency code", () => {
        const payload = { ...validPayload, currency: "usd" };
        const result = action.execute(JSON.stringify(payload), "{}");
        const output = JSON.parse(result.outputJson);
        expect(output.currency).toBe("USD");
    });

    it("lowercases and trims email", () => {
        const payload = { ...validPayload, customerEmail: "  TEST@EXAMPLE.COM  " };
        const result = action.execute(JSON.stringify(payload), "{}");
        const output = JSON.parse(result.outputJson);
        expect(output.customerEmail).toBe("test@example.com");
    });

    it("trims transactionId", () => {
        const payload = { ...validPayload, transactionId: "  txn-123  " };
        const result = action.execute(JSON.stringify(payload), "{}");
        const output = JSON.parse(result.outputJson);
        expect(output.transactionId).toBe("txn-123");
    });

    it("lowercases status", () => {
        const payload = { ...validPayload, status: "COMPLETED" };
        const result = action.execute(JSON.stringify(payload), "{}");
        const output = JSON.parse(result.outputJson);
        expect(output.status).toBe("completed");
    });

    it("rounds amount to 2 decimals", () => {
        const payload = { ...validPayload, amount: 99.999 };
        const result = action.execute(JSON.stringify(payload), "{}");
        const output = JSON.parse(result.outputJson);
        expect(output.amount).toBe(100);
    });

    it("normalizes line items", () => {
        const payload = {
            ...validPayload,
            lineItems: [{ name: "  Item  ", quantity: 2, unitPrice: 10.999 }],
        };
        const result = action.execute(JSON.stringify(payload), "{}");
        const output = JSON.parse(result.outputJson);
        expect(output.lineItems[0].name).toBe("Item");
        expect(output.lineItems[0].unitPrice).toBe(11);
    });

    it("always returns success", () => {
        const result = action.execute(JSON.stringify(validPayload), "{}");
        expect(result.success).toBe(true);
    });
});

describe("EnrichPaymentAction", () => {
    const action = new EnrichPaymentAction();

    it("has correct action type", () => {
        expect(action.actionType).toBe(ProcessingActionType.EnrichPayment);
    });

    it("adds processedAt timestamp", () => {
        const result = action.execute(JSON.stringify(validPayload), "{}");
        const output = JSON.parse(result.outputJson);
        expect(output.processedAt).toBeDefined();
        expect(new Date(output.processedAt).getTime()).toBeLessThanOrEqual(Date.now());
    });

    it("adds paymentHash", () => {
        const result = action.execute(JSON.stringify(validPayload), "{}");
        const output = JSON.parse(result.outputJson);
        expect(output.paymentHash).toBeDefined();
        expect(output.paymentHash).toHaveLength(64); // SHA-256 hex = 64 chars
    });

    it("generates consistent hash for same transactionId", () => {
        const result1 = action.execute(JSON.stringify(validPayload), "{}");
        const result2 = action.execute(JSON.stringify(validPayload), "{}");
        const output1 = JSON.parse(result1.outputJson);
        const output2 = JSON.parse(result2.outputJson);
        expect(output1.paymentHash).toBe(output2.paymentHash);
    });

    it("adds amountInCents", () => {
        const result = action.execute(JSON.stringify(validPayload), "{}");
        const output = JSON.parse(result.outputJson);
        expect(output.amountInCents).toBe(9999); // 99.99 * 100
    });

    it("preserves original fields", () => {
        const result = action.execute(JSON.stringify(validPayload), "{}");
        const output = JSON.parse(result.outputJson);
        expect(output.transactionId).toBe(validPayload.transactionId);
        expect(output.amount).toBe(validPayload.amount);
        expect(output.currency).toBe(validPayload.currency);
    });

    it("always returns success", () => {
        const result = action.execute(JSON.stringify(validPayload), "{}");
        expect(result.success).toBe(true);
    });
});

describe("VerifyPaymentAction", () => {
    const action = new VerifyPaymentAction();

    it("has correct action type", () => {
        expect(action.actionType).toBe(ProcessingActionType.VerifyPayment);
    });

    it("accepts valid payment", () => {
        const result = action.execute(JSON.stringify(validPayload), "{}");
        expect(result.success).toBe(true);
    });

    it("rejects zero amount", () => {
        const payload = { ...validPayload, amount: 0 };
        const result = action.execute(JSON.stringify(payload), "{}");
        expect(result.success).toBe(false);
        expect(result.reason).toContain("positive");
    });

    it("rejects negative amount", () => {
        const payload = { ...validPayload, amount: -10 };
        const result = action.execute(JSON.stringify(payload), "{}");
        expect(result.success).toBe(false);
        expect(result.reason).toContain("positive");
    });

    it("rejects invalid currency", () => {
        const payload = { ...validPayload, currency: "INVALID" };
        const result = action.execute(JSON.stringify(payload), "{}");
        expect(result.success).toBe(false);
        expect(result.reason).toContain("Invalid currency");
    });

    it("accepts all valid currencies", () => {
        const currencies = ["USD", "EUR", "GBP", "CAD", "AUD", "JPY", "CHF", "CNY", "INR", "BRL"];
        for (const currency of currencies) {
            const payload = { ...validPayload, currency };
            const result = action.execute(JSON.stringify(payload), "{}");
            expect(result.success).toBe(true);
        }
    });

    it("rejects invalid status", () => {
        const payload = { ...validPayload, status: "invalid" };
        const result = action.execute(JSON.stringify(payload), "{}");
        expect(result.success).toBe(false);
        expect(result.reason).toContain("Invalid status");
    });

    it("accepts all valid statuses", () => {
        const statuses = ["completed", "pending", "failed", "refunded"];
        for (const status of statuses) {
            const payload = { ...validPayload, status };
            const result = action.execute(JSON.stringify(payload), "{}");
            expect(result.success).toBe(true);
        }
    });

    it("rejects invalid email", () => {
        const payload = { ...validPayload, customerEmail: "not-an-email" };
        const result = action.execute(JSON.stringify(payload), "{}");
        expect(result.success).toBe(false);
        expect(result.reason).toContain("Invalid email");
    });

    it("reports multiple errors at once", () => {
        const payload = {
            ...validPayload,
            amount: -1,
            currency: "INVALID",
            status: "bad",
            customerEmail: "no-at-sign",
        };
        const result = action.execute(JSON.stringify(payload), "{}");
        expect(result.success).toBe(false);
        expect(result.reason).toContain("positive");
        expect(result.reason).toContain("Invalid currency");
        expect(result.reason).toContain("Invalid status");
        expect(result.reason).toContain("Invalid email");
    });
});

describe("SummarizeLineItemsAction", () => {
    const action = new SummarizeLineItemsAction();

    it("has correct action type", () => {
        expect(action.actionType).toBe(ProcessingActionType.SummarizeLineItems);
    });

    it("filters out payload with no lineItems", () => {
        const result = action.execute(JSON.stringify(validPayload), "{}");
        expect(result.success).toBe(false);
        expect(result.reason).toContain("No lineItems");
    });

    it("filters out payload with empty lineItems", () => {
        const payload = { ...validPayload, lineItems: [] };
        const result = action.execute(JSON.stringify(payload), "{}");
        expect(result.success).toBe(false);
        expect(result.reason).toContain("No lineItems");
    });

    it("calculates itemCount", () => {
        const result = action.execute(JSON.stringify(validPayloadWithLineItems), "{}");
        const output = JSON.parse(result.outputJson);
        expect(output.itemCount).toBe(2);
    });

    it("calculates subtotal correctly", () => {
        // 2 * 10.00 + 1 * 25.50 = 45.50
        const result = action.execute(JSON.stringify(validPayloadWithLineItems), "{}");
        const output = JSON.parse(result.outputJson);
        expect(output.subtotal).toBe(45.50);
    });

    it("calculates averageItemPrice correctly", () => {
        // (10.00 + 25.50) / 2 = 17.75
        const result = action.execute(JSON.stringify(validPayloadWithLineItems), "{}");
        const output = JSON.parse(result.outputJson);
        expect(output.averageItemPrice).toBe(17.75);
    });

    it("rounds subtotal to 2 decimals", () => {
        const payload = {
            ...validPayload,
            lineItems: [
                { name: "Item", quantity: 3, unitPrice: 10.333 },
            ],
        };
        const result = action.execute(JSON.stringify(payload), "{}");
        const output = JSON.parse(result.outputJson);
        expect(output.subtotal).toBe(31); // 3 * 10.333 = 30.999, rounded
    });

    it("preserves original fields", () => {
        const result = action.execute(JSON.stringify(validPayloadWithLineItems), "{}");
        const output = JSON.parse(result.outputJson);
        expect(output.transactionId).toBe(validPayload.transactionId);
        expect(output.amount).toBe(validPayload.amount);
        expect(output.lineItems).toBeDefined();
    });

    it("returns success when lineItems present", () => {
        const result = action.execute(JSON.stringify(validPayloadWithLineItems), "{}");
        expect(result.success).toBe(true);
    });
});
