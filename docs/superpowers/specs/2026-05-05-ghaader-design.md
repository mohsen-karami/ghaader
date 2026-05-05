# Ghaader — Design Specification

## Overview

Ghaader (قادر — Persian for "able", also: **G**itHub **A**s **A** **D**ownload**ER**) is a lightweight, self-hosted Node.js webhook service that turns GitHub Issues into a file download proxy. Users submit an issue containing one or more URLs; the app downloads each file, splits oversized files into multi-part zip archives, and uploads them as attachments in issue comments.

## Problem Statement

Iran experiences recurring internet blackouts where only a handful of services remain accessible (Google, GitHub). Unrestricted internet access is prohibitively expensive. Ghaader leverages GitHub's free webhook and API features to let users download files from the open internet by simply posting a URL in a GitHub Issue.

## Architecture

### Layered, Class-Based

```
src/
├── config/              # Environment loading, constants, container
│   ├── environment.js   # Config class (reads process.env)
│   └── container.js     # Dependency injection container
├── controllers/         # HTTP request handling
│   └── WebhookController.js
├── services/            # Business logic
│   ├── GitHubService.js     # Issue comments, labels, close
│   ├── DownloadService.js   # URL extraction, file download
│   └── FileService.js       # File splitting into multi-part zip
├── middleware/          # Express middleware
│   └── webhookVerification.js  # HMAC signature verification
├── utils/               # Cross-cutting concerns
│   └── logger.js        # Winston daily-rotate logger
└── app.js               # Express bootstrap, route setup
```

### Dependencies (minimal)

| Package | Purpose |
|---------|---------|
| express | HTTP server |
| @octokit/rest | GitHub API (comments, labels, close) |
| archiver | Multi-part zip archive creation |
| winston | Logging |
| winston-daily-rotate-file | Daily log rotation |

No database. No dotenv (Node.js native `--env-file` + PM2 ecosystem config).

## Core Flow

1. GitHub sends `issues` webhook (`action: "opened"`) to `POST /webhook`
2. Middleware verifies HMAC-SHA256 signature using webhook secret
3. WebhookController extracts issue body, delegates to services
4. DownloadService parses all URLs from issue body, downloads each file
5. FileService checks file size: if >24MB, splits into multi-part zip (each ≤24MB)
6. GitHubService posts comments with attachments:
   - Max 10 files per comment
   - Descriptive text per comment (which files, part numbers)
   - Small files from multiple URLs can share a comment
7. GitHubService applies label based on outcome:
   - `completed` — all URLs processed successfully
   - `failed` — all URLs failed
   - `partial` — some succeeded, some failed
8. GitHubService closes the issue
9. If any URLs failed, a comment lists the failures with reasons before closing

## File Handling Rules

- File ≤24MB: attach directly (no zip)
- File >24MB: split into multi-part zip, each part ≤24MB
- Parts named: `{original-name}.zip.001`, `.zip.002`, etc.
- Max 10 attachments per comment; overflow goes to additional comments
- Users extract by opening the first part with any zip utility (WinRAR, 7-Zip, etc.)

## URL Extraction

- Extract ALL URLs from issue body (option C)
- Any URL that resolves to a downloadable file is attempted
- No auth/special handling for specific hosts (generic HTTP GET)

## Error Handling

- Failed downloads: note reason (404, timeout, auth required, network error)
- Post a comment listing all failed URLs with error messages
- Continue processing remaining URLs
- Final label reflects aggregate outcome

## Security

- Webhook secret verification is mandatory (HMAC-SHA256)
- No unauthenticated requests are processed
- GitHub PAT stored in environment variables only
- Repo intended to be private with select collaborators

## Configuration (.env.example)

```
# Required
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
WEBHOOK_SECRET=your-webhook-secret-here

# Optional (with defaults)
PORT=3000
MAX_FILE_SIZE_MB=24
LOG_LEVEL=info
```

## Logging

- Winston with daily rotation
- Daily rotation (one file per day)
- Compressed (gzip) immediately on rotation
- Deleted after 180 days (6 months)
- Levels: error, warn, info, debug

## Deployment

- Self-hosted on VPS with public IP
- PM2 for process management (ecosystem.config.cjs)
- Health check: `GET /health` → 200 OK
- No domain required (IP address works)

## User Guide (Fork & Deploy)

1. Fork repository
2. Make repo private, add collaborators
3. Configure GitHub webhook (URL: `http://<ip>:<port>/webhook`, events: Issues)
4. Generate GitHub PAT with `repo` scope
5. Set environment variables on server
6. `npm install` → `pm2 start ecosystem.config.cjs`
7. Collaborators create issues with URLs → files appear as comments

## Future Improvements (designed for, not implemented)

- TypeScript rewrite
- Docker containerization
- Automated tests (unit + integration)
- Retry mechanism via issue comments

## Code Standards

- Class-based, modular architecture
- ESLint flat config (all rules set to error, based on ~/main config)
- Tabs for indentation, semicolons required
- JSDoc on all classes and methods
- camelCase variables/functions, PascalCase classes
- Dependency injection for testability
