import { z } from 'zod'

// --- Individual role file schema ---
// Each role is a single YAML file in ~/.disclaw-team/roles/

const PersonalitySchema = z.object({
  tagline: z.string(),
  tone: z.string().default('Professional'),
  instructions: z.string().default(''),
  domain: z.array(z.string()).default([]),
})

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

const ModelConfigSchema = z.object({
  model: z.enum(['opus', 'sonnet', 'haiku']).default('sonnet'),
  reasoning: z.enum(['low', 'medium', 'high', 'max']).default('medium'),
})

export const RoleFileSchema = z.object({
  name: z.string(),
  type: z.enum(['orchestrator', 'specialist', 'executor', 'generalist']),
  description: z.string(),
  leadership_style: z.string().optional(),
  responsibilities: z.array(z.string()).default([]),
  engagement: EngagementSchema.default({}),
  delegation: DelegationSchema.default({}),
  execution: ExecutionSchema.default({}),
  presentation: PresentationSchema.default({}),
  personality: PersonalitySchema,
  model_config: ModelConfigSchema.default({}),
})

export type RoleFile = z.infer<typeof RoleFileSchema>

// --- Bots config schema ---
// ~/.disclaw-team/bots.yaml

const BotEntrySchema = z.object({
  token_env: z.string(),
  discord_user_id: z.string().optional(), // discovered on first login
})

export const BotsConfigSchema = z.object({
  bots: z.record(BotEntrySchema),
})

export type BotsConfig = z.infer<typeof BotsConfigSchema>
export type BotEntry = z.infer<typeof BotEntrySchema>

// --- Assignment config schema ---
// ~/.disclaw-team/assignment.yaml

const HumanEntrySchema = z.object({
  name: z.string(),
  discord_id: z.string(),
  role: z.string().default('owner'),
})

const ProtocolOverrideSchema = z.object({
  communication: z.object({
    selective_replies: z.boolean().optional(),
    acknowledge_teammates: z.boolean().optional(),
    react_before_responding: z.boolean().optional(),
    default_reaction: z.string().optional(),
    completion_reaction: z.string().optional(),
  }).optional(),
  validation: z.object({
    require_validation: z.boolean().optional(),
    never_skip_for: z.array(z.string()).optional(),
  }).optional(),
  escalation: z.object({
    human_approval_required: z.array(z.string()).optional(),
  }).optional(),
})

export const AssignmentConfigSchema = z.object({
  discord: z.object({
    guild_id: z.string(),
    channel_id: z.string(),
  }),
  workspace: z.string().optional(),
  model: z.string().default('opus'),
  assignments: z.record(z.string()), // bot-id → role-filename (without .yaml)
  humans: z.record(HumanEntrySchema).default({}),
  allowed_users: z.array(z.string()).default([]), // Discord user IDs that can interact with bots. Empty = allow all.
  overrides: z.object({
    protocol: ProtocolOverrideSchema.optional(),
  }).default({}),
})

export type AssignmentConfig = z.infer<typeof AssignmentConfigSchema>
