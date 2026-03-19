import { IMessageHandler } from "./IMessageHandler.js";



export interface IProcessingService extends IMessageHandler {
    processJobAsync(
        jobId: string,
        signal?: AbortSignal,
    ): Promise<void>;
}