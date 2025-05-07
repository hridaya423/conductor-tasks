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
