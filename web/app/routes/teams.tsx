import { useState } from "react";
import { Form, redirect, useSearchParams } from "react-router";
import { PageHeader, Section, RoleBadge, SubmitButton, cardClass, inputClass } from "../components/ui";
import type { Route } from "./+types/teams";

/** Reject names with path traversal characters */
function safeName(name: string | null): string | null {
  if (!name || /[\/\\.\x00]/.test(name)) return null;
  return name;
}

interface TeamInfo {
  name: string;
  description: string;
  botCount: number;
  bots: Array<{ key: string; name: string; role: string }>;
  isPreloaded: boolean;
  isActive: boolean;
}

interface CurrentBot {
  id: string;
  name: string;
  roleId: string;
  roleType: string;
}

export function meta() {
  return [{ title: "disclaw-team — Teams" }];
}

export async function loader() {
  const { join } = await import("path");
  const { homedir } = await import("os");
  const { existsSync, readdirSync, readFileSync } = await import("fs");
  const { parse: parseYaml } = await import("yaml");
  const { getTeamStatus } = await import("../lib/status.server");
  const { listTemplates } = await import("../lib/templates.server");

  const status = getTeamStatus();
  const preloaded = listTemplates();

  // Build current team info from live status
  const currentBots: CurrentBot[] = status.bots.map(b => ({
    id: b.id,
    name: b.name,
    roleId: b.roleId,
    roleType: b.role,
  }));

  // Read active team name and check if assignments still match
  const base = join(homedir(), ".disclaw-team");
  const activeTeamFile = join(base, "active-team.txt");
  const claimedTeam = existsSync(activeTeamFile) ? readFileSync(activeTeamFile, "utf-8").trim() : "";
  const teamsDir = join(base, "teams");

  // Get current live assignments to compare
  const assignFile = join(base, "assignment.yaml");
  const liveAssignments: Record<string, string> = {};
  if (existsSync(assignFile)) {
    const raw = parseYaml(readFileSync(assignFile, "utf-8"));
    Object.assign(liveAssignments, raw.assignments || {});
  }

  // Check if live assignments still match what the claimed team would set
  let assignmentsMatch = false;
  if (claimedTeam) {
    // Check against saved team
    const savedAssignPath = join(teamsDir, claimedTeam, "assignment.yaml");
    if (existsSync(savedAssignPath)) {
      const saved = parseYaml(readFileSync(savedAssignPath, "utf-8"));
      const savedAssignments = saved.assignments || {};
      assignmentsMatch = JSON.stringify(liveAssignments) === JSON.stringify(savedAssignments);
    }

    // Check against preset template
    if (!assignmentsMatch) {
      const preset = preloaded.find(t => t.name === claimedTeam);
      if (preset) {
        const botIds = Object.keys(liveAssignments);
        const presetRoles = preset.bots.map(b => b.key);
        assignmentsMatch = botIds.every((id, i) =>
          (liveAssignments[id] || "") === (presetRoles[i] || "")
        );
      }
    }
  }

  const activeTeam = assignmentsMatch ? claimedTeam : "";
  const isCustom = !activeTeam;

  // Load user-saved teams
  const userTeams: TeamInfo[] = [];
  if (existsSync(teamsDir)) {
    for (const entry of readdirSync(teamsDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const assignPath = join(teamsDir, entry.name, "assignment.yaml");
      const configPath = join(teamsDir, entry.name, "team.yaml");

      let bots: TeamInfo["bots"] = [];
      let description = "";

      if (existsSync(assignPath)) {
        const raw = parseYaml(readFileSync(assignPath, "utf-8"));
        const assignments = raw.assignments || {};
        bots = Object.entries(assignments).map(([key, roleId]) => ({
          key,
          name: String(roleId) || "unassigned",
          role: String(roleId) ? "assigned" : "unassigned",
        }));
        description = `${Object.values(assignments).filter(Boolean).length} assigned roles`;
      } else if (existsSync(configPath)) {
        const raw = parseYaml(readFileSync(configPath, "utf-8"));
        bots = Object.entries(raw.bots || {}).map(([key, bot]: [string, any]) => ({
          key,
          name: bot.name || key,
          role: bot.role || "unknown",
        }));
        description = raw.name || "";
      }

      userTeams.push({
        name: entry.name,
        description,
        botCount: bots.length,
        bots,
        isPreloaded: false,
        isActive: entry.name === activeTeam,
      });
    }
  }

  // Convert preloaded templates to TeamInfo
  const preloadedTeams: TeamInfo[] = preloaded.map(t => ({
    ...t,
    isPreloaded: true,
    isActive: t.name === activeTeam,
  }));

  return {
    preloadedTeams,
    userTeams,
    activeTeam,
    isCustom,
    currentBots,
    botCount: status.bots.length,
    sessionRunning: status.sessionRunning,
  };
}

export async function action({ request }: { request: Request }) {
  const form = await request.formData();
  const intent = form.get("intent") as string;

  if (intent === "apply-preloaded") {
    const templateName = form.get("template") as string;
    if (!templateName) return null;

    const { join } = await import("path");
    const { homedir } = await import("os");
    const { existsSync, readFileSync, writeFileSync } = await import("fs");
    const { parse: parseYaml, stringify: toYaml } = await import("yaml");
    const { listTemplates } = await import("../lib/templates.server");
    const { regenerateAllState } = await import("../lib/regenerate.server");

    const base = join(homedir(), ".disclaw-team");
    const ASSIGNMENT_FILE = join(base, "assignment.yaml");
    if (!existsSync(ASSIGNMENT_FILE)) return redirect("/onboarding");

    const templates = listTemplates();
    const template = templates.find(t => t.name === templateName);
    if (!template) return null;

    const assignment = parseYaml(readFileSync(ASSIGNMENT_FILE, "utf-8"));
    const botIds = Object.keys(assignment.assignments || {});
    const templateBots = template.bots;

    for (let i = 0; i < botIds.length; i++) {
      assignment.assignments[botIds[i]] = i < templateBots.length ? templateBots[i].key : "";
    }

    writeFileSync(ASSIGNMENT_FILE, toYaml(assignment, { lineWidth: 0 }));
    writeFileSync(join(base, "active-team.txt"), templateName);
    await regenerateAllState();
    return redirect(`/teams?applied=${encodeURIComponent(templateName)}`);
  }

  if (intent === "save") {
    const name = safeName(form.get("name") as string);
    if (!name) return null;

    const { join } = await import("path");
    const { homedir } = await import("os");
    const { existsSync, mkdirSync, copyFileSync, writeFileSync } = await import("fs");

    const base = join(homedir(), ".disclaw-team");
    const teamDir = join(base, "teams", name);
    mkdirSync(teamDir, { recursive: true });

    const assignSrc = join(base, "assignment.yaml");
    if (existsSync(assignSrc)) {
      copyFileSync(assignSrc, join(teamDir, "assignment.yaml"));
    }

    // Mark this as the active team
    writeFileSync(join(base, "active-team.txt"), name);

    return redirect("/teams");
  }

  if (intent === "load") {
    const name = safeName(form.get("name") as string);
    if (!name) return null;

    const { join } = await import("path");
    const { homedir } = await import("os");
    const { existsSync, copyFileSync, writeFileSync } = await import("fs");
    const { regenerateAllState } = await import("../lib/regenerate.server");

    const base = join(homedir(), ".disclaw-team");
    const teamAssign = join(base, "teams", name, "assignment.yaml");
    if (existsSync(teamAssign)) {
      copyFileSync(teamAssign, join(base, "assignment.yaml"));
      writeFileSync(join(base, "active-team.txt"), name);
      await regenerateAllState();
    }

    return redirect(`/teams?applied=${encodeURIComponent(name)}`);
  }

  if (intent === "delete") {
    const name = safeName(form.get("name") as string);
    if (!name) return null;

    const { join } = await import("path");
    const { homedir } = await import("os");
    const { rmSync } = await import("fs");

    rmSync(join(homedir(), ".disclaw-team", "teams", name), { recursive: true, force: true });
    return redirect("/teams");
  }

  return null;
}

const presetColors: Record<string, string> = {
  executive: "#6366f1",
  "dev-team": "#34d399",
  content: "#f59e0b",
  research: "#fb7185",
  frontend: "#22d3ee",
  product: "#a78bfa",
  solo: "#6b7280",
};

const presetIcons: Record<string, string> = {
  executive: "👔",
  "dev-team": "💻",
  content: "✍️",
  research: "🔬",
  frontend: "🎨",
  product: "📦",
  solo: "🤖",
};

export default function Teams({ loaderData }: Route.ComponentProps) {
  const { preloadedTeams, userTeams, activeTeam, isCustom, currentBots, botCount, sessionRunning } = loaderData;
  const [showSave, setShowSave] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const appliedTeam = searchParams.get("applied");

  return (
    <div>
      {/* Success banner */}
      {appliedTeam && (
        <div className="mb-6 bg-[var(--color-success)]/10 border border-[var(--color-success)]/30 rounded-lg p-4 flex items-center justify-between">
          <div>
            <span className="text-sm text-[var(--color-success)] font-medium">✓ &ldquo;{appliedTeam}&rdquo; is now active</span>
            {sessionRunning && (
              <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">Restart your bots for the new roles to take effect.</p>
            )}
          </div>
          <div className="flex gap-2">
            {sessionRunning && (
              <form method="post" action="/api/action">
                <input type="hidden" name="action" value="restart" />
                <button type="submit" className="px-3 py-1.5 text-xs font-medium bg-[var(--color-accent)]/15 text-[var(--color-accent)] rounded-lg hover:bg-[var(--color-accent)]/25">Restart All</button>
              </form>
            )}
            <button onClick={() => setSearchParams({})} className="px-3 py-1.5 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">Dismiss</button>
          </div>
        </div>
      )}

      <PageHeader title="Teams" subtitle="Manage your active team, switch presets, or save custom configurations." />

      {/* Current Team */}
      <Section title="Active Team">
        <div className={`${cardClass} border-[var(--color-accent)] bg-[var(--color-accent)]/5 p-5`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="text-xs bg-[var(--color-accent)]/15 text-[var(--color-accent)] px-2.5 py-1 rounded-full font-medium">
                {activeTeam ? activeTeam.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase()) : "Custom Configuration"}
              </span>
              {!isCustom && (
                <span className="text-xs text-[var(--color-text-secondary)]">
                  {preloadedTeams.some(t => t.isActive) ? "preset" : "saved team"}
                </span>
              )}
            </div>
            {isCustom && (
              <button
                onClick={() => setShowSave(!showSave)}
                className="px-3 py-1.5 text-xs bg-[var(--color-accent)]/15 text-[var(--color-accent)] rounded-lg hover:bg-[var(--color-accent)]/25 transition-colors"
              >
                Save as Team
              </button>
            )}
          </div>

          {showSave && (
            <Form method="post" className="flex gap-2 mb-4">
              <input type="hidden" name="intent" value="save" />
              <input type="text" name="name" placeholder="Team name" required className={inputClass + " flex-1"} autoFocus />
              <SubmitButton>Save</SubmitButton>
            </Form>
          )}

          {currentBots.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {currentBots.map(bot => (
                <a
                  key={bot.id}
                  href={`/bots/${bot.id}`}
                  className="flex items-center gap-2.5 p-2.5 rounded-lg bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] transition-colors"
                >
                  <span className="text-sm font-medium text-[var(--color-text-primary)]">{bot.name}</span>
                  <RoleBadge role={bot.roleType} />
                </a>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[var(--color-text-secondary)]">No bots configured yet.</p>
          )}
        </div>
      </Section>

      {/* Saved Teams */}
      {userTeams.length > 0 && (
        <Section title={`Saved Teams (${userTeams.length})`}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {userTeams.map(team => (
              <div key={team.name} className={`${cardClass} p-4 ${team.isActive ? "border-[var(--color-accent)] bg-[var(--color-accent)]/5" : ""}`}>
                <div className="flex items-center justify-between mb-2">
                  <a href={`/teams/${encodeURIComponent(team.name)}`} className="font-medium text-[var(--color-text-primary)] hover:text-[var(--color-accent)] transition-colors">{team.name}</a>
                  {team.isActive && (
                    <span className="text-xs bg-[var(--color-accent)]/15 text-[var(--color-accent)] px-2 py-0.5 rounded-full">active</span>
                  )}
                </div>
                <p className="text-xs text-[var(--color-text-secondary)] mb-3">{team.description}</p>
                <div className="flex gap-2">
                  <a href={`/teams/${encodeURIComponent(team.name)}`} className="px-3 py-1.5 text-xs bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)] rounded-lg hover:text-[var(--color-text-primary)] transition-colors">Edit</a>
                  {!team.isActive && (
                    <Form method="post">
                      <input type="hidden" name="intent" value="load" />
                      <input type="hidden" name="name" value={team.name} />
                      <button type="submit" className="px-3 py-1.5 text-xs bg-[var(--color-accent)]/15 text-[var(--color-accent)] rounded-lg hover:bg-[var(--color-accent)]/25">Apply</button>
                    </Form>
                  )}
                  <Form method="post">
                    <input type="hidden" name="intent" value="delete" />
                    <input type="hidden" name="name" value={team.name} />
                    <button type="submit" className="px-3 py-1.5 text-xs text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 rounded-lg" onClick={(e) => { if (!confirm(`Delete "${team.name}"?`)) e.preventDefault(); }}>Delete</button>
                  </Form>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Presets */}
      <Section title={`Presets (${preloadedTeams.length})`}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {preloadedTeams.map(team => {
            const canApply = botCount >= team.botCount && !team.isActive;
            const color = presetColors[team.name] || "#6b7280";
            const icon = presetIcons[team.name] || "📦";
            return (
              <Form key={team.name} method="post" className="h-full">
                <input type="hidden" name="intent" value="apply-preloaded" />
                <input type="hidden" name="template" value={team.name} />
                <button
                  type="submit"
                  disabled={!canApply}
                  className={`w-full h-full text-left ${cardClass} border-2 border-opacity-30 !rounded-xl p-5 hover:border-opacity-60 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none ${team.isActive ? "border-[var(--color-accent)] bg-[var(--color-accent)]/5" : ""}`}
                  style={{ borderColor: team.isActive ? undefined : color }}
                >
                  <div className="flex flex-col h-full">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <span className="text-2xl mr-2">{icon}</span>
                        <span className="text-lg font-semibold capitalize">{team.name.replace("-", " ")}</span>
                        {team.isActive && <span className="ml-2 text-[10px] bg-[var(--color-accent)]/15 text-[var(--color-accent)] px-1.5 py-0.5 rounded-full">active</span>}
                      </div>
                      <span className="text-xs text-[var(--color-text-secondary)] bg-[var(--color-surface)] px-2 py-1 rounded">
                        {team.botCount} bot{team.botCount !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <p className="text-sm text-[var(--color-text-secondary)] mb-3 line-clamp-2">{team.description}</p>
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {team.bots.map(bot => (
                        <span key={bot.key} className="inline-flex items-center gap-1 text-xs bg-[var(--color-surface)] px-2 py-0.5 rounded">
                          {bot.name} <RoleBadge role={bot.role} size="xs" />
                        </span>
                      ))}
                    </div>
                    <div className="mt-auto opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      {team.isActive ? (
                        <span className="text-xs text-[var(--color-accent)]">Currently active</span>
                      ) : canApply ? (
                        <span className="text-xs text-[var(--color-accent)]">Click to apply →</span>
                      ) : (
                        <span className="text-xs text-[var(--color-danger)]">Need {team.botCount} bots (you have {botCount})</span>
                      )}
                    </div>
                  </div>
                </button>
              </Form>
            );
          })}
        </div>
      </Section>
    </div>
  );
}
