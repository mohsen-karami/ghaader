---
name: eslint-compliance
description: Ensures ESLint rules are followed when writing or editing JavaScript files. Use when writing new code, editing existing JS files, or reviewing code for lint compliance in this project.
---

## Before Writing Any Code

Read the ESLint config: `eslint.config.js`

## Critical Rules (Cannot Be Auto-Fixed)

These must be followed from the start — fixing them after the fact requires restructuring:

- **sort-keys**: Object keys must be alphabetical — `{ age, name, zip }` not `{ name, age, zip }`
- **max-params**: Max 3 function parameters — use an options object for 4+
- **id-length**: Variable names must be 3–30 chars — no `i`, `x`, `a` (allowed exceptions: `$`, `js`, `ts`, `fs`, `vm`, `i`, `j`, `k`, `id`, `el`, `fn`, `cb`)
- **max-lines**: Files ≤ 500 lines (excluding comments), functions ≤ 30 lines (excluding comments) — split into modules if exceeded
- **max-depth**: Nesting ≤ 3 levels deep — use early returns to flatten logic
- **camelCase**: All variables and functions — no `snake_case` (except `_id`, `__dirname`, `__filename`)

## After Writing Code

Run lint on the entire codebase and fix ALL errors before finishing:
```bash
npm run lint:fix
```

If errors remain after running fix commands, resolve them manually — structural violations (sort-keys, max-params, naming) cannot be auto-fixed.
