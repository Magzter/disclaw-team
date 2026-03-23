import { readFileSync, existsSync, readdirSync, mkdirSync, copyFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { parse as parseYaml, stringify as toYaml } from 'yaml'
import {
  RoleFileSchema, BotsConfigSchema, AssignmentConfigSchema,
  type RoleFile, type BotsConfig, type AssignmentConfig,
} from './role-schema.js'
import type { TeamConfig } from './schema.js'

const BASE = join(homedir(), '.disclaw-team')
const BOTS_FILE = join(BASE, 'bots.yaml')
const ASSIGNMENT_FILE = join(BASE, 'assignment.yaml')
const ROLES_DIR = join(BASE, 'roles')
const ENV_FILE = join(BASE, '.env')

// --- Role loading ---

export function loadRole(roleId: string): RoleFile {
  const path = join(ROLES_DIR, `${roleId}.yaml`)
  if (!existsSync(path)) throw new Error(`Role "${roleId}" not found at ${path}`)
  const raw = readFileSync(path, 'utf-8')
  return RoleFileSchema.parse(parseYaml(raw))
}

export function listRoles(): Array<{ id: string; role: RoleFile }> {
  if (!existsSync(ROLES_DIR)) return []
  const roles: Array<{ id: string; role: RoleFile }> = []
  for (const file of readdirSync(ROLES_DIR)) {
    if (!file.endsWith('.yaml')) continue
    try {
      const id = file.replace('.yaml', '')
      const role = loadRole(id)
      roles.push({ id, role })
    } catch {}
  }
  return roles
}

// --- Bots loading ---

export function loadBots(): BotsConfig {
  if (!existsSync(BOTS_FILE)) throw new Error(`No bots configured. Run disclaw-team init.`)
  const raw = readFileSync(BOTS_FILE, 'utf-8')
  return BotsConfigSchema.parse(parseYaml(raw))
}

export function saveBots(config: BotsConfig): void {
  mkdirSync(BASE, { recursive: true })
  writeFileSync(BOTS_FILE, toYaml(config, { lineWidth: 0 }), { mode: 0o600 })
}

// --- Assignment loading ---

export function loadAssignment(): AssignmentConfig {
  if (!existsSync(ASSIGNMENT_FILE)) throw new Error(`No assignment configured. Run disclaw-team init.`)
  const raw = readFileSync(ASSIGNMENT_FILE, 'utf-8')
  return AssignmentConfigSchema.parse(parseYaml(raw))
}

export function saveAssignment(config: AssignmentConfig): void {
  mkdirSync(BASE, { recursive: true })
  writeFileSync(ASSIGNMENT_FILE, toYaml(config, { lineWidth: 0 }), { mode: 0o600 })
}

// --- Install preloaded roles ---

export function installPreloadedRoles(): void {
  mkdirSync(ROLES_DIR, { recursive: true })

  // Read the grouped role files from src/roles/ (or dist/roles/ in npm package)
  // Try multiple paths to find the source roles directory
  const candidates = [
    join(new URL('../../roles', import.meta.url).pathname),          // dist/roles/ (npm)
    join(new URL('../roles', import.meta.url).pathname),             // config/../roles = roles/ (if flat)
    join(new URL('../../src/roles', import.meta.url).pathname),      // src/roles/ (dev)
    join(new URL('../../../src/roles', import.meta.url).pathname),   // up from dist/config/
    join(process.cwd(), 'src', 'roles'),                            // cwd fallback
  ]
  const srcRolesDir = candidates.find(p => existsSync(p))
  if (!srcRolesDir) {
    console.warn('Warning: Could not find preloaded roles. Looked in:\n' + candidates.map(c => `  - ${c}`).join('\n'))
    return
  }

  for (const file of readdirSync(srcRolesDir)) {
    if (!file.endsWith('.yaml')) continue
    const raw = readFileSync(join(srcRolesDir, file), 'utf-8')
    const parsed = parseYaml(raw) as Record<string, Record<string, unknown>>

    // Each key in the file is a role ID
    for (const [roleId, roleData] of Object.entries(parsed)) {
      if (typeof roleData !== 'object' || !roleData) continue

      // Determine type from the source filename
      const type = file.replace('.yaml', '').replace(/s$/, '') // orchestrators → orchestrator

      // Default model config based on role type
      const defaultModelConfig = type === 'orchestrator'
        ? { model: 'opus', reasoning: 'high' }
        : type === 'specialist'
        ? { model: 'sonnet', reasoning: 'high' }
        : { model: 'sonnet', reasoning: 'medium' }

      const roleFile: Record<string, unknown> = {
        name: roleData.name_suggestion || roleId,
        type,
        description: roleData.description || '',
        ...(roleData.leadership_style ? { leadership_style: roleData.leadership_style } : {}),
        responsibilities: roleData.responsibilities || [],
        engagement: roleData.engagement || {},
        delegation: roleData.delegation || {},
        execution: roleData.execution || {},
        presentation: roleData.presentation || {},
        personality: roleData.personality || { tagline: roleData.description || '' },
        model_config: defaultModelConfig,
      }

      const destPath = join(ROLES_DIR, `${roleId}.yaml`)
      if (!existsSync(destPath)) {
        writeFileSync(destPath, toYaml(roleFile, { lineWidth: 0 }))
      }
    }
  }
}

// --- Protocol auto-derivation ---

export function deriveProtocol(
  assignments: Record<string, string>,
  roles: Map<string, RoleFile>,
  overrides?: AssignmentConfig['overrides']
): TeamConfig['protocol'] {
  const assignedRoles = Object.values(assignments).map(roleId => roles.get(roleId)).filter(Boolean) as RoleFile[]
  const types = new Set(assignedRoles.map(r => r.type))
  const hasOrchestrator = types.has('orchestrator')
  const hasSpecialist = types.has('specialist')
  const hasExecutor = types.has('executor')
  const multipleRoles = assignedRoles.length > 1

  // Auto-derive communication
  const communication = {
    selective_replies: multipleRoles,
    acknowledge_teammates: multipleRoles,
    react_before_responding: multipleRoles,
    default_reaction: 'eyes',
    completion_reaction: 'white_check_mark',
    ...overrides?.protocol?.communication,
  }

  // Auto-derive validation chain
  const validationChain: Array<{ source: string; validator: string }> = []
  if (hasSpecialist && hasExecutor) {
    validationChain.push({ source: 'executor', validator: 'specialist' })
  }
  if (hasSpecialist) {
    validationChain.push({ source: 'specialist', validator: 'specialist' })
  }

  const validation = {
    require_validation: validationChain.length > 0,
    validation_chain: validationChain,
    never_skip_for: overrides?.protocol?.validation?.never_skip_for || [],
    ...overrides?.protocol?.validation,
  }

  const escalation = {
    human_approval_required: overrides?.protocol?.escalation?.human_approval_required || [],
    escalation_targets: ['owner'],
  }

  return { communication, validation, escalation }
}

// --- Generate TeamConfig from new format (backward compatible) ---

export function generateTeamConfig(
  bots: BotsConfig,
  assignment: AssignmentConfig,
  envTokens: Map<string, string>,
): TeamConfig {
  // Load all assigned roles (skip empty/unassigned)
  const roleMap = new Map<string, RoleFile>()
  for (const roleId of new Set(Object.values(assignment.assignments))) {
    if (!roleId) continue
    try { roleMap.set(roleId, loadRole(roleId)) } catch {}
  }

  // Derive protocol
  const protocol = deriveProtocol(assignment.assignments, roleMap, assignment.overrides)

  // Build role definitions for TeamConfig
  const roles: TeamConfig['roles'] = {}
  const seenTypes = new Set<string>()
  for (const [, role] of roleMap) {
    if (!seenTypes.has(role.type)) {
      roles[role.type] = {
        description: role.description,
        leadership_style: role.leadership_style,
        responsibilities: role.responsibilities,
        engagement: role.engagement,
        delegation: role.delegation,
        execution: role.execution,
        presentation: role.presentation,
        is_human: false,
      }
      seenTypes.add(role.type)
    }
  }
  roles['owner'] = { description: 'Human stakeholder', is_human: true, responsibilities: [], engagement: { respond_to_all_teammates: false, require_mention_from_humans: true, require_mention_from_bots: true }, delegation: { can_delegate_to: [], reports_to: [] }, execution: { use_subagents: false, keep_main_thread_free: false }, presentation: { use_visuals: false, frame_with_conviction: false } }

  // Build bot configs
  const botConfigs: TeamConfig['bots'] = {}
  for (const [botId, roleId] of Object.entries(assignment.assignments)) {
    const botEntry = bots.bots[botId]
    if (!botEntry) continue
    const role = roleMap.get(roleId)
    if (!role) continue

    botConfigs[botId] = {
      name: role.name,
      token_env: botEntry.token_env,
      role: role.type,
      personality: role.personality,
      channels: [{
        id: assignment.discord.channel_id,
        require_mention: !role.engagement.respond_to_all_teammates,
        allow_from: [],
      }],
      dm_policy: 'disabled',
      allow_from: [],
      workspace: assignment.workspace,
      model: role.model_config?.model || assignment.model,
    }
  }

  // Build humans
  const humans: TeamConfig['humans'] = {}
  for (const [id, h] of Object.entries(assignment.humans)) {
    humans[id] = { name: h.name, discord_id: h.discord_id, role: h.role }
  }

  return {
    version: 1,
    name: `Team (${Object.keys(assignment.assignments).length} bots)`,
    discord: { guild_id: assignment.discord.guild_id },
    defaults: {
      workspace: assignment.workspace,
      model: assignment.model,
      interbot: true,
    },
    protocol,
    roles,
    bots: botConfigs,
    humans,
    allowed_users: assignment.allowed_users || [],
  }
}

// --- Resolve tokens ---

export function resolveTokensFromEnv(bots: BotsConfig): Map<string, string> {
  // Load .env
  const envTokens: Record<string, string> = {}
  try {
    for (const line of readFileSync(ENV_FILE, 'utf-8').split('\n')) {
      const m = line.match(/^(\w+)=(.*)$/)
      if (m) envTokens[m[1]] = m[2].trim()
    }
  } catch {}

  const tokens = new Map<string, string>()
  const missing: string[] = []

  for (const [botId, bot] of Object.entries(bots.bots)) {
    const token = envTokens[bot.token_env] || process.env[bot.token_env]
    if (!token) {
      missing.push(`${bot.token_env} (for bot "${botId}")`)
    } else {
      tokens.set(botId, token)
    }
  }

  if (missing.length > 0) {
    // Warn but don't fail — unassigned bots may not have tokens yet
    console.warn(`\nWarning: Missing Discord bot tokens:`)
    for (const m of missing) console.warn(`  - ${m}`)
    console.warn(`Add them to ~/.disclaw-team/.env\n`)
  }

  return tokens
}

// --- Check if new format exists ---

export function hasNewFormatConfig(): boolean {
  return existsSync(BOTS_FILE) && existsSync(ASSIGNMENT_FILE)
}
