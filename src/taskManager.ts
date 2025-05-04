import { z } from "zod";
import path from 'path';

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
  aiSummary?: string; 
  drawbacks?: string[];
}

export interface TaskNote {
  id: string;
  content: string;
  timestamp: number;
  author: string;
  type: "progress" | "comment" | "blocker" | "solution";
}

export class TaskManager {
  private tasks: Map<string, Task> = new Map();
  private tasksByStatus: Map<TaskStatus, Task[]> = new Map();
  private lastAiAnalysis: number = 0;
  private aiAnalysisInterval: number = 1000 * 60 * 60;
  private tasksFilePath: string;

  constructor() {
    this.tasks = new Map();
    this.tasksByStatus = new Map();
    this.tasksFilePath = path.join(process.cwd(), 'TASKS.md');
  }

  addTask(taskData: Omit<Task, "id" | "createdAt" | "updatedAt" | "notes" | "aiSummary">): string {
    const id = `task-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const now = Date.now();

    const task: Task = {
      id,
      ...taskData,
      createdAt: now,
      updatedAt: now,
      notes: [],
      aiSummary: undefined
    };

    this.tasks.set(id, task);
    this.checkForBlocking(task);

    return id;
  }

  getTask(id: string): Task | undefined {
    return this.tasks.get(id);
  }

  updateTask(id: string, updates: Partial<Omit<Task, "id" | "createdAt" | "updatedAt">>): Task | undefined {
    const task = this.tasks.get(id);
    if (!task) return undefined;

    const updatedTask = {
      ...task,
      ...updates,
      updatedAt: Date.now()
    };

    this.tasks.set(id, updatedTask);

    if (updates.dependencies) {
      this.checkForBlocking(updatedTask);
    }

    return updatedTask;
  }

  addTaskNote(
    taskId: string, 
    content: string, 
    author: string, 
    type: "progress" | "comment" | "blocker" | "solution"
  ): TaskNote | undefined {
    const task = this.tasks.get(taskId);
    if (!task) return undefined;

    const note: TaskNote = {
      id: `note-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      content,
      timestamp: Date.now(),
      author,
      type
    };

    task.notes.push(note);
    task.updatedAt = Date.now();

    return note;
  }

  deleteTask(id: string): boolean {
    if (!this.tasks.has(id)) return false;

    this.tasks.delete(id);

    for (const task of this.tasks.values()) {
      if (task.dependencies.includes(id)) {
        task.dependencies = task.dependencies.filter(depId => depId !== id);

        if (task.status === TaskStatus.BLOCKED) {
          this.checkForBlocking(task);
        }
      }
    }

    return true;
  }

  getTasks(options: {
    status?: TaskStatus | TaskStatus[],
    priority?: TaskPriority | TaskPriority[],
    assignee?: string,
    tags?: string[],
    sortBy?: "priority" | "dueDate" | "createdAt" | "updatedAt",
    sortDirection?: "asc" | "desc"
  } = {}): Task[] {
    const {
      status,
      priority,
      assignee,
      tags,
      sortBy = "priority",
      sortDirection = "desc"
    } = options;

    let filteredTasks = Array.from(this.tasks.values());

    if (status) {
      const statusArray = Array.isArray(status) ? status : [status];
      filteredTasks = filteredTasks.filter(task => statusArray.includes(task.status));
    }

    if (priority) {
      const priorityArray = Array.isArray(priority) ? priority : [priority];
      filteredTasks = filteredTasks.filter(task => priorityArray.includes(task.priority));
    }

    if (assignee) {
      filteredTasks = filteredTasks.filter(task => task.assignee === assignee);
    }

    if (tags && tags.length > 0) {
      filteredTasks = filteredTasks.filter(task => 
        tags.some(tag => task.tags.includes(tag))
      );
    }

    filteredTasks.sort((a, b) => {
      let valueA, valueB;

      switch (sortBy) {
        case "priority":

          const priorityOrder = {
            [TaskPriority.CRITICAL]: 0,
            [TaskPriority.HIGH]: 1,
            [TaskPriority.MEDIUM]: 2,
            [TaskPriority.LOW]: 3,
            [TaskPriority.BACKLOG]: 4
          };
          valueA = priorityOrder[a.priority];
          valueB = priorityOrder[b.priority];
          break;

        case "dueDate":
          valueA = a.dueDate || Number.MAX_SAFE_INTEGER;
          valueB = b.dueDate || Number.MAX_SAFE_INTEGER;
          break;

        case "createdAt":
          valueA = a.createdAt;
          valueB = b.createdAt;
          break;

        case "updatedAt":
          valueA = a.updatedAt;
          valueB = b.updatedAt;
          break;

        default:
          valueA = a.updatedAt;
          valueB = b.updatedAt;
      }

      return sortDirection === "asc" 
        ? valueA - valueB 
        : valueB - valueA;
    });

    return filteredTasks;
  }

  private checkForBlocking(task: Task): void {

    if (task.dependencies.length === 0) {

      if (task.status === TaskStatus.BLOCKED) {
        task.status = TaskStatus.TODO;
      }
      return;
    }

    const hasUnfinishedDependencies = task.dependencies.some(depId => {
      const depTask = this.tasks.get(depId);

      return !depTask || depTask.status !== TaskStatus.DONE;
    });

    if (hasUnfinishedDependencies) {
      task.status = TaskStatus.BLOCKED;
    } else if (task.status === TaskStatus.BLOCKED) {

      task.status = TaskStatus.TODO;
    }
  }

  generateAiSummaries(): void {
    const now = Date.now();
    if (now - this.lastAiAnalysis < this.aiAnalysisInterval) {
      return;
    }

    for (const task of this.tasks.values()) {
      if (!task.aiSummary || task.notes.length > 0 || task.updatedAt > this.lastAiAnalysis) {

        const summary = this.mockAiSummary(task);
        task.aiSummary = summary;
      }
    }

    this.lastAiAnalysis = now;
  }

  private mockAiSummary(task: Task): string {
    const progressNotes = task.notes.filter(n => n.type === "progress").length;
    const blockerNotes = task.notes.filter(n => n.type === "blocker").length;

    let complexity = "";
    if (task.complexity <= 3) complexity = "simple";
    else if (task.complexity <= 7) complexity = "moderate";
    else complexity = "complex";

    return `This is a ${complexity} task with ${progressNotes} progress updates and ${blockerNotes} reported blockers. ` +
           `Priority is ${task.priority} and current status is ${task.status}.`;
  }

  getTasksNeedingAttention(): Task[] {
    const now = Date.now();
    return Array.from(this.tasks.values()).filter(task => {

      if (task.dueDate && task.dueDate < now && task.status !== TaskStatus.DONE) {
        return true;
      }

      if (task.status === TaskStatus.BLOCKED) {
        return true;
      }

      if (task.priority === TaskPriority.CRITICAL && task.status !== TaskStatus.DONE) {
        return true;
      }

      return false;
    });
  }

  getTaskDependencyTree(taskId: string): { task: Task, dependencies: Task[] } | undefined {
    const task = this.tasks.get(taskId);
    if (!task) return undefined;

    const dependencies: Task[] = [];
    for (const depId of task.dependencies) {
      const depTask = this.tasks.get(depId);
      if (depTask) {
        dependencies.push(depTask);
      }
    }

    return { task, dependencies };
  }

  getTasksFilePath(): string {
    return this.tasksFilePath;
  }
}
