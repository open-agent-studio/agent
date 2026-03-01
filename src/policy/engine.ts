import type { AgentConfig } from '../config/schema.js';
import type { ActionDescriptor, ExecutionContext, PermissionCategory } from '../tools/types.js';
import type { PermissionResult, ApprovalAction } from './types.js';
import { ScopeChecker } from './scope.js';
import { auditEmitter, AuditEventType } from './audit.js';

/**
 * Policy Engine — enforces permissions, approvals, and scope limits
 * This is an immutable core component that MUST NOT be modified by autonomous runs.
 */
export class PolicyEngine {
    private config: AgentConfig;
    private scopeChecker: ScopeChecker;
    private sessionApprovals: Set<string> = new Set();

    constructor(config: AgentConfig, projectRoot: string) {
        this.config = config;
        this.scopeChecker = new ScopeChecker(config, projectRoot);
    }

    /**
     * Check if an action is permitted based on policy rules
     */
    async checkPermission(
        action: ActionDescriptor,
        ctx: ExecutionContext
    ): Promise<PermissionResult> {
        // Check each required permission
        for (const perm of action.permissions) {
            const rule = this.findRule(perm);

            // If session has pre-approved this permission (or all via wildcard)
            if (ctx.approvedPermissions.has('*') || ctx.approvedPermissions.has(perm) || this.sessionApprovals.has(`${action.tool}:${perm}`)) {
                continue;
            }

            switch (rule) {
                case 'allow':
                    continue;
                case 'deny':
                    auditEmitter.emit(AuditEventType.PERMISSION_DENIED, {
                        tool: action.tool,
                        permission: perm,
                        reason: 'Denied by policy',
                    });
                    return {
                        allowed: false,
                        reason: `Permission "${perm}" is denied by policy for tool "${action.tool}"`,
                        requiresApproval: false,
                    };
                case 'confirm':
                    return {
                        allowed: false,
                        reason: `Action "${action.description}" requires approval (${perm})`,
                        requiresApproval: true,
                    };
            }
        }

        return { allowed: true, requiresApproval: false };
    }

    /**
     * Request approval from the user for a specific action
     */
    async requestApproval(
        action: ActionDescriptor,
        ctx: ExecutionContext
    ): Promise<boolean> {
        // In autonomous mode, auto-approve low-risk actions
        if (ctx.autonomous && action.riskLevel === 'low') {
            this.grantSessionApproval(action);
            return true;
        }

        // Call the approval handler
        if (ctx.onApproval) {
            const approved = await ctx.onApproval(action);
            if (approved) {
                this.grantSessionApproval(action);
                auditEmitter.emit(AuditEventType.APPROVAL_GRANTED, {
                    tool: action.tool,
                    permissions: action.permissions,
                    description: action.description,
                });
            } else {
                auditEmitter.emit(AuditEventType.APPROVAL_DENIED, {
                    tool: action.tool,
                    permissions: action.permissions,
                    description: action.description,
                });
            }
            return approved;
        }

        // No approval handler = deny
        return false;
    }

    /**
     * Check if a tool invocation is within the configured scope
     */
    checkScope(toolName: string, args: Record<string, unknown>): boolean {
        // Filesystem scope
        if (toolName.startsWith('fs.') && args['path']) {
            const check = this.scopeChecker.checkFilesystemScope(args['path'] as string);
            if (!check.inScope) return false;
        }

        // Command scope
        if (toolName === 'cmd.run' && args['command']) {
            const check = this.scopeChecker.checkCommandScope(args['command'] as string);
            if (!check.inScope) return false;
        }

        return true;
    }

    /**
     * Grant session-level approval (persists for current run)
     */
    grantSessionApproval(action: ActionDescriptor): void {
        for (const perm of action.permissions) {
            this.sessionApprovals.add(`${action.tool}:${perm}`);
        }
    }

    /**
     * Clear all session approvals
     */
    clearSessionApprovals(): void {
        this.sessionApprovals.clear();
    }

    // ─── Private ───

    private findRule(permission: PermissionCategory): ApprovalAction {
        // Check specific rules first
        for (const rule of this.config.policy.rules) {
            if (rule.permission === permission) {
                return rule.action;
            }
        }

        // Check parent category (e.g., filesystem.read → filesystem)
        const parentPerm = permission.split('.')[0];
        if (parentPerm !== permission) {
            for (const rule of this.config.policy.rules) {
                if (rule.permission === parentPerm) {
                    return rule.action;
                }
            }
        }

        return this.config.policy.defaultApproval;
    }
}
