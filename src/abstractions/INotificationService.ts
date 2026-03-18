import { Job, Subscriber } from "../db/schema.js";
import {IMessageHandler} from "./IMessageHandler.js"


export interface INotificationService extends IMessageHandler {
    notifySubscribersAsync(
        jobId: string,
        signal?: AbortSignal,
    ): Promise<void>;
    notifySubscriberAsync(
        subscriber: Subscriber,
        job: Job,
        startAttempt: number,
        signal?: AbortSignal,
    ): Promise<void>;
}