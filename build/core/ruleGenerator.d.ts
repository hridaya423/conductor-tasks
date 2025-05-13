import { IDEType } from './types.js';
/**
 * Generator for project rules documentation
 */
export declare class RuleGenerator {
    private projectRoot;
    private ideType;
    constructor(projectRoot: string, ideType?: IDEType);
    /**
     * Generates all rule files for the project
     */
    generateAllRules(): Promise<void>;
    /**
     * Creates necessary directories for rules
     */
    private createRulesDirectories;
    /**
     * Generates IDE-specific rule files based on the current IDE type
     */
    private generateIDERules;
    /**
     * Generates workflow and development rules
     */
    private generateWorkflowRules;
    /**
     * Generates Cursor rules
     */
    private generateCursorRules;
    /**
     * Generates Windsurf rules
     */
    private generateWindsurfRules;
    /**
     * Generates Roo rules
     */
    private generateRooRules;
    /**
     * Generates MCP tools rule documentation
     */
    private generateMCPToolsRules;
    /**
     * Generates task lifecycle rule documentation
     */
    private generateTaskLifecycleRules;
    /**
     * Generates AI implementation assistance rule documentation
     */
    private generateAIAssistanceRules;
    /**
     * Generates task visualization rule documentation
     */
    private generateVisualizationRules;
    /**
     * Generates rules index documentation
     */
    private generateRulesIndex;
    /**
     * Template for cursor_rules.mdc
     */
    private getCursorRulesTemplate;
    /**
     * Template for dev_workflow.mdc
     */
    private getDevWorkflowTemplate;
    /**
     * Template for conductor_tasks.mdc
     */
    private getConductorTasksTemplate;
    /**
     * Template for .windsurfrules
     */
    private getWindsurfRulesTemplate;
    /**
     * Template for roo_rules.md
     */
    private getRooRulesTemplate;
    /**
     * Template for mcp_tools.mdc
     */
    private getMCPToolsTemplate;
    /**
     * Template for task_lifecycle.mdc
     */
    private getTaskLifecycleTemplate;
    /**
     * Template for ai_assistance.mdc
     */
    private getAIAssistanceTemplate;
    /**
     * Template for visualization.mdc
     */
    private getVisualizationTemplate;
    /**
     * Template for rules_index.mdc
     */
    private getRulesIndexTemplate;
}
