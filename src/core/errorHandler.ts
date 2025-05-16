import fs from 'fs';
import path from 'path';
import logger from './logger.js';

export enum ErrorSeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL'
}

export enum ErrorCategory {
  FILESYSTEM = 'FILESYSTEM',
  NETWORK = 'NETWORK',
  PARSING = 'PARSING',
  VALIDATION = 'VALIDATION',
  CONFIGURATION = 'CONFIGURATION',
  LLM = 'LLM',
  UNKNOWN = 'UNKNOWN'
}

export interface ErrorContext {
  operation: string;
  targetFile?: string;
  taskId?: string;
  additionalInfo?: Record<string, any>;
}

export class TaskError extends Error {
  public severity: ErrorSeverity;
  public category: ErrorCategory;
  public context: ErrorContext;
  public timestamp: number;
  public originalError?: Error;

  constructor(
    message: string,
    category: ErrorCategory = ErrorCategory.UNKNOWN,
    severity: ErrorSeverity = ErrorSeverity.ERROR,
    context: ErrorContext = { operation: 'unknown' },
    originalError?: Error
  ) {
    super(message);
    this.name = 'TaskError';
    this.severity = severity;
    this.category = category;
    this.context = context;
    this.timestamp = Date.now();
    this.originalError = originalError;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, TaskError);
    }
  }

  public toString(): string {
    const timestamp = new Date(this.timestamp).toISOString();
    let errorStr = `[${timestamp}] [${this.severity}] [${this.category}] ${this.message}`;

    errorStr += `\nOperation: ${this.context.operation}`;
    if (this.context.targetFile) {
      errorStr += `\nTarget File: ${this.context.targetFile}`;
    }
    if (this.context.taskId) {
      errorStr += `\nTask ID: ${this.context.taskId}`;
    }
    if (this.context.additionalInfo) {
      errorStr += `\nAdditional Info: ${JSON.stringify(this.context.additionalInfo, null, 2)}`;
    }

    if (this.originalError) {
      errorStr += `\nOriginal Error: ${this.originalError.message}`;
      if (this.originalError.stack) {
        errorStr += `\nOriginal Stack: ${this.originalError.stack}`;
      }
    }

    if (this.stack) {
      errorStr += `\nStack Trace: ${this.stack}`;
    }

    return errorStr;
  }
}

interface ErrorHandlerOptions {
  consoleEnabled?: boolean;
  fileLoggingEnabled?: boolean;
  logFilePath?: string;
  maxLogSize?: number;
  maxLogFiles?: number;
}

export class ErrorHandler {
  private static instance: ErrorHandler;
  private logFilePath: string;
  private isMcpMode: boolean;
  private isTestMode: boolean;
  private consoleEnabled: boolean;
  private fileLoggingEnabled: boolean;
  private maxLogSize: number;
  private maxLogFiles: number;

  private constructor() {
    this.isMcpMode = process.env.MCP_MODE === 'true' || 
                     process.argv.some(arg => arg.includes('mcp')) ||
                     process.send !== undefined;
    this.isTestMode = process.env.NODE_ENV === 'test';
    this.consoleEnabled = !this.isMcpMode;
    this.fileLoggingEnabled = false;
    this.maxLogSize = parseInt(process.env.MAX_LOG_SIZE || '5242880', 10);
    this.maxLogFiles = parseInt(process.env.MAX_LOG_FILES || '5', 10);

    this.logFilePath = '';
  }

  public static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  public configure(options: ErrorHandlerOptions): void {
    if (options.consoleEnabled !== undefined) {
      this.consoleEnabled = options.consoleEnabled;
    }
    if (options.maxLogSize) {
      this.maxLogSize = options.maxLogSize;
    }
    if (options.maxLogFiles) {
      this.maxLogFiles = options.maxLogFiles;
    }
  }

  public handleError(error: TaskError | Error, silent: boolean = false): void {
    let taskError: TaskError;

    if (!(error instanceof TaskError)) {
      taskError = new TaskError(
        error.message,
        ErrorCategory.UNKNOWN,
        ErrorSeverity.ERROR,
        { operation: 'unknown' },
        error
      );
    } else {
      taskError = error;
    }

    const errorString = taskError.toString();

    if (this.consoleEnabled && !silent && !this.isMcpMode) {
      if (taskError.severity === ErrorSeverity.CRITICAL) {
        console.error('\x1b[31m%s\x1b[0m', errorString);
      } else if (taskError.severity === ErrorSeverity.ERROR) {
        console.error(errorString);
      } else if (taskError.severity === ErrorSeverity.WARNING) {
        console.warn('\x1b[33m%s\x1b[0m', errorString);
      } else {
        console.info('\x1b[36m%s\x1b[0m', errorString);
      }
    }

    if (this.isMcpMode && process.send) {
      process.send({ type: 'error', payload: { message: errorString } });
    }
  }

  public createFileSystemError(
    message: string,
    context: Omit<ErrorContext, 'operation'> & { operation?: string },
    severity: ErrorSeverity = ErrorSeverity.ERROR,
    originalError?: Error
  ): TaskError {
    return new TaskError(
      message,
      ErrorCategory.FILESYSTEM,
      severity,
      { operation: context.operation || 'file_operation', ...context },
      originalError
    );
  }

  public createParsingError(
    message: string,
    context: Omit<ErrorContext, 'operation'> & { operation?: string },
    severity: ErrorSeverity = ErrorSeverity.ERROR,
    originalError?: Error
  ): TaskError {
    return new TaskError(
      message,
      ErrorCategory.PARSING,
      severity,
      { operation: context.operation || 'parsing', ...context },
      originalError
    );
  }

  public createLLMError(
    message: string,
    context: Omit<ErrorContext, 'operation'> & { operation?: string },
    severity: ErrorSeverity = ErrorSeverity.ERROR,
    originalError?: Error
  ): TaskError {
    return new TaskError(
      message,
      ErrorCategory.LLM,
      severity,
      { operation: context.operation || 'llm_operation', ...context },
      originalError
    );
  }

  public static async tryCatch<T>(
    fn: () => Promise<T> | T,
    errorCategory: ErrorCategory,
    operation: string,
    context: Omit<ErrorContext, 'operation'> = {},
    defaultValue?: T
  ): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      const handler = ErrorHandler.getInstance();
      const taskError = new TaskError(
        error instanceof Error ? error.message : String(error),
        errorCategory,
        ErrorSeverity.ERROR,
        { operation, ...context },
        error instanceof Error ? error : undefined
      );

      handler.handleError(taskError);

      if (defaultValue !== undefined) {
        return defaultValue;
      }
      throw taskError;
    }
  }
}

export const errorHandler = ErrorHandler.getInstance();
