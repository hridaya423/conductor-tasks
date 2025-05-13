export interface LLMProviderConfig {
  apiKey: string;
  model: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
}

export interface LLMModelDefaults {
  model: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
}

export interface LLMResponse {
  text: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface LLMRequest {
  prompt: string;
  systemPrompt?: string;
  options?: Partial<LLMProviderConfig>;
  provider?: string;
  taskName?: string;
}

export interface LLMProvider {
  name: string;
  generate(request: LLMRequest): Promise<LLMResponse>;
  isAvailable(): boolean;
}

export enum TaskPriority {
  CRITICAL = "critical", 
  HIGH = "high",    
  MEDIUM = "medium",
  LOW = "low",
  BACKLOG = "backlog"
}

export enum TaskStatus {
  BACKLOG = "backlog",
  TODO = "todo",
  IN_PROGRESS = "in_progress",
  REVIEW = "review",
  DONE = "done",
  BLOCKED = "blocked"
}

export interface TaskNote {
  id: string;
  content: string;
  timestamp: number;
  author: string;
  type: "progress" | "comment" | "blocker" | "solution";
}

export interface Task {
  id: string;
  title: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  complexity: number;
  createdAt: number;
  updatedAt: number;
  dueDate?: number;
  assignee?: string;
  dependencies: string[];
  tags: string[];
  notes: TaskNote[];
  subtasks?: string[];
  parent?: string;
  estimatedEffort?: string;
  actualEffort?: string;
}

export enum ContextPriority {
  CRITICAL = "critical",
  ESSENTIAL = "essential",
  BACKGROUND = "background"
}

export interface ContextItem {
  id: string;
  content: string;
  priority: ContextPriority;
  timestamp: number;
  source: string;
  tags: string[];
}

export interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: number;
  updatedAt: number;
  repositoryUrl?: string;
  tasks: string[];
}

export interface LLMCompletionOptions {
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  presencePenalty?: number;
  frequencyPenalty?: number;
  stream?: boolean;
  onStreamUpdate?: (update: string) => void;
}

export interface LLMClient {
  complete(options: LLMCompletionOptions): Promise<string>;
  getProviderName(): string;
  getModelName(): string;
}

export enum IDEType {
  CURSOR = "cursor",
  WINDSURF = "windsurf",
  ROO_CODE = "roo-code",
  CLINE = "cline",
  AUTO = "auto",
  GENERIC = "generic"
}

export interface IDERule {
  name: string;
  description: string;
  content: string;
}

export interface IDERules {
  type: IDEType;
  rules: IDERule[];
}

export interface TextContentItem {
  type: "text";
  text: string;
}

export interface SuggestedAction {
  tool_name: string; 
  parameters?: Record<string, any>; 
  reason?: string; 
  user_facing_suggestion?: string; 
}

export interface ToolResultWithNextSteps {
  content: TextContentItem[]; 
  suggested_actions?: SuggestedAction[];
  isError?: boolean; 
}

export interface TaskTemplateVariable {
  name: string;
  description?: string;
  defaultValue?: string;
}

export interface TaskTemplateDefinition {
  title: string; 
  description: string; 
  priority?: TaskPriority;
  complexity?: number;
  tags?: string[]; 
  
  subtask_templates?: TaskTemplateDefinition[]; 
}

export interface TaskTemplate {
  name: string; 
  description?: string; 
  variables?: TaskTemplateVariable[]; 
  task: TaskTemplateDefinition; 
}

export enum CodeSymbolType {
  FUNCTION = "function",
  CLASS = "class",
  INTERFACE = "interface",
  VARIABLE = "variable",
  CONSTANT = "constant",
  TYPE_ALIAS = "type_alias",
  ENUM = "enum",
  MODULE = "module", 
  IMPORT = "import_statement",
  EXPORT = "export_statement",
  UNKNOWN = "unknown"
}

export interface CodeSymbolParameter {
  name: string;
  type?: string; 
  optional?: boolean;
  defaultValue?: string;
}

export interface CodeSymbolSignature {
  parameters?: CodeSymbolParameter[];
  returnType?: string;
}

export interface CodeSymbol {
  name: string;
  type: CodeSymbolType;
  filePath: string; 
  startLine: number;
  endLine: number;
  signature?: CodeSymbolSignature; 
  exported: boolean;
  comment?: string; 
  
  
  
}

export interface FileAnalysis {
  filePath: string; 
  symbols: CodeSymbol[];
  imports: Array<{ moduleSpecifier: string; importedNames?: string[]; isDefaultImport?: boolean; namespaceImport?: string }>;
  exports: Array<{ name: string; type?: CodeSymbolType  }>;
  
}

export interface CodebaseAnalysisSummary {
  projectType: string;
  languageSummary: Record<string, { count: number; percentage: number }>;
  structureSummary: string[]; 
  keyEntryPoints?: string[];
  keyConfigFileInsights?: Record<string, any>; 
  readmeSummary?: string[]; 
  planMdSummary?: string[]; 
  detailedFileAnalyses?: FileAnalysis[]; 
  moduleDependencyGraph?: { 
    nodes: Array<{ id: string; label?: string; type?: string }>; 
    edges: Array<{ from: string; to: string; label?: string }>; 
  };
  analysisError?: string; 
}
