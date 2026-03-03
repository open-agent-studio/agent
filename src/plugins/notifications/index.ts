import type { ToolRegistry } from '../../tools/registry.js';
import type { ToolResult, ExecutionContext } from '../../tools/types.js';
import { z } from 'zod';

/**
 * Notification Plugin — Sends alerts via webhook, email, or log
 */

interface NotifyOptions {
    channel: 'webhook' | 'email' | 'log';
    title: string;
    message: string;
    level?: 'info' | 'success' | 'warning' | 'error';
    webhookUrl?: string;
    emailTo?: string;
    emailFrom?: string;
    smtpHost?: string;
    smtpPort?: number;
}

/**
 * Send notification via webhook (Slack/Discord/custom)
 */
async function sendWebhook(opts: NotifyOptions): Promise<{ ok: boolean; error?: string }> {
    const url = opts.webhookUrl;
    if (!url) return { ok: false, error: 'No webhookUrl provided' };

    const emoji = opts.level === 'success' ? '✅' : opts.level === 'error' ? '❌' : opts.level === 'warning' ? '⚠️' : 'ℹ️';

    // Auto-detect Slack vs Discord vs generic
    const isSlack = url.includes('hooks.slack.com');
    const isDiscord = url.includes('discord.com/api/webhooks');

    let body: string;
    if (isSlack) {
        body = JSON.stringify({
            text: `${emoji} *${opts.title}*\n${opts.message}`,
            username: 'Agent Runtime',
            icon_emoji: ':robot_face:',
        });
    } else if (isDiscord) {
        body = JSON.stringify({
            content: `${emoji} **${opts.title}**\n${opts.message}`,
            username: 'Agent Runtime',
        });
    } else {
        body = JSON.stringify({
            title: opts.title,
            message: opts.message,
            level: opts.level || 'info',
            timestamp: new Date().toISOString(),
            source: 'agent-runtime',
        });
    }

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body,
        });
        return { ok: res.ok, error: res.ok ? undefined : `HTTP ${res.status}` };
    } catch (err) {
        return { ok: false, error: (err as Error).message };
    }
}

/**
 * Send notification via email (nodemailer)
 */
async function sendEmail(opts: NotifyOptions): Promise<{ ok: boolean; error?: string }> {
    try {
        // nodemailer is optional — only needed for email channel
        let nodemailer: any;
        try {
            const pkg = 'nodemailer';
            nodemailer = await import(pkg);
        } catch {
            return { ok: false, error: 'nodemailer is not installed. Run: npm install nodemailer' };
        }
        const transporter = nodemailer.createTransport({
            host: opts.smtpHost || process.env.SMTP_HOST || 'smtp.gmail.com',
            port: opts.smtpPort || parseInt(process.env.SMTP_PORT || '587'),
            secure: false,
            auth: {
                user: process.env.SMTP_USER || opts.emailFrom,
                pass: process.env.SMTP_PASS,
            },
        });

        await transporter.sendMail({
            from: opts.emailFrom || process.env.SMTP_USER || 'agent@localhost',
            to: opts.emailTo || process.env.NOTIFY_EMAIL,
            subject: `[Agent] ${opts.title}`,
            text: opts.message,
            html: `<h2>${opts.title}</h2><p>${opts.message.replace(/\n/g, '<br>')}</p>`,
        });
        return { ok: true };
    } catch (err) {
        return { ok: false, error: (err as Error).message };
    }
}

/**
 * Send notification to log file
 */
async function sendLog(opts: NotifyOptions, workDir: string): Promise<{ ok: boolean }> {
    const { appendFile, mkdir } = await import('node:fs/promises');
    const { join } = await import('node:path');
    const logDir = join(workDir, '.agent');
    await mkdir(logDir, { recursive: true });
    const logPath = join(logDir, 'notifications.log');
    const line = `[${new Date().toISOString()}] [${(opts.level || 'info').toUpperCase()}] ${opts.title}: ${opts.message}\n`;
    await appendFile(logPath, line, 'utf-8');
    return { ok: true };
}

