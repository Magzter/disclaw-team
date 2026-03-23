# Contributing to disclaw-team

Thanks for your interest in contributing! This project is in early development and we welcome contributions of all kinds.

## Getting Started

1. Fork the repo
2. Clone your fork
3. Install dependencies: `npm install`
4. Build: `npm run build`
5. Create a branch: `git checkout -b my-feature`
6. Make your changes
7. Push and open a PR

## Prerequisites

- [Node.js](https://nodejs.org) 20+ (or [Bun](https://bun.sh))
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) CLI (for testing)
- A Discord bot token (for integration testing)

## Project Structure

See [docs/PLAN.md](docs/PLAN.md) for full architecture details.

Key directories:
- `src/cli/` — CLI tool and commands
- `src/server/` — MCP server (Discord integration)
- `src/config/` — Config schema and loading
- `src/roles/` — Built-in role archetypes (YAML)
- `src/templates/` — Team template definitions
- `src/generator/` — Per-bot config generation
- `src/hooks/` — Claude Code permission hooks
- `skills/` — Claude Code plugin skills

## Code Style

- TypeScript with strict mode
- ESM modules (`import`/`export`, no `require`)
- Prefer explicit types over `any`
- Keep functions focused and small

## Tests

Tests are not yet implemented. When adding new functionality, document expected behavior in the PR description so it can be manually verified.

## Pull Requests

- Keep PRs focused on a single change
- Include a clear description of what and why
- Update docs if behavior changes

## Reporting Issues

Open an issue on GitHub with:
- What you expected to happen
- What actually happened
- Steps to reproduce
- Your environment (OS, Bun version, Claude Code version)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
