import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Logger } from "../src/logger.js";

describe("Logger", () => {
    let logger: Logger;
    let consoleInfoSpy: ReturnType<typeof vi.spyOn>;
    let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
    let consoleDebugSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        logger = new Logger();
        consoleInfoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
        consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
        consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        consoleDebugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("info", () => {
        it("logs info message with prefix", () => {
            logger.info("test message");
            expect(consoleInfoSpy).toHaveBeenCalledWith("[INFO] test message");
        });

        it("passes additional arguments", () => {
            logger.info("test message", { extra: "data" }, 123);
            expect(consoleInfoSpy).toHaveBeenCalledWith(
                "[INFO] test message",
                { extra: "data" },
                123
            );
        });
    });

    describe("warn", () => {
        it("logs warning message with prefix", () => {
            logger.warn("warning message");
            expect(consoleWarnSpy).toHaveBeenCalledWith("[WARN] warning message");
        });

        it("passes additional arguments", () => {
            const error = new Error("test error");
            logger.warn("warning", error);
            expect(consoleWarnSpy).toHaveBeenCalledWith("[WARN] warning", error);
        });
    });

    describe("error", () => {
        it("logs error message with prefix", () => {
            logger.error("error message");
            expect(consoleErrorSpy).toHaveBeenCalledWith("[ERROR] error message");
        });

        it("passes error objects", () => {
            const error = new Error("something went wrong");
            logger.error("operation failed", error);
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                "[ERROR] operation failed",
                error
            );
        });
    });

    describe("debug", () => {
        it("logs debug message with prefix", () => {
            logger.debug("debug message");
            expect(consoleDebugSpy).toHaveBeenCalledWith("[DEBUG] debug message");
        });

        it("passes additional arguments", () => {
            logger.debug("debugging", { details: true });
            expect(consoleDebugSpy).toHaveBeenCalledWith(
                "[DEBUG] debugging",
                { details: true }
            );
        });
    });
});
