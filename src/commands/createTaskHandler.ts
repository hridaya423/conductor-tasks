import { z } from "zod";
import { TaskManager } from "../task/taskManager.js";
import logger from "../core/logger.js";

export const CreateTaskSchema = {
  title: z.string().describe("Title of the task"),
  description: z.string().describe("Detailed description of the task"),
  additionalContext: z.string().optional().describe("Additional context that might help with task analysis")
};


const createTaskSchemaObject = z.object(CreateTaskSchema);


export type CreateTaskParams = z.infer<typeof createTaskSchemaObject>;

export async function createTaskHandler(
  taskManager: TaskManager,
  params: CreateTaskParams
): Promise<{ content: { type: "text"; text: string }[] }> {
  try {
    
    
    const { title, description, additionalContext } = params;
    
    logger.info(`Task creation requested: "${title}"`);
    
    
    const result = await taskManager.mcpCreateTask(title, description, additionalContext);
    
    return {
      content: [
        {
          type: "text",
          text: result
        }
      ]
    };
  } catch (error: any) {
    logger.error('Error creating task:', { 
      error, 
      title: params.title,
      description: params.description?.substring(0, 100) 
    });
    
    return {
      content: [
        {
          type: "text",
          text: `Error creating task: ${error.message || String(error)}`
        }
      ]
    };
  }
}
