import { SkillLoader } from '../skills/loader.js';
import type { AgentConfig } from '../config/schema.js';

export class McpPromptManager {
    private skillLoader: SkillLoader;

    constructor(config: AgentConfig) {
        this.skillLoader = new SkillLoader(config);
    }

    async init() {
        await this.skillLoader.loadAll();
    }

    getPrompts() {
        return this.skillLoader.list().map(skill => ({
            name: `skill_${skill.manifest.name}`,
            description: `Runs the agent with the ${skill.manifest.name} skill context. ${skill.manifest.description}`,
            arguments: [
                {
                    name: 'goal',
                    description: 'The task or goal to accomplish',
                    required: true
                }
            ]
        }));
    }

    async getPrompt(name: string, args: Record<string, string> | undefined) {
        if (!name.startsWith('skill_')) {
            throw new Error(`Unknown prompt: ${name}`);
        }

        const skillName = name.replace('skill_', '');
        const skill = this.skillLoader.get(skillName);

        if (!skill) {
            throw new Error(`Skill not found: ${skillName}`);
        }

        return {
            description: skill.manifest.description,
            messages: [
                {
                    role: 'user',
                    content: {
                        type: 'text',
                        text: args?.goal
                            ? `Use the ${skillName} skill to achieve this goal: ${args.goal}`
                            : `Please load the ${skillName} skill.`
                    }
                }
            ]
        };
    }
}
