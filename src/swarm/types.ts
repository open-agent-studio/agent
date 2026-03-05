// ─── Swarm Types ───

export type AgentRole = 'planner' | 'coder' | 'reviewer' | 'researcher' | 'tester' | 'custom';

export interface SwarmConfig {
    /** Enable swarm mode */
    enabled: boolean;
    /** Max concurrent agents */
    maxAgents: number;
    /** Default model for swarm agents */
    model: string;
    /** Whether agents can spawn sub-agents */
    allowDelegation: boolean;
    /** Max depth of delegation chain */
    maxDelegationDepth: number;
    /** Timeout for each agent task (ms) */
    agentTimeout: number;
}

export const DEFAULT_SWARM_CONFIG: SwarmConfig = {
    enabled: false,
    maxAgents: 5,
    model: 'gpt-4o',
    allowDelegation: true,
    maxDelegationDepth: 3,
    agentTimeout: 120000,
};

export interface SwarmMessage {
    id: string;
    from: string;        // agent ID
    to: string;          // agent ID or 'broadcast'
    type: SwarmMessageType;
    payload: unknown;
    timestamp: Date;
}

export type SwarmMessageType =
    | 'task_assign'
    | 'task_result'
    | 'task_error'
    | 'delegate'
    | 'status_update'
    | 'artifact'
    | 'review_request'
    | 'review_response'
    | 'broadcast';

export interface AgentTask {
    id: string;
    description: string;
    role: AgentRole;
    assignedTo?: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    result?: string;
    error?: string;
    createdAt: Date;
    completedAt?: Date;
    parentTaskId?: string;
    subtasks?: string[];
}

export interface SwarmAgent {
    id: string;
    role: AgentRole;
    name: string;
    status: 'idle' | 'busy' | 'done' | 'error';
    currentTask?: string;
    model: string;
    depth: number;          // delegation depth
    completedTasks: number;
}

export interface SwarmState {
    id: string;
    status: 'idle' | 'running' | 'completed' | 'failed';
    agents: SwarmAgent[];
    tasks: AgentTask[];
    startedAt?: Date;
    completedAt?: Date;
    goalDescription?: string;
}
