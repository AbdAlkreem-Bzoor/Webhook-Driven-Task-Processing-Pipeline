
import { Router, Request, Response } from "express";
import { eq, and } from "drizzle-orm";
import { pipelines, subscribers, processingActions } from "../../db/schema.js";
import { requireAuth, getUserId } from "../middleware/auth.js";
import {
    CreatePipelineRequest,
    UpdatePipelineRequest,
    PipelineResponse,
} from "./types.js";
import { db } from "../../db/index.js";

export function createPipelineRouter(): Router {
    const router = Router();

    router.use(requireAuth);

    router.get("/", async (request: Request, response: Response) => {
        const userId = getUserId(request);
        if (!userId) {
            response.status(401).json({ error: "Unauthorized" });
            return;
        }

        const results = await db.query.pipelines.findMany({
            where: eq(pipelines.userId, userId),
            with: { subscribers: true, processingActions: true },
            orderBy: (p, { desc }) => desc(p.createdAt),
        });

        response.status(200).json(results.map(toPipelineResponse));
    });

    router.get("/:id", async (request: Request, response: Response) => {
        const userId = getUserId(request);
        if (!userId) {
            response.status(401).json({ error: "Unauthorized" });
            return;
        }

        const pipeline = await db.query.pipelines.findFirst({
            where: and(eq(pipelines.id, request.params.id as string), eq(pipelines.userId, userId)),
            with: { subscribers: true, processingActions: true },
        });

        if (!pipeline) {
            response.status(404).json({ error: "Not found" });
            return;
        }

        response.status(200).json(toPipelineResponse(pipeline));
    });

    router.post("/", async (request: Request, response: Response) => {
        const userId = getUserId(request);
        if (!userId) {
            response.status(401).json({ error: "Unauthorized" });
            return;
        }

        const body = request.body as CreatePipelineRequest;

        if (!body.name?.trim()) {
            response.status(400).json({ error: "Name is required." });
            return;
        }

        if (!body.subscriberUrls?.length) {
            response.status(400).json({ error: "At least one subscriber URL is required." });
            return;
        }

        if (body.actions) {
            const validTypes = ['Validate', 'Transform', 'Enrich'];
            for (const action of body.actions) {
                if (!validTypes.includes(action.actionType as string)) {
                    response.status(400).json({
                        error: `Invalid action type '${action.actionType}'. Valid: ${validTypes.join(", ")}`,
                    });
                    return;
                }
            }
        }

        const now = new Date();

        const [pipeline] = await db
            .insert(pipelines)
            .values({
                name: body.name,
                payloadSchema: body.payloadSchema ?? null,
                userId,
                createdAt: now,
                updatedAt: now,
                createdBy: userId,
                updatedBy: userId,
            })
            .returning();

        if (body.subscriberUrls.length) {
            await db.insert(subscribers).values(
                body.subscriberUrls.map(url => ({ pipelineId: pipeline.id, url })),
            );
        }

        if (body.actions?.length) {
            await db.insert(processingActions).values(
                body.actions.map((a, i) => ({
                    pipelineId: pipeline.id,
                    order: a.order ?? i,
                    actionType: a.actionType,
                    configuration: a.configuration,
                    name: a.name ?? null,
                })),
            );
        }

        const created = await db.query.pipelines.findFirst({
            where: eq(pipelines.id, pipeline.id),
            with: { subscribers: true, processingActions: true },
        });

        response.status(201)
            .setHeader("Location", `/api/pipelines/${pipeline.id}`)
            .json(toPipelineResponse(created!));
    });

    router.put("/:id", async (request: Request, response: Response) => {
        const userId = getUserId(request);
        if (!userId) {
            response.status(401).json({ error: "Unauthorized" });
            return;
        }

        const pipeline = await db.query.pipelines.findFirst({
            where: and(eq(pipelines.id, request.params.id as string), eq(pipelines.userId, userId)),
            with: { subscribers: true, processingActions: true },
        });

        if (!pipeline) {
            response.status(404).json({ error: "Not found" });
            return;
        }

        const body = request.body as UpdatePipelineRequest;
        const now = new Date();
        const updates: Partial<typeof pipelines.$inferInsert> = {
            updatedAt: now,
            updatedBy: userId,
        };

        if (body.name !== undefined)          updates.name = body.name;
        if (body.payloadSchema !== undefined)  updates.payloadSchema = body.payloadSchema;

        await db.update(pipelines).set(updates).where(eq(pipelines.id, pipeline.id));

        if (body.actions !== undefined) {
            await db.delete(processingActions).where(eq(processingActions.pipelineId, pipeline.id));
            if (body.actions.length) {
                await db.insert(processingActions).values(
                    body.actions.map((a, i) => ({
                        pipelineId: pipeline.id,
                        order: a.order ?? i,
                        actionType: a.actionType,
                        configuration: a.configuration,
                        name: a.name ?? null,
                    })),
                );
            }
        }

        if (body.subscriberUrls !== undefined) {
            await db.delete(subscribers).where(eq(subscribers.pipelineId, pipeline.id));
            if (body.subscriberUrls.length) {
                await db.insert(subscribers).values(
                    body.subscriberUrls.map(url => ({ pipelineId: pipeline.id, url })),
                );
            }
        }

        const updated = await db.query.pipelines.findFirst({
            where: eq(pipelines.id, pipeline.id),
            with: { subscribers: true, processingActions: true },
        });

        response.status(200).json(toPipelineResponse(updated!));
    });

    router.delete("/:id", async (request: Request, response: Response) => {
        const userId = getUserId(request);
        if (!userId) {
            response.status(401).json({ error: "Unauthorized" });
            return;
        }

        const pipeline = await db.query.pipelines.findFirst({
            where: and(eq(pipelines.id, request.params.id as string), eq(pipelines.userId, userId)),
        });

        if (!pipeline) {
            response.status(404).json({ error: "Not found" });
            return;
        }

        await db.delete(pipelines).where(eq(pipelines.id, pipeline.id));

        response.status(204).send();
    });

    return router;
}

function toPipelineResponse(pipeline: any): PipelineResponse {
    return {
        id: pipeline.id,
        name: pipeline.name,
        sourceId: pipeline.sourceId,
        webhookUrl: `/api/webhooks/${pipeline.sourceId}`,
        payloadSchema: pipeline.payloadSchema ?? null,
        actions: [...pipeline.processingActions]
            .sort((a: any, b: any) => a.order - b.order)
            .map((a: any) => ({
                id: a.id,
                order: a.order,
                actionType: a.actionType,
                configuration: a.configuration,
                name: a.name ?? null,
            })),
        subscribers: pipeline.subscribers.map((s: any) => ({
            id: s.id,
            url: s.url,
        })),
        createdAt: pipeline.createdAt,
        updatedAt: pipeline.updatedAt,
    };
}
