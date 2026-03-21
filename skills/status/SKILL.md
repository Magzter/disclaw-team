---
name: status
description: Show the status of configured disclaw-team bots — config, tokens, state, and tmux session. Use when the user asks about their team status.
user-invocable: true
allowed-tools:
  - Read
  - Bash(ls *)
  - Bash(cat *)
  - Bash(tmux *)
---

# /disclaw-team:status — Team Status

Shows the current state of all configured bots.

Arguments passed: `$ARGUMENTS`

---

## Process

1. **Config** — read `~/.disclaw-team/team.yaml`. If missing, tell user to run `/disclaw-team:configure init`.

2. **Tokens** — read `~/.disclaw-team/.env`. For each bot, check if its `token_env` is present.

3. **Registry** — check `~/.disclaw-team/registry/` for Discord user ID files (written by servers on login).

4. **State** — for each bot, check `~/.disclaw-team/bots/<bot-id>/`:
   - access.json, CLAUDE.md, system-prompt.txt, mcp-config.json, launch.sh

5. **Tmux** — check if `disclaw-team` tmux session exists and which windows are running:
   ```bash
   tmux list-windows -t disclaw-team 2>/dev/null
   ```

6. **Display** — show summary:
   ```
   Team: <name>

   Bot           Role          Token   State   Running
   michael       orchestrator  ✓       ✓       ✓
   researcher    specialist    ✓       ✓       ✓
   engineer      executor      ✓       ✓       ✗
   validator     specialist    ✗       ✗       ✗
   ```

7. **Guidance** — based on state:
   - Missing tokens → "Add with `/disclaw-team:configure token <bot-id> <token>`"
   - Missing state → "Run `disclaw-team start` to generate and launch"
   - Not running → "Run `disclaw-team start` or `disclaw-team start <bot-id>`"
   - All running → "Attach with `tmux attach -t disclaw-team`"
