import { useState } from "react";
import { Form, redirect } from "react-router";
import type { Route } from "./+types/onboarding";
import { SubmitButton, inputClass, cardClass } from "../components/ui";

interface RoleInfo {
  id: string;
  name: string;
  type: string;
  tagline: string;
}

export function meta() {
  return [{ title: "disclaw-team — Setup" }];
}

export async function loader() {
  const { getTeamStatus } = await import("../lib/status.server.js");
  const status = getTeamStatus();
  if (status.configured) return redirect("/");

  let roles = status.availableRoles;
  if (roles.length === 0) {
    try {
      // Install roles directly since the role-loader's path resolution
      // may not work from the web server context
      const { join } = await import("path");
      const { homedir } = await import("os");
      const { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } = await import("fs");
      const { parse: parseYaml, stringify: toYaml } = await import("yaml");

      const rolesDir = join(homedir(), ".disclaw-team", "roles");
      mkdirSync(rolesDir, { recursive: true });

      // Find the source roles directory (DISCLAW_ROOT set by CLI)
      const root = process.env.DISCLAW_ROOT || process.cwd();
      const candidates = [
        join(root, "dist", "roles"),
        join(root, "src", "roles"),
        join(process.cwd(), "src", "roles"),
        join(process.cwd(), "..", "src", "roles"),
      ];
      const srcDir = candidates.find(p => existsSync(p));

      if (srcDir) {
        for (const file of readdirSync(srcDir)) {
          if (!file.endsWith(".yaml")) continue;
          const raw = readFileSync(join(srcDir, file), "utf-8");
          const parsed = parseYaml(raw) as Record<string, any>;
          const type = file.replace(".yaml", "").replace(/s$/, "");

          for (const [roleId, roleData] of Object.entries(parsed)) {
            if (typeof roleData !== "object" || !roleData) continue;
            const destPath = join(rolesDir, `${roleId}.yaml`);
            if (existsSync(destPath)) continue;

            const roleFile = {
              name: roleData.name_suggestion || roleId,
              type,
              description: roleData.description || "",
              ...(roleData.leadership_style ? { leadership_style: roleData.leadership_style } : {}),
              responsibilities: roleData.responsibilities || [],
              engagement: roleData.engagement || {},
              delegation: roleData.delegation || {},
              execution: roleData.execution || {},
              presentation: roleData.presentation || {},
              personality: roleData.personality || { tagline: roleData.description || "" },
              model_config: { model: "sonnet", reasoning: "medium" },
            };
            writeFileSync(destPath, toYaml(roleFile, { lineWidth: 0 }));
          }
        }
        roles = getTeamStatus().availableRoles;
      }
    } catch (err) {
      console.error("Failed to install roles:", err);
    }
  }

  return { availableRoles: roles };
}

