import { describe, it, expect } from "vitest";
import {
    BadRequestError,
    UnauthorizedError,
    UserForbiddenError,
    NotFoundError,
    SecurityTokenError,
} from "../src/errors.js";

describe("Custom Errors", () => {
    describe("BadRequestError", () => {
        it("sets message correctly", () => {
            const error = new BadRequestError("Invalid input");
            expect(error.message).toBe("Invalid input");
        });

        it("is an instance of Error", () => {
            const error = new BadRequestError("test");
            expect(error).toBeInstanceOf(Error);
        });
    });

    describe("UnauthorizedError", () => {
        it("sets message correctly", () => {
            const error = new UnauthorizedError("Please login");
            expect(error.message).toBe("Please login");
        });

        it("is an instance of Error", () => {
            const error = new UnauthorizedError("test");
            expect(error).toBeInstanceOf(Error);
        });
    });

    describe("UserForbiddenError", () => {
        it("sets message correctly", () => {
            const error = new UserForbiddenError("Access denied");
            expect(error.message).toBe("Access denied");
        });

        it("is an instance of Error", () => {
            const error = new UserForbiddenError("test");
            expect(error).toBeInstanceOf(Error);
        });
    });

    describe("NotFoundError", () => {
        it("sets message correctly", () => {
            const error = new NotFoundError("Resource not found");
            expect(error.message).toBe("Resource not found");
        });

        it("is an instance of Error", () => {
            const error = new NotFoundError("test");
            expect(error).toBeInstanceOf(Error);
        });
    });

    describe("SecurityTokenError", () => {
        it("sets message correctly", () => {
            const error = new SecurityTokenError("Invalid token");
            expect(error.message).toBe("Invalid token");
        });

        it("is an instance of Error", () => {
            const error = new SecurityTokenError("test");
            expect(error).toBeInstanceOf(Error);
        });
    });

    describe("Error differentiation", () => {
        it("errors are distinguishable by type", () => {
            const badRequest = new BadRequestError("bad");
            const unauthorized = new UnauthorizedError("unauth");
            const forbidden = new UserForbiddenError("forbidden");
            const notFound = new NotFoundError("missing");
            const security = new SecurityTokenError("token");

            expect(badRequest).toBeInstanceOf(BadRequestError);
            expect(badRequest).not.toBeInstanceOf(UnauthorizedError);

            expect(unauthorized).toBeInstanceOf(UnauthorizedError);
            expect(unauthorized).not.toBeInstanceOf(BadRequestError);

            expect(forbidden).toBeInstanceOf(UserForbiddenError);
            expect(notFound).toBeInstanceOf(NotFoundError);
            expect(security).toBeInstanceOf(SecurityTokenError);
        });
    });
});
