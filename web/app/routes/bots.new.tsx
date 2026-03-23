import { Form, redirect } from "react-router";
import type { Route } from "./+types/bots.new";
import { PageHeader, SubmitButton, cardClass, inputClass, labelClass } from "../components/ui";

interface RoleInfo {
  id: string;
  name: string;
  type: string;
  tagline: string;
}

export function meta() {
  return [{ title: "disclaw-team — Add Bot" }];
}

export async function loader() {
  const { getTeamStatus } = await import("../lib/status.server");
  return { availableRoles: getTeamStatus().availableRoles };
}

export async function action({ request }: { request: Request }) {
  const { join } = await import("path");
  const { homedir } = await import("os");
  const { existsSync, readFileSync, writeFileSync, appendFileSync, chmodSync } = await import("fs");
  const { parse: parseYaml, stringify: toYaml } = await import("yaml");

  const BASE = join(homedir(), ".disclaw-team");
  const form = await request.formData();
  const botId = (form.get("botId") as string || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const token = form.get("token") as string;
  const roleId = form.get("roleId") as string;

  if (!botId || !token) return null;

  const tokenEnv = `${botId.toUpperCase().replace(/-/g, "_")}_TOKEN`;

  // Add to bots.yaml
  const botsPath = join(BASE, "bots.yaml");
  if (existsSync(botsPath)) {
    const raw = parseYaml(readFileSync(botsPath, "utf-8")) || {};
    if (!raw.bots) raw.bots = {};
    raw.bots[botId] = { token_env: tokenEnv };
    writeFileSync(botsPath, toYaml(raw, { lineWidth: 0 }));
  }

  // Add token to .env (appendFileSync doesn't support mode, so ensure permissions after)
  const envPath = join(BASE, ".env");
  appendFileSync(envPath, `${tokenEnv}=${token}\n`);
  try { chmodSync(envPath, 0o600); } catch {}

  // Add to assignment.yaml (even if unassigned — empty string)
  const assignPath = join(BASE, "assignment.yaml");
  if (existsSync(assignPath)) {
    const raw = parseYaml(readFileSync(assignPath, "utf-8"));
    raw.assignments = raw.assignments || {};
    raw.assignments[botId] = roleId || "";
    writeFileSync(assignPath, toYaml(raw, { lineWidth: 0 }));
  }

  // Regenerate all bots' state (new team member affects everyone's roster)
  const { regenerateAllState } = await import("../lib/regenerate.server");
  await regenerateAllState();

  return redirect("/");
}

export default function AddBot({ loaderData }: Route.ComponentProps) {
  const { availableRoles } = loaderData;

  return (
    <div className="max-w-lg">
      <PageHeader
        title="Add Bot"
        subtitle="Create a new bot application in the Discord Developer Portal, then add it here."
        backTo="/"
        backLabel="Dashboard"
      />

      <Form method="post">
        <div className={`${cardClass} p-4 space-y-3`}>
          <div>
            <label className={labelClass}>Bot ID</label>
            <input className={inputClass} name="botId" placeholder="my-bot" required />
          </div>
          <div>
            <label className={labelClass}>Discord Bot Token</label>
            <input className={inputClass} name="token" type="password" placeholder="Paste from Developer Portal" required />
          </div>
          <div>
            <label className={labelClass}>Role</label>
            <select name="roleId" className={inputClass}>
              <option value="">Unassigned</option>
              {['orchestrator', 'specialist', 'executor'].map(type => (
                <optgroup key={type} label={type.charAt(0).toUpperCase() + type.slice(1) + 's'}>
                  {availableRoles.filter((r: RoleInfo) => r.type === type).map((r: RoleInfo) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <SubmitButton>Add Bot</SubmitButton>
          <a href="/" className="px-5 py-2 border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-surface-hover)] text-sm flex items-center transition-colors">Cancel</a>
        </div>
      </Form>
    </div>
  );
}
