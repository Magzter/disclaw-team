#!/usr/bin/env node
export {}
/**
 * Permission request hook — routes Claude Code's permission prompts to Discord DMs.
 *
 * This is a PermissionRequest hook (NOT PreToolUse). It fires ONLY when
 * Claude Code's built-in permission system would normally show a terminal
 * prompt. We intercept it and show Approve/Always Allow/Deny in Discord.
 *
 * "Always Allow" saves the permission rule to the bot's local settings
 * so it won't ask again for the same type of action.
 *
 * Environment:
 *   DISCORD_BOT_TOKEN — the bot's Discord token
 *   DISCORD_OWNER_ID — human owner's Discord user ID
 *   BOT_ID — bot name for the message
 */

const chunks: Buffer[] = []
for await (const chunk of process.stdin) chunks.push(chunk as Buffer)
const stdin = Buffer.concat(chunks).toString('utf-8')

interface HookInput {
  tool_name?: string
  tool_input?: Record<string, string>
}

interface DiscordMessage {
  id: string
}

interface DiscordChannel {
  id: string
}

interface DiscordUser {
  id: string
}

let hookInput: HookInput
try {
  hookInput = JSON.parse(stdin) as HookInput
} catch {
  process.exit(0)
}

const toolName = hookInput.tool_name || 'unknown'
const toolInput = hookInput.tool_input || {}
const botId = process.env.BOT_ID || 'bot'
const token = process.env.DISCORD_BOT_TOKEN
const ownerDiscordId = process.env.DISCORD_OWNER_ID

if (!token || !ownerDiscordId) {
  process.exit(0)
}

function describeRequest(tool: string, input: Record<string, string>): string {
  switch (tool) {
    case 'Bash':
      return `Run command:\n\`\`\`\n${(input.command || '').slice(0, 500)}\n\`\`\``
    case 'Edit':
      return `Edit file: \`${input.file_path || 'unknown'}\``
    case 'Write':
      return `Create/write file: \`${input.file_path || 'unknown'}\``
    default:
      return `Use tool: \`${tool}\``
  }
}

const description = describeRequest(toolName, toolInput)
const API = 'https://discord.com/api/v10'
const headers = {
  'Authorization': `Bot ${token}`,
  'Content-Type': 'application/json',
}

try {
  // Open DM with owner
  const dmRes = await fetch(`${API}/users/@me/channels`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ recipient_id: ownerDiscordId }),
  })
  if (!dmRes.ok) process.exit(0)

  const dmChannel = await dmRes.json() as DiscordChannel
  const channelId = dmChannel.id

  // Post with 3 reaction options
  const msgRes = await fetch(`${API}/channels/${channelId}/messages`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      content: `🔐 **${botId}** needs permission\n\n${description}\n\n✅ Approve once\n🔓 Always allow this type\n❌ Deny`,
    }),
  })
  if (!msgRes.ok) process.exit(0)

  const msg = await msgRes.json() as DiscordMessage
  const messageId = msg.id

  // Add reactions
  for (const emoji of ['✅', '🔓', '❌']) {
    await fetch(`${API}/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}/@me`, {
      method: 'PUT', headers,
    })
  }

  // Poll for human reaction (every 2 seconds, max 2 minutes)
  const deadline = Date.now() + 120_000
  let decision: 'allow' | 'always' | 'deny' | null = null

  while (Date.now() < deadline && !decision) {
    await new Promise(r => setTimeout(r, 2000))

    for (const [emoji, result] of [['✅', 'allow'], ['🔓', 'always'], ['❌', 'deny']] as const) {
      const res = await fetch(
        `${API}/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`,
        { headers },
      )
      if (res.ok) {
        const reactors = await res.json() as DiscordUser[]
        if (reactors.length > 1) {
          decision = result
          break
        }
      }
    }
  }

  // Update message
  const resultText = decision === 'allow' ? '✅ Approved'
    : decision === 'always' ? '🔓 Always allowed'
    : decision === 'deny' ? '❌ Denied'
    : '⏰ Timed out (denied)'

  await fetch(`${API}/channels/${channelId}/messages/${messageId}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({
      content: `🔐 **${botId}** — ${description}\n\n${resultText}`,
    }),
  })

  if (decision === 'allow' || decision === 'always') {
    interface PermissionRule {
      type: string
      rules: Array<{ toolName: string; ruleContent: string }>
      behavior: string
      destination: string
    }
    interface HookOutput {
      hookSpecificOutput: {
        hookEventName: string
        decision: {
          behavior: string
          updatedPermissions?: PermissionRule[]
        }
      }
    }

    const output: HookOutput = {
      hookSpecificOutput: {
        hookEventName: 'PermissionRequest',
        decision: {
          behavior: 'allow',
        },
      },
    }

    // "Always allow" saves a permission rule
    if (decision === 'always') {
      const ruleContent = toolName === 'Bash'
        ? (toolInput.command || '').split(' ')[0] + ':*'
        : '*'

      output.hookSpecificOutput.decision.updatedPermissions = [{
        type: 'addRules',
        rules: [{ toolName, ruleContent }],
        behavior: 'allow',
        destination: 'localSettings',
      }]
    }

    console.log(JSON.stringify(output))
  } else {
    console.log(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PermissionRequest',
        decision: {
          behavior: 'deny',
        },
        message: decision === 'deny' ? 'Denied via Discord' : 'Permission request timed out',
      },
    }))
  }
} catch {
  process.exit(0)
}
