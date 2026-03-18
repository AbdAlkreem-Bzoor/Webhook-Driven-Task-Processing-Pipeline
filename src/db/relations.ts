import { relations } from "drizzle-orm";
import {
    pipelines,
    subscribers,
    processingActions,
    jobs,
    deliveryAttempts,
} from "./schema.js";

export const pipelinesRelations = relations(pipelines, ({ many }) => ({
    subscribers: many(subscribers),           
    processingActions: many(processingActions), 
    jobs: many(jobs),                        
}));

export const subscribersRelations = relations(subscribers, ({ one, many }) => ({
    pipeline: one(pipelines, {               
        fields: [subscribers.pipelineId],
        references: [pipelines.id],
    }),
    deliveryAttempts: many(deliveryAttempts), 
}));

export const processingActionsRelations = relations(processingActions, ({ one }) => ({
    pipeline: one(pipelines, {               
        fields: [processingActions.pipelineId],
        references: [pipelines.id],
    }),
}));

export const jobsRelations = relations(jobs, ({ one, many }) => ({
    pipeline: one(pipelines, {               
        fields: [jobs.pipelineId],
        references: [pipelines.id],
    }),
    deliveryAttempts: many(deliveryAttempts), 
}));

export const deliveryAttemptsRelations = relations(deliveryAttempts, ({ one }) => ({
    job: one(jobs, {                         
        fields: [deliveryAttempts.jobId],
        references: [jobs.id],
    }),
    subscriber: one(subscribers, {           
        fields: [deliveryAttempts.subscriberId],
        references: [subscribers.id],
    }),
}));