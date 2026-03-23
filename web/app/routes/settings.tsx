import { Form, redirect, useLoaderData } from "react-router";
import type { Route } from "./+types/settings";
import { PageHeader, SubmitButton, cardClass, inputClass, labelClass, Section } from "../components/ui";

export function meta() {
  return [{ title: "disclaw-team — Settings" }];
}

export async function loader() {
  const { join } = await import("path");
  const { homedir } = await import("os");
  const { existsSync, readFileSync } = await import("fs");
  const { parse: parseYaml } = await import("yaml");
  const { getTeamStatus } = await import("../lib/status.server");

  const status = getTeamStatus();
  const ASSIGNMENT_FILE = join(homedir(), ".disclaw-team", "assignment.yaml");
  let workspace = "";
  let model = "opus";
  let channelId = "";
  let allowedUsers: string[] = [];
  if (existsSync(ASSIGNMENT_FILE)) {
    const raw = parseYaml(readFileSync(ASSIGNMENT_FILE, "utf-8"));
    workspace = raw.workspace || "";
    model = raw.model || "opus";
    channelId = raw.discord?.channel_id || "";
    allowedUsers = raw.allowed_users || [];
  }
  return {
    teamName: status.teamName,
    guildId: status.guildId,
    channelId,
    configured: status.configured,
    workspace,
    model,
    allowedUsers,
    botCount: status.bots.length,
    roleCount: status.availableRoles.length,
    profileCount: status.profiles.length,
  };
}

export async function action({ request }: { request: Request }) {
  const form = await request.formData();
  const intent = form.get("intent") as string;

  if (intent === "update-assignment") {
    const { join } = await import("path");
    const { homedir } = await import("os");
    const { existsSync, readFileSync, writeFileSync } = await import("fs");
    const { parse: parseYaml, stringify: toYaml } = await import("yaml");

    const ASSIGNMENT_FILE = join(homedir(), ".disclaw-team", "assignment.yaml");
    if (existsSync(ASSIGNMENT_FILE)) {
      const raw = parseYaml(readFileSync(ASSIGNMENT_FILE, "utf-8"));
      const workspace = form.get("workspace") as string;
      const model = form.get("model") as string;
      const guildId = form.get("guildId") as string;
      const channelId = form.get("channelId") as string;
      if (workspace) raw.workspace = workspace;
      if (model) raw.model = model;
      if (guildId) {
        raw.discord = raw.discord || {};
        raw.discord.guild_id = guildId;
      }
      if (channelId) {
        raw.discord = raw.discord || {};
        raw.discord.channel_id = channelId;
      }
      writeFileSync(ASSIGNMENT_FILE, toYaml(raw, { lineWidth: 0 }));
    }
  }

  if (intent === "update-allowed-users") {
    const { join } = await import("path");
    const { homedir } = await import("os");
    const { existsSync, readFileSync, writeFileSync } = await import("fs");
    const { parse: parseYaml, stringify: toYaml } = await import("yaml");

    const ASSIGNMENT_FILE = join(homedir(), ".disclaw-team", "assignment.yaml");
    if (existsSync(ASSIGNMENT_FILE)) {
      const raw = parseYaml(readFileSync(ASSIGNMENT_FILE, "utf-8"));
      const usersStr = form.get("allowedUsers") as string;
      raw.allowed_users = usersStr
        .split("\n")
        .map((s: string) => s.trim())
        .filter(Boolean);
      writeFileSync(ASSIGNMENT_FILE, toYaml(raw, { lineWidth: 0 }));
    }
  }

  if (intent === "reset") {
    const { join } = await import("path");
    const { homedir } = await import("os");
    // Dangerous — deletes all config
    const { execSync } = await import("child_process");
    try { execSync("tmux kill-session -t disclaw-team 2>/dev/null", { stdio: "pipe" }); } catch {}
    const BASE = join(homedir(), ".disclaw-team");
    const { rmSync } = await import("fs");
    rmSync(BASE, { recursive: true, force: true });
    return redirect("/onboarding");
  }

  return redirect("/settings");
}

