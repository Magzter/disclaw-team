import { execSync } from 'child_process'
import { join, resolve } from 'path'
import { homedir } from 'os'
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'fs'
import { stringify as toYaml } from 'yaml'
import { loadConfig, resolveTokens, getBotConfig, findConfigPath } from '../../config/loader.js'
import { hasNewFormatConfig, loadBots, loadAssignment, loadRole, generateTeamConfig, resolveTokensFromEnv } from '../../config/role-loader.js'
import { generateAccessJson } from '../../generator/access-json.js'
import { generateClaudeMd } from '../../generator/claude-md.js'
import { TMUX_SESSION, ensureTmux, tmuxSessionExists, tmuxWindowName } from '../tmux.js'
import { runtime, packageRoot } from '../../runtime.js'

const BOTS_DIR = join(homedir(), '.disclaw-team', 'bots')
const REGISTRY_DIR = join(homedir(), '.disclaw-team', 'registry')

function serverPath(): string {
  // Works from both src/ (dev) and dist/ (published)
  const candidates = [
    join(packageRoot(), 'dist', 'server', 'server.js'),
    join(new URL('../../server/server.ts', import.meta.url).pathname),
  ]
  return candidates.find(p => existsSync(p)) || candidates[candidates.length - 1]
}

function buildMcpConfig(botId: string, stateDir: string, configPath: string): string {
  const server = serverPath()
  const rt = runtime()
  const mcpJson = {
    mcpServers: {
      'disclaw-team': {
        command: '/bin/sh',
        args: [
          '-c',
          `BOT_ID='${botId}' CLAUDE_TEAM_CONFIG='${configPath}' DISCORD_STATE_DIR='${stateDir}' exec '${rt}' '${server}'`,
        ],
      },
    },
  }
  return JSON.stringify(mcpJson)
}

function killSession(): void {
  try { execSync(`tmux kill-session -t ${TMUX_SESSION}`, { stdio: 'pipe' }) } catch {}
}

