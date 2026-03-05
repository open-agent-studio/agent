// ─── Swarm Module Index ───
export { SwarmOrchestrator, getSwarmOrchestrator, initSwarmOrchestrator } from './orchestrator.js';
export { MessageBus } from './bus.js';
export { BUILT_IN_ROLES, getRole, getAllRoles } from './roles.js';
export type {
    SwarmConfig, SwarmState, SwarmAgent, AgentTask,
    AgentRole, SwarmMessage, SwarmMessageType,
} from './types.js';
export { DEFAULT_SWARM_CONFIG } from './types.js';
