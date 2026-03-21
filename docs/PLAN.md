# Disclaw-Team — Role-Based Architecture Redesign

## Context

The current system uses monolithic team.yaml configs where bots and roles are tightly coupled. The user's vision: bots are permanent infrastructure (Discord tokens), roles are a swappable library. Assign any role to any bot, hot-swap anytime, zero downtime.

## New Data Model

### Bots (infrastructure, permanent)
`~/.disclaw-team/bots.yaml`:
```yaml
bots:
  bot-1:
    token_env: BOT_1_TOKEN
    discord_user_id: "111122223333444455"  # discovered on first login
  bot-2:
    token_env: BOT_2_TOKEN
    discord_user_id: "222233334444555566"
  bot-3:
    token_env: BOT_3_TOKEN
    discord_user_id: "333344445555666677"
```
- Just tokens and Discord IDs. No personality, no role.
- Set up once during onboarding. Rarely changes.

### Roles (library, preloaded + custom)
`~/.disclaw-team/roles/` directory:
- Preloaded: copy from `src/roles/*.yaml` on init
- Each file is a single role definition
- Users can edit existing roles or add new ones

Example `~/.disclaw-team/roles/tech-lead.yaml`:
```yaml
name: Tech Lead
type: orchestrator
description: Technical leader who owns architecture and code quality
personality:
  tagline: Technical leader — owns architecture and code quality
  tone: Precise and technical, but collaborative
  instructions: |
    You own the technical direction. Think architecture first.
    Break features into tasks and assign to your engineers.
  domain: [architecture, code-review, technical-planning]
```

### Assignment (current role mapping)
`~/.disclaw-team/assignment.yaml`:
```yaml
discord:
  guild_id: "YOUR_GUILD_ID"
  channel_id: "YOUR_CHANNEL_ID"
workspace: /path/to/your/workspace

assignments:
  bot-1: tech-lead      # role name from roles/
  bot-2: backend-dev
  bot-3: qa

humans:
  owner:
    name: Your Name
    discord_id: "YOUR_DISCORD_USER_ID"
    role: owner

overrides:
  protocol:
    validation:
      never_skip_for: [security changes]
```

### Protocol (auto-derived)
Generated automatically from the role combination:
- Has orchestrator + specialists? → selective replies ON, validation chains ON
- Has orchestrator only? → all defaults
- Has validator/QA role? → validation chain from executor → validator
- Override section in assignment.yaml for user tweaks

## Hot-Swap Mechanism

When a user reassigns a role to a bot:

1. **Regenerate CLAUDE.md** in the bot's state dir with new personality
2. **Send a role-change notification** via the MCP server to the Claude Code session:
   ```
   SYSTEM ROLE CHANGE: You are now "Tech Lead". Your previous role has been replaced.
   Read your updated instructions carefully and operate according to your new role.
   [Full new CLAUDE.md content here]
   ```
3. **Update Discord nickname** via the API (REST call, no restart needed)
4. **Update access.json** if channel permissions changed
5. **No tmux restart** — the bot's Claude session continues with the new role in context

This works because:
- Claude Code sessions are persistent — they accumulate context
- A strong "your role has changed" message overrides previous personality
- The MCP server can send notifications at any time
- Nickname changes are instant via Discord API

To implement: add a `role_change` MCP tool that the web UI calls, which triggers the notification.

## New MCP Tool: `role_change`
Added to the server. When called:
1. Reads the new role definition
2. Generates new CLAUDE.md
3. Sends it as a channel notification to the bot's own session
4. Updates Discord nickname via REST API

The web UI calls this via an API route that writes to a trigger file the MCP server watches. Or simpler: the web UI calls the Discord REST API directly to send a message in the bot's monitored channel.

Actually simplest: the web UI:
1. Regenerates the CLAUDE.md and system-prompt.txt
2. Uses Discord REST API to send a DM or channel message to the bot with the new role instructions
3. Updates the bot's nickname via Discord REST API

The bot sees the message via its MCP server and adapts.

## UI Flow

