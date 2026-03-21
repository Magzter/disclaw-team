---
name: start
description: Generate state files and launch all bots in tmux. Use when the user wants to start their bot team.
user-invocable: true
allowed-tools:
  - Read
  - Bash(ls *)
  - Bash(bun *)
  - Bash(cat *)
---

# /disclaw-team:start — Launch Bot Team

Generates per-bot state files and launches all bots in a tmux session.

Arguments passed: `$ARGUMENTS`

---

## Process

1. **Validate** — read `~/.disclaw-team/team.yaml` and `~/.disclaw-team/.env`. Check config is valid and all bot tokens are present.

2. **Generate state** — for each bot, run the start CLI command which:
   - Creates `~/.disclaw-team/bots/<bot-id>/` state directory
   - Generates `access.json` (channel permissions)
   - Generates `CLAUDE.md` (personality, team awareness, engagement rules)
   - Generates `system-prompt.txt` (for --append-system-prompt)
   - Generates `mcp-config.json` (MCP server definition)
   - Generates `launch.sh` (standalone launch script)

3. **Launch** — spawns all bots in a tmux session called `disclaw-team`, one window per bot.

4. **Report** — shows tmux session info and how to attach/manage.

## Running it

From the disclaw-team project directory:

```bash
disclaw-team start          # Launch all bots
disclaw-team start <bot-id> # Launch one bot
disclaw-team stop           # Stop all
disclaw-team stop <bot-id>  # Stop one
disclaw-team attach <bot-id> # Attach to a bot's session
```

Or from any Claude Code session with the plugin loaded:

```
tmux attach -t disclaw-team              # See all bots
```

## Architecture

Each bot runs as a **separate Claude Code session** in its own tmux window. This gives each bot:
- Its own context window and reasoning
- Independent personality via --append-system-prompt
- Its own MCP server instance connected to Discord
- Full visibility of team discourse (all bots see all messages)
- The ability to disagree, push back, and provide independent perspectives

Engagement decisions (when to respond) are handled by each bot's CLAUDE.md instructions, not by server-side filtering.
