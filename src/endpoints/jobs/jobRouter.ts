import { Router, Request, Response } from "express";
import { eq } from "drizzle-orm";
import { jobs, deliveryAttempts } from "../../db/schema.js";
import { JobStatus } from "../../db/schema.js";
import { requireAuth, getUserId } from "../middleware/auth.js";
import { toPagedResponse } from "./types.js";
import { db } from "../../db/index.js";

export function createJobRouter(): Router {
    const router = Router();

    router.use(requireAuth);

    router.get("/", async (request: Request, response: Response) => {
        const userId = getUserId(request);
        if (!userId) {
            response.status(401).json({ error: "Unauthorized" });
            return;
        }

        const pipelineId = request.query.pipelineId as string | undefined;
        const status = request.query.status as JobStatus | undefined;
        const page = Math.max(1, parseInt(request.query.page as string) || 1);
        const pageSize = Math.min(100, Math.max(1, parseInt(request.query.pageSize as string) || 20));

        const allJobs = await db.query.jobs.findMany({
            where: (j, { eq, and }) => {
                const conditions = [];
                if (pipelineId) conditions.push(eq(j.pipelineId, pipelineId));
                if (status)     conditions.push(eq(j.status, status));
                return conditions.length ? and(...conditions) : undefined;
            },
            with: { pipeline: true },
            orderBy: (j, { desc }) => desc(j.createdAt),
        });

        // Filter by userId from joined pipeline
        const filtered = allJobs.filter(j => j.pipeline.userId === userId);
        const totalCount = filtered.length;
        const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

        const items = paginated.map(j => ({
            id: j.id,
            pipelineId: j.pipelineId,
            status: j.status,
            createdAt: j.createdAt,
            updatedAt: j.updatedAt,
            completedAt: j.completedAt,
        }));

        response.status(200).json(toPagedResponse(items, totalCount, page, pageSize));
    });

    router.get("/:id", async (request: Request, response: Response) => {
        const userId = getUserId(request);
        if (!userId) {
            response.status(401).json({ error: "Unauthorized" });
            return;
        }

        const { id } = request.params;

        const job = await db.query.jobs.findFirst({
            where: eq(jobs.id, id as string),
            with: {
                pipeline: true,
                deliveryAttempts: {
                    with: { subscriber: true },
                },
            },
        });

        if (!job) {
            response.status(404).json({ error: "Not found" });
            return;
        }

        if (job.pipeline.userId !== userId) {
            response.status(404).json({ error: "Not found" });
            return;
        }

        // Group delivery attempts by subscriberId
        const attemptsBySubscriber = new Map<string, typeof job.deliveryAttempts>();
        for (const attempt of job.deliveryAttempts) {
            const existing = attemptsBySubscriber.get(attempt.subscriberId) ?? [];
            existing.push(attempt);
            attemptsBySubscriber.set(attempt.subscriberId, existing);
        }

        const deliveries = Array.from(attemptsBySubscriber.entries()).map(([subscriberId, attempts]) => {
            const sorted = [...attempts].sort((a, b) => a.attemptNumber - b.attemptNumber);
            const last = sorted[sorted.length - 1];
            return {
                subscriberId,
                subscriberUrl: last.subscriber.url,
                totalAttempts: sorted.length,
                delivered: sorted.some(a => a.success),
                lastStatusCode: last.httpStatusCode,
                lastAttemptedAt: last.attemptedAt,
                lastError: last.errorMessage ?? null,
            };
        });

        response.status(200).json({
            id: job.id,
            pipelineId: job.pipelineId,
            status: job.status,
            incomingPayload: job.incomingPayload,
            processedPayload: job.processedPayload ?? null,
            deliveries,
            createdAt: job.createdAt,
            updatedAt: job.updatedAt,
            completedAt: job.completedAt ?? null,
        });
    });

    router.get("/:id/deliveries", async (request: Request, response: Response) => {
        const userId = getUserId(request);
        if (!userId) {
            response.status(401).json({ error: "Unauthorized" });
            return;
        }

        const { id } = request.params;

        const job = await db.query.jobs.findFirst({
            where: eq(jobs.id, id as string),
            with: { pipeline: true },
        });
        if (!job) {
            response.status(404).json({ error: "Not found" });
            return;
        }

        if (job.pipeline.userId !== userId) {
            response.status(404).json({ error: "Not found" });
            return;
        }

        const attempts = await db.query.deliveryAttempts.findMany({
            where: eq(deliveryAttempts.jobId, id as string),
            with: { subscriber: true },
            orderBy: (da, { asc }) => [asc(da.subscriberId), asc(da.attemptNumber)],
        });

        const deliveries = attempts.map(da => ({
            id: da.id,
            subscriberId: da.subscriberId,
            subscriberUrl: da.subscriber.url,
            attemptNumber: da.attemptNumber,
            httpStatusCode: da.httpStatusCode,
            success: da.success,
            errorMessage: da.errorMessage ?? null,
            attemptedAt: da.attemptedAt,
        }));

        response.status(200).json(deliveries);
    });

    return router;
}
