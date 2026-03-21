import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { parse as parseYaml } from 'yaml'
import { TeamConfigSchema, TemplateSchema } from './schema.js'
import type { TeamConfig, BotConfig, RoleConfig } from './schema.js'

const CONFIG_SEARCH_PATHS = [
  'team.yaml',
  '.disclaw-team/team.yaml',
  join(homedir(), '.disclaw-team', 'team.yaml'),
]

const ENV_SEARCH_PATHS = [
  '.env',
  '.disclaw-team/.env',
  join(homedir(), '.disclaw-team', '.env'),
]

export function findConfigPath(explicit?: string): string {
  if (explicit) {
    if (!existsSync(explicit)) {
      throw new Error(`Config file not found: ${explicit}`)
    }
    return explicit
  }

  for (const p of CONFIG_SEARCH_PATHS) {
    if (existsSync(p)) return p
  }

  throw new Error(
    'No team.yaml found. Searched:\n' +
    CONFIG_SEARCH_PATHS.map(p => `  - ${p}`).join('\n') +
    '\n\nRun `disclaw-team init` to create one.'
  )
}

export function loadConfig(path?: string): TeamConfig {
  const configPath = findConfigPath(path)
  const raw = readFileSync(configPath, 'utf-8')
  const parsed = parseYaml(raw)
  return TeamConfigSchema.parse(parsed)
}

export function loadTemplate(path: string) {
  const raw = readFileSync(path, 'utf-8')
  const parsed = parseYaml(raw)
  return TemplateSchema.parse(parsed)
}

export function findEnvPath(explicit?: string): string | null {
  if (explicit) {
    return existsSync(explicit) ? explicit : null
  }

  for (const p of ENV_SEARCH_PATHS) {
    if (existsSync(p)) return p
  }

  return null
}

function parseEnvFile(content: string): Record<string, string> {
  const env: Record<string, string> = {}
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIndex = trimmed.indexOf('=')
    if (eqIndex === -1) continue
    const key = trimmed.slice(0, eqIndex).trim()
    let value = trimmed.slice(eqIndex + 1).trim()
    // Strip quotes
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    env[key] = value
  }
  return env
}

export function resolveTokens(
  config: TeamConfig,
  envPath?: string,
): Map<string, string> {
  const path = findEnvPath(envPath)
  const fileEnv = path ? parseEnvFile(readFileSync(path, 'utf-8')) : {}
  // Merge with process.env (file takes precedence)
  const allEnv = { ...process.env, ...fileEnv }

  const tokens = new Map<string, string>()
  const missing: string[] = []

  for (const [botId, bot] of Object.entries(config.bots)) {
    const token = allEnv[bot.token_env]
    if (!token) {
      missing.push(`${bot.token_env} (for bot "${botId}")`)
    } else {
      tokens.set(botId, token)
    }
  }

  if (missing.length > 0) {
    throw new Error(
      'Missing Discord bot tokens:\n' +
      missing.map(m => `  - ${m}`).join('\n') +
      '\n\nAdd them to your .env file.'
    )
  }

  return tokens
}

export function getBotConfig(config: TeamConfig, botId: string): BotConfig {
  const bot = config.bots[botId]
  if (!bot) {
    throw new Error(`Bot "${botId}" not found in team.yaml. Available: ${Object.keys(config.bots).join(', ')}`)
  }
  return bot
}

export function getRoleForBot(config: TeamConfig, botId: string): RoleConfig {
  const bot = getBotConfig(config, botId)
  const role = config.roles[bot.role]
  if (!role) {
    throw new Error(`Role "${bot.role}" not found in team.yaml. Available: ${Object.keys(config.roles).join(', ')}`)
  }
  return role
}