### Onboarding
1. "How many team members?" → 3
2. For each: "Paste Discord bot token" → saves to bots.yaml
3. Copy preloaded roles to ~/.disclaw-team/roles/
4. Show role picker for each bot

### Dashboard
- Bot cards show: nickname, current role, status
- Click bot → role picker dropdown → select new role → instant hot-swap
- "Unassigned" state for bots without roles

### Roles Library
- Grid of all available roles (preloaded + custom)
- Filter by type (orchestrator, specialist, executor)
- Click to view/edit personality, instructions, domain
- "Create new role" button
- "Customise" button on preloaded roles (copies and allows editing)

### Team Presets (formerly templates)
- Suggested role assignments: "Dev Team", "Research Team", etc.
- One-click applies assignments to existing bots
- Just a convenience — maps bot slots to roles

## Changes Required

### Config system (`src/config/`)
- New schemas: `BotsSchema`, `RoleSchema`, `AssignmentSchema`
- New loaders: `loadBots()`, `loadRoles()`, `loadAssignment()`
- `generateTeamConfig()` — derives the full team.yaml-equivalent from bots + roles + assignment
- Protocol auto-derivation logic

### Generator (`src/generator/`)
- `generateClaudeMd()` now takes a role + bot + team context (not a full TeamConfig)
- Hot-swap: function to generate a role-change message

### MCP Server (`src/server/`)
- Reads bots.yaml + assignment.yaml instead of team.yaml (or: we still generate team.yaml as a derived artifact)
- Hot-swap notification capability

### CLI (`src/cli/`)
- `disclaw-team init` → onboarding flow (create bots.yaml, copy roles, initial assignment)
- `disclaw-team assign <bot-id> <role>` → hot-swap a role
- `disclaw-team roles list` → show available roles
- `disclaw-team roles add <name>` → create custom role

### Web UI (`web/`)
- Onboarding wizard (token paste flow)
- Role picker on bot cards
- Roles library page
- Team presets page

## Phased Implementation

### Phase 1: New data model + CLI
- New schemas (BotsSchema, RoleSchema, AssignmentSchema)
- New loaders and writers
- Protocol auto-derivation from role composition
- Generate team.yaml as derived artifact (backward compatible with start command)
- Copy preloaded roles from src/roles/ to ~/.disclaw-team/roles/ on init
- New `disclaw-team init` onboarding (create bots, assign roles)
- New `disclaw-team assign <bot-id> <role>` command (restarts affected bot)
- New `disclaw-team roles list` command

### Phase 2: Web UI updates
- Onboarding wizard (bot token setup)
- Dashboard: role picker dropdown on bot cards (triggers restart)
- Roles library page (view all roles, filter by type)
- Team presets (one-click role assignments)

### Phase 3: Role customization
- Edit role personality in the UI
- Create custom roles
- Override protocol settings

### Phase 4: Hot-swap (future)
- Role-change notification via MCP (no restart needed)
- Discord nickname update via REST API
- Zero-downtime role switching

## Key Files to Modify

- `src/config/schema.ts` — new Zod schemas
- `src/config/loader.ts` — new loaders for bots/roles/assignment
- `src/config/writer.ts` — writers for new config files
- `src/generator/claude-md.ts` — adapt to role-based input
- `src/server/server.ts` — read from new config, hot-swap support
- `src/cli/commands/start.ts` — generate from new config
- `src/cli/commands/init.ts` — new onboarding flow
- `web/app/routes/home.tsx` — role picker on bot cards
- `web/app/routes/setup.tsx` → `web/app/routes/roles.tsx` — roles library

## Verification

After Phase 1:
- `disclaw-team init` creates bots.yaml, copies roles, creates assignment.yaml
- `disclaw-team start` generates team.yaml from new config and launches

After Phase 2:
- `disclaw-team assign bot-1 researcher` → bot-1's nickname changes in Discord, receives role-change message, starts behaving as researcher

After Phase 3:
- Open web UI → click bot → pick role from dropdown → bot switches instantly
