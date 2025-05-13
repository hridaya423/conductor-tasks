import { z } from "zod";
import { TaskManager } from "../task/taskManager.js";
import logger from "../core/logger.js";
import { ToolResultWithNextSteps, SuggestedAction } from "../core/types.js";
import { checkTaskManagerInitialized } from "../core/checkInit.js"; 

export const GenerateDiffSchema = {
  filePath: z.string().describe("Path to the file to generate a diff for (relative to workspace root)."),
  changeDescription: z.string().describe("A detailed description of the changes to be made."),
  startLine: z.number().optional().describe("Optional start line for a selection if the change is targeted."),
  endLine: z.number().optional().describe("Optional end line for a selection if the change is targeted.")
};

const generateDiffSchemaObject = z.object(GenerateDiffSchema);
export type GenerateDiffParams = z.infer<typeof generateDiffSchemaObject>;

export async function generateDiffHandler(
  taskManager: TaskManager,
  params: GenerateDiffParams
): Promise<ToolResultWithNextSteps> {
  
  
  const notInitializedResult = checkTaskManagerInitialized(taskManager);
  if (notInitializedResult) return notInitializedResult;

  try {
    const { filePath, changeDescription, startLine, endLine } = params;
    logger.info(`Generating diff for file: "${filePath}"`, { changeDescription });

    const selection = (startLine !== undefined && endLine !== undefined) ? { startLine, endLine } : undefined;

    const diffContent = await taskManager.generateDiffForChange(filePath, changeDescription, selection);

    if (!diffContent || diffContent.trim() === "") {
      return {
        content: [{ type: "text", text: `Could not generate a diff for "${filePath}". The LLM might not have found any changes to make based on the description, or an error occurred.` }],
        isError: true, 
      };
    }
    
    const resultText = `Successfully generated diff for "${filePath}":\n\n\`\`\`diff\n${diffContent}\n\`\`\``;
    
    const suggested_actions: SuggestedAction[] = [
      {
        tool_name: "propose_diff", 
        parameters: { 
            filePath: filePath, 
            diffContent: diffContent,
            description: `AI-generated: ${changeDescription.substring(0, 50)}...` 
        },
        reason: "The generated diff can now be proposed for application.",
        user_facing_suggestion: `Propose this diff for file '${filePath}'?`
      },
      {
        tool_name: "ask_followup_question",
        parameters: { question: `The diff for ${filePath} has been generated. Review it and decide if you want to propose it for application, or if further refinement is needed.` },
        reason: "Prompt user for next action after reviewing the diff.",
        user_facing_suggestion: "Review the generated diff and decide next steps?"
      }
    ];

    return {
      content: [{ type: "text", text: resultText }],
      suggested_actions,
    };

  } catch (error: any) {
    logger.error('Error generating diff:', { error, filePath: params.filePath });
    return {
      content: [
        {
          type: "text",
          text: `Error generating diff for "${params.filePath}": ${error.message || String(error)}`,
        },
      ],
      isError: true,
    };
  }
}
