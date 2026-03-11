import { LLMRouter } from '../llm/router.js';
import type { PlanStep } from './types.js';

export class PlanCorrector {
    private router: LLMRouter;

    constructor(router: LLMRouter) {
        this.router = router;
    }

    /**
     * Generates a set of corrective steps based on the failure feedback
     * from the AgentEvaluator.
     */
    async generateCorrections(
        originalStep: PlanStep,
        error: string,
        contextVariables: Record<string, unknown>
    ): Promise<PlanStep[]> {
        const prompt = `
You are an autonomous agent recovery planner.
A plan step just failed, and you need to generate 1 to 3 new steps to correct the problem so the original step can be retried successfully.

### Failed Step:
Name: ${originalStep.name}
Description: ${originalStep.description || 'N/A'}
Tool Attempted: ${originalStep.tool || originalStep.skill || 'unknown'}
Args: ${JSON.stringify(originalStep.args, null, 2)}

### Failure Reason / Critic Feedback:
${error}

### Current Context:
${JSON.stringify(contextVariables, null, 2)}

Generate a JSON array of NEW steps to execute BEFORE we retry the failed step.
The steps must conform exactly to this TypeScript interface:
interface PlanStep {
    id: string; // generate a unique id like 'recovery-step-1'
    name: string;
    description: string;
    tool?: string; // e.g., 'fs.read', 'os.exec', 'github.search'
    args?: Record<string, unknown>;
}

Respond STRICTLY with the JSON array, no markdown wrapping, no extra text.
`;

        try {
            const responseText = await this.router.generateText(prompt, { temperature: 0.2 });
            const jsonMatch = responseText.match(/\[[\s\S]*\]/);

            if (!jsonMatch) {
                console.warn('[PlanCorrector] Failed to parse JSON from recovery prompt.', responseText);
                return [];
            }

            const steps = JSON.parse(jsonMatch[0]) as PlanStep[];
            return steps.map(s => ({
                ...s,
                id: `recovery-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`
            }));
        } catch (error) {
            console.error('[PlanCorrector] Failed to generate corrections:', error);
            return [];
        }
    }
}