export default function Settings({ loaderData }: Route.ComponentProps) {
  const { configured, guildId, channelId, workspace, model, allowedUsers, botCount, roleCount } = loaderData;

  if (!configured) {
    return (
      <div>
        <PageHeader title="Settings" subtitle="No team configured yet." />
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <PageHeader title="Settings" />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className={`${cardClass} p-4 text-center`}>
          <div className="text-2xl font-bold text-[var(--color-accent)]">{botCount}</div>
          <div className="text-xs text-[var(--color-text-secondary)] mt-0.5">Bots</div>
        </div>
        <div className={`${cardClass} p-4 text-center`}>
          <div className="text-2xl font-bold text-emerald-400">{roleCount}</div>
          <div className="text-xs text-[var(--color-text-secondary)] mt-0.5">Roles</div>
        </div>
      </div>

      {/* Editable settings */}
      <Section title="General">
        <Form method="post">
          <input type="hidden" name="intent" value="update-assignment" />
          <div className={`${cardClass} p-4`}>
            <div className="space-y-3">
              <div>
                <label className={labelClass}>Discord Server ID</label>
                <input className={`${inputClass} font-mono`} name="guildId" defaultValue={guildId} placeholder="Right-click server → Copy Server ID" />
              </div>
              <div>
                <label className={labelClass}>General Channel ID</label>
                <input className={`${inputClass} font-mono`} name="channelId" defaultValue={channelId} placeholder="Right-click channel → Copy Channel ID" />
              </div>
              <div>
                <label className={labelClass}>Workspace Directory</label>
                <input className={inputClass} name="workspace" defaultValue={workspace} />
              </div>
              <div>
                <label className={labelClass}>Default Model</label>
                <select name="model" defaultValue={model} className={inputClass}>
                  <option value="opus">Opus — most capable</option>
                  <option value="sonnet">Sonnet — balanced</option>
                  <option value="haiku">Haiku — fastest</option>
                </select>
              </div>
            </div>
          </div>
          <div className="mt-4">
            <SubmitButton>Save</SubmitButton>
          </div>
        </Form>
      </Section>

      {/* Allowed Users */}
      <Section title="Allowed Users">
        <Form method="post">
          <input type="hidden" name="intent" value="update-allowed-users" />
          <div className={`${cardClass} p-4`}>
            <p className="text-xs text-[var(--color-text-secondary)] mb-3">
              Only these Discord users can interact with your bots. Leave empty to allow everyone (not recommended for public servers).
              One Discord user ID per line. Right-click a user in Discord → Copy ID.
            </p>
            <textarea
              name="allowedUsers"
              defaultValue={allowedUsers.join("\n")}
              rows={4}
              className={`${inputClass} font-mono text-xs`}
              placeholder={"201897892368220161\n309128475610293842"}
            />
            <p className="text-xs text-[var(--color-warning)] mt-2">
              ⚠ Bots always see each other regardless of this list. Requires restart to take effect.
            </p>
          </div>
          <div className="mt-4">
            <SubmitButton>Save</SubmitButton>
          </div>
        </Form>
      </Section>

      {/* Config info */}
      <Section title="Config Location">
        <div className={`${cardClass} p-4`}>
          <div className="space-y-1 text-xs font-mono text-[var(--color-text-secondary)]">
            <p>~/.disclaw-team/bots.yaml</p>
            <p>~/.disclaw-team/assignment.yaml</p>
            <p>~/.disclaw-team/roles/</p>
            <p>~/.disclaw-team/.env</p>
            <p className="text-[var(--color-success)] mt-2">✓ Role-based config</p>
          </div>
        </div>
      </Section>

      {/* Danger zone */}
      <div className="border border-[var(--color-danger)]/30 rounded-lg p-4">
        <h3 className="text-sm font-medium text-[var(--color-danger)] mb-2">Danger Zone</h3>
        <p className="text-xs text-[var(--color-text-secondary)] mb-3">
          Reset all configuration. This stops all bots and deletes ~/.disclaw-team/.
        </p>
        <Form method="post">
          <input type="hidden" name="intent" value="reset" />
          <button
            type="submit"
            onClick={(e) => { if (!confirm("This will delete ALL configuration, bots, roles, and profiles. Are you sure?")) e.preventDefault(); }}
            className="px-4 py-2 text-sm bg-[var(--color-danger)]/15 text-[var(--color-danger)] rounded-lg hover:bg-[var(--color-danger)]/25 transition-colors"
          >
            Reset Everything
          </button>
        </Form>
      </div>
    </div>
  );
}