export async function action({ request }: { request: Request }) {
  const form = await request.formData();
  const step = form.get("step") as string;

  if (step === "complete") {
    const { join } = await import("path");
    const { homedir } = await import("os");
    const { mkdirSync, writeFileSync } = await import("fs");
    const { stringify: toYaml } = await import("yaml");

    const BASE = join(homedir(), ".disclaw-team");
    mkdirSync(BASE, { recursive: true });

    const guildId = form.get("guildId") as string;
    const channelId = form.get("channelId") as string;
    const workspace = form.get("workspace") as string;
    const humanName = form.get("humanName") as string;
    const humanDiscordId = form.get("humanDiscordId") as string;

    const botCount = parseInt(form.get("botCount") as string, 10);
    const bots: Record<string, { token_env: string }> = {};
    const tokens: Record<string, string> = {};
    const assignments: Record<string, string> = {};

    for (let i = 0; i < botCount; i++) {
      const botId = form.get(`bot_${i}_id`) as string;
      const botToken = form.get(`bot_${i}_token`) as string;
      const botRole = form.get(`bot_${i}_role`) as string;
      if (!botId || !botToken) continue;

      const tokenEnv = `${botId.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}_TOKEN`;
      bots[botId] = { token_env: tokenEnv };
      tokens[tokenEnv] = botToken;
      if (botRole) assignments[botId] = botRole;
    }

    try {
      const root = process.env.DISCLAW_ROOT || join(process.cwd(), "..");
      const { existsSync: exists } = await import("fs");
      const loaderCandidates = [
        join(root, "dist", "config", "role-loader.js"),
        join(root, "src", "config", "role-loader.ts"),
      ];
      const loaderPath = loaderCandidates.find(p => exists(p));
      if (loaderPath) {
        const { installPreloadedRoles } = await import(loaderPath);
        installPreloadedRoles();
      }
    } catch {}

    writeFileSync(join(BASE, "bots.yaml"), toYaml({ bots }, { lineWidth: 0 }));

    const envLines = Object.entries(tokens).map(([k, v]) => `${k}=${v}`).join("\n");
    writeFileSync(join(BASE, ".env"), envLines + "\n", { mode: 0o600 });

    const assignment = {
      discord: { guild_id: guildId, channel_id: channelId },
      workspace: workspace || process.cwd(),
      model: "opus",
      assignments,
      humans: humanDiscordId
        ? { [humanName.toLowerCase().replace(/[^a-z0-9]+/g, "-")]: { name: humanName, discord_id: humanDiscordId, role: "owner" } }
        : {},
      allowed_users: humanDiscordId ? [humanDiscordId] : [],
      overrides: {},
    };
    writeFileSync(join(BASE, "assignment.yaml"), toYaml(assignment, { lineWidth: 0 }));

    return redirect("/");
  }

  return null;
}

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className="flex items-center gap-2">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              i < current
                ? "bg-[var(--color-accent)] text-white"
                : i === current
                ? "bg-[var(--color-accent)]/20 text-[var(--color-accent)] border-2 border-[var(--color-accent)]"
                : "bg-[var(--color-surface)] text-[var(--color-text-secondary)] border border-[var(--color-border)]"
            }`}
          >
            {i < current ? "✓" : i + 1}
          </div>
          {i < total - 1 && (
            <div className={`w-8 h-0.5 ${i < current ? "bg-[var(--color-accent)]" : "bg-[var(--color-border)]"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

export default function Onboarding({ loaderData }: Route.ComponentProps) {
  const { availableRoles } = loaderData;
  const [step, setStep] = useState(0);
  const [guildId, setGuildId] = useState("");
  const [channelId, setChannelId] = useState("");
  const [workspace, setWorkspace] = useState("");
  const [humanName, setHumanName] = useState("");
  const [humanDiscordId, setHumanDiscordId] = useState("");
  const [bots, setBots] = useState<Array<{ id: string; token: string; role: string }>>([
    { id: "bot-1", token: "", role: "" },
    { id: "bot-2", token: "", role: "" },
    { id: "bot-3", token: "", role: "" },
  ]);

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-2xl font-semibold mb-2">Welcome to disclaw-team</h2>
      <p className="text-[var(--color-text-secondary)] mb-6">Let's set up your AI team.</p>

      <StepIndicator current={step} total={4} />

      {step === 0 && (
        <div>
          <h3 className="text-lg font-medium mb-4">Discord Server</h3>
          <div className={`${cardClass} p-3 mb-4 border-[var(--color-accent)]/30`}>
            <p className="text-xs text-[var(--color-text-secondary)]">
              <strong className="text-[var(--color-accent)]">Tip:</strong> Enable Developer Mode in Discord to copy IDs.
              Open <strong>User Settings → App Settings → Advanced → Developer Mode</strong>. Then right-click any server, channel, or user and select <strong>Copy ID</strong>.
            </p>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-[var(--color-text-secondary)] mb-1">Discord Server ID</label>
              <input className={inputClass} value={guildId} onChange={(e) => setGuildId(e.target.value)} placeholder="Right-click server → Copy Server ID" />
            </div>
            <div>
              <label className="block text-sm text-[var(--color-text-secondary)] mb-1">General Channel ID</label>
              <input className={inputClass} value={channelId} onChange={(e) => setChannelId(e.target.value)} placeholder="Right-click channel → Copy Channel ID" />
            </div>
            <div>
              <label className="block text-sm text-[var(--color-text-secondary)] mb-1">Workspace Directory</label>
              <input className={inputClass} value={workspace} onChange={(e) => setWorkspace(e.target.value)} placeholder="Where bots will work (default: current directory)" />
            </div>
          </div>
          <button
            onClick={() => setStep(1)}
            disabled={!guildId || !channelId}
            className="mt-6 px-6 py-2 bg-[var(--color-accent)] text-white rounded-lg hover:bg-[var(--color-accent-hover)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}

      {step === 1 && (
        <div>
          <h3 className="text-lg font-medium mb-2">Create Bots</h3>
          <p className="text-sm text-[var(--color-text-secondary)] mb-4">
            Create bot applications in the Discord Developer Portal. Enable Message Content Intent for each.
          </p>
          <div className="space-y-4">
            {bots.map((bot, i) => (
              <div key={i} className={`${cardClass} p-4`}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium">Bot {i + 1}</span>
                  {bots.length > 1 && (
                    <button onClick={() => setBots(bots.filter((_, j) => j !== i))} className="text-xs text-[var(--color-danger)]">Remove</button>
                  )}
                </div>
                <div className="space-y-2">
                  <input className={inputClass} value={bot.id} onChange={(e) => { const b = [...bots]; b[i].id = e.target.value; setBots(b); }} placeholder="Bot ID (e.g. bot-1)" />
                  <input className={inputClass} type="password" value={bot.token} onChange={(e) => { const b = [...bots]; b[i].token = e.target.value; setBots(b); }} placeholder="Discord bot token" />
                </div>
              </div>
            ))}
          </div>
          <button onClick={() => setBots([...bots, { id: `bot-${bots.length + 1}`, token: "", role: "" }])} className="mt-3 px-4 py-2 text-sm border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-surface-hover)] transition-colors">
            + Add Bot
          </button>
          <div className="flex gap-2 mt-6">
            <button onClick={() => setStep(0)} className="px-6 py-2 text-sm border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-surface-hover)]">Back</button>
            <button onClick={() => setStep(2)} disabled={!bots.some(b => b.id && b.token)} className="px-6 py-2 bg-[var(--color-accent)] text-white rounded-lg hover:bg-[var(--color-accent-hover)] disabled:opacity-30 disabled:cursor-not-allowed">Next</button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div>
          <h3 className="text-lg font-medium mb-2">Assign Roles</h3>
          <p className="text-sm text-[var(--color-text-secondary)] mb-4">Pick a role for each bot. You can change these anytime.</p>
          <div className="space-y-3">
            {bots.filter(b => b.id && b.token).map((bot, i) => (
              <div key={i} className={`${cardClass} p-4`}>
                <div className="flex items-center justify-between">
                  <span className="font-medium">{bot.id}</span>
                  <select value={bot.role} onChange={(e) => { const b = [...bots]; const idx = bots.indexOf(bot); b[idx].role = e.target.value; setBots(b); }} className={`${inputClass} max-w-xs`}>
                    <option value="">Select a role...</option>
                    {['orchestrator', 'specialist', 'executor'].map(type => (
                      <optgroup key={type} label={type.charAt(0).toUpperCase() + type.slice(1) + 's'}>
                        {(availableRoles as RoleInfo[]).filter(r => r.type === type).map(r => (
                          <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-6">
            <button onClick={() => setStep(1)} className="px-6 py-2 text-sm border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-surface-hover)]">Back</button>
            <button onClick={() => setStep(3)} disabled={!bots.filter(b => b.id && b.token).every(b => b.role)} className="px-6 py-2 bg-[var(--color-accent)] text-white rounded-lg hover:bg-[var(--color-accent-hover)] disabled:opacity-30 disabled:cursor-not-allowed">Next</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div>
          <h3 className="text-lg font-medium mb-4">Your Details</h3>
          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-sm text-[var(--color-text-secondary)] mb-1">Your Name</label>
              <input className={inputClass} value={humanName} onChange={(e) => setHumanName(e.target.value)} placeholder="Name" />
            </div>
            <div>
              <label className="block text-sm text-[var(--color-text-secondary)] mb-1">Your Discord User ID (optional)</label>
              <input className={inputClass} value={humanDiscordId} onChange={(e) => setHumanDiscordId(e.target.value)} placeholder="For permission requests and mentions" />
            </div>
          </div>

          <h3 className="text-lg font-medium mb-3">Summary</h3>
          <div className={`${cardClass} p-4 mb-6`}>
            <p className="text-sm mb-2"><span className="text-[var(--color-text-secondary)]">Server:</span> {guildId}</p>
            <p className="text-sm mb-3"><span className="text-[var(--color-text-secondary)]">Channel:</span> {channelId}</p>
            {bots.filter(b => b.id && b.token).map((bot, i) => {
              const role = (availableRoles as RoleInfo[]).find(r => r.id === bot.role);
              return (
                <p key={i} className="text-sm">
                  <span className="font-medium">{bot.id}</span>
                  <span className="text-[var(--color-text-secondary)]"> → </span>
                  <span className="text-[var(--color-accent)]">{role?.name || bot.role}</span>
                </p>
              );
            })}
          </div>

          <Form method="post">
            <input type="hidden" name="step" value="complete" />
            <input type="hidden" name="guildId" value={guildId} />
            <input type="hidden" name="channelId" value={channelId} />
            <input type="hidden" name="workspace" value={workspace} />
            <input type="hidden" name="humanName" value={humanName} />
            <input type="hidden" name="humanDiscordId" value={humanDiscordId} />
            <input type="hidden" name="botCount" value={bots.filter(b => b.id && b.token).length} />
            {bots.filter(b => b.id && b.token).map((bot, i) => (
              <div key={i}>
                <input type="hidden" name={`bot_${i}_id`} value={bot.id} />
                <input type="hidden" name={`bot_${i}_token`} value={bot.token} />
                <input type="hidden" name={`bot_${i}_role`} value={bot.role} />
              </div>
            ))}
            <div className="flex gap-2">
              <button type="button" onClick={() => setStep(2)} className="px-6 py-2 text-sm border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-surface-hover)]">Back</button>
              <SubmitButton variant="success">Create Team</SubmitButton>
            </div>
          </Form>
        </div>
      )}
    </div>
  );
}
