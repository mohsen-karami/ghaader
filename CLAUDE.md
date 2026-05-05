# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Ghaader (قادر) — A lightweight Node.js webhook service that turns GitHub Issues into a file download proxy. Users submit URLs in issues; the app downloads files and uploads them as issue comment attachments. Designed for use during internet blackouts where GitHub remains accessible.

## Quick Commands

```bash
# Development
npm start              # Start server with PM2
npm run dev            # Dev server with --watch (auto-restart)
npm run lint           # Lint all source files
npm run lint:fix       # Lint and auto-fix all source files
npm run lint:pr        # Lint files changed in current PR branch
```

## Architecture

- **Layered:** Controllers → Services (no repositories — no database)
- **Class-based** with dependency injection via container
- **Webhook endpoint:** `POST /webhooks/github`
- **Health check:** `GET /health`

### Layer Responsibilities

- **Controllers:** HTTP request/response handling, input extraction, delegate to services
- **Services:** All business logic — downloading, file processing, GitHub API interactions
- **Middleware:** Webhook signature verification (HMAC-SHA256)
- **Config:** Environment loading, DI container setup

## Documentation

Read before implementing:

- `docs/superpowers/specs/2026-05-05-ghaader-design.md` — Full design specification

## Implementation Workflow

### Before Writing Any Code
- **Large change** (new feature, multiple files, significant refactor): briefly explain the approach and **wait for user confirmation** before writing any code
- **Small change** (quick fix, minor edit, single file): implement directly

### Writing Code
- Follow layered architecture: Controllers → Services
- Apply relevant design patterns (Service Layer, Factory, Observer, etc.)
- Follow SOLID principles — functions should do one thing
- ESLint compliance is handled automatically by the `eslint-compliance` skill
- **All functions/methods require JSDoc** — description, `@param` (with sub-properties using dot notation), `@returns`; use `@typedef` for complex nested shapes

### After Writing Code
- Run `/simplify` to review for quality, reuse, and clean code
- Confirm linting passes before finishing

## Commit Rules

- Use git config credentials only — **no co-author lines, no AI attribution of any kind**
- Small change: single-line message
- Large change: short title + blank line + at least 3 lines describing what changed and why
