import fs from 'fs';
import { promises as fsPromises } from 'fs';
import path from 'path';
import { IDEType, IDERule, IDERules } from '../core/types.js';
import logger from '../core/logger.js';

import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class IDERulesManager {
  private static instance: IDERulesManager;
  private idePath: string;
  private ideType: IDEType;
  private loadedRules: Map<IDEType, IDERules>;
  private workspaceRoot: string;

  private constructor() {
    this.ideType = IDEType.AUTO;
    this.loadedRules = new Map();
    this.workspaceRoot = process.cwd();
    
    this.idePath = path.join(__dirname, 'rules_fallback'); 
    
    if (process.env.WORKSPACE_FOLDER_PATHS) {
      const paths = process.env.WORKSPACE_FOLDER_PATHS.split(';');
      if (paths.length > 0 && paths[0]) {
        this.workspaceRoot = paths[0];
        logger.info(`Using workspace path from WORKSPACE_FOLDER_PATHS: ${this.workspaceRoot}`);
      }
    }
    
    const envIdeType = process.env.IDE || process.env.CONDUCTOR_IDE_TYPE;
    if (envIdeType) {
      const normalizedType = envIdeType.toLowerCase();
      const validIdeType = Object.values(IDEType).find(
        type => type.toLowerCase() === normalizedType
      );
      
      if (validIdeType) {
        this.ideType = validIdeType as IDEType;
        logger.info(`Using IDE type from environment: ${this.ideType}`);
      } else {
        logger.warn(`Invalid IDE type in environment: ${envIdeType}. Using AUTO.`);
      }
    }
  }

  public static getInstance(): IDERulesManager {
    if (!IDERulesManager.instance) {
      IDERulesManager.instance = new IDERulesManager();
    }
    return IDERulesManager.instance;
  }

  public getIDEType(): IDEType {
    return this.ideType;
  }

  public setIDEType(ideType: IDEType): void {
    this.ideType = ideType;
  }

  public getWorkspaceRoot(): string {
    return this.workspaceRoot;
  }

  public setWorkspaceRoot(workspaceRoot: string): void {
    if (workspaceRoot && fs.existsSync(workspaceRoot)) {
      this.workspaceRoot = workspaceRoot;
      logger.info(`Set workspace root to: ${this.workspaceRoot}`);
    } else {
      logger.warn(`Invalid workspace root provided: ${workspaceRoot}. Using current: ${this.workspaceRoot}`);
    }
  }

  private getRulesDirectoryForIDE(): string {
    switch (this.ideType) {
      case IDEType.CURSOR:
        return path.join(this.workspaceRoot, '.cursor', 'rules');
      case IDEType.WINDSURF:
        return this.workspaceRoot; 
      case IDEType.ROO_CODE:
        return path.join(this.workspaceRoot, '.roo'); 
      case IDEType.CLINE:
        return path.join(this.workspaceRoot, '.cline', 'rules');
      default:
        
        
        return path.join(__dirname, 'rules_fallback', 'generic'); 
    }
  }

  private async readRuleTemplate(filename: string): Promise<string> {
    try {
      const possiblePaths = [
        path.resolve(__dirname, '..', '..', 'src', 'ide', 'rule_templates', filename),
        path.resolve(__dirname, 'rule_templates', filename),
        path.resolve(__dirname, '..', 'ide', 'rule_templates', filename),
        path.resolve(process.cwd(), 'src', 'ide', 'rule_templates', filename)
      ];
      
      for (const templatePath of possiblePaths) {
        if (fs.existsSync(templatePath)) {
          logger.info(`Reading rule template from: ${templatePath}`);
          return await fsPromises.readFile(templatePath, 'utf8');
        }
      }
      
      logger.error(`Rule template file not found: ${filename}. Attempted paths:`, possiblePaths);
      
      return `# Rule template not found: ${filename}
# 
# This appears to be an installation issue. The rule template files are missing.
# Please report this issue at: https://github.com/hridaya423/conductor-tasks/issues
# 
# Attempted paths:
${possiblePaths.map(p => `# - ${p}`).join('\n')}
#
# As a workaround, you can manually create this file with your own rules.
`;
    } catch (error) {
      logger.error(`Error reading rule template ${filename}:`, { error });
      return `# Error reading rule template ${filename}
# Error: ${error instanceof Error ? error.message : String(error)}
# Please report this issue at: https://github.com/hridaya423/conductor-tasks/issues
`;
    }
  }

  private async createDefaultRuleFiles(): Promise<void> {
    if (this.ideType === IDEType.AUTO) {
      logger.info('IDE type is AUTO, skipping default rule file creation');
      return;
    }

    try {
      logger.info(`Creating rule files ONLY for IDE type: ${this.ideType}`);
      logger.info(`Using workspace root: ${this.workspaceRoot}`);

      if (this.ideType === IDEType.CURSOR) {
        const rulesDir = path.join(this.workspaceRoot, '.cursor', 'rules');
        logger.info(`Target Cursor rules directory: ${rulesDir}`);
        if (!fs.existsSync(rulesDir)) {
          await fsPromises.mkdir(rulesDir, { recursive: true });
        }
        
        const ruleTemplates = {
          'conductor_tasks_workflow.mdc': 'cursor_conductor_tasks_workflow.mdc',
          'conductor_task_management.mdc': 'cursor_conductor_task_management.mdc',
          'cursor_dev_workflow.mdc': 'cursor_dev_workflow.mdc',
        };
        
        const writingPromises = Object.entries(ruleTemplates).map(async ([filename, templateName]) => {
          const content = await this.readRuleTemplate(templateName);
          const filePath = path.join(rulesDir, filename);
          
          let existingContent: string | null = null;
          if (fs.existsSync(filePath)) {
            existingContent = await fsPromises.readFile(filePath, 'utf8');
          }

          if (existingContent !== content) {
            await fsPromises.writeFile(filePath, content, 'utf8');
            logger.info(`Wrote/Updated Cursor rule file: ${filePath}`);
          }
        });
        await Promise.all(writingPromises);
        logger.info('Finished processing Cursor IDE rule files.');
      }
      
      else if (this.ideType === IDEType.WINDSURF) {
        const windsurfFile = path.join(this.workspaceRoot, '.windsurfrules');
        const windsurfContent = await this.readRuleTemplate('windsurf.txt');
        await fsPromises.writeFile(windsurfFile, windsurfContent, 'utf8');
        logger.info(`Wrote/Updated Windsurf rules file: ${windsurfFile}`);
      }
      
      else if (this.ideType === IDEType.ROO_CODE) {
        const roomodeFile = path.join(this.workspaceRoot, '.roomode');
        const roomodeContent = await this.readRuleTemplate('roo_mode.txt');
        await fsPromises.writeFile(roomodeFile, roomodeContent, 'utf8');
        logger.info(`Wrote/Updated Roo Code mode file: ${roomodeFile}`);

        const rooRulesSubDirs = ['rules', 'rules-architect', 'rules-ask', 'rules-code', 'rules-debug', 'rules-test'];
        for (const subDir of rooRulesSubDirs) {
            const dirPath = path.join(this.workspaceRoot, '.roo', subDir);
            if (!fs.existsSync(dirPath)) {
                await fsPromises.mkdir(dirPath, { recursive: true });
            }
        }
        
        const rulesContentMap: Record<string, Record<string, string>> = {
          'rules': { 'conductor-tasks-general.rules': 'roo_general.txt' },
          'rules-architect': { 'architecture-conductor.rules': 'roo_architect.txt' },
          'rules-ask': { 'planning-clarification-conductor.rules': 'roo_ask.txt' },
          'rules-code': { 'coding-conductor.rules': 'roo_code.txt' },
          'rules-debug': { 'debugging-conductor.rules': 'roo_debug.txt' },
          'rules-test': { 'testing-conductor.rules': 'roo_test.txt' },
        };
        
        const rooWritingPromises: Promise<void>[] = [];
        for (const [dirName, files] of Object.entries(rulesContentMap)) {
          const dirPath = path.join(this.workspaceRoot, '.roo', dirName);
          for (const [fileName, templateName] of Object.entries(files)) {
            rooWritingPromises.push((async () => {
              const content = await this.readRuleTemplate(templateName);
              const filePath = path.join(dirPath, fileName);
              let existingContent: string | null = null;
              if (fs.existsSync(filePath)) {
                existingContent = await fsPromises.readFile(filePath, 'utf8');
              }
              if (existingContent !== content) {
                  await fsPromises.writeFile(filePath, content, 'utf8');
                  logger.info(`Wrote/Updated Roo Code rule file: ${filePath}`);
              }
            })());
          }
        }
        await Promise.all(rooWritingPromises);
        logger.info('Finished processing Roo Code IDE rule files.');
      }
      
      else if (this.ideType === IDEType.CLINE) {
        const clineRulesDir = path.join(this.workspaceRoot, '.cline', 'rules');
        if (!fs.existsSync(clineRulesDir)) {
          await fsPromises.mkdir(clineRulesDir, { recursive: true });
        }
        const clineRulesContent = await this.readRuleTemplate('cline.txt');
        const filePath = path.join(clineRulesDir, 'conductor-tasks.rules');
        let existingContent: string | null = null;
        if (fs.existsSync(filePath)) {
            existingContent = await fsPromises.readFile(filePath, 'utf8');
        }
        if (existingContent !== clineRulesContent) {
            await fsPromises.writeFile(filePath, clineRulesContent, 'utf8');
            logger.info(`Wrote/Updated Cline rules file: ${filePath}`);  
        }
        logger.info('Finished processing Cline IDE rule files.');
      }
    } catch (error) {
      logger.error('Failed to create default rule files', { error });
    }
  }

  private async cleanupUnusedRuleFiles(): Promise<void> {
    
    
    try {
      if (this.ideType !== IDEType.AUTO) {
        logger.info(`Cleanup check for non-${this.ideType} IDEs (currently minimal due to rule externalization)`);
        
        
      }
    } catch (error) {
      logger.error('Failed to clean up unused rule files', { error });
    }
  }

  private async removeDirectoryRecursive(dirPath: string): Promise<void> {
    try {
      if (fs.existsSync(dirPath)) { 
        await fsPromises.rm(dirPath, { recursive: true, force: true });
        logger.info(`Successfully removed directory recursively: ${dirPath}`);
      }
    } catch (error: any) {
      
      logger.error(`Error removing directory recursively ${dirPath}:`, { error: error.message });
      
    }
  }

  public async loadRules(forceReload = false): Promise<void> {
    if (this.loadedRules.size > 0 && !forceReload) {
      return;
    }

    try {
      await this.cleanupUnusedRuleFiles(); 
      if (forceReload) {
        await this.createDefaultRuleFiles();
      } else {
        const rulesDir = this.getRulesDirectoryForIDE(); 
        const dirExists = fs.existsSync(rulesDir);
        
        
        let shouldCreateDefaults = !dirExists;
        if (dirExists && this.ideType === IDEType.CURSOR || this.ideType === IDEType.CLINE || this.ideType === IDEType.ROO_CODE) {
            
            
            const checkDir = this.ideType === IDEType.ROO_CODE ? path.join(rulesDir, 'rules') : rulesDir;
            if (fs.existsSync(checkDir) && fs.readdirSync(checkDir).length === 0) {
                shouldCreateDefaults = true;
            } else if (!fs.existsSync(checkDir)) {
                shouldCreateDefaults = true;
            }
        }


        if (shouldCreateDefaults) {
          logger.info(`Rules directory for ${this.ideType} not found or empty, creating default files`);
          await this.createDefaultRuleFiles();
        }
      }

      if (this.ideType !== IDEType.AUTO) {
        const rules = await this.loadRulesForType(this.ideType);
        if (rules) {
          this.loadedRules.set(this.ideType, rules);
          logger.info(`Loaded IDE rules for specified type: ${this.ideType}`);
        }
      } else {
        for (const type of Object.values(IDEType)) {
          if (type !== IDEType.AUTO && type !== IDEType.GENERIC) {
            const rules = await this.loadRulesForType(type as IDEType);
            if (rules) {
              this.loadedRules.set(type as IDEType, rules);
            }
          }
        }
        logger.info(`Loaded IDE rules for: ${Array.from(this.loadedRules.keys()).join(', ')}`);
      }
    } catch (error) {
      logger.error('Failed to load rules', { error });
    }
  }

  private async loadRulesForType(ideType: IDEType): Promise<IDERules | null> {
    
    try {
      let rules: IDERule[] = [];
      const ideRulesDir = this.getRulesDirectoryForIDE(); 

      if (ideType === IDEType.CURSOR) {
        const ruleFileNames = ['conductor_tasks_workflow.mdc', 'conductor_task_management.mdc', 'cursor_dev_workflow.mdc'];
        for (const fileName of ruleFileNames) {
          const filePath = path.join(ideRulesDir, fileName);
          if (fs.existsSync(filePath)) { 
            const content = await fsPromises.readFile(filePath, 'utf8');
            let description = `Cursor IDE Rule: ${fileName}`;
            const descMatch = content.match(/description:\\s*(.*)/);
            if (descMatch && descMatch[1]) {
              description = descMatch[1].trim();
            }
            rules.push({ name: fileName, description, content });
          }
        }
      } else if (ideType === IDEType.WINDSURF) {
        const filePath = path.join(ideRulesDir, '.windsurfrules');
        if (fs.existsSync(filePath)) { 
          const content = await fsPromises.readFile(filePath, 'utf8');
          rules.push({ name: '.windsurfrules', description: 'Windsurf IDE Rules', content });
        }
      } else if (ideType === IDEType.ROO_CODE) {
        const roomodeFilePath = path.join(ideRulesDir, '.roomode');
        if (fs.existsSync(roomodeFilePath)) { 
            rules.push({ name: '.roomode', description: 'Roo Code Mode Configuration', content: await fsPromises.readFile(roomodeFilePath, 'utf8')});
        }
        const rooSubDirs = ['rules', 'rules-architect', 'rules-ask', 'rules-code', 'rules-debug', 'rules-test'];
        for (const subDir of rooSubDirs) {
            const actualRulesPath = path.join(ideRulesDir, subDir);
            if (fs.existsSync(actualRulesPath)) { 
                const files = await fsPromises.readdir(actualRulesPath);
                for (const file of files) {
                    if (file.endsWith('.rules')) {
                        const filePath = path.join(actualRulesPath, file);
                        const content = await fsPromises.readFile(filePath, 'utf8');
                        rules.push({ name: `${subDir}/${file}`, description: `Roo Code Rules (${subDir}): ${file}`, content });
                    }
                }
            }
        }
      } else if (ideType === IDEType.CLINE) {
        const filePath = path.join(ideRulesDir, 'conductor-tasks.rules');
        if (fs.existsSync(filePath)) { 
          const content = await fsPromises.readFile(filePath, 'utf8');
          rules.push({ name: 'conductor-tasks.rules', description: 'Cline IDE Rule: conductor-tasks.rules', content });
        }
      }

      if (rules.length === 0) return null;
      return { type: ideType, rules };

    } catch (error) {
      logger.error(`Failed to load rules for IDE type: ${ideType}`, { error });
      return null;
    }
  }

  public async getRules(specificType?: IDEType): Promise<IDERules | null> {
    if (this.loadedRules.size === 0 && !specificType) { 
        await this.loadRules();
    } else if (specificType && !this.loadedRules.has(specificType)) { 
        const rules = await this.loadRulesForType(specificType);
        if (rules) {
            this.loadedRules.set(specificType, rules);
        }
    }
    
    if (specificType) {
      return this.loadedRules.get(specificType) || null;
    }
    return this.loadedRules.get(this.ideType) || null;
  }

  public async getRule(ruleName: string, ideType?: IDEType): Promise<IDERule | null> {
    const type = ideType || this.ideType;
    
    if (!this.loadedRules.has(type)) {
        const rules = await this.loadRulesForType(type);
        if (rules) {
            this.loadedRules.set(type, rules);
        } else {
            return null; 
        }
    }
    const rulesForType = this.loadedRules.get(type);
    if (!rulesForType) return null;
    return rulesForType.rules.find((rule: IDERule) => rule.name === ruleName) || null;
  }

  private getConductorManagedFiles(ideType: IDEType): string[] {
    switch (ideType) {
      case IDEType.CURSOR:
        return [
          'conductor_tasks_workflow.mdc',
          'conductor_task_management.mdc', 
          'cursor_dev_workflow.mdc'
        ];
      case IDEType.CLINE:
        return ['conductor-tasks.rules'];
      case IDEType.ROO_CODE:
        return [
          '.roomode',
          'rules/conductor-tasks-general.rules',
          'rules-architect/architecture-conductor.rules',
          'rules-ask/planning-clarification-conductor.rules',
          'rules-code/coding-conductor.rules',
          'rules-debug/debugging-conductor.rules',
          'rules-test/testing-conductor.rules'
        ];
      case IDEType.WINDSURF:
        return ['.windsurfrules'];
      default:
        return [];
    }
  }

  private async removeConductorManagedFiles(ideType: IDEType): Promise<void> {
    try {
      const rulesDir = this.getRulesDirectoryForIDE();
      const managedFiles = this.getConductorManagedFiles(ideType);
      
      logger.info(`Removing conductor-tasks managed files for ${ideType} from ${rulesDir}`);
      
      for (const file of managedFiles) {
        const filePath = path.join(rulesDir, file);
        if (fs.existsSync(filePath)) {
          await fsPromises.unlink(filePath);
          logger.info(`Removed conductor-tasks managed file: ${filePath}`);
        }
      }
      
      if (ideType === IDEType.ROO_CODE) {
        const rooSubDirs = ['rules', 'rules-architect', 'rules-ask', 'rules-code', 'rules-debug', 'rules-test'];
        for (const subDir of rooSubDirs) {
          const dirPath = path.join(rulesDir, subDir);
          if (fs.existsSync(dirPath)) {
            const files = await fsPromises.readdir(dirPath);
            const nonConductorFiles = files.filter(f => !f.includes('conductor'));
            if (nonConductorFiles.length === 0) {
              await fsPromises.rmdir(dirPath);
              logger.info(`Removed empty conductor directory: ${dirPath}`);
            }
          }
        }
      }
    } catch (error) {
      logger.error(`Failed to remove conductor-tasks managed files for ${ideType}`, { error });
    }
  }

  public async forceResetRules(): Promise<void> {
    try {
      logger.info(`Force resetting rules for IDE type: ${this.ideType}`);
      logger.info(`Using workspace root: ${this.workspaceRoot}`);
      
      this.loadedRules.delete(this.ideType); 
      this.loadedRules.clear(); 

      if (this.ideType !== IDEType.AUTO) {
        const rulesDir = this.getRulesDirectoryForIDE();
        logger.info(`Rules directory for IDE ${this.ideType}: ${rulesDir}`);
        
        if (fs.existsSync(rulesDir)) {
          await this.removeConductorManagedFiles(this.ideType);
        }
        
        if (!fs.existsSync(rulesDir)) {
          await fsPromises.mkdir(rulesDir, { recursive: true });
        }
      } else { 
        for (const type of Object.values(IDEType)) {
          if (type !== IDEType.AUTO && type !== IDEType.GENERIC) {
            const originalIdeTypeForAutoLoop = this.ideType; 
            this.setIDEType(type as IDEType); 
            
            const rulesDir = this.getRulesDirectoryForIDE(); 
            this.setIDEType(originalIdeTypeForAutoLoop); 

            if (fs.existsSync(rulesDir)) {
              await this.removeConductorManagedFiles(type as IDEType);
            }
            
            if (!fs.existsSync(rulesDir)) {
              await fsPromises.mkdir(rulesDir, { recursive: true });
            }
          }
        }
      }
      
      if (this.ideType === IDEType.AUTO) {
        const originalType = this.ideType; 
        for (const type of Object.values(IDEType)) {
            if (type !== IDEType.AUTO && type !== IDEType.GENERIC) {
                this.setIDEType(type as IDEType); 
                await this.createDefaultRuleFiles();
            }
        }
        this.setIDEType(originalType); 
      } else {
        await this.createDefaultRuleFiles();
      }
      
      await this.loadRules(true); 
                                  
      logger.info(`Successfully force reset rules for IDE type: ${this.ideType}`);
    } catch (error) {
      logger.error('Failed to force reset rules', { error });
    }
  }
}