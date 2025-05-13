import { z } from "zod";
import { TaskManager } from "../task/taskManager.js";
import { LLMManager } from "../llm/llmManager.js";
import { ToolResultWithNextSteps } from "../core/types.js";
export declare const ResearchTopicSchema: {
    topic: z.ZodString;
    taskId: z.ZodOptional<z.ZodString>;
    preferred_provider: z.ZodOptional<z.ZodString>;
};
declare const researchTopicSchemaObject: z.ZodObject<{
    topic: z.ZodString;
    taskId: z.ZodOptional<z.ZodString>;
    preferred_provider: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    topic: string;
    taskId?: string | undefined;
    preferred_provider?: string | undefined;
}, {
    topic: string;
    taskId?: string | undefined;
    preferred_provider?: string | undefined;
}>;
export type ResearchTopicParams = z.infer<typeof researchTopicSchemaObject>;
export declare function researchTopicHandler(taskManager: TaskManager, llmManager: LLMManager, params: ResearchTopicParams): Promise<ToolResultWithNextSteps>;
export {};
