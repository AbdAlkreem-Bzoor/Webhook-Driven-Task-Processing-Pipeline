import { describe, it, expect } from "vitest";
import { defaultRabbitMqOptions, DeliveryMode } from "../src/options.js";

describe("RabbitMQ Options", () => {
    describe("DeliveryMode", () => {
        it("has Transient mode as 1", () => {
            expect(DeliveryMode.Transient).toBe(1);
        });

        it("has Persistent mode as 2", () => {
            expect(DeliveryMode.Persistent).toBe(2);
        });
    });

    describe("defaultRabbitMqOptions", () => {
        it("has correct default host settings", () => {
            expect(defaultRabbitMqOptions.hostName).toBe("localhost");
            expect(defaultRabbitMqOptions.port).toBe(5672);
            expect(defaultRabbitMqOptions.userName).toBe("guest");
            expect(defaultRabbitMqOptions.password).toBe("guest");
        });

        it("has publisher confirmations enabled", () => {
            expect(defaultRabbitMqOptions.channel.publisherConfirmationsEnabled).toBe(true);
            expect(defaultRabbitMqOptions.channel.publisherConfirmationTrackingEnabled).toBe(true);
        });

        describe("exchange defaults", () => {
            it("has correct exchange type", () => {
                expect(defaultRabbitMqOptions.exchange.type).toBe("direct");
            });

            it("has durable exchanges", () => {
                expect(defaultRabbitMqOptions.exchange.durable).toBe(true);
            });

            it("does not auto-delete exchanges", () => {
                expect(defaultRabbitMqOptions.exchange.autoDelete).toBe(false);
            });
        });

        describe("queue defaults", () => {
            it("has durable queues", () => {
                expect(defaultRabbitMqOptions.queue.durable).toBe(true);
            });

            it("has non-exclusive queues", () => {
                expect(defaultRabbitMqOptions.queue.exclusive).toBe(false);
            });

            it("does not auto-delete queues", () => {
                expect(defaultRabbitMqOptions.queue.autoDelete).toBe(false);
            });

            it("has prefetch count of 1", () => {
                expect(defaultRabbitMqOptions.queue.qos.prefetchCount).toBe(1);
            });

            it("has non-global QoS", () => {
                expect(defaultRabbitMqOptions.queue.qos.global).toBe(false);
            });

            it("requeues on nack", () => {
                expect(defaultRabbitMqOptions.queue.nack.requeue).toBe(true);
            });

            it("does not ack multiple messages at once", () => {
                expect(defaultRabbitMqOptions.queue.ack.multiple).toBe(false);
            });
        });

        describe("publish defaults", () => {
            it("uses persistent delivery mode", () => {
                expect(defaultRabbitMqOptions.publish.deliveryMode).toBe(DeliveryMode.Persistent);
            });

            it("has zero priority by default", () => {
                expect(defaultRabbitMqOptions.publish.priority).toBe(0);
            });

            it("does not require mandatory delivery", () => {
                expect(defaultRabbitMqOptions.publish.mandatory).toBe(false);
            });
        });

        describe("consume defaults", () => {
            it("does not auto-ack", () => {
                expect(defaultRabbitMqOptions.consume.autoAck).toBe(false);
            });
        });

        describe("jobs endpoint", () => {
            it("has same defaults as base options", () => {
                expect(defaultRabbitMqOptions.jobs.exchange.durable).toBe(true);
                expect(defaultRabbitMqOptions.jobs.queue.durable).toBe(true);
                expect(defaultRabbitMqOptions.jobs.publish.deliveryMode).toBe(DeliveryMode.Persistent);
                expect(defaultRabbitMqOptions.jobs.consume.autoAck).toBe(false);
            });
        });

        describe("notifications endpoint", () => {
            it("has same defaults as base options", () => {
                expect(defaultRabbitMqOptions.notifications.exchange.durable).toBe(true);
                expect(defaultRabbitMqOptions.notifications.queue.durable).toBe(true);
                expect(defaultRabbitMqOptions.notifications.publish.deliveryMode).toBe(DeliveryMode.Persistent);
                expect(defaultRabbitMqOptions.notifications.consume.autoAck).toBe(false);
            });
        });
    });
});
