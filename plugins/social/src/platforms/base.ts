/**
 * Social Platform — Abstract Interface
 *
 * All social media platforms (LinkedIn, X, Meta, Instagram) implement
 * this contract. The plugin routes `social.post` calls through
 * the correct adapter based on the user's target platforms.
 */

// ─── Post Content ───

export interface PostContent {
    /** Text body of the post */
    text: string;
    /** Optional image URL or local file path */
    imageUrl?: string;
    /** Optional link to attach */
    linkUrl?: string;
    /** Hashtags (without #) */
    tags?: string[];
    /** Platform-specific extras */
    metadata?: Record<string, any>;
}

// ─── Post Result ───

export interface PostResult {
    success: boolean;
    platform: string;
    postId?: string;
    postUrl?: string;
    error?: string;
    timestamp: string;
}

// ─── Auth Status ───

export interface AuthStatus {
    platform: string;
    authenticated: boolean;
    username?: string;
    expiresAt?: string;
    scopes?: string[];
}

// ─── OAuth Config ───

export interface OAuthConfig {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    authUrl: string;
    tokenUrl: string;
    scopes: string[];
}

// ─── Credential Keys ───

export function credentialKey(platform: string, field: string): string {
    return `SOCIAL_${platform.toUpperCase()}_${field.toUpperCase()}`;
}

// ─── Abstract Platform ───

export abstract class SocialPlatform {
    abstract readonly name: string;
    abstract readonly displayName: string;
    abstract readonly capabilities: string[];

    /**
     * Check if the platform has valid stored credentials
     */
    abstract isAuthenticated(getCredential: CredentialGetter): Promise<boolean>;

    /**
     * Start the OAuth authentication flow
     */
    abstract authenticate(
        getCredential: CredentialGetter,
        setCredential: CredentialSetter,
        openBrowser: (url: string) => void
    ): Promise<AuthStatus>;

    /**
     * Publish a post to the platform
     */
    abstract post(content: PostContent, getCredential: CredentialGetter): Promise<PostResult>;

    /**
     * Get current auth status
     */
    abstract getAuthStatus(getCredential: CredentialGetter): Promise<AuthStatus>;

    /**
     * Refresh expired tokens if supported. Override in subclasses that support refresh.
     */
    async refreshToken(
        _getCredential: CredentialGetter,
        _setCredential: CredentialSetter
    ): Promise<boolean> {
        return false;
    }

    /**
     * Format the post content for this platform's constraints
     */
    protected formatText(text: string, maxLength: number, tags?: string[]): string {
        let formatted = text;
        if (tags && tags.length > 0) {
            const hashtagStr = tags.map(t => `#${t}`).join(' ');
            const available = maxLength - hashtagStr.length - 2;
            if (formatted.length > available) {
                formatted = formatted.slice(0, available - 3) + '...';
            }
            formatted = `${formatted}\n\n${hashtagStr}`;
        } else if (formatted.length > maxLength) {
            formatted = formatted.slice(0, maxLength - 3) + '...';
        }
        return formatted;
    }
}

// ─── Types for credential access ───

export type CredentialGetter = (key: string) => Promise<string | null>;
export type CredentialSetter = (key: string, value: string) => Promise<void>;
