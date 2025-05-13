import logger from "../core/logger.js";
import { checkTaskManagerInitialized } from "../core/checkInit.js";
export const ListTaskTemplatesSchema = {};
export async function listTaskTemplatesHandler(taskManager) {
    const notInitializedResult = checkTaskManagerInitialized(taskManager);
    if (notInitializedResult)
        return notInitializedResult;
    try {
        logger.info("Listing task templates requested.");
        const templateNames = await taskManager.listTaskTemplates();
        let resultText = "Available task templates:\n";
        if (templateNames.length === 0) {
            resultText = "No task templates found in the .conductor/templates directory.";
        }
        else {
            resultText += templateNames.map(name => `- ${name}`).join("\n");
        }
        const suggested_actions = [];
        if (templateNames.length > 0) {
            suggested_actions.push({
                tool_name: "get-task-template",
                parameters: { templateName: templateNames[0] },
                reason: "View the details of the first available template.",
                user_facing_suggestion: `View details for template '${templateNames[0]}'?`
            });
            suggested_actions.push({
                tool_name: "create-task-from-template",
                parameters: { templateName: templateNames[0], variables: {} },
                reason: "Create a new task using the first available template.",
                user_facing_suggestion: `Create a task from template '${templateNames[0]}'? (You'll be prompted for variables)`
            });
        }
        else {
            suggested_actions.push({
                tool_name: "ask_followup_question",
                parameters: { question: "No templates found. Would you like me to help you create one?" },
                reason: "Guide user to create templates if none exist.",
                user_facing_suggestion: "No templates found. Create one now?"
            });
        }
        return {
            content: [{ type: "text", text: resultText }],
            suggested_actions,
        };
    }
    catch (error) {
        logger.error('Error listing task templates:', { error });
        return {
            content: [
                {
                    type: "text",
                    text: `Error listing task templates: ${error.message || String(error)}`,
                },
            ],
            isError: true
        };
    }
}
//# sourceMappingURL=listTaskTemplatesHandler.js.map