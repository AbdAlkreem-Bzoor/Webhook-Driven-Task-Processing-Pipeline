// webhooks/webhookRouter.ts

import { Router, Request, Response } from "express";
import { eq, and } from "drizzle-orm";
import { pipelines, jobs, outboxMessages } from "../../db/schema.js";
import { AppMetrics } from "../../diagnostics/AppMetrics.js";
import { isValidWebhookSignature } from "../../services/WebhookSignatureVerification.js";
import { validateSchema } from "../../services/SchemaValidator.js";
import { db } from "../../db/index.js";

export function createWebhookRouter(
    metrics: AppMetrics
): Router {
    const router = Router();

    router.post("/:sourceId", async (request: Request, response: Response) => {
        const { sourceId } = request.params;
        const rawBody: string = (request as any).rawBody ?? JSON.stringify(request.body);

        const [pipeline] = await db
            .select({
                id: pipelines.id,
                payloadSchema: pipelines.payloadSchema,
                webhookSecret: pipelines.webhookSecret,
            })
            .from(pipelines)
            .where(eq(pipelines.sourceId, sourceId as string))
            .limit(1);

        if (!pipeline) {
            response.status(404).json({ error: "No pipeline found for this source." });
            return;
        }

        if (pipeline.webhookSecret) {
            const signature = request.headers["x-webhook-signature"] as string | undefined;

            if (!signature) {
                metrics.webhooksRejected.add(1, { reason: "missing_signature" });
                response.status(401).json({ error: "Missing X-Webhook-Signature header." });
                return;
            }

            if (!isValidWebhookSignature(rawBody, pipeline.webhookSecret, signature)) {
                metrics.webhooksRejected.add(1, { reason: "invalid_signature" });
                response.status(401).json({ error: "Invalid webhook signature." });
                return;
            }
        }

        let body: unknown;
        try {
            body = JSON.parse(rawBody);
        } catch {
            metrics.webhooksRejected.add(1, { reason: "invalid_json" });
            response.status(400).json({ error: "Invalid JSON payload." });
            return;
        }

        if (pipeline.payloadSchema) {
            const violations = validateSchema(body, pipeline.payloadSchema);

            if (violations.length > 0) {
                metrics.webhooksRejected.add(1, { reason: "schema_violation" });
                response.status(400).json({
                    error: "Payload does not match pipeline schema.",
                    violations,
                });
                return;
            }
        }

        const idempotencyKey = request.headers["x-idempotency-key"] as string | undefined;
        const now = new Date();

        try {
            const result = await db.transaction(async (tx) => {
                const [job] = await tx
                .insert(jobs)
                .values({
                    pipelineId: pipeline.id,
                    incomingPayload: JSON.stringify(body),
                    status: 'Queued',
                    idempotencyKey: idempotencyKey ?? null,
                    createdAt: now,
                    updatedAt: now,
                    createdBy: "webhook",
                    updatedBy: "webhook",
                })
                .returning();

                await tx.insert(outboxMessages).values({
                    eventType: 'JobCreated',
                    payload: JSON.stringify(job.id),
                    createdAt: now,
                });

                metrics.webhooksReceived.add(1, { pipeline_id: pipeline.id });

                return job;
            });

            response.status(202)
                .setHeader("Location", `/api/jobs/${result.id}`)
                .json({
                    id: result.id,
                    status: result.status,
                    message: "Webhook received and queued for processing.",
                });

        } catch (error: any) {
            if (error?.code === "23505") {
                metrics.webhooksRejected.add(1, { reason: "duplicate" });

                const [existing] = await db
                    .select({ id: jobs.id, status: jobs.status })
                    .from(jobs)
                    .where(
                        and(
                            eq(jobs.pipelineId, pipeline.id),
                            eq(jobs.idempotencyKey, idempotencyKey!),
                        ),
                    )
                    .limit(1);

                response.status(200).json({
                    id: existing.id,
                    status: existing.status,
                    message: "Duplicate webhook — returning existing job.",
                });
            } else {
                throw error;
            }
        }
    });

    return router;
}
