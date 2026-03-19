import { describe, it, expect } from "vitest";
import { TransformAction } from "../src/processing-actions/TransformAction.js";
import { ProcessingActionType } from "../src/processing-actions/ProcessingAction.js";


describe("TransformAction", () => {
    const action = new TransformAction();

    describe("Action Type", () => {
        it("should have correct action type identifier", () => {
            expect(action.actionType).toBe(ProcessingActionType.Transform);
        });
    });

    describe("String Trimming", () => {
        it("should trim whitespace from string values by default", () => {
            const input = JSON.stringify({
                name: "  John Doe  ",
                email: "   test@example.com   "
            });
            const result = action.execute(input, "{}");

            expect(result.success).toBe(true);
            const output = JSON.parse(result.outputJson);
            expect(output.name).toBe("John Doe");
            expect(output.email).toBe("test@example.com");
        });

        it("should trim strings with tabs and newlines", () => {
            const input = JSON.stringify({
                text: "\t  Hello World  \n"
            });
            const result = action.execute(input, "{}");

            const output = JSON.parse(result.outputJson);
            expect(output.text).toBe("Hello World");
        });

        it("should not trim when trimStrings is false", () => {
            const input = JSON.stringify({ name: "  padded  " });
            const config = JSON.stringify({ trimStrings: false });
            const result = action.execute(input, config);

            const output = JSON.parse(result.outputJson);
            expect(output.name).toBe("  padded  ");
        });

        it("should trim strings in nested objects", () => {
            const input = JSON.stringify({
                user: {
                    firstName: "  Alice  ",
                    lastName: "  Smith  "
                }
            });
            const result = action.execute(input, "{}");

            const output = JSON.parse(result.outputJson);
            expect(output.user.firstName).toBe("Alice");
            expect(output.user.lastName).toBe("Smith");
        });

        it("should trim strings in arrays", () => {
            const input = JSON.stringify({
                tags: ["  tag1  ", "  tag2  ", "  tag3  "]
            });
            const result = action.execute(input, "{}");

            const output = JSON.parse(result.outputJson);
            expect(output.tags).toEqual(["tag1", "tag2", "tag3"]);
        });

        it("should trim strings in objects within arrays", () => {
            const input = JSON.stringify({
                items: [
                    { name: "  Item A  " },
                    { name: "  Item B  " }
                ]
            });
            const result = action.execute(input, "{}");

            const output = JSON.parse(result.outputJson);
            expect(output.items[0].name).toBe("Item A");
            expect(output.items[1].name).toBe("Item B");
        });
    });

    describe("Case Conversion - Lowercase", () => {
        it("should convert specified fields to lowercase", () => {
            const input = JSON.stringify({
                email: "USER@EXAMPLE.COM",
                username: "JOHNDOE"
            });
            const config = JSON.stringify({
                lowercaseFields: ["email", "username"]
            });
            const result = action.execute(input, config);

            const output = JSON.parse(result.outputJson);
            expect(output.email).toBe("user@example.com");
            expect(output.username).toBe("johndoe");
        });

        it("should only lowercase specified fields, leave others unchanged", () => {
            const input = JSON.stringify({
                email: "USER@EXAMPLE.COM",
                displayName: "JOHN DOE"
            });
            const config = JSON.stringify({
                lowercaseFields: ["email"]
            });
            const result = action.execute(input, config);

            const output = JSON.parse(result.outputJson);
            expect(output.email).toBe("user@example.com");
            expect(output.displayName).toBe("JOHN DOE");
        });

        it("should handle mixed case conversion", () => {
            const input = JSON.stringify({
                email: "Test.User@Example.COM"
            });
            const config = JSON.stringify({
                lowercaseFields: ["email"]
            });
            const result = action.execute(input, config);

            const output = JSON.parse(result.outputJson);
            expect(output.email).toBe("test.user@example.com");
        });
    });

    describe("Case Conversion - Uppercase", () => {
        it("should convert specified fields to uppercase", () => {
            const input = JSON.stringify({
                countryCode: "us",
                currency: "usd"
            });
            const config = JSON.stringify({
                uppercaseFields: ["countryCode", "currency"]
            });
            const result = action.execute(input, config);

            const output = JSON.parse(result.outputJson);
            expect(output.countryCode).toBe("US");
            expect(output.currency).toBe("USD");
        });

        it("should handle both lowercase and uppercase in same config", () => {
            const input = JSON.stringify({
                email: "USER@EXAMPLE.COM",
                countryCode: "gb"
            });
            const config = JSON.stringify({
                lowercaseFields: ["email"],
                uppercaseFields: ["countryCode"]
            });
            const result = action.execute(input, config);

            const output = JSON.parse(result.outputJson);
            expect(output.email).toBe("user@example.com");
            expect(output.countryCode).toBe("GB");
        });
    });

    describe("Number Rounding", () => {
        it("should round numbers to 2 decimal places by default", () => {
            const input = JSON.stringify({
                price: 99.9999,
                tax: 8.12345
            });
            const result = action.execute(input, "{}");

            const output = JSON.parse(result.outputJson);
            expect(output.price).toBe(100);
            expect(output.tax).toBe(8.12);
        });

        it("should round to specified decimal places", () => {
            const input = JSON.stringify({
                amount: 123.456789
            });
            const config = JSON.stringify({ roundNumbers: 4 });
            const result = action.execute(input, config);

            const output = JSON.parse(result.outputJson);
            expect(output.amount).toBe(123.4568);
        });

        it("should round to 0 decimal places (integers)", () => {
            const input = JSON.stringify({
                quantity: 5.7,
                count: 10.3
            });
            const config = JSON.stringify({ roundNumbers: 0 });
            const result = action.execute(input, config);

            const output = JSON.parse(result.outputJson);
            expect(output.quantity).toBe(6);
            expect(output.count).toBe(10);
        });

        it("should round numbers in nested objects", () => {
            const input = JSON.stringify({
                order: {
                    subtotal: 99.999,
                    tax: 8.123
                }
            });
            const result = action.execute(input, "{}");

            const output = JSON.parse(result.outputJson);
            expect(output.order.subtotal).toBe(100);
            expect(output.order.tax).toBe(8.12);
        });

        it("should round numbers in arrays", () => {
            const input = JSON.stringify({
                prices: [10.125, 20.999, 30.001]
            });
            const result = action.execute(input, "{}");

            const output = JSON.parse(result.outputJson);
            expect(output.prices).toEqual([10.13, 21, 30]);
        });

        it("should preserve integers without adding decimals", () => {
            const input = JSON.stringify({
                count: 5,
                quantity: 100
            });
            const result = action.execute(input, "{}");

            const output = JSON.parse(result.outputJson);
            expect(output.count).toBe(5);
            expect(output.quantity).toBe(100);
        });
    });

    describe("Null Removal", () => {
        it("should keep null values by default", () => {
            const input = JSON.stringify({
                name: "John",
                middleName: null
            });
            const result = action.execute(input, "{}");

            const output = JSON.parse(result.outputJson);
            expect(output).toHaveProperty("middleName");
            expect(output.middleName).toBeNull();
        });

        it("should remove null values when removeNulls is true", () => {
            const input = JSON.stringify({
                name: "John",
                middleName: null,
                email: "john@example.com"
            });
            const config = JSON.stringify({ removeNulls: true });
            const result = action.execute(input, config);

            const output = JSON.parse(result.outputJson);
            expect(output).not.toHaveProperty("middleName");
            expect(output.name).toBe("John");
            expect(output.email).toBe("john@example.com");
        });

        it("should remove undefined values when removeNulls is true", () => {
            const payload = { name: "John", extra: undefined };
            const input = JSON.stringify(payload);
            const config = JSON.stringify({ removeNulls: true });
            const result = action.execute(input, config);

            const output = JSON.parse(result.outputJson);
            expect(output).not.toHaveProperty("extra");
        });
    });

    describe("Configuration Handling", () => {
        it("should work with empty configuration", () => {
            const input = JSON.stringify({ data: "test" });
            const result = action.execute(input, "");

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
        it("should clean messy e-commerce order data", () => {
            const input = JSON.stringify({
                orderId: "  ORD-001  ",
                amount: 149.9999,
                email: "   CUSTOMER@SHOP.COM   ",
                status: "  pending  ",
                items: [
                    { name: "  Product A  ", price: 49.999 },
                    { name: "  Product B  ", price: 100.001 }
                ]
            });
            const config = JSON.stringify({
                trimStrings: true,
                lowercaseFields: ["email"],
                roundNumbers: 2
            });
            const result = action.execute(input, config);

            expect(result.success).toBe(true);
            const output = JSON.parse(result.outputJson);

            expect(output.orderId).toBe("ORD-001");
            expect(output.amount).toBe(150);
            expect(output.email).toBe("customer@shop.com");
            expect(output.status).toBe("pending");
            expect(output.items[0].name).toBe("Product A");
            expect(output.items[0].price).toBe(50);
            expect(output.items[1].name).toBe("Product B");
            expect(output.items[1].price).toBe(100);
        });

        it("should normalize payment webhook", () => {
            const input = JSON.stringify({
                transactionId: "  TXN-12345  ",
                amount: 500.12345,
                currency: "usd",
                recipientEmail: "  RECIPIENT@BANK.COM  ",
                status: null
            });
            const config = JSON.stringify({
                trimStrings: true,
                uppercaseFields: ["currency"],
                lowercaseFields: ["recipientEmail"],
                roundNumbers: 2,
                removeNulls: true
            });
            const result = action.execute(input, config);

            const output = JSON.parse(result.outputJson);

            expect(output.transactionId).toBe("TXN-12345");
            expect(output.amount).toBe(500.12);
            expect(output.currency).toBe("USD");
            expect(output.recipientEmail).toBe("recipient@bank.com");
            expect(output).not.toHaveProperty("status");
        });

        it("should handle deeply nested user profile data", () => {
            const input = JSON.stringify({
                userId: "  USR-001  ",
                profile: {
                    personal: {
                        firstName: "  John  ",
                        lastName: "  Doe  ",
                        email: "   JOHN.DOE@COMPANY.COM   "
                    },
                    address: {
                        street: "  123 Main St  ",
                        countryCode: "us"
                    }
                },
                metadata: {
                    score: 95.6789
                }
            });
            const config = JSON.stringify({
                trimStrings: true,
                lowercaseFields: ["email"],
                uppercaseFields: ["countryCode"],
                roundNumbers: 1
            });
            const result = action.execute(input, config);

            const output = JSON.parse(result.outputJson);

            expect(output.userId).toBe("USR-001");
            expect(output.profile.personal.firstName).toBe("John");
            expect(output.profile.personal.lastName).toBe("Doe");
            expect(output.profile.address.street).toBe("123 Main St");
            expect(output.metadata.score).toBe(95.7);
        });
    });

    describe("Edge Cases", () => {
        it("should handle empty strings", () => {
            const input = JSON.stringify({ value: "" });
            const result = action.execute(input, "{}");

            const output = JSON.parse(result.outputJson);
            expect(output.value).toBe("");
        });

        it("should handle zero values", () => {
            const input = JSON.stringify({ count: 0, amount: 0.0 });
            const result = action.execute(input, "{}");

            const output = JSON.parse(result.outputJson);
            expect(output.count).toBe(0);
            expect(output.amount).toBe(0);
        });

        it("should handle boolean values", () => {
            const input = JSON.stringify({ active: true, deleted: false });
            const result = action.execute(input, "{}");

            const output = JSON.parse(result.outputJson);
            expect(output.active).toBe(true);
            expect(output.deleted).toBe(false);
        });

        it("should handle empty arrays", () => {
            const input = JSON.stringify({ items: [] });
            const result = action.execute(input, "{}");

            const output = JSON.parse(result.outputJson);
            expect(output.items).toEqual([]);
        });

        it("should handle empty nested objects", () => {
            const input = JSON.stringify({ metadata: {} });
            const result = action.execute(input, "{}");

            const output = JSON.parse(result.outputJson);
            expect(output.metadata).toEqual({});
        });

        it("should handle negative numbers", () => {
            const input = JSON.stringify({ balance: -123.4567 });
            const result = action.execute(input, "{}");

            const output = JSON.parse(result.outputJson);
            expect(output.balance).toBe(-123.46);
        });

        it("should handle very large numbers", () => {
            const input = JSON.stringify({ bigNumber: 9999999.999999 });
            const result = action.execute(input, "{}");

            const output = JSON.parse(result.outputJson);
            expect(output.bigNumber).toBe(10000000);
        });
    });
});
