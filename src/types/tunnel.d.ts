declare module 'localtunnel' {
    interface Tunnel {
        url: string;
        on(event: 'close', cb: () => void): void;
        close(): void;
    }
    function localtunnel(opts: { port: number; subdomain?: string }): Promise<Tunnel>;
    export default localtunnel;
}

declare module 'qrcode-terminal' {
    function generate(text: string, opts?: { small?: boolean }, cb?: (qr: string) => void): void;
    export default { generate };
}
