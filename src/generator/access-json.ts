import type { TeamConfig } from '../config/schema.js'
import { getBotConfig } from '../config/loader.js'

export interface AccessJson {
  dmPolicy: 'pairing' | 'allowlist' | 'disabled'
  allowFrom: string[]
  groups: Record<string, {
    requireMention: boolean
    allowFrom: string[]
  }>
  pending: Record<string, never>
  ackReaction?: string
  replyToMode?: string
}

export function generateAccessJson(config: TeamConfig, botId: string): AccessJson {
  const bot = getBotConfig(config, botId)
  const proto = config.protocol

  const groups: AccessJson['groups'] = {}
  for (const ch of bot.channels) {
    groups[ch.id] = {
      // All bots see all messages at the server level.
      // Engagement decisions (when to respond) are handled by CLAUDE.md,
      // not by the server gate. This enables full discourse visibility.
      requireMention: false,
      allowFrom: ch.allow_from,
    }
  }

  // 'disabled' in team.yaml means "no DMs" but we still want guild channels.
  // The stock Discord plugin drops ALL messages when dmPolicy='disabled',
  // so we map it to 'allowlist' with an empty allowFrom list (same effect for DMs).
  const effectiveDmPolicy = bot.dm_policy === 'disabled' ? 'allowlist' : bot.dm_policy

  return {
    dmPolicy: effectiveDmPolicy,
    allowFrom: bot.allow_from,
    groups,
    pending: {},
    ...(proto.communication.react_before_responding && {
      ackReaction: proto.communication.default_reaction,
    }),
  }
}
