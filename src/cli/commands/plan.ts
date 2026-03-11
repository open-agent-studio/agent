import { Command } from 'commander';
import chalk from 'chalk';
import { ConfigLoader } from '../../config/loader.js';
import { ToolRegistry } from '../../tools/registry.js';
import { PolicyEngine } from '../../policy/engine.js';
import { SkillLoader } from '../../skills/loader.js';
import { SkillRunner } from '../../skills/runner.js';
import { LLMRouter } from '../../llm/router.js';
import { ExecutionEngine } from '../../engine/executor.js';
import { PlanParser } from '../../plans/parser.js';
import { PlanRunner } from '../../plans/runner.js';
import { PlanProposer } from '../../plans/propose.js';
import { AuditLogger } from '../../logging/audit-log.js';
import { registerCoreTools } from './init.js';
import { promptApproval } from '../ui/prompt.js';
import { renderRunReport } from '../ui/report.js';
import { progress } from '../ui/progress.js';
import { generateRunId } from '../../utils/paths.js';
import type { ExecutionContext } from '../../tools/types.js';

export function createPlanCommand(): Command {
    const cmd = new Command('plan')
        .description('Manage and run plans');

    cmd
        .command('list')
        .description('List available plans')
        .action(async () => {
            const parser = new PlanParser();
            const plans = await parser.listPlans();

            if (plans.length === 0) {
                console.log(chalk.yellow('\nNo plans found.'));
                console.log(chalk.dim('  Create one in .agent/plans/*.plan.yaml\n'));
                return;
            }

            console.log(chalk.bold.cyan('\nAvailable Plans\n'));
            for (const plan of plans) {
                console.log(`  ${chalk.white.bold(plan.name)} ${chalk.dim(plan.path)}`);
            }
            console.log();
        });

    cmd
        .command('validate <name>')
        .description('Validate a plan file')
        .action(async (name: string) => {
            const parser = new PlanParser();
            const plan = await parser.findPlan(name);

            if (!plan) {
                console.error(chalk.red(`\nPlan "${name}" not found\n`));
                process.exit(1);
            }

            console.log(chalk.green(`\n✓ Plan "${name}" is valid\n`));
            console.log(`  ${chalk.dim('Goals:')}  ${plan.goals.length}`);
            console.log(`  ${chalk.dim('Steps:')}  ${plan.steps.length}`);
            console.log(`  ${chalk.dim('Mode:')}   ${plan.mode}`);
            console.log(`  ${chalk.dim('Trigger:')} ${plan.trigger.type}`);
            console.log();
        });

    cmd
        .command('run <name>')
        .description('Execute a plan')
        .option('-a, --autonomous', 'Auto-approve low-risk actions')
        .action(async (name: string, options: { autonomous?: boolean }) => {
            const configLoader = new ConfigLoader();
            const config = await configLoader.load();

            const registry = ToolRegistry.getInstance();
            registerCoreTools(registry);

            const policy = new PolicyEngine(config, process.cwd());
            const skillLoader = new SkillLoader(config);
            const llmRouter = new LLMRouter(config);
            const skillRunner = new SkillRunner(registry, policy, llmRouter);
            const engine = new ExecutionEngine(registry, llmRouter, policy, skillLoader, skillRunner);
            const planParser = new PlanParser();
            const planRunner = new PlanRunner(engine, llmRouter);

            await skillLoader.loadAll();

            const plan = await planParser.findPlan(name);
            if (!plan) {
                console.error(chalk.red(`\nPlan "${name}" not found\n`));
                process.exit(1);
            }

            const ctx: ExecutionContext = {
                runId: generateRunId(),
                cwd: process.cwd(),
                config,
                autonomous: options.autonomous ?? false,
                approvedPermissions: new Set(),
                onApproval: promptApproval,
                onProgress: (msg) => progress.info(msg),
            };

            progress.start(`Plan: ${plan.name}`, plan.steps.length);

            const result = await planRunner.run(plan, ctx);

            renderRunReport(result);
        });

    cmd
        .command('propose <name>')
        .description('Create a proposed plan run for review')
        .action(async (name: string) => {
            const configLoader = new ConfigLoader();
            await configLoader.load();
            const planParser = new PlanParser();
            const proposer = new PlanProposer();

            const plan = await planParser.findPlan(name);
            if (!plan) {
                console.error(chalk.red(`\nPlan "${name}" not found\n`));
                process.exit(1);
            }

            const run = await proposer.createProposal(plan, 'cli');

            console.log(chalk.green(`\n✓ Proposed run created: ${run.runId}`));
            console.log(chalk.dim(`\n  To approve and execute:`));
            console.log(chalk.dim(`    agent plan approve ${run.runId}`));
            console.log(chalk.dim(`    agent plan execute ${run.runId}\n`));
        });

    cmd
        .command('runs')
        .description('List plan run history')
        .action(async () => {
            const runs = await AuditLogger.listRuns();

            if (runs.length === 0) {
                console.log(chalk.yellow('\nNo runs found.\n'));
                return;
            }

            console.log(chalk.bold.cyan('\nRun History\n'));
            for (const runId of runs.slice(0, 20)) {
                const log = await AuditLogger.loadRun(runId);
                if (log) {
                    const status = log.status === 'completed' ? chalk.green(log.status) :
                        log.status === 'failed' ? chalk.red(log.status) :
                            chalk.yellow(log.status);
                    console.log(`  ${chalk.dim(runId)} ${status} ${chalk.dim(log.planName ?? '')}`);
                } else {
                    console.log(`  ${chalk.dim(runId)}`);
                }
            }
            console.log();
        });

    cmd
        .command('show <runId>')
        .description('Show details of a plan run')
        .action(async (runId: string) => {
            const log = await AuditLogger.loadRun(runId);
            if (!log) {
                console.error(chalk.red(`\nRun "${runId}" not found\n`));
                process.exit(1);
            }

            console.log(chalk.bold.cyan(`\nRun: ${runId}\n`));
            console.log(`  ${chalk.dim('Plan:')}    ${log.planName ?? 'N/A'}`);
            console.log(`  ${chalk.dim('Status:')}  ${log.status}`);
            console.log(`  ${chalk.dim('Started:')} ${log.startedAt}`);
            console.log(`  ${chalk.dim('Ended:')}   ${log.completedAt ?? 'N/A'}`);

            if (log.summary) {
                console.log(`\n  ${chalk.dim('Summary:')}`);
                console.log(`    Steps completed: ${log.summary.stepsCompleted}`);
                console.log(`    Steps failed:    ${log.summary.stepsFailed}`);
                console.log(`    Files changed:   ${log.summary.filesChanged}`);
                console.log(`    Duration:        ${log.summary.durationMs}ms`);
            }

            if (log.steps.length > 0) {
                console.log(`\n  ${chalk.dim('Steps:')}`);
                for (const step of log.steps) {
                    const icon = step.status === 'completed' ? chalk.green('✓') :
                        step.status === 'failed' ? chalk.red('✗') : chalk.dim('·');
                    console.log(`    ${icon} ${step.stepId} [${step.status}]`);
                    if (step.error) console.log(chalk.red(`      ${step.error}`));
                }
            }

            console.log();
        });

    cmd
        .command('approve <runId>')
        .description('Approve a proposed plan run')
        .action(async (runId: string) => {
            const proposer = new PlanProposer();
            const approved = await proposer.approve(runId);

            if (approved) {
                console.log(chalk.green(`\n✓ Run ${runId} approved`));
                console.log(chalk.dim(`\n  Execute with: agent plan execute ${runId}\n`));
            } else {
                console.error(chalk.red(`\n✗ Could not approve run ${runId}\n`));
            }
        });

    cmd
        .command('execute <runId>')
        .description('Execute an approved plan run')
        .action(async (runId: string) => {
            const configLoader = new ConfigLoader();
            const config = await configLoader.load();
            const proposer = new PlanProposer();
            const proposal = await proposer.loadProposal(runId);

            if (!proposal) {
                console.error(chalk.red(`\nRun "${runId}" not found\n`));
                process.exit(1);
            }

            if (proposal.run.status !== 'pending') {
                console.error(chalk.red(`\nRun "${runId}" is not approved (status: ${proposal.run.status})\n`));
                process.exit(1);
            }

            const registry = ToolRegistry.getInstance();
            registerCoreTools(registry);

            const policy = new PolicyEngine(config, process.cwd());
            const skillLoader = new SkillLoader(config);
            const llmRouter = new LLMRouter(config);
            const skillRunner = new SkillRunner(registry, policy, llmRouter);
            const engine = new ExecutionEngine(registry, llmRouter, policy, skillLoader, skillRunner);
            const planRunner = new PlanRunner(engine, llmRouter);

            await skillLoader.loadAll();

            const ctx: ExecutionContext = {
                runId,
                cwd: process.cwd(),
                config,
                autonomous: false,
                approvedPermissions: new Set(),
                onApproval: promptApproval,
                onProgress: (msg) => progress.info(msg),
            };

            const result = await planRunner.run(proposal.plan, ctx);
            renderRunReport(result);
        });

    return cmd;
}