function allBotsRegistered(botIds: string[]): boolean {
  return botIds.every(id => existsSync(join(REGISTRY_DIR, `${id}.json`)))
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/** Read the current tmux pane content for a window */
function readPane(windowName: string): string {
  try {
    return execSync(`tmux capture-pane -t ${TMUX_SESSION}:${windowName} -p`, { stdio: 'pipe' }).toString()
  } catch { return '' }
}

/** Known Claude Code prompts and the keystrokes needed to proceed */
const PROMPT_HANDLERS: Array<{ match: string; keys: string; description: string }> = [
  {
    match: 'Bypass Permissions mode',
    keys: 'Down Enter',
    description: 'Accepting bypass permissions',
  },
  {
    match: 'Loading development channels',
    keys: 'Enter',
    description: 'Accepting development channels',
  },
]

/**
 * Poll tmux panes and auto-confirm Claude Code startup prompts.
 * Reads pane content to detect which prompt is showing, then sends
 * the correct keystrokes. Handles any number of prompts in any order.
 */
async function autoConfirmPrompts(
  botIds: string[],
  commands: Map<string, { launchScript: string; name: string }>,
  _safeMode: boolean,
) {
  const pending = new Set(botIds.filter(id => commands.has(id)))
  const confirmed = new Map<string, Set<string>>() // botId → set of confirmed prompts
  for (const id of pending) confirmed.set(id, new Set())

  const MAX_WAIT = 20_000
  const POLL_INTERVAL = 500
  let waited = 0

  while (pending.size > 0 && waited < MAX_WAIT) {
    await sleep(POLL_INTERVAL)
    waited += POLL_INTERVAL

    // Check if tmux session died
    if (!tmuxSessionExists()) break

    for (const botId of [...pending]) {
      const cmd = commands.get(botId)!
      const windowName = tmuxWindowName(botId, cmd.name)
      const pane = readPane(windowName)
      if (!pane) continue

      // Check each known prompt
      let matched = false
      for (const handler of PROMPT_HANDLERS) {
        if (pane.includes(handler.match) && !confirmed.get(botId)!.has(handler.match)) {
          try {
            execSync(`tmux send-keys -t ${TMUX_SESSION}:${windowName} ${handler.keys}`, { stdio: 'pipe' })
          } catch {}
          confirmed.get(botId)!.add(handler.match)
          matched = true
          break // handle one prompt per poll cycle
        }
      }

      // If pane shows the Claude Code session (no more prompts), bot is ready
      if (!matched && confirmed.get(botId)!.size > 0 && !PROMPT_HANDLERS.some(h => pane.includes(h.match))) {
        pending.delete(botId)
      }
    }
  }
}

function generateBotState(config: ReturnType<typeof loadConfig>, botId: string, token: string, configPath: string, safeMode: boolean = false) {
  const bot = getBotConfig(config, botId)
  const stateDir = join(BOTS_DIR, botId)
  mkdirSync(stateDir, { recursive: true, mode: 0o700 })

  // Generate access.json
  const accessJson = generateAccessJson(config, botId)
  writeFileSync(
    join(stateDir, 'access.json'),
    JSON.stringify(accessJson, null, 2) + '\n',
    { mode: 0o600 },
  )

  // Generate CLAUDE.md and system prompt
  const claudeMd = generateClaudeMd(config, botId)
  writeFileSync(join(stateDir, 'CLAUDE.md'), claudeMd)
  writeFileSync(join(stateDir, 'system-prompt.txt'), claudeMd)

  // Write per-bot .env
  writeFileSync(
    join(stateDir, '.env'),
    `DISCORD_BOT_TOKEN=${token}\n`,
    { mode: 0o600 },
  )

  // Write MCP config
  const mcpConfig = buildMcpConfig(botId, stateDir, configPath)
  const mcpConfigFile = join(stateDir, 'mcp-config.json')
  writeFileSync(mcpConfigFile, mcpConfig)

  // Generate permission hook settings
  const hookCandidates = [
    join(packageRoot(), 'dist', 'hooks', 'permission-request.js'),
    join(new URL('../../hooks/permission-request.ts', import.meta.url).pathname),
  ]
  const hookScript = hookCandidates.find(p => existsSync(p)) || hookCandidates[hookCandidates.length - 1]
  const rt = runtime()

  // Find the owner's Discord ID from the humans config
  const ownerDiscordId = Object.values(config.humans).find(h => h.role === 'owner')?.discord_id || ''

  const settingsFile = join(stateDir, 'settings.json')
  const settings: {
    permissions?: { allow: string[] }
    hooks?: {
      PermissionRequest: Array<{
        matcher: string
        hooks: Array<{ type: string; command: string; timeout: number }>
      }>
    }
  } = {}

  // In safe mode: pre-seed safe permissions + route remaining prompts to Discord
  if (safeMode) {
    settings.permissions = {
      allow: [
        // Read-only tools
        'Read', 'Glob', 'Grep', 'WebSearch', 'WebFetch',
        // Edit/Write within workspace
        'Edit', 'Write',
        // Common safe bash commands
        'Bash(cat:*)', 'Bash(ls:*)', 'Bash(head:*)', 'Bash(tail:*)',
        'Bash(echo:*)', 'Bash(pwd:*)', 'Bash(wc:*)', 'Bash(which:*)',
        'Bash(find:*)', 'Bash(grep:*)', 'Bash(sort:*)', 'Bash(uniq:*)',
        'Bash(mkdir:*)', 'Bash(touch:*)', 'Bash(cp:*)', 'Bash(mv:*)',
        'Bash(git:*)',
        'Bash(bun:*)', 'Bash(bunx:*)', 'Bash(npm:*)', 'Bash(npx:*)',
        'Bash(node:*)', 'Bash(tsc:*)', 'Bash(tsx:*)',
        'Bash(curl:*)', 'Bash(wget:*)',
        'Bash(tmux:*)',
        // MCP tools
        `mcp__disclaw-team__reply`,
        `mcp__disclaw-team__react`,
        `mcp__disclaw-team__typing`,
        `mcp__disclaw-team__fetch_messages`,
        `mcp__disclaw-team__edit_message`,
        `mcp__disclaw-team__download_attachment`,
        `mcp__disclaw-team__create_channel`,
        `mcp__disclaw-team__archive_channel`,
        `mcp__disclaw-team__reply_with_buttons`,
        // Agent tool
        'Agent',
      ],
    }

    // Route remaining permission prompts to Discord DMs
    if (ownerDiscordId) {
      settings.hooks = {
        PermissionRequest: [
          {
            matcher: '',
            hooks: [
              {
                type: 'command',
                command: `BOT_ID='${botId}' DISCORD_BOT_TOKEN='${token}' DISCORD_OWNER_ID='${ownerDiscordId}' '${rt}' '${hookScript}'`,
                timeout: 130,
              },
            ],
          },
        ],
      }
    }
  }

  writeFileSync(settingsFile, JSON.stringify(settings, null, 2))

  const workspace = bot.workspace ?? config.defaults.workspace ?? process.cwd()
  const promptFile = join(stateDir, 'system-prompt.txt')

  // Load role-specific model config if using new format
  let modelFlag = ''
  let effortFlag = ''
  if (hasNewFormatConfig()) {
    try {
      const assignment = loadAssignment()
      const roleId = assignment.assignments[botId]
      if (roleId) {
        const role = loadRole(roleId)
        if (role.model_config?.model) modelFlag = `--model ${role.model_config.model} `
        if (role.model_config?.reasoning) effortFlag = `--effort ${role.model_config.reasoning} `
      }
    } catch {}
  }

  const permFlag = safeMode ? '' : '--dangerously-skip-permissions '
  const claudeCmd = `cd "${workspace}" && claude ${permFlag}${modelFlag}${effortFlag}--dangerously-load-development-channels server:disclaw-team --strict-mcp-config --mcp-config "${mcpConfigFile}" --settings "${settingsFile}" --append-system-prompt "$(cat "${promptFile}")"`

  // Write launch script (used by tmux to avoid shell quoting issues)
  const launchScript = join(stateDir, 'launch.sh')
  writeFileSync(launchScript, `#!/bin/sh\n${claudeCmd}\n`, { mode: 0o755 })

  return { claudeCmd, launchScript, bot }
}

function launchBots(botIds: string[], commands: Map<string, { launchScript: string; name: string }>) {
  let firstBot = true
  for (const botId of botIds) {
    const cmd = commands.get(botId)!
    // Use botId-roleName for unique tmux window tab
    const windowName = tmuxWindowName(botId, cmd.name)
    if (firstBot && !tmuxSessionExists()) {
      execSync(`tmux new-session -d -s ${TMUX_SESSION} -n ${windowName} "${cmd.launchScript}"`)
      firstBot = false
    } else {
      execSync(`tmux new-window -t ${TMUX_SESSION} -n ${windowName} "${cmd.launchScript}"`)
    }
  }
}

export async function start(args: string[]) {
  const safeMode = args.includes('--safe')
  const filteredArgs = args.filter(a => a !== '--safe')
  const targetBotId = filteredArgs[0]

  if (!(await ensureTmux())) {
    process.exit(1)
  }

  // Support both new format (bots.yaml + assignment.yaml) and legacy (team.yaml)
  let config
  let tokens
  let configPath: string

  if (hasNewFormatConfig()) {
    // New role-based format
    try {
      const bots = loadBots()
      const assignment = loadAssignment()
      tokens = resolveTokensFromEnv(bots)
      config = generateTeamConfig(bots, assignment, tokens)

      // Write derived team.yaml for the MCP server to read
      const derivedPath = join(homedir(), '.disclaw-team', 'team.yaml')
      writeFileSync(derivedPath, toYaml(config, { lineWidth: 0 }))
      configPath = resolve(derivedPath)
    } catch (err) {
      console.error(`Error: ${(err as Error).message}`)
      process.exit(1)
    }
  } else {
    // Legacy team.yaml format
    try { config = loadConfig() } catch (err) {
      console.error(`Error: ${(err as Error).message}`)
      process.exit(1)
    }
    try { tokens = resolveTokens(config) } catch (err) {
      console.error(`Error: ${(err as Error).message}`)
      process.exit(1)
    }
    configPath = resolve(findConfigPath())
  }
  const botIds = targetBotId ? [targetBotId] : Object.keys(config.bots)

  // Kill existing session
  if (!targetBotId && tmuxSessionExists()) {
    console.log('Stopping existing team session...')
    killSession()
  }

  // Check if registry already has all bot IDs (from a previous run)
  const registryComplete = allBotsRegistered(botIds)

  // Phase 1: Generate state
  console.log(registryComplete ? 'Starting team...' : 'Starting team (first run — will auto-restart to pick up Discord IDs)...')

  const commands = new Map<string, { launchScript: string; name: string }>()
  for (const botId of botIds) {
    const token = tokens.get(botId)
    if (!token) { console.error(`No token for "${botId}"`); continue }
    const { launchScript, bot } = generateBotState(config, botId, token, configPath, safeMode)
    commands.set(botId, { launchScript, name: bot.name })
    console.log(`  ${bot.name} (${botId})`)
  }

  // Pre-flight: verify Discord connections before launching tmux
  console.log('\nVerifying Discord connections...')
  let preflightFailed = false
  for (const botId of botIds) {
    const stateDir = join(BOTS_DIR, botId)
    const mcpCmd = buildMcpConfig(botId, stateDir, configPath)
    const parsed = JSON.parse(mcpCmd)
    const serverCmd = parsed.mcpServers['disclaw-team'].args[1]
    try {
      execSync(serverCmd, { stdio: 'pipe', timeout: 10000, shell: '/bin/sh' })
    } catch (err) {
      const e = err as { stderr?: Buffer; killed?: boolean }
      const stderr = e.stderr?.toString() || ''
      if (e.killed) {
        // Timeout = server started successfully (connected to Discord, waiting for MCP messages)
        continue
      }
      if (stderr.includes('disclaw-team:')) {
        console.error(`\n  ${botId}: ${stderr.trim().split('\n').join('\n  ')}`)
        preflightFailed = true
      }
    }
  }
  if (preflightFailed) {
    console.error('\nFix the above errors and try again.\n')
    process.exit(1)
  }
  console.log('  All connections verified.\n')

  launchBots(botIds, commands)

  // Auto-confirm Claude Code startup prompts
  // Prompt 1 (non-safe mode only): "Bypass Permissions" — default is "No, exit", need Down+Enter
  // Prompt 2: "Development channels" — default is "I am using this for local development", just Enter
  await autoConfirmPrompts(botIds, commands, safeMode)

  // Phase 2: If registry was incomplete, wait for bots to register then restart
  if (!registryComplete) {
    console.log('\nWaiting for bots to connect to Discord...')

    // Poll for registry files (max 30 seconds)
    let waited = 0
    while (!allBotsRegistered(botIds) && waited < 30000) {
      await sleep(2000)
      waited += 2000
      const registered = botIds.filter(id => existsSync(join(REGISTRY_DIR, `${id}.json`)))
      process.stdout.write(`\r  ${registered.length}/${botIds.length} bots registered...`)
    }
    console.log('')

    if (allBotsRegistered(botIds)) {
      console.log('All bots registered. Restarting with Discord mention IDs...')

      // Kill the initial session
      killSession()
      await sleep(1000)

      // Regenerate state with registry data (now has real Discord user IDs)
      for (const botId of botIds) {
        const token = tokens.get(botId)
        if (!token) continue
        const { launchScript, bot } = generateBotState(config, botId, token, configPath, safeMode)
        commands.set(botId, { launchScript, name: bot.name })
      }

      // Relaunch
      launchBots(botIds, commands)

      // Auto-confirm startup prompts
      await autoConfirmPrompts(botIds, commands, safeMode)

      console.log('Restarted with full Discord mention IDs.')
    } else {
      console.log('Warning: Not all bots registered in time. @mentions may use plain text names.')
      console.log('Run `disclaw-team stop && disclaw-team start` to retry.')
    }
  }

  // Inject scheduled cron jobs into bot sessions
  const schedulesFile = join(homedir(), '.disclaw-team', 'schedules.yaml')
  if (existsSync(schedulesFile)) {
    try {
      const { parse: parseYaml } = await import('yaml')
      const schedulesData = parseYaml(readFileSync(schedulesFile, 'utf-8')) as { schedules?: Array<{ id: string; name: string; prompt: string; bot_id: string; cron: string; enabled: boolean }> }
      const schedules = (schedulesData.schedules || []).filter(s => s.enabled)

      if (schedules.length > 0) {
        // Wait for bots to fully initialize (after auto-confirm, channel connection, etc.)
        console.log(`\nWaiting for bots to be ready before injecting schedules...`)
        await sleep(15000)

        for (const schedule of schedules) {
          if (!botIds.includes(schedule.bot_id)) continue
          const cmd = commands.get(schedule.bot_id)
          const windowName = cmd ? tmuxWindowName(schedule.bot_id, cmd.name) : schedule.bot_id
          const escaped = `Set up a recurring cron job: cron expression "${schedule.cron}", prompt: "${schedule.prompt.replace(/"/g, '\\"').replace(/\n/g, ' ')}" — use CronCreate to schedule this.`
          try {
            execSync(`tmux send-keys -t ${TMUX_SESSION}:${windowName} '${escaped.replace(/'/g, "'\\''")}' Enter`)
            console.log(`  ${schedule.name} → ${windowName}`)
          } catch {
            console.log(`  ${schedule.name} → ${windowName} (failed — bot may not be ready)`)
          }
        }
      }
    } catch {}
  }

  // Launch web dashboard in a tmux window
  const { findDashboard } = await import('../dashboard.js')
  const dashboard = findDashboard()
  let dashboardLine = ''
  if (dashboard && tmuxSessionExists()) {
    execSync(`tmux new-window -t ${TMUX_SESSION} -n dashboard '${dashboard.cmd.replace(/'/g, "'\\''")}'`)
    dashboardLine = `\n  Dashboard:             http://localhost:${dashboard.port}`
  }

  if (tmuxSessionExists()) {
    console.log(`
All ${botIds.length} bot(s) launched in tmux session "${TMUX_SESSION}".
${dashboardLine}
  Attach to session:     tmux attach -t ${TMUX_SESSION}
  Switch windows:        Ctrl-B then 0-${botIds.length} (or n/p for next/prev)
  Stop all:              disclaw-team stop
`)
  } else {
    console.log(`
Error: tmux session failed to start. The bot process likely crashed immediately.

  Check the launch script:  cat ~/.disclaw-team/bots/${botIds[0]}/launch.sh
  Try running it manually:  sh ~/.disclaw-team/bots/${botIds[0]}/launch.sh
  Is Claude Code installed? claude --version
`)
  }
}
