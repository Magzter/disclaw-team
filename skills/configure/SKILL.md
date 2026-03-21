---
name: configure
description: Set up a disclaw-team configuration — create team.yaml, manage bot tokens, edit team config. Use when the user asks to set up or modify their bot team.
user-invocable: true
allowed-tools:
  - Read
  - Write
  - Bash(ls *)
  - Bash(mkdir *)
  - Bash(chmod *)
---

# /disclaw-team:configure — Team Configuration

Manages team configuration at `~/.disclaw-team/team.yaml` and tokens at `~/.disclaw-team/.env`.

Arguments passed: `$ARGUMENTS`

---

## Dispatch on arguments

### No args — status

Read state files and show:
1. **Config** — team name, bots (names, roles), protocol summary
2. **Tokens** — which bots have tokens set (masked)
3. **Registry** — which bots have Discord user IDs cached in `~/.disclaw-team/registry/`
4. **State** — which bots have generated state dirs with access.json + CLAUDE.md
5. **What next** — guidance based on what's missing

### `init` — interactive setup

Run the init wizard: `disclaw-team init`.

The wizard supports:
- Template selection (executive, solo, or custom)
- Multi-bot setup with per-bot token collection
- Smart protocol defaults based on team composition

### `add-bot` — add a bot to existing config

Read team.yaml, prompt for bot details (name, role, token, channel), add to config and .env.

### `token <bot-id> <token>` — save/update a bot token

Update the token in `~/.disclaw-team/.env` for the specified bot.

### `remove-bot <bot-id>` — remove a bot

Remove from team.yaml and .env. Optionally clean up state dir.

---

## Architecture

Each bot runs as a separate Claude Code session in its own tmux window. The team.yaml defines:
- **Protocol** — team-wide communication rules, validation chains, escalation
- **Roles** — behavioral archetypes (orchestrator, specialist, executor)
- **Bots** — individual identities with personality, tone, instructions
- **Humans** — stakeholders for the interaction matrix

State files are generated per-bot by `disclaw-team start` into `~/.disclaw-team/bots/<bot-id>/`.
Tokens live in `~/.disclaw-team/.env` (chmod 600, never committed).
