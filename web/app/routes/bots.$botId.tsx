import { Form, redirect, useLoaderData } from "react-router";
import type { Route } from "./+types/bots.$botId";
import { PageHeader, StatusBadge, RoleBadge, SubmitButton, cardClass, inputClass } from "../components/ui";

interface RoleInfo {
  id: string;
  name: string;
  type: string;
  tagline: string;
}

export function meta({ params }: Route.MetaArgs) {
  return [{ title: `disclaw-team — Bot: ${params.botId}` }];
}

export async function loader({ params }: Route.LoaderArgs) {
  const { join } = await import("path");
  const { homedir } = await import("os");
  const { existsSync, readFileSync } = await import("fs");
  const { getTeamStatus } = await import("../lib/status.server");

  const BASE = join(homedir(), ".disclaw-team");
  const { botId } = params;
  const status = getTeamStatus();
  const bot = status.bots.find(b => b.id === botId);
  if (!bot) throw new Response("Bot not found", { status: 404 });

  // Load generated CLAUDE.md preview
  let claudeMd = "";
  const claudeMdPath = join(BASE, "bots", botId!, "system-prompt.txt");
  if (existsSync(claudeMdPath)) {
    claudeMd = readFileSync(claudeMdPath, "utf-8");
  }

  // Load registry info
  interface DiscordRegistryEntry {
    discordUsername: string;
    discordUserId: string;
  }
  let discordInfo: DiscordRegistryEntry | null = null;
  const regPath = join(BASE, "registry", `${botId}.json`);
  if (existsSync(regPath)) {
    discordInfo = JSON.parse(readFileSync(regPath, "utf-8")) as DiscordRegistryEntry;
  }

  return { bot, claudeMd, discordInfo, availableRoles: status.availableRoles };
}

export async function action({ request, params }: Route.ActionArgs) {
  const { join } = await import("path");
  const { homedir } = await import("os");
  const { existsSync, readFileSync, writeFileSync } = await import("fs");
  const { parse: parseYaml, stringify: toYaml } = await import("yaml");
  const { cliStop, cliStart } = await import("../lib/cli.server");
  const { regenerateAllState } = await import("../lib/regenerate.server");

  const BASE = join(homedir(), ".disclaw-team");
  const { botId } = params;
  const form = await request.formData();
  const intent = form.get("intent") as string;

  if (intent === "assign") {
    const roleId = form.get("roleId") as string;
    const assignPath = join(BASE, "assignment.yaml");
    if (existsSync(assignPath)) {
      const raw = parseYaml(readFileSync(assignPath, "utf-8"));
      raw.assignments = raw.assignments || {};
      raw.assignments[botId!] = roleId;
      writeFileSync(assignPath, toYaml(raw, { lineWidth: 0 }));
      await regenerateAllState();
      try { cliStop(botId); } catch {}
      try { cliStart(botId); } catch {}
    }
  }

  if (intent === "start") { try { cliStart(botId); } catch {} }
  if (intent === "stop") { try { cliStop(botId); } catch {} }
  if (intent === "restart") {
    try { cliStop(botId); } catch {}
    try { cliStart(botId); } catch {}
  }

  if (intent === "remove") {
    // Remove bot from bots.yaml and assignment.yaml
    const botsPath = join(BASE, "bots.yaml");
    const assignPath = join(BASE, "assignment.yaml");

    if (existsSync(botsPath)) {
      const raw = parseYaml(readFileSync(botsPath, "utf-8"));
      delete raw.bots[botId!];
      writeFileSync(botsPath, toYaml(raw, { lineWidth: 0 }));
    }
    if (existsSync(assignPath)) {
      const raw = parseYaml(readFileSync(assignPath, "utf-8"));
      delete raw.assignments[botId!];
      writeFileSync(assignPath, toYaml(raw, { lineWidth: 0 }));
    }

    try { cliStop(botId); } catch {}
    await regenerateAllState();
    return redirect("/");
  }

  return redirect(`/bots/${botId}`);
}

