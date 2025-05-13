import { z } from "zod";
import logger from "../core/logger.js";
import { checkTaskManagerInitialized } from "../core/checkInit.js";
import * as fs from 'fs';
import * as path from 'path';
import * as Diff from 'diff';
import crypto from 'crypto';
export const ProposeDiffSchema = {
    filePath: z.string().describe("Path to the file to apply the diff to (relative to workspace root)."),
    diffContent: z.string().describe("The diff content, preferably in unified diff format."),
    originalHash: z.string().optional().describe("Optional hash (e.g., SHA256) of the original file content to prevent applying to a modified file."),
    description: z.string().optional().describe("A brief description of what this diff achieves.")
};
const proposeDiffSchemaObject = z.object(ProposeDiffSchema);
export async function proposeDiffHandler(taskManager, params) {
    const notInitializedResult = checkTaskManagerInitialized(taskManager);
    if (notInitializedResult)
        return notInitializedResult;
    try {
        const { filePath, diffContent, originalHash, description } = params;
        logger.info(`Diff proposed for file: "${filePath}"`, { description, hasHash: !!originalHash });
        const absoluteFilePath = path.resolve(taskManager.getWorkspaceRoot(), filePath);
        if (!fs.existsSync(absoluteFilePath)) {
            return {
                content: [{ type: "text", text: `Error: File not found at ${absoluteFilePath} to apply diff.` }],
                isError: true,
            };
        }
        const currentFileContent = fs.readFileSync(absoluteFilePath, 'utf8');
        if (originalHash) {
            const hasher = crypto.createHash('sha256');
            hasher.update(currentFileContent);
            const currentHash = hasher.digest('hex');
            if (currentHash !== originalHash) {
                return {
                    content: [{ type: "text", text: `Error: File "${filePath}" has been modified since the diff was generated. Hash mismatch. Please regenerate the diff.` }],
                    isError: true,
                };
            }
        }
        let newContent;
        try {
            newContent = Diff.applyPatch(currentFileContent, diffContent);
            if (newContent === false) {
                throw new Error("Diff could not be applied. It may be invalid or not match the current file content.");
            }
        }
        catch (e) {
            logger.error(`Error applying diff to ${filePath}:`, e);
            return {
                content: [{ type: "text", text: `Error applying diff to "${filePath}": ${e.message}` }],
                isError: true,
            };
        }
        fs.writeFileSync(absoluteFilePath, newContent, 'utf8');
        logger.info(`Diff successfully applied to "${filePath}".`);
        const resultText = `Diff successfully applied to "${filePath}". Description: "${description || 'N/A'}".`;
        const suggested_actions = [
            {
                tool_name: "ask_followup_question",
                parameters: { question: `Changes applied to ${filePath}. Please review and test.` },
                reason: "The file has been modified, user should review.",
                user_facing_suggestion: `Changes applied to ${filePath}. Review and test?`
            }
        ];
        return {
            content: [{ type: "text", text: resultText }],
            suggested_actions,
        };
    }
    catch (error) {
        logger.error('Error processing diff proposal:', { error, filePath: params.filePath });
        return {
            content: [
                {
                    type: "text",
                    text: `Error processing diff proposal for "${params.filePath}": ${error.message || String(error)}`,
                },
            ],
            isError: true,
        };
    }
}
//# sourceMappingURL=proposeDiffHandler.js.map