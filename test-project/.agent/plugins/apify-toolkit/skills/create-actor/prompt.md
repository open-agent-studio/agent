# Create Apify Actor

You are an expert Apify actor developer. Create a production-ready actor from scratch.

## Scaffold Structure

Create the following files:

```
<actor-name>/
├── .actor/
│   ├── actor.json
│   └── input_schema.json
├── src/
│   ├── main.js          # or main.ts
│   ├── routes.js        # Route handlers for CrawlingContext
│   └── utils.js         # Helper functions
├── package.json
├── Dockerfile
├── .dockerignore
├── .gitignore
└── README.md
```

## Best Practices

### 1. `actor.json`
```json
{
    "actorSpecification": 1,
    "name": "<actor-name>",
    "title": "<Human Readable Title>",
    "description": "<SEO-friendly description>",
    "version": "0.0.1"
}
```

### 2. `input_schema.json`
- Use descriptive titles and descriptions for each field
- Include `prefill` values for quick testing
- Group related fields with `sectionCaption`
- Always include a `proxy` field with `"editor": "proxy"`
- Use proper `enum` values where appropriate

### 3. `Dockerfile`
```dockerfile
FROM apify/actor-node-playwright-chrome:20
COPY --chown=myuser package*.json ./
RUN npm --quiet set progress=false && npm install --omit=dev --omit=optional
COPY --chown=myuser . ./
CMD npm start --silent
```

### 4. Anti-Blocking Defaults
- Use `PlaywrightCrawler` for JavaScript-rendered sites
- Set `useSessionPool: true`
- Set `persistCookiesPerSession: true`
- Add random delays: `requestHandlerTimeoutSecs: 120`
- Use `proxyConfiguration` with residential proxies for protected sites

### 5. Pay-Per-Event (PPE) Charging
Add `Actor.charge()` calls for each scraped result:
```javascript
await Actor.charge({ eventName: 'result-scraped', count: 1 });
```

### 6. README.md
Include:
- What the actor does
- Input parameters table
- Output data schema with example JSON
- PPE pricing info
- Proxy recommendations
- Limitations

## Rules
1. Always generate complete, working code—never leave TODOs
2. Use Crawlee best practices (ProxyConfiguration, SessionPool)
3. Handle errors gracefully with retry logic
4. Push results to the default dataset immediately (don't batch)
5. Log progress with `Actor.log.info()`
6. **CRITICAL:** Do NOT just print the code blocks to the terminal. You MUST use the `fs.mkdir` and `fs.write` tools to physically create the project files on the user's disk at `./<actor-name>/`.
7. **CRITICAL:** Execute `npm install apify crawlee playwright` in the new directory.
8. **Git Initialization:** After project creation, format the code, run `git init`, create an initial commit.
9. **GitHub Repository:** Provide instructions to the user to push code OR if possible, use `gh repo create <actor-name> --public` via `cmd.run` to create a new remote repo and push to it.
10. **Apify Deployment:** Run `apify push` using `cmd.run` to deploy the actor to the Apify platform.
11. **Testing:** Wait for deployment to finish, then encourage the user to test the actor with `apify run` or directly call `cmd.run` to test locally.
