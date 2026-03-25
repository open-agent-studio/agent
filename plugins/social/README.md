# @open-agent-studio/plugin-social

> **Unified Social Media Plugin** — Post to LinkedIn, X/Twitter, Facebook, and Instagram from your autonomous AI agent.

## Installation

```bash
agent plugins install @open-agent-studio/plugin-social
```

Or manually copy to `.agent/plugins/social/` in your project.

## Quick Start

### 1. Set Up Platform Credentials

Before authenticating, you need developer app credentials for each platform. Store them in your credential vault:

```bash
# LinkedIn
agent credentials set SOCIAL_LINKEDIN_CLIENT_ID "your-client-id"
agent credentials set SOCIAL_LINKEDIN_CLIENT_SECRET "your-client-secret"

# X/Twitter
agent credentials set SOCIAL_TWITTER_CLIENT_ID "your-client-id"
agent credentials set SOCIAL_TWITTER_CLIENT_SECRET "your-client-secret"

# Meta (Facebook + Instagram)
agent credentials set SOCIAL_META_CLIENT_ID "your-app-id"
agent credentials set SOCIAL_META_CLIENT_SECRET "your-app-secret"
```

### 2. Authenticate

```bash
agent social auth linkedin
agent social auth twitter
agent social auth facebook
agent social auth instagram
```

Each command opens a browser window for OAuth authorization.

### 3. Post Content

```bash
# Post to a single platform
agent social post -p linkedin -t "Shipping v1.0 today! 🚀"

# Post to multiple platforms
agent social post -p linkedin,twitter -t "Hello from Open Agent Studio!" --tags "ai,automation"

# Post with an image
agent social post -p instagram -t "Our new feature" -i "https://example.com/image.png"
```

### 4. Use with Natural Language

```bash
agent "Post a summary of today's code changes to LinkedIn and Twitter"
```

The agent will automatically use the `social-poster` skill to format and publish content.

## Supported Platforms

| Platform | Text | Images | Links | Threads | Auth |
|----------|:----:|:------:|:-----:|:-------:|:----:|
| LinkedIn | ✅ | ✅ | ✅ | — | OAuth 2.0 |
| X/Twitter | ✅ | ✅ | ✅ | 🔜 | OAuth 2.0 (PKCE) |
| Facebook | ✅ | ✅ | ✅ | — | OAuth 2.0 |
| Instagram | — | ✅ | — | — | OAuth 2.0 (Meta) |

## Security

- All OAuth tokens are stored in your local AES-256 encrypted vault (`vault.json`)
- Tokens never leave your machine
- You can revoke access at any time through each platform's settings
- See our [Privacy Policy](https://openagent.studio/privacy) and [Terms](https://openagent.studio/terms)

## License

MIT
