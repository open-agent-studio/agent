# Browser Automation (Playwright)

Open Agent Studio includes a built-in Playwright-powered browser automation layer that lets the agent natively open, control, and scrape web pages — then persist session state across runs.

## Overview

The `desktop.browser.*` tools give the AI agent full programmatic control of a headless (or headed) Chromium browser.  Cookies, localStorage, and authentication tokens are automatically saved to `.agent/browser-session.json` so that multi-turn workflows stay authenticated.

## Available Tools

| Tool | Description |
|------|-------------|
| `desktop.browser.open` | Navigate to a URL and initialise the browser (headless by default) |
| `desktop.browser.click` | Click a DOM element by CSS or XPath selector |
| `desktop.browser.fill` | Type text into an input element |
| `desktop.browser.scrape` | Extract `innerText` or `innerHTML` from the page (or a specific selector) |
| `desktop.browser.screenshot` | Capture a PNG screenshot (full-page supported) |
| `desktop.browser.close` | Close the browser and persist session state |

## Quick Start

```bash
# Ensure Playwright browsers are installed
npx playwright install chromium

# Run a goal that uses the browser
agent run "Open https://example.com and scrape the heading text"
```

The agent will automatically invoke `desktop.browser.open`, then `desktop.browser.scrape`, and return the result.

## Session Persistence

When `desktop.browser.close` is called (or the browser gracefully shuts down) the current session state is saved:

```
.agent/browser-session.json
```

On the next `desktop.browser.open`, the saved cookies and localStorage are restored automatically.  This means the agent can log in to a site once and remain authenticated across subsequent runs.

## Architecture

```
BrowserManager (singleton)
  ├── init(headless?)   → launches Playwright Chromium
  ├── getPage()         → returns the active Page object
  └── close()           → calls context.storageState() → saves session → cleanup
```

The `BrowserManager` is a singleton that ensures only one Playwright instance is active at a time.  Tools reference the manager via `BrowserManager.getInstance()`.

## Example Use Cases

- **Web scraping**: Scrape dynamic JavaScript-rendered pages that `fetch()` alone cannot handle.
- **Form automation**: Fill out multi-step forms, handle CAPTCHAs (with human-in-the-loop).
- **Authenticated workflows**: Log into dashboards, pull reports, and download CSVs — session persists between runs.
- **Visual regression**: Take screenshots and compare them against baselines.

## Configuration

No additional configuration is required.  Browser tools are registered automatically during `agent init` and are available in every run.

To use a headed (visible) browser, pass `headless: false` in the `desktop.browser.open` input:

```json
{ "url": "https://example.com", "headless": false }
```
