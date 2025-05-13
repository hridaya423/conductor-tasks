import { ContextItem, ContextPriority } from './types.js';
import { IDERulesManager } from '../ide/ideRulesManager.js';
import logger from './logger.js';

export class ContextManager {
  private contextItems: Map<string, ContextItem> = new Map();
  private projectContext: string = '';
  private anchorPoints: Set<string> = new Set();
  private ideRulesManager?: IDERulesManager;

  setProjectContext(context: string): void {
    this.projectContext = context;
  }

  getProjectContext(): string {
    return this.projectContext;
  }

  addContext(
    content: string, 
    priority: ContextPriority,
    source: string, 
    tags: string[] = []
  ): string {
    const id = `ctx-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    const contextItem: ContextItem = {
      id,
      content,
      priority,
      timestamp: Date.now(),
      source,
      tags
    };

    this.contextItems.set(id, contextItem);
    return id;
  }

  setAnchorPoint(id: string, isAnchor: boolean): boolean {
    if (!this.contextItems.has(id)) {
      return false;
    }

    if (isAnchor) {
      this.anchorPoints.add(id);
    } else {
      this.anchorPoints.delete(id);
    }

    return true;
  }

  getContextItem(id: string): ContextItem | undefined {
    return this.contextItems.get(id);
  }

  getActiveContext(maxItems: number = 10): ContextItem[] {
    const anchorItems = Array.from(this.anchorPoints)
      .map(id => this.contextItems.get(id))
      .filter((item): item is ContextItem => !!item);

    const nonAnchorItems = Array.from(this.contextItems.values())
      .filter(item => !this.anchorPoints.has(item.id));

    const sortedNonAnchorItems = this.sortContextItems(nonAnchorItems);

    const remainingSlots = Math.max(0, maxItems - anchorItems.length);
    const result = [
      ...anchorItems,
      ...sortedNonAnchorItems.slice(0, remainingSlots)
    ];

    return result;
  }

  private sortContextItems(items: ContextItem[]): ContextItem[] {
    return [...items].sort((a, b) => {
      const priorityOrder = {
        [ContextPriority.CRITICAL]: 0,
        [ContextPriority.ESSENTIAL]: 1,
        [ContextPriority.BACKGROUND]: 2
      };

      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) {
        return priorityDiff;
      }

      return b.timestamp - a.timestamp;
    });
  }

  clearNonAnchorContext(): void {
    const contextToKeep = new Map<string, ContextItem>();

    for (const id of this.anchorPoints) {
      const item = this.contextItems.get(id);
      if (item) {
        contextToKeep.set(id, item);
      }
    }

    this.contextItems = contextToKeep;
  }

  public setIDERulesManager(ideRulesManager: IDERulesManager): void {
    this.ideRulesManager = ideRulesManager;
    logger.debug('IDE Rules Manager set in context');
  }

  
  public getIDERulesManager(): IDERulesManager | undefined {
    return this.ideRulesManager;
  }
}
