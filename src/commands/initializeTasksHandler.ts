import { z } from "zod";
import * as fs from 'fs';
import * as path from 'path';
import { TaskManager } from "../task/taskManager.js";
import logger from "../core/logger.js";

export const InitializeTasksSchema = {
  projectName: z.string().describe("Name of the project"),
  projectDescription: z.string().describe("Description of the project"),
  filePath: z.string().describe("Full path where to save TASKS.md")
};

export async function initializeTasksHandler(
  taskManager: TaskManager,
  params: z.infer<z.ZodObject<typeof InitializeTasksSchema>>
): Promise<{ content: { type: "text"; text: string }[] }> {
  try {
    const { projectName, projectDescription, filePath } = params;
    logger.info(`Initializing task system for project: ${projectName} at ${filePath}`);

    const normalizedPath = path.resolve(filePath);
    if (fs.existsSync(normalizedPath)) {
      logger.warn(`Task file already exists at ${normalizedPath}. Initialization aborted.`);
      return {
        content: [
          {
            type: "text",
            text: `Error: A task file already exists at ${normalizedPath}. Cannot initialize a new task system at this location.`
          }
        ]
      };
    }

    const result = await taskManager.mcpInitializeTasks(projectName, projectDescription, filePath);
    logger.info(`Task system initialized successfully for ${projectName}.`);

    return {
      content: [
        {
          type: "text",
          text: result
        }
      ]
    };
  } catch (error: any) {
    logger.error('Error initializing task system:', { error });
    return {
      content: [
        {
          type: "text",
          text: `Error initializing task system: ${error.message || String(error)}`
        }
      ]
    };
  }
}
