import { z } from "zod";
import { TaskManager } from "../task/taskManager.js";
import logger from "../core/logger.js";
import { ToolResultWithNextSteps, SuggestedAction, TaskTemplate } from "../core/types.js";
import { checkTaskManagerInitialized } from "../core/checkInit.js";

export const GetTaskTemplateSchema = {
  templateName: z.string().describe("Name of the task template to retrieve (without extension)"),
};

const getTaskTemplateSchemaObject = z.object(GetTaskTemplateSchema);
export type GetTaskTemplateParams = z.infer<typeof getTaskTemplateSchemaObject>;

export async function getTaskTemplateHandler(
  taskManager: TaskManager,
  params: GetTaskTemplateParams
): Promise<ToolResultWithNextSteps> {
  const notInitializedResult = checkTaskManagerInitialized(taskManager);
  if (notInitializedResult) return notInitializedResult;

  try {
    const { templateName } = params;
    logger.info(`Getting task template: "${templateName}"`);

    const template: TaskTemplate | undefined = await taskManager.getTaskTemplate(templateName);

    if (!template) {
      return {
        content: [{ type: "text", text: `Error: Task template "${templateName}" not found.` }], 
        isError: true,
      };
    }

    
    
    const resultText = `Task Template: ${templateName}\n\n${JSON.stringify(template, null, 2)}`;
    
    const suggested_actions: SuggestedAction[] = [
      {
        tool_name: "create-task-from-template",
        parameters: { templateName: templateName, variables: {} }, 
        reason: `Create a new task using the '${templateName}' template.`,
        user_facing_suggestion: `Create a task from template '${templateName}'?`
      },
      {
        tool_name: "list-task-templates",
        reason: "List all available templates to see other options.",
        user_facing_suggestion: "List all available task templates?"
      }
    ];

    return {
      content: [{ type: "text", text: resultText }], 
      suggested_actions,
    };
  } catch (error: any) {
    logger.error('Error getting task template:', { error, templateName: params.templateName });
    return {
      content: [ 
        {
          type: "text",
          text: `Error getting task template "${params.templateName}": ${error.message || String(error)}`,
        },
      ],
      isError: true,
    };
  }
}
