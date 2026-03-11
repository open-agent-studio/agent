import { LLMRouter } from '../llm/router.js';
import type { PlanStep } from '../plans/types.js';
import type { StepResult } from './types.js';

export interface EvaluationResult {
    success: boolean;
    confidence: number;
    feedback: string;
}

export class AgentEvaluator {
    private router: LLMRouter;

    constructor(router: LLMRouter) {
        this.router = router;
    }

    /**
     * Evaluates a completed task step to determine if it actually succeeded
     * in its objective, based on the outputs and the stated goal.
     */
    async evaluateStep(step: PlanStep, stepResult: StepResult): Promise<EvaluationResult> {
        // Prepare context for the critic
        const prompt = `
You are an expert software developer and Agent Critic.
Your job is to evaluate if a specific action taken by an autonomous agent was successful based on its stated goal.

### Task Goal:
${step.description || step.name}

### Action Taken:
Tool Used: ${step.tool || step.skill || 'unknown'}
Input Arguments: ${JSON.stringify(step.args, null, 2)}

### Action Output:
${stepResult.output || stepResult.error}

### Evaluation Instructions:
1. Did the action accomplish the intended goal?
2. Did the tool throw a critical error that prevents progress?
3. If partial success, is it enough to proceed to the next task?

Respond strictly in the JSON format below:
{
  "success": boolean, // true if successful enough to proceed, false if failed and needs correction
  "confidence": number, // 1-10 scale
  "feedback": "string" // Brief explanation of why it succeeded or failed. If failed, hint on what to try next.
}
`;

        try {
            const responseText = await this.router.generateText(prompt, { temperature: 0.1 });

            // Extract JSON from potential markdown wrapping
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                console.warn('[Evaluator] Failed to parse JSON from critic. Defaulting to success.', responseText);
                return { success: true, confidence: 5, feedback: 'Critic failed to return valid JSON.' };
            }

            const parsed = JSON.parse(jsonMatch[0]) as EvaluationResult;
            return parsed;
        } catch (error) {
            console.error('[Evaluator] Error during evaluation:', error);
            // Default to true on error so we don't block execution if the API glitches
            return {
                success: true,
                confidence: 5,
                feedback: `Critic error: ${(error as Error).message}`
            };
        }
    }
}
