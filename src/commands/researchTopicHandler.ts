import { z } from "zod";
import { TaskManager } from "../task/taskManager.js";
import { LLMManager } from "../llm/llmManager.js";
import logger from "../core/logger.js";
import { ToolResultWithNextSteps, SuggestedAction, TextContentItem } from "../core/types.js";
import { checkTaskManagerInitialized } from "../core/checkInit.js";

export const ResearchTopicSchema = {
  topic: z.string().describe("The topic or question to research."),
  taskId: z.string().optional().describe("Optional ID of a task to associate the research notes with."),
  preferred_provider: z.string().optional().describe("Optional preferred LLM provider for this research query (e.g., 'perplexity', 'openai').")
};

const researchTopicSchemaObject = z.object(ResearchTopicSchema);
export type ResearchTopicParams = z.infer<typeof researchTopicSchemaObject>;

export async function researchTopicHandler(
  taskManager: TaskManager,
  llmManager: LLMManager,
  params: ResearchTopicParams
): Promise<ToolResultWithNextSteps> {
  const notInitializedResult = checkTaskManagerInitialized(taskManager);
  if (notInitializedResult && params.taskId) { 
    return notInitializedResult;
  }

  try {
    const { topic, taskId, preferred_provider } = params;
    logger.info(`Researching topic: "${topic}"`, { taskId, preferred_provider });

    let researchResultText = "";
    let providerUsed = preferred_provider || llmManager.getDefaultProvider(); 

    
    if ((!preferred_provider || preferred_provider.toLowerCase() === 'perplexity') && llmManager.getAvailableProviders().includes('perplexity')) {
      try {
        logger.info(`Attempting research with Perplexity for: "${topic}"`);
        providerUsed = 'perplexity';
        const perplexityResponse = await llmManager.sendRequest({
          prompt: topic, 
          provider: 'perplexity',
          systemPrompt: "You are a helpful research assistant. Provide a concise and informative answer to the following topic, using your web search capabilities if necessary.",
          taskName: "research-topic"
        });
        researchResultText = perplexityResponse.text;
        logger.info(`Research successful with Perplexity for: "${topic}"`);
      } catch (e: any) {
        logger.warn(`Perplexity research failed for "${topic}": ${e.message}. Trying other methods.`);
        researchResultText = ""; 
      }
    }

    
    if (!researchResultText) {
      
      if (preferred_provider && preferred_provider.toLowerCase() !== 'perplexity' && llmManager.getAvailableProviders().includes(preferred_provider)) {
        providerUsed = preferred_provider;
      } else {
        
        const fallbackProviders = llmManager.getAvailableProviders().filter(p => p !== 'perplexity');
        providerUsed = fallbackProviders.length > 0 ? fallbackProviders[0] : llmManager.getDefaultProvider();
      }
      
      logger.info(`Attempting research with general LLM (${providerUsed}) for: "${topic}"`);
      let researchPrompt = `Please research the following topic and provide a concise summary: "${topic}". If you have access to web search tools, please use them to find the most up-to-date information. Otherwise, provide the best answer based on your existing knowledge.`;
      
      
      
      if (providerUsed.toLowerCase().includes('openai') || providerUsed.toLowerCase().includes('gemini')) {
        researchPrompt = `Topic to research: "${topic}". 
Please use your available tools (like web search) to find the most relevant and up-to-date information on this topic. Then, provide a concise summary of your findings. If you cannot perform a search, answer based on your existing knowledge.`;
      }
      
      try {
        const llmResponse = await llmManager.sendRequest({
          prompt: researchPrompt,
          provider: providerUsed,
          systemPrompt: "You are a helpful research assistant.",
          taskName: "research-topic"
        });
        researchResultText = llmResponse.text;
        logger.info(`Research successful with ${providerUsed} for: "${topic}"`);
      } catch (e: any) {
        logger.error(`General LLM research failed for "${topic}" with provider ${providerUsed}: ${e.message}`);
        return {
          content: [{ type: "text", text: `Error researching topic "${topic}": ${e.message}` }],
          isError: true
        };
      }
    }
    
    if (!researchResultText) {
        researchResultText = `No information found for topic: "${topic}" after trying available methods.`;
    }

    if (taskId) {
      const task = taskManager.getTask(taskId);
      if (task) {
        taskManager.addTaskNote(taskId, `# Research: ${topic}\n\nProvider Used: ${providerUsed}\n\n${researchResultText}`, "ResearchAgent", "comment");
        logger.info(`Research note added to task ${taskId}`);
      } else {
        logger.warn(`Task ID ${taskId} provided for research note, but task not found.`);
      }
    }

    const suggested_actions: SuggestedAction[] = [];
    if (taskId) {
        suggested_actions.push({
            tool_name: "get-task",
            parameters: { id: taskId },
            reason: "View the task to see the research note.",
            user_facing_suggestion: `View task ${taskId} with research notes?`
        });
    }

    return {
      content: [{ type: "text", text: researchResultText }],
      suggested_actions: suggested_actions.length > 0 ? suggested_actions : undefined,
    };

  } catch (error: any) {
    logger.error('Error researching topic:', { error, topic: params.topic });
    return {
      content: [
        {
          type: "text",
          text: `Error researching topic "${params.topic}": ${error.message || String(error)}`,
        },
      ],
      isError: true,
    };
  }
}
