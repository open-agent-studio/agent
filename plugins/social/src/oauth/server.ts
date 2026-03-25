/**
 * OAuth 2.0 Local Callback Server
 *
 * Spins up a temporary HTTP server on localhost:9876 to receive
 * OAuth authorization codes from platform redirects.
 */

import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'node:http';

export interface OAuthCallbackResult {
    code: string;
    state?: string;
}

/**
 * Start a temporary local HTTP server to capture the OAuth callback.
 * Returns a promise that resolves with the authorization code.
 *
 * @param port - Port to listen on (default: 9876)
 * @param timeoutMs - Auto-close after this many ms (default: 120s)
 */
export function waitForOAuthCallback(port = 9876, timeoutMs = 120_000): Promise<OAuthCallbackResult> {
    return new Promise((resolve, reject) => {
        let server: Server;
        let timer: NodeJS.Timeout;

        server = createServer((req: IncomingMessage, res: ServerResponse) => {
            const url = new URL(req.url || '/', `http://localhost:${port}`);

            if (url.pathname === '/callback') {
                const code = url.searchParams.get('code');
                const state = url.searchParams.get('state');
                const error = url.searchParams.get('error');

                if (error) {
                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    res.end(`
                        <html><body style="font-family:system-ui;text-align:center;padding:60px;background:#0a0a0a;color:#fff">
                            <h1 style="color:#ef4444">❌ Authorization Failed</h1>
                            <p>${error}: ${url.searchParams.get('error_description') || 'Unknown error'}</p>
                            <p style="color:#888">You can close this tab.</p>
                        </body></html>
                    `);
                    cleanup();
                    reject(new Error(`OAuth error: ${error}`));
                    return;
                }

                if (!code) {
                    res.writeHead(400, { 'Content-Type': 'text/html' });
                    res.end(`
                        <html><body style="font-family:system-ui;text-align:center;padding:60px;background:#0a0a0a;color:#fff">
                            <h1 style="color:#f59e0b">⚠️ Missing Authorization Code</h1>
                            <p style="color:#888">No code parameter received. Please try again.</p>
                        </body></html>
                    `);
                    return;
                }

                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(`
                    <html><body style="font-family:system-ui;text-align:center;padding:60px;background:#0a0a0a;color:#fff">
                        <h1 style="color:#22c55e">✅ Authorization Successful!</h1>
                        <p>Open Agent Studio has received your credentials.</p>
                        <p style="color:#888">You can close this tab and return to your terminal.</p>
                    </body></html>
                `);

                cleanup();
                resolve({ code, state: state || undefined });
            } else {
                res.writeHead(404);
                res.end('Not Found');
            }
        });

        const cleanup = () => {
            clearTimeout(timer);
            server.close();
        };

        timer = setTimeout(() => {
            cleanup();
            reject(new Error('OAuth callback timed out after 2 minutes'));
        }, timeoutMs);

        server.listen(port, () => {
            // Server is ready to receive callbacks
        });

        server.on('error', (err) => {
            clearTimeout(timer);
            reject(new Error(`OAuth callback server error: ${err.message}`));
        });
    });
}

/**
 * Build the redirect URI for OAuth flows
 */
export function getRedirectUri(port = 9876): string {
    return `http://localhost:${port}/callback`;
}
