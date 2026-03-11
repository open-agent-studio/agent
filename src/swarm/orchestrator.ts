// ─── Swarm Orchestrator ───
// Coordinates multiple specialized agents to accomplish complex goals.
// Decomposes goals into tasks, spawns agents, routes messages, and collects results.

import { randomUUID } from 'node:crypto';
import { MessageBus } from './bus.js';
import { getRole } from './roles.js';
import { RemoteAgentBridge } from './remote-agent.js';
import type {
    SwarmConfig, SwarmState, SwarmAgent, AgentTask,
    AgentRole, SwarmMessage,
} from './types.js';
import { DEFAULT_SWARM_CONFIG } from './types.js';

export class SwarmOrchestrator {
    private config: SwarmConfig;
    private bus: MessageBus;
    private state: SwarmState;
    private taskCallbacks: Map<string, (result: string) => void> = new Map();
    private remoteAgents: Map<string, RemoteAgentBridge> = new Map();

    constructor(config?: Partial<SwarmConfig>) {
        this.config = { ...DEFAULT_SWARM_CONFIG, ...config };
        this.bus = new MessageBus();
        this.state = {
            id: randomUUID(),
            status: 'idle',
            agents: [],
            tasks: [],
        };
    }

    /** Current swarm state */
    get swarmState(): SwarmState {
        return { ...this.state };
    }

    /** Whether the swarm is actively processing */
    get isActive(): boolean {
        return this.state.status === 'running';
    }

    /**
     * Start a swarm session for a given goal.
     * The orchestrator will:
     * 1. Spawn a planner agent
     * 2. Let the planner decompose the goal into tasks
     * 3. Spawn specialist agents for each task
     * 4. Coordinate execution and collect results
     */
    async run(goal: string): Promise<SwarmState> {
        this.state.status = 'running';
        this.state.goalDescription = goal;
        this.state.startedAt = new Date();

        try {
            // Phase 1: Planning
            const plannerAgent = this.spawnAgent('planner');
            const planTask = this.createTask({
                description: `Analyze and decompose the following goal into actionable tasks:\n\n${goal}`,
                role: 'planner',
            });
            this.assignTask(planTask.id, plannerAgent.id);

            // Phase 2: The planner will produce subtasks via the message bus
            // In a full implementation, this would invoke the LLM per agent.
            // For now, we set up the coordination framework.

            // Monitor the bus for task completions
            this.bus.on('message', (msg: SwarmMessage) => {
                this.handleMessage(msg);
            });

            // Phase 3: Mark orchestrator as ready
            this.bus.send('orchestrator', 'broadcast', 'status_update', {
                status: 'Swarm initialized',
                goal,
                agents: this.state.agents.length,
            });

            return this.state;
        } catch (err) {
            this.state.status = 'failed';
            throw err;
        }
    }

    /**
     * Spawn a new agent with a specific role.
     */
    spawnAgent(role: AgentRole, name?: string): SwarmAgent {
        if (this.state.agents.length >= this.config.maxAgents) {
            throw new Error(`Max agents (${this.config.maxAgents}) reached. Increase swarm.maxAgents in config.`);
        }

        const roleDef = getRole(role);
        const agent: SwarmAgent = {
            id: `agent-${role}-${randomUUID().slice(0, 8)}`,
            role,
            name: name || roleDef?.name || role,
            status: 'idle',
            model: this.config.model,
            depth: 0,
            completedTasks: 0,
        };

        this.state.agents.push(agent);

        // Subscribe agent to the message bus
        this.bus.subscribe(agent.id, (msg) => {
            this.handleAgentMessage(agent.id, msg);
        });

        return agent;
    }

    /**
     * Add a remote agent to the swarm.
     */
    addRemoteAgent(url: string, role: AgentRole, name: string, key?: string): SwarmAgent {
        if (this.state.agents.length >= this.config.maxAgents) {
            throw new Error(`Max agents (${this.config.maxAgents}) reached. Increase swarm.maxAgents in config.`);
        }

        const bridge = new RemoteAgentBridge(url, role, name, key);
        this.remoteAgents.set(bridge.agentInfo.id, bridge);
        this.state.agents.push(bridge.agentInfo);

        // We don't subscribe to the bus for incoming messages because 
        // the RemoteAgentBridge is a facade we invoke directly when assigned a task.
        return bridge.agentInfo;
    }

    /**
     * Create a task and add it to the task queue.
     */
    createTask(opts: {
        description: string;
        role: AgentRole;
        parentTaskId?: string;
    }): AgentTask {
        const task: AgentTask = {
            id: `task-${randomUUID().slice(0, 8)}`,
            description: opts.description,
            role: opts.role,
            status: 'pending',
            createdAt: new Date(),
            parentTaskId: opts.parentTaskId,
        };

        this.state.tasks.push(task);
        return task;
    }