export default function BotDetail({ loaderData }: Route.ComponentProps) {
  const { bot, claudeMd, discordInfo, availableRoles } = loaderData;

  return (
    <div className="max-w-4xl">
      <PageHeader
        title={bot.name}
        backTo="/"
        backLabel="Dashboard"
        action={<StatusBadge active={bot.isRunning} label={bot.isRunning ? "Running" : "Stopped"} />}
      />

      <div className="flex items-center gap-2 -mt-4 mb-6">
        <RoleBadge role={bot.role} />
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {/* Controls */}
        <div className={`${cardClass} p-4`}>
          <h3 className="text-sm font-medium mb-3">Controls</h3>
          <div className="flex flex-wrap gap-2">
            {bot.isRunning ? (
              <>
                <Form method="post"><input type="hidden" name="intent" value="stop" />
                  <SubmitButton variant="danger" className="!px-3 !py-1.5 !text-xs">Stop</SubmitButton>
                </Form>
                <Form method="post"><input type="hidden" name="intent" value="restart" />
                  <button type="submit" className="px-3 py-1.5 text-xs bg-[var(--color-warning)]/15 text-[var(--color-warning)] rounded-lg hover:bg-[var(--color-warning)]/25 transition-colors">Restart</button>
                </Form>
              </>
            ) : (
              <Form method="post"><input type="hidden" name="intent" value="start" />
                <SubmitButton variant="success" className="!px-3 !py-1.5 !text-xs">Start</SubmitButton>
              </Form>
            )}
          </div>
        </div>

        {/* Status */}
        <div className={`${cardClass} p-4`}>
          <h3 className="text-sm font-medium mb-3">Status</h3>
          <div className="space-y-1.5 text-xs">
            <p className="flex items-center gap-2">
              <StatusBadge active={bot.hasToken} />
              <span>Token configured</span>
            </p>
            <p className="flex items-center gap-2">
              <StatusBadge active={bot.hasState} />
              <span>Bot config ready</span>
            </p>
            <p className="flex items-center gap-2">
              <StatusBadge active={bot.hasRegistry} />
              <span>Discord connected</span>
            </p>
          </div>
        </div>

        {/* Discord Info */}
        <div className={`${cardClass} p-4`}>
          <h3 className="text-sm font-medium mb-3">Discord</h3>
          {discordInfo ? (
            <div className="space-y-1 text-xs">
              <p className="text-[var(--color-text-secondary)]">Username: <span className="text-[var(--color-text-primary)]">{discordInfo.discordUsername}</span></p>
              <p className="text-[var(--color-text-secondary)]">ID: <span className="font-mono">{discordInfo.discordUserId}</span></p>
            </div>
          ) : (
            <p className="text-xs text-[var(--color-text-secondary)]">Not connected yet</p>
          )}
        </div>
      </div>

      {/* Role Assignment */}
      <div className={`${cardClass} p-4 mb-4`}>
        <h3 className="text-sm font-medium mb-3">Current Role: {bot.roleId || bot.name}</h3>
        <p className="text-sm text-[var(--color-text-secondary)] mb-3">{bot.tagline}</p>
        <Form method="post" className="flex gap-2">
          <input type="hidden" name="intent" value="assign" />
          <select name="roleId" defaultValue={bot.roleId || ""} className={`${inputClass} flex-1`}>
            <option value="">Select a role...</option>
            {['orchestrator', 'specialist', 'executor'].map(type => (
              <optgroup key={type} label={type.charAt(0).toUpperCase() + type.slice(1) + 's'}>
                {availableRoles.filter((r: RoleInfo) => r.type === type).map((r: RoleInfo) => (
                  <option key={r.id} value={r.id}>{r.name} — {r.tagline}</option>
                ))}
              </optgroup>
            ))}
          </select>
          <SubmitButton>Change Role</SubmitButton>
        </Form>
      </div>

      {/* CLAUDE.md Preview */}
      {claudeMd && (
        <div className={`${cardClass} p-4 mb-4`}>
          <h3 className="text-sm font-medium mb-3">Generated Personality (CLAUDE.md)</h3>
          <div className="bg-[var(--color-surface)] rounded-lg p-4 max-h-80 overflow-y-auto scroll-smooth border border-[var(--color-border)]/50">
            <pre className="text-xs font-mono whitespace-pre-wrap text-[var(--color-text-secondary)] leading-relaxed">{claudeMd}</pre>
          </div>
        </div>
      )}

      {/* Remove Bot */}
      <div className="border border-[var(--color-danger)]/30 rounded-lg p-4">
        <h3 className="text-sm font-medium text-[var(--color-danger)] mb-2">Remove Bot</h3>
        <p className="text-xs text-[var(--color-text-secondary)] mb-3">Remove this bot from the team.</p>
        <Form method="post">
          <input type="hidden" name="intent" value="remove" />
          <button
            type="submit"
            onClick={(e) => { if (!confirm(`Remove bot "${bot.name}"?`)) e.preventDefault(); }}
            className="px-4 py-2 text-sm bg-[var(--color-danger)]/15 text-[var(--color-danger)] rounded-lg hover:bg-[var(--color-danger)]/25 transition-colors"
          >
            Remove Bot
          </button>
        </Form>
      </div>
    </div>
  );
}
