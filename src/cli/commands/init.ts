import { createInterface } from 'readline'
import { join } from 'path'
import { homedir } from 'os'
import { existsSync, writeFileSync, mkdirSync } from 'fs'
import { stringify as toYaml } from 'yaml'
import {
  installPreloadedRoles,
  listRoles,
  saveBots,
  saveAssignment,
} from '../../config/role-loader.js'
import type { BotsConfig, AssignmentConfig } from '../../config/role-schema.js'

const BASE = join(homedir(), '.disclaw-team')
const ENV_PATH = join(BASE, '.env')

function prompt(rl: ReturnType<typeof createInterface>, question: string, defaultVal?: string): Promise<string> {
  const suffix = defaultVal ? ` [${defaultVal}]` : ''
  return new Promise(resolve => {
    rl.question(`  ${question}${suffix}: `, answer => {
      resolve(answer.trim() || defaultVal || '')
    })
  })
}

export async function init(args: string[]) {
  if (existsSync(join(BASE, 'bots.yaml')) && existsSync(join(BASE, 'assignment.yaml'))) {
    console.log(`\n  Already configured — starting team...\n`)
    const { start } = await import('./start.js')
    await start([])
    return
  }

  // Install preloaded roles early so the dashboard has them
  mkdirSync(BASE, { recursive: true })
  installPreloadedRoles()

  const rl = createInterface({ input: process.stdin, output: process.stdout })

  console.log('\n  Welcome to disclaw-team!\n')
  console.log('  You can configure your team in the browser or here in the terminal.\n')

  const setupChoice = await prompt(rl, 'Open the dashboard to set up? [Y/n]', 'Y')

  if (setupChoice.toLowerCase() !== 'n') {
    rl.close()
    console.log('\n  Starting dashboard...\n')
    // Launch just the web dashboard (no bots yet — onboarding will handle that)
    const { ensureTmux } = await import('../tmux.js')
    if (!(await ensureTmux())) { process.exit(1) }

    const { TMUX_SESSION, tmuxSessionExists } = await import('../tmux.js')
    const webCandidates = [
      join(new URL('../../..', import.meta.url).pathname, 'web'),
      join(process.cwd(), 'web'),
    ]
    const webDir = webCandidates.find(p => existsSync(join(p, 'package.json')))
    if (webDir) {
      const npmCmd = existsSync(join(webDir, 'node_modules')) ? 'npm run dev' : 'npm install && npm run dev'
      const dashCmd = `cd ${webDir} && ${npmCmd}`
      if (!tmuxSessionExists()) {
        const { execSync } = await import('child_process')
        execSync(`tmux new-session -d -s ${TMUX_SESSION} -n dashboard '${dashCmd.replace(/'/g, "'\\''")}'`)
      }
    }

    console.log(`  Dashboard:  http://localhost:5173/onboarding`)
    console.log(`  Complete the setup wizard in your browser.\n`)
    console.log(`  Once configured, run: disclaw-team start\n`)
    return
  }

  console.log('\n  Step 1: Set up your Discord server\n')

  const guildId = await prompt(rl, 'Discord server (guild) ID')
  if (!guildId) {
    console.log('\n  Guild ID required. Server Settings → Widget → Server ID\n')
    rl.close()
    return
  }

  const channelId = await prompt(rl, 'General channel ID (where the team talks)')
  if (!channelId) {
    console.log('\n  Channel ID required. Right-click channel → Copy Channel ID\n')
    rl.close()
    return
  }

  const workspace = await prompt(rl, 'Workspace directory (where bots work)', process.cwd())

  // Step 2: Create bots
  console.log('\n  Step 2: Set up your bots\n')
  console.log('  Create bot applications in the Discord Developer Portal.')
  console.log('  Each bot needs: Message Content Intent enabled, invite to your server.\n')

  const botCountStr = await prompt(rl, 'How many bots?', '3')
  const botCount = Math.max(1, parseInt(botCountStr, 10) || 3)

  const botsConfig: BotsConfig = { bots: {} }
  const tokens: Record<string, string> = {}

  for (let i = 0; i < botCount; i++) {
    console.log(`\n  --- Bot ${i + 1} of ${botCount} ---`)
    const botName = await prompt(rl, '  Bot ID (short name, e.g. bot-1)', `bot-${i + 1}`)
    const botToken = await prompt(rl, '  Discord bot token')

    if (!botToken) {
      console.log(`  Skipping (no token). Add later by editing ~/.disclaw-team/.env`)
      continue
    }

    const tokenEnv = `${botName.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}_TOKEN`
    botsConfig.bots[botName] = { token_env: tokenEnv }
    tokens[tokenEnv] = botToken
  }

  if (Object.keys(botsConfig.bots).length === 0) {
    console.log('\n  No bots configured.\n')
    rl.close()
    return
  }

  // Step 3: Install roles and assign
  console.log('\n  Step 3: Assign roles to your bots\n')

  installPreloadedRoles()
  const allRoles = listRoles()

  // Group roles by type for display
  const byType = new Map<string, Array<{ id: string; name: string }>>()
  for (const { id, role } of allRoles) {
    if (!byType.has(role.type)) byType.set(role.type, [])
    byType.get(role.type)!.push({ id, name: role.name })
  }

  console.log('  Available roles:')
  let num = 1
  const roleIndex: string[] = []
  for (const [type, roles] of byType) {
    console.log(`\n    ${type.toUpperCase()}S:`)
    for (const r of roles) {
      console.log(`      ${num}. ${r.name} (${r.id})`)
      roleIndex.push(r.id)
      num++
    }
  }
  console.log('')

  const assignments: Record<string, string> = {}
  const botIds = Object.keys(botsConfig.bots)

  for (const botId of botIds) {
    const choice = await prompt(rl, `  Role for ${botId} (number or role-id)`, '1')
    const choiceNum = parseInt(choice, 10)
    if (choiceNum > 0 && choiceNum <= roleIndex.length) {
      assignments[botId] = roleIndex[choiceNum - 1]
    } else if (allRoles.some(r => r.id === choice)) {
      assignments[botId] = choice
    } else {
      console.log(`  Invalid choice, defaulting to first role`)
      assignments[botId] = roleIndex[0]
    }
    const assigned = allRoles.find(r => r.id === assignments[botId])
    console.log(`    → ${assigned?.role.name || assignments[botId]}`)
  }

  // Step 4: Human owner
  console.log('\n  Step 4: Human owner\n')
  const humanName = await prompt(rl, '  Your name', 'Owner')
  const humanDiscordId = await prompt(rl, '  Your Discord user ID (optional)', '')

  rl.close()

  // Save everything
  mkdirSync(BASE, { recursive: true })

  // Save bots.yaml
  saveBots(botsConfig)

  // Save .env
  const envLines = Object.entries(tokens).map(([k, v]) => `${k}=${v}`).join('\n')
  writeFileSync(ENV_PATH, envLines + '\n', { mode: 0o600 })

  // Save assignment.yaml
  const assignment: AssignmentConfig = {
    discord: { guild_id: guildId, channel_id: channelId },
    workspace,
    model: 'opus',
    assignments,
    humans: humanDiscordId ? {
      [humanName.toLowerCase().replace(/[^a-z0-9]+/g, '-')]: {
        name: humanName,
        discord_id: humanDiscordId,
        role: 'owner',
      },
    } : {},
    overrides: {},
  }
  saveAssignment(assignment)

  // Summary
  console.log(`
  Setup complete!

  Bots: ${Object.keys(botsConfig.bots).length}`)
  for (const [botId, roleId] of Object.entries(assignments)) {
    const role = allRoles.find(r => r.id === roleId)
    console.log(`    ${botId} → ${role?.role.name || roleId} (${role?.role.type || '?'})`)
  }
  console.log(`
  Config: ${BASE}/
    bots.yaml        Bot tokens
    assignment.yaml  Role assignments
    roles/           Role library (${allRoles.length} roles)
    .env             Tokens (private)
`)

  // Auto-start
  console.log('  Launching team...\n')
  const { start } = await import('./start.js')
  await start([])
}