    /**
     * Assign a task to a specific agent.
     */
    assignTask(taskId: string, agentId: string): void {
        const task = this.state.tasks.find(t => t.id === taskId);
        const agent = this.state.agents.find(a => a.id === agentId);

        if (!task || !agent) throw new Error('Task or agent not found');

        task.assignedTo = agentId;
        task.status = 'running';
        agent.status = 'busy';
        agent.currentTask = taskId;

        const remoteBridge = this.remoteAgents.get(agentId);
        if (remoteBridge) {
            // Task assigned to remote agent: execute in background
            remoteBridge.executeTask(task, (msg) => {
                this.bus.send(agentId, 'orchestrator', 'status_update', { taskId, status: msg });
            }).then(result => {
                this.completeTask(taskId, result);
            }).catch(err => {
                this.failTask(taskId, err.message);
            });
        }

        this.bus.send('orchestrator', agentId, 'task_assign', {
            taskId: task.id,
            description: task.description,
            role: task.role,
        });
    }

    /**
     * Complete a task with a result.
     */
    completeTask(taskId: string, result: string): void {
        const task = this.state.tasks.find(t => t.id === taskId);
        if (!task) return;

        task.status = 'completed';
        task.result = result;
        task.completedAt = new Date();

        const agent = this.state.agents.find(a => a.id === task.assignedTo);
        if (agent) {
            agent.status = 'idle';
            agent.currentTask = undefined;
            agent.completedTasks++;
        }

        this.bus.send(task.assignedTo || 'unknown', 'orchestrator', 'task_result', {
            taskId,
            result,
        });

        // Check if all tasks are done
        const allDone = this.state.tasks.every(t => t.status === 'completed' || t.status === 'failed');
        if (allDone && this.state.tasks.length > 0) {
            this.state.status = 'completed';
            this.state.completedAt = new Date();
        }

        // Resolve any waiting callbacks
        const cb = this.taskCallbacks.get(taskId);
        if (cb) {
            cb(result);
            this.taskCallbacks.delete(taskId);
        }
    }

    /**
     * Fail a task with an error.
     */
    failTask(taskId: string, error: string): void {
        const task = this.state.tasks.find(t => t.id === taskId);
        if (!task) return;

        task.status = 'failed';
        task.error = error;
        task.completedAt = new Date();

        const agent = this.state.agents.find(a => a.id === task.assignedTo);
        if (agent) {
            agent.status = 'error';
            agent.currentTask = undefined;
        }

        this.bus.send(task.assignedTo || 'unknown', 'orchestrator', 'task_error', {
            taskId,
            error,
        });
    }

    /**
     * Handle delegation: an agent requests spawning a sub-agent.
     */
    delegate(fromAgentId: string, role: AgentRole, description: string): AgentTask {
        const fromAgent = this.state.agents.find(a => a.id === fromAgentId);
        if (!fromAgent) throw new Error(`Agent ${fromAgentId} not found`);

        if (fromAgent.depth >= this.config.maxDelegationDepth) {
            throw new Error(`Max delegation depth (${this.config.maxDelegationDepth}) reached`);
        }

        if (!this.config.allowDelegation) {
            throw new Error('Delegation is disabled in swarm config');
        }

        const subAgent = this.spawnAgent(role);
        subAgent.depth = fromAgent.depth + 1;

        const task = this.createTask({
            description,
            role,
            parentTaskId: fromAgent.currentTask,
        });

        this.assignTask(task.id, subAgent.id);
        return task;
    }

    /**
     * Get a status summary for display.
     */
    getStatus(): {
        swarmId: string;
        status: string;
        goal?: string;
        agents: Array<{ id: string; role: string; status: string; task?: string }>;
        tasks: Array<{ id: string; role: string; status: string; assignedTo?: string }>;
        uptime?: number;
    } {
        return {
            swarmId: this.state.id,
            status: this.state.status,
            goal: this.state.goalDescription,
            agents: this.state.agents.map(a => ({
                id: a.id,
                role: a.role,
                status: a.status,
                task: a.currentTask,
            })),
            tasks: this.state.tasks.map(t => ({
                id: t.id,
                role: t.role,
                status: t.status,
                assignedTo: t.assignedTo,
            })),
            uptime: this.state.startedAt
                ? Date.now() - this.state.startedAt.getTime()
                : undefined,
        };
    }

    /**
     * Stop the swarm and clean up.
     */
    stop(): void {
        this.state.status = 'idle';
        this.state.completedAt = new Date();
        this.bus.reset();
    }

    // ─── Internal message handling ───

    private handleMessage(msg: SwarmMessage): void {
        if (msg.type === 'delegate') {
            const { role, description } = msg.payload as { role: AgentRole; description: string };
            try {
                this.delegate(msg.from, role, description);
            } catch (err) {
                this.bus.send('orchestrator', msg.from, 'task_error', {
                    error: (err as Error).message,
                });
            }
        }
    }

    private handleAgentMessage(_agentId: string, msg: SwarmMessage): void {
        if (msg.type === 'task_result') {
            const { taskId, result } = msg.payload as { taskId: string; result: string };
            this.completeTask(taskId, result);
        }
        if (msg.type === 'task_error') {
            const { taskId, error } = msg.payload as { taskId: string; error: string };
            this.failTask(taskId, error);
        }
    }
}

// ─── Singleton ───
let swarmInstance: SwarmOrchestrator | null = null;

export function getSwarmOrchestrator(): SwarmOrchestrator | null {
    return swarmInstance;
}

export function initSwarmOrchestrator(config?: Partial<SwarmConfig>): SwarmOrchestrator {
    swarmInstance = new SwarmOrchestrator(config);
    return swarmInstance;
}
