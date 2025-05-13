import { z } from "zod";
import { TaskManager } from "../task/taskManager.js";
import logger from "../core/logger.js";
import { ToolResultWithNextSteps, SuggestedAction } from "../core/types.js";
import { checkTaskManagerInitialized } from "../core/checkInit.js";

export const CreateTaskFromTemplateSchema = {
  templateName: z.string().describe("Name of the task template to use (without extension)"),
  variables: z.record(z.string()).optional().describe("A JSON object of key-value pairs for template variable substitution. E.g., {\"TASK_NAME\": \"My New Feature\", \"COMPONENT_NAME\": \"AuthModule\"}"),
  parentId: z.string().optional().describe("Optional ID of a parent task if this template creates a subtask.")
};

const createTaskFromTemplateSchemaObject = z.object(CreateTaskFromTemplateSchema);
export type CreateTaskFromTemplateParams = z.infer<typeof createTaskFromTemplateSchemaObject>;

export async function createTaskFromTemplateHandler(
  taskManager: TaskManager,
  params: CreateTaskFromTemplateParams
): Promise<ToolResultWithNextSteps> {
  const notInitializedResult = checkTaskManagerInitialized(taskManager);
  if (notInitializedResult) return notInitializedResult;

  try {
    const { templateName, variables, parentId } = params;
    logger.info(`Creating task from template: "${templateName}"`, { variables, parentId });

    const rootTaskId = await taskManager.createTaskFromTemplate(templateName, variables || {});

    if (!rootTaskId) {
      return {
        content: [{ type: "text", text: `Error: Failed to create task(s) from template "${templateName}". Template might be missing or invalid.` }],
        isError: true,
      };
    }
    
    const rootTask = taskManager.getTask(rootTaskId);
    const title = rootTask ? rootTask.title : "Unknown Task";

    const resultText = `Successfully created task(s) from template "${templateName}". Root task ID: ${rootTaskId} ("${title}")`;
    
    const suggested_actions: SuggestedAction[] = [
      {
        tool_name: "get-task",
        parameters: { id: rootTaskId },
        reason: "View the details of the root task created from the template.",
        user_facing_suggestion: `View details for the new task '${title}' (ID: ${rootTaskId})?`
      },
      {
        tool_name: "list-tasks",
        parameters: { }, 
        reason: "List tasks to see the newly created task(s) in context.",
        user_facing_suggestion: "List all tasks?"
      }
    ];

    return {
      content: [{ type: "text", text: resultText }],
      suggested_actions,
    };
  } catch (error: any) {
    logger.error('Error creating task from template:', { 
      error, 
      templateName: params.templateName, 
      variables: params.variables 
    });
    return {
      content: [
        {
          type: "text",
          text: `Error creating task from template "${params.templateName}": ${error.message || String(error)}`,
        },
      ],
      isError: true,
    };
  }
}
