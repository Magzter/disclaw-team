# Security Policy

## Trust Model

disclaw-team is a **local development tool**, not a production server. It is designed to run on your own machine and connect to Discord on your behalf. It is not hardened for multi-tenant or adversarial environments.

## Claude Code Permission Mode

By default, disclaw-team launches Claude Code sessions with `--dangerously-skip-permissions`. This means:

- Claude Code can execute shell commands, write files, and run arbitrary code **without prompting for confirmation**.
- This is intentional for unattended bot operation — bots need to act autonomously.
- If you want Claude Code to prompt before taking actions, pass `--safe` when starting your team. This disables `--dangerously-skip-permissions` but will cause bots to pause and wait for user input on sensitive operations.

**Do not run disclaw-team on a shared or untrusted machine.** Any process with access to the tmux session can interact with running Claude Code sessions.

## Web UI

The web management UI binds to `localhost` only. It has **no authentication**. Anyone with access to your machine (or your localhost port) can view and modify your team configuration.

- Do not expose the web UI port publicly (e.g., via `ngrok`, port forwarding, or a public VPS without a firewall).
- If you need remote access, use a VPN or SSH tunnel.

## Token Storage

Discord bot tokens are stored in `~/.disclaw-team/.env` with `0o600` permissions (readable only by the file owner). Tokens are never committed to version control — `.env` files are excluded via `.gitignore`.

Per-bot state directories at `~/.disclaw-team/bots/<bot-id>/` are created with `0o700` permissions.

## Responsible Disclosure

- **Non-sensitive issues** (bugs, misconfigurations, documentation gaps): open a GitHub issue at https://github.com/Magzter/disclaw-team/issues
- **Sensitive security vulnerabilities** (token exposure, privilege escalation, RCE): email the maintainers directly rather than opening a public issue. Use the contact address on the GitHub profile, or reach out via a private GitHub security advisory.

We appreciate responsible disclosure and will respond promptly.