/**
 * Register notification tools
 */
export function registerNotificationTools(registry: ToolRegistry, workDir: string): void {
    if (registry.has('notify.send')) return;

    registry.register({
        name: 'notify.send',
        category: 'network',
        description: 'Send a notification via webhook (Slack/Discord), email, or log file. Use this to alert the user about important events.',
        inputSchema: z.object({
            channel: z.enum(['webhook', 'email', 'log']).describe('Notification channel'),
            title: z.string().describe('Notification title'),
            message: z.string().describe('Notification body'),
            level: z.enum(['info', 'success', 'warning', 'error']).optional().describe('Severity level'),
            webhookUrl: z.string().optional().describe('Webhook URL (for webhook channel). If not provided, uses WEBHOOK_URL env var.'),
            emailTo: z.string().optional().describe('Recipient email (for email channel). If not provided, uses NOTIFY_EMAIL env var.'),
        }),
        outputSchema: z.object({
            sent: z.boolean(),
            channel: z.string(),
            error: z.string().optional(),
        }),
        permissions: ['network'] as any,
        execute: async (input: any, _ctx: ExecutionContext): Promise<ToolResult> => {
            const start = Date.now();
            try {
                const opts: NotifyOptions = {
                    channel: input.channel,
                    title: input.title,
                    message: input.message,
                    level: input.level,
                    webhookUrl: input.webhookUrl || process.env.WEBHOOK_URL || process.env.SLACK_WEBHOOK_URL || process.env.DISCORD_WEBHOOK_URL,
                    emailTo: input.emailTo,
                };

                let result: { ok: boolean; error?: string };
                switch (opts.channel) {
                    case 'webhook': result = await sendWebhook(opts); break;
                    case 'email': result = await sendEmail(opts); break;
                    case 'log': result = await sendLog(opts, workDir); break;
                    default: result = { ok: false, error: `Unknown channel: ${opts.channel}` };
                }

                return {
                    success: result.ok,
                    data: { sent: result.ok, channel: opts.channel, error: result.error },
                    durationMs: Date.now() - start,
                };
            } catch (err) {
                return { success: false, error: (err as Error).message, durationMs: Date.now() - start };
            }
        },
    } as any);
}

/**
 * Auto-notify on goal completion/failure (used by daemon)
 */
export class NotificationService {
    private webhookUrl: string | null;

    constructor(private workDir: string) {
        this.webhookUrl = process.env.WEBHOOK_URL || process.env.SLACK_WEBHOOK_URL || process.env.DISCORD_WEBHOOK_URL || null;
    }

    async onGoalComplete(goalTitle: string, taskCount: number): Promise<void> {
        if (!this.webhookUrl) {
            await sendLog({ channel: 'log', title: 'Goal Completed', message: `"${goalTitle}" — ${taskCount} tasks done`, level: 'success' }, this.workDir);
            return;
        }
        await sendWebhook({ channel: 'webhook', title: 'Goal Completed', message: `"${goalTitle}" — ${taskCount} tasks done`, level: 'success', webhookUrl: this.webhookUrl });
    }

    async onGoalFailed(goalTitle: string, error: string): Promise<void> {
        if (!this.webhookUrl) {
            await sendLog({ channel: 'log', title: 'Goal Failed', message: `"${goalTitle}" — ${error}`, level: 'error' }, this.workDir);
            return;
        }
        await sendWebhook({ channel: 'webhook', title: 'Goal Failed', message: `"${goalTitle}" — ${error}`, level: 'error', webhookUrl: this.webhookUrl });
    }

    async onTaskComplete(taskTitle: string, output: string): Promise<void> {
        await sendLog({ channel: 'log', title: 'Task Completed', message: `"${taskTitle}" — ${output.slice(0, 200)}`, level: 'success' }, this.workDir);
    }
}
