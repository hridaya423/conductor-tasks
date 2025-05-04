import { z } from "zod";
import { TaskManager } from "../task/taskManager.js";
import { ContextManager } from "../core/contextManager.js";
import { LLMManager } from "../llm/llmManager.js";
export declare const HelpImplementTaskSchema: {
    taskId: z.ZodString;
    additionalContext: z.ZodOptional<z.ZodString>;
};
export declare function helpImplementTaskHandler(taskManager: TaskManager, llmManager: LLMManager, contextManager: ContextManager, params: z.infer<z.ZodObject<typeof HelpImplementTaskSchema>>): Promise<{
    content: {
        type: "text";
        text: string;
    }[];
}>;
