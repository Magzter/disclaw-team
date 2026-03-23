# disclaw-team

Deploy a team of AI assistants to your Discord server.

`disclaw-team` is an open-source tool for running multiple Claude Code bots in a Discord server — each with its own role, personality, and specialization. Built on [Claude Code Channels](https://docs.anthropic.com/en/docs/claude-code/channels), every bot runs as a full Claude Code session through your existing Claude Pro subscription. No API keys, no per-token billing.

> **⚠️ Security Warning:** By default, disclaw-team runs Claude Code with `--dangerously-skip-permissions`, meaning **anyone who can send messages in your Discord server can trigger commands on your machine** — file reads, writes, shell execution, and more. This is powerful but dangerous.
>
> **Only run this on Discord servers where you trust every member.** Treat server access as root access to the host machine. For safer operation:
> - Use `--safe` mode to route permission prompts to your Discord DMs
> - Run on an isolated machine or VM, not your primary workstation
> - Restrict your Discord server to trusted collaborators only
>
> See [Safe Mode](docs/src/content/docs/concepts/safe-mode.mdx) for details.

## How It Works

Each bot is an independent Claude Code session connected to Discord via the Model Context Protocol (MCP). They share channels, see each other's messages, and collaborate — with humans able to watch, interject, and redirect at any time.

```
disclaw-team start
    │
    └── tmux session
        ├── bot-1-Tech-Lead     (orchestrator)
        ├── bot-2-Researcher    (specialist)
        ├── bot-3-Validator     (specialist)
        └── bot-4-Engineer      (executor)
```

One command. All bots online.

## Key Features

**Role-Based Teams**
- 22 preloaded roles across orchestrators, specialists, and executors
- Assign any role to any bot — swap anytime
- Custom roles with full personality, tone, and instruction editing
- Per-role model selection (Opus/Sonnet/Haiku) and reasoning effort

**Web Dashboard**
- Visual bot management with live status
- Role picker — click a bot, pick a role
- Roles library with model/reasoning badges
- One-click team presets (Executive, Dev Team, Frontend, Product, Content, Research)
- Schedules with visual cron builder
- Onboarding wizard for first-time setup
- Profile save/load for switching between team configs

**Smart Discord Integration**
- Task channels — orchestrator creates per-task channels, delegates work, archives when done
- Bot-to-bot mentions with real Discord `<@USER_ID>` syntax
- Interactive buttons for human decision points
- Direct messages via `send_dm` tool
- Message batching (3s delay for rapid human messages)
- Typing indicators controlled by bots
- Auto-nickname from role name

**Team Protocol**
- Orchestrator delegates via Discord, never does specialist work
- Specialists spawn subagents for deep work, stay responsive to Discord
- Validation chains — research gets cross-checked before presenting to humans
- Selective engagement — specialists only respond when @mentioned
- Chain of command — specialists report to orchestrator, not humans directly

**Permission System**
- Default mode skips permissions for autonomous operation — **only use on trusted servers**
- Safe mode (`disclaw-team start --safe`): every tool call requires approval via Discord DM
- Three approval options: Approve once, Always allow, Deny
- "Always allow" saves rules so trusted tools stop prompting

## Quick Start

```bash
npx disclaw-team init
```

This runs the setup wizard, installs 22 roles, and launches your bots. Open the dashboard at [http://localhost:5173](http://localhost:5173) to configure everything visually — the onboarding wizard walks you through Discord setup, bot tokens, and role assignment.

From the dashboard you can:

- Assign and swap roles visually
- Start/stop individual bots or the whole team
- Create and edit custom roles
- Switch between team presets with one click
- Set up recurring schedules
- Monitor live bot status

## Team Presets

| Preset | Bots | Use Case |
|--------|------|----------|
| **Executive** | CEO, Researcher, Validator, Engineer | Research-backed decisions |
| **Dev Team** | Tech Lead, Frontend, Backend, QA | Software development |
| **Frontend** | Creative Director, UI Designer, Frontend Dev, Reviewer | Design + frontend |
| **Product** | Product Manager, UX Researcher, Frontend Dev, Copywriter | Product design |
| **Content** | Editor, Writer, Researcher, Fact-checker | Content creation |
| **Research** | Lead Analyst, Researcher, Analyst, Reviewer | Deep analysis |
| **Solo** | Single assistant | Stock Discord plugin replacement |

## Roles Library

22 preloaded roles with configurable model and reasoning:

**Orchestrators** (Opus/high by default)
- CEO, Tech Lead, Editor-in-Chief, Creative Director, Product Manager, Project Manager

**Specialists** (Sonnet/high by default)
- Researcher, Validator, Data Analyst, Code Reviewer, Competitive Analyst, Security Advisor, SEO Specialist, UI Designer, UX Researcher

**Executors** (Sonnet/medium by default)
- Software Engineer, Frontend Engineer, Backend Engineer, Content Writer, QA Engineer, DevOps Engineer, Copywriter

Create custom roles or edit existing ones via the web dashboard or YAML files.

## Architecture

```
~/.disclaw-team/
├── bots.yaml           # Bot tokens (infrastructure)
├── assignment.yaml     # Role assignments (bot → role mapping)
├── .env                # Discord tokens (private)
├── roles/              # Role library (22 preloaded + custom)
├── schedules.yaml      # Recurring tasks
├── bots/               # Per-bot generated state
│   └── bot-1/
│       ├── access.json
│       ├── CLAUDE.md
│       ├── system-prompt.txt
│       ├── mcp-config.json
│       └── launch.sh
└── registry/           # Discord user ID cache
```

- **Bots are infrastructure** — set up once with Discord tokens
- **Roles are swappable** — assign any role to any bot, change anytime
- **Protocol auto-derives** — validation chains, engagement rules generated from role composition
- **State regenerates** — all bot CLAUDE.md files update when team changes

## CLI

```bash
disclaw-team init                       # Interactive setup
disclaw-team start [--safe]             # Launch all bots in tmux
disclaw-team stop [bot-id]              # Stop all or one bot
disclaw-team attach [bot-id]            # Attach to tmux session
disclaw-team status                     # Show team status
disclaw-team assign <bot-id> <role>     # Assign a role
disclaw-team roles list                 # Show available roles
disclaw-team roles show <role-id>       # Role details
disclaw-team switch save <name>         # Save current config
disclaw-team switch load <name>         # Load a saved config
```

## MCP Server Tools

The Discord MCP server provides 11 tools:

| Tool | Description |
|------|-------------|
| `reply` | Send a message to a Discord channel |
| `react` | Add an emoji reaction |
| `typing` | Show typing indicator |
| `edit_message` | Edit a previously sent message |
| `fetch_messages` | Read channel history |
| `download_attachment` | Download files from messages |
| `create_channel` | Create a task channel |
| `archive_channel` | Archive (rename) a task channel |
| `reply_with_buttons` | Send interactive button choices |
| `send_dm` | Direct message a user |

## Prerequisites

- [Node.js](https://nodejs.org) 18+ (or [Bun](https://bun.sh))
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) CLI with a Claude Pro subscription or higher
- [tmux](https://github.com/tmux/tmux) — auto-installed on macOS/Linux if missing
- Discord bot tokens from the [Developer Portal](https://discord.com/developers/applications)

## Why Separate Sessions?

Each bot runs as an independent Claude Code session because:
- **Genuine discourse** — independent reasoning, not one model wearing masks
- **Disagreement** — bots can push back on each other's findings
- **Parallel work** — all bots process simultaneously
- **Resilience** — one crash doesn't kill the team
- **Full context** — each bot has its own 1M context window

A single-session subagent approach was explored and rejected — it collapses into one mind routing to itself.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT
