import { execSync } from 'child_process'
import { join } from 'path'
import { homedir } from 'os'
import { existsSync, readFileSync, readdirSync } from 'fs'
import { parse as parseYaml } from 'yaml'
import { tmuxSessionExists, tmuxWindows } from '../tmux.js'

const CLAUDE_TEAM_DIR = join(homedir(), '.disclaw-team')
const CONFIG_PATH = join(CLAUDE_TEAM_DIR, 'team.yaml')
const ENV_PATH = join(CLAUDE_TEAM_DIR, '.env')
const BOTS_DIR = join(CLAUDE_TEAM_DIR, 'bots')
const REGISTRY_DIR = join(CLAUDE_TEAM_DIR, 'registry')
const PROFILES_DIR = join(CLAUDE_TEAM_DIR, 'profiles')

function loadEnvTokens(): Record<string, boolean> {
  const tokens: Record<string, boolean> = {}
  try {
    const content = readFileSync(ENV_PATH, 'utf-8')
    for (const line of content.split('\n')) {
      const m = line.match(/^(\w+)=(.+)$/)
      if (m) tokens[m[1]] = true
    }
  } catch {}
  return tokens
}

function activeProfile(): string | null {
  if (!existsSync(CONFIG_PATH) || !existsSync(PROFILES_DIR)) return null
  try {
    const activeContent = readFileSync(CONFIG_PATH, 'utf-8')
    const entries = readdirSync(PROFILES_DIR, { withFileTypes: true })
      .filter(e => e.isDirectory())
    for (const entry of entries) {
      const profileConfig = join(PROFILES_DIR, entry.name, 'team.yaml')
      if (existsSync(profileConfig)) {
        if (readFileSync(profileConfig, 'utf-8') === activeContent) return entry.name
      }
    }
  } catch {}
  return null
}

export async function status() {
  // Config
  if (!existsSync(CONFIG_PATH)) {
    console.log('\n  No team configured. Run `disclaw-team init` to get started.\n')
    return
  }

  type StatusBot = { name?: string; role?: string; token_env?: string }
  type StatusHuman = { name?: string; role?: string; discord_id?: string }
  type StatusConfig = {
    name?: string
    discord?: { guild_id?: string }
    bots?: Record<string, StatusBot>
    humans?: Record<string, StatusHuman>
  }
  const raw = readFileSync(CONFIG_PATH, 'utf-8')
  const config = parseYaml(raw) as StatusConfig
  const envTokens = loadEnvTokens()
  const running = tmuxWindows()
  const profile = activeProfile()

  console.log('')
  console.log(`  Team: ${config.name}${profile ? ` (profile: ${profile})` : ''}`)
  console.log(`  Guild: ${config.discord?.guild_id}`)
  console.log(`  Session: ${tmuxSessionExists() ? 'running' : 'stopped'}`)
  console.log('')

  // Bot table
  const bots = Object.entries(config.bots ?? {})
  const maxName = Math.max(...bots.map(([, b]) => (b.name || '').length), 4)
  const maxRole = Math.max(...bots.map(([, b]) => (b.role || '').length), 4)

  const header = `  ${'Bot'.padEnd(maxName + 2)}${'Role'.padEnd(maxRole + 2)}Token   State   Discord   Running`
  console.log(header)
  console.log('  ' + '-'.repeat(header.length - 2))

  for (const [id, bot] of bots) {
    const name = (bot.name || id).padEnd(maxName + 2)
    const role = (bot.role || '?').padEnd(maxRole + 2)
    const hasToken = (bot.token_env && envTokens[bot.token_env]) ? '✓' : '✗'
    const hasState = existsSync(join(BOTS_DIR, id, 'access.json')) ? '✓' : '✗'
    const hasRegistry = existsSync(join(REGISTRY_DIR, `${id}.json`)) ? '✓' : '✗'
    const isRunning = running.includes(id) ? '✓' : '✗'

    console.log(`  ${name}${role}${hasToken.padEnd(8)}${hasState.padEnd(8)}${hasRegistry.padEnd(10)}${isRunning}`)
  }

  // Humans
  const humans = Object.entries(config.humans ?? {})
  if (humans.length > 0) {
    console.log('')
    console.log('  Humans:')
    for (const [, h] of humans) {
      console.log(`    ${h.name} (${h.role})${h.discord_id ? ` — ${h.discord_id}` : ''}`)
    }
  }

  // Profiles
  if (existsSync(PROFILES_DIR)) {
    const profiles = readdirSync(PROFILES_DIR, { withFileTypes: true })
      .filter(e => e.isDirectory() && existsSync(join(PROFILES_DIR, e.name, 'team.yaml')))
      .map(e => e.name)
    if (profiles.length > 0) {
      console.log('')
      console.log(`  Profiles: ${profiles.map(p => p === profile ? `${p}*` : p).join(', ')}`)
    }
  }

  // Guidance
  console.log('')
  if (!tmuxSessionExists()) {
    console.log('  Run `disclaw-team start` to launch the team.')
  } else {
    console.log('  Attach: tmux attach -t disclaw-team')
  }
  console.log('')
}
