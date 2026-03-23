import { z } from 'zod'

// --- Protocol schemas ---

const CommunicationSchema = z.object({
  selective_replies: z.boolean().default(true),
  acknowledge_teammates: z.boolean().default(true),
  react_before_responding: z.boolean().default(true),
  default_reaction: z.string().default('eyes'),
  completion_reaction: z.string().default('white_check_mark'),
})

const ValidationChainEntrySchema = z.object({
  source: z.string(),     // role type that produces output
  validator: z.string(),  // role type that validates it
})

const ValidationSchema = z.object({
  require_validation: z.boolean().default(true),
  validation_chain: z.array(ValidationChainEntrySchema).default([]),
  never_skip_for: z.array(z.string()).default([]),
})

const EscalationSchema = z.object({
  human_approval_required: z.array(z.string()).default([]),
  escalation_targets: z.array(z.string()).default(['owner']),
})

const ProtocolSchema = z.object({
  communication: CommunicationSchema.default({}),
  validation: ValidationSchema.default({}),
  escalation: EscalationSchema.default({}),
})

// --- Role schemas ---

const EngagementSchema = z.object({
  respond_to_all_teammates: z.boolean().default(false),
  require_mention_from_humans: z.boolean().default(true),
  require_mention_from_bots: z.boolean().default(true),
})

const DelegationSchema = z.object({
  can_delegate_to: z.array(z.string()).default([]),
  reports_to: z.array(z.string()).default([]),
})

const ExecutionSchema = z.object({
  use_subagents: z.boolean().default(true),
  keep_main_thread_free: z.boolean().default(true),
})

const PresentationSchema = z.object({
  use_visuals: z.boolean().default(false),
  frame_with_conviction: z.boolean().default(false),
})

const RoleSchema = z.object({
  description: z.string(),
  leadership_style: z.string().optional(),
  responsibilities: z.array(z.string()).default([]),
  engagement: EngagementSchema.default({}),
  delegation: DelegationSchema.default({}),
  execution: ExecutionSchema.default({}),
  presentation: PresentationSchema.default({}),
  is_human: z.boolean().default(false),
})

// --- Bot schemas ---

const PersonalitySchema = z.object({
  tagline: z.string(),
  tone: z.string().default('Helpful and professional'),
  instructions: z.string().default(''),
  domain: z.array(z.string()).default([]),
})

const ChannelEntrySchema = z.object({
  id: z.string(),
  require_mention: z.boolean().default(true),
  allow_from: z.array(z.string()).default([]),
})

const BotSchema = z.object({
  name: z.string().min(1).max(32),
  token_env: z.string(),
  role: z.string(),  // references a key in roles
  personality: PersonalitySchema,
  channels: z.array(ChannelEntrySchema).min(1),
  dm_policy: z.enum(['pairing', 'allowlist', 'disabled']).default('disabled'),
  allow_from: z.array(z.string()).default([]),
  workspace: z.string().optional(),
  model: z.string().optional(),
  plugins: z.array(z.string()).optional(),
})

// --- Human schema ---

const HumanSchema = z.object({
  name: z.string(),
  discord_id: z.string(),
  role: z.string().default('owner'),
})

// --- Defaults schema ---

const DefaultsSchema = z.object({
  workspace: z.string().optional(),
  model: z.string().default('opus'),
  interbot: z.boolean().default(true),
})

// --- Top-level team config ---

const DiscordSchema = z.object({
  guild_id: z.string(),
  channels: z.record(z.string()).optional(),
})

export const TeamConfigSchema = z.object({
  version: z.literal(1),
  name: z.string(),
  discord: DiscordSchema,
  defaults: DefaultsSchema.default({}),
  protocol: ProtocolSchema.default({}),
  roles: z.record(RoleSchema).default({}),
  bots: z.record(BotSchema),
  humans: z.record(HumanSchema).default({}),
  allowed_users: z.array(z.string()).default([]), // Discord user IDs. Empty = allow all.
})

// --- Inferred types ---

export type TeamConfig = z.infer<typeof TeamConfigSchema>
export type BotConfig = z.infer<typeof BotSchema>
export type RoleConfig = z.infer<typeof RoleSchema>
export type Protocol = z.infer<typeof ProtocolSchema>
export type Personality = z.infer<typeof PersonalitySchema>
export type ChannelEntry = z.infer<typeof ChannelEntrySchema>
export type HumanConfig = z.infer<typeof HumanSchema>

// --- Template schema (subset of TeamConfig, no tokens required) ---

const TemplateBotSchema = z.object({
  name_suggestion: z.string(),
  role: z.string(),
  personality: PersonalitySchema.partial().extend({
    tagline: z.string(),
  }),
})

export const TemplateSchema = z.object({
  description: z.string(),
  protocol: ProtocolSchema.default({}),
  roles: z.record(RoleSchema).default({}),
  bots: z.record(TemplateBotSchema),
})

export type Template = z.infer<typeof TemplateSchema>
