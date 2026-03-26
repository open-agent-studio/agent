# @open-agent-studio/plugin-apify

Official Apify integration plugin for [Open Agent Studio](https://openagent.studio). Run web scrapers, manage datasets, and orchestrate 2,000+ Apify Actors from your AI agent.

## Installation

```bash
agent plugins install @open-agent-studio/plugin-apify
```

## Setup

1. Create a free account at [apify.com](https://apify.com)
2. Get your API token: Profile → Settings → Integrations → Personal API Token
3. Save it:

```bash
agent credentials set APIFY_API_TOKEN "apify_api_your_token_here"
```

## Usage

### Natural Language
```bash
agent "Scrape all product prices from example-store.com"
agent "Search Apify Store for a Google Maps scraper and run it"
agent "Schedule a daily scrape of competitor pricing"
```

### CLI Commands
```bash
agent apify run apify/web-scraper --input '{"startUrls":[{"url":"https://example.com"}]}' --sync
agent apify store "instagram scraper"
agent apify actors
agent apify status <run-id>
agent apify results <dataset-id> --format csv
agent apify datasets
```

## Tools Registered

| Tool | Description |
|------|-------------|
| `apify.run` | Run an Apify Actor (async or sync) |
| `apify.status` | Check run status |
| `apify.results` | Get dataset results |
| `apify.actors` | List/get your Actors |
| `apify.store` | Search the Apify Store |
| `apify.datasets` | List/manage datasets |
| `apify.schedule` | Create/manage cron schedules |
| `apify.kv` | Key-Value Store operations |

## Security

Your API token is encrypted with AES-256-GCM and stored locally in `vault.json`. It never leaves your machine.

## License

MIT © Open Agent Studio
