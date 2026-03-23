import { Form, redirect } from "react-router";
import { PageHeader, SubmitButton, RoleBadge, cardClass, inputClass, labelClass } from "../components/ui";
import type { Route } from "./+types/teams.$name";

interface RoleInfo {
  id: string;
  name: string;
  type: string;
  tagline: string;
}

export function meta({ params }: Route.MetaArgs) {
  return [{ title: `disclaw-team — Edit Team: ${params.name}` }];
}

export async function loader({ params }: Route.LoaderArgs) {
  const { join } = await import("path");
  const { homedir } = await import("os");
  const { existsSync, readFileSync } = await import("fs");
  const { parse: parseYaml } = await import("yaml");
  const { getTeamStatus } = await import("../lib/status.server");

  const { name } = params;
  if (!name || /[\/\\.\x00]/.test(name)) throw new Response("Invalid team name", { status: 400 });
  const base = join(homedir(), ".disclaw-team");
  const teamDir = join(base, "teams", name);
  const assignPath = join(teamDir, "assignment.yaml");

  if (!existsSync(assignPath)) throw new Response("Team not found", { status: 404 });

  const assignment = parseYaml(readFileSync(assignPath, "utf-8"));
  const assignments: Record<string, string> = assignment.assignments || {};

  // Get bot list from bots.yaml
  const botsConfig = parseYaml(readFileSync(join(base, "bots.yaml"), "utf-8"));
  const botIds = Object.keys(botsConfig.bots || {});

  // Fill in any bots not in this team's assignments
  for (const botId of botIds) {
    if (!(botId in assignments)) assignments[botId] = "";
  }

  const status = getTeamStatus();

  return {
    name,
    assignments,
    botIds,
    availableRoles: status.availableRoles,
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  const form = await request.formData();
  const intent = form.get("intent") as string;
  const { name } = params;
  if (!name || /[\/\\.\x00]/.test(name)) throw new Response("Invalid team name", { status: 400 });

  const { join } = await import("path");
  const { homedir } = await import("os");
  const { existsSync, readFileSync, writeFileSync, copyFileSync } = await import("fs");
  const { parse: parseYaml, stringify: toYaml } = await import("yaml");

  const base = join(homedir(), ".disclaw-team");
  const teamDir = join(base, "teams", name);
  const assignPath = join(teamDir, "assignment.yaml");

  if (intent === "save") {
    if (!existsSync(assignPath)) return redirect("/teams");

    const assignment = parseYaml(readFileSync(assignPath, "utf-8"));
    const botIds = Object.keys(assignment.assignments || {});

    // Update assignments from form
    for (const botId of botIds) {
      const roleId = form.get(`role_${botId}`) as string;
      assignment.assignments[botId] = roleId || "";
    }

    writeFileSync(assignPath, toYaml(assignment, { lineWidth: 0 }));
    return redirect(`/teams/${name}`);
  }

  if (intent === "apply") {
    // Copy this team's assignment to the active config
    const activeAssign = join(base, "assignment.yaml");
    if (existsSync(assignPath)) {
      copyFileSync(assignPath, activeAssign);

      const { regenerateAllState } = await import("../lib/regenerate.server");
      await regenerateAllState();
    }
    return redirect("/");
  }

  return null;
}

export default function EditTeam({ loaderData }: Route.ComponentProps) {
  const { name, assignments, botIds, availableRoles } = loaderData;

  return (
    <div className="max-w-2xl">
      <PageHeader
        title={`Edit: ${name}`}
        subtitle="Assign roles to each bot in this team."
        backTo="/teams"
        backLabel="Teams"
      />

      <Form method="post">
        <input type="hidden" name="intent" value="save" />

        <div className="space-y-3 mb-6">
          {botIds.map((botId: string) => {
            const currentRole = (assignments as Record<string, string>)[botId] || "";
            const role = currentRole ? (availableRoles as RoleInfo[]).find(r => r.id === currentRole) : null;

            return (
              <div key={botId} className={`${cardClass} p-4`}>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium text-[var(--color-text-primary)]">{botId}</span>
                    {role && (
                      <span className="ml-2 text-xs text-[var(--color-text-secondary)]">
                        currently: {role.name}
                      </span>
                    )}
                  </div>
                  <select
                    name={`role_${botId}`}
                    defaultValue={currentRole}
                    className={inputClass + " max-w-xs"}
                  >
                    <option value="">Unassigned</option>
                    {["orchestrator", "specialist", "executor"].map(type => (
                      <optgroup key={type} label={type.charAt(0).toUpperCase() + type.slice(1) + "s"}>
                        {(availableRoles as RoleInfo[]).filter(r => r.type === type).map(r => (
                          <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex gap-2">
          <SubmitButton>Save Changes</SubmitButton>
          <Form method="post" className="inline">
            <input type="hidden" name="intent" value="apply" />
            <button type="submit" className="px-5 py-2 text-sm rounded-lg bg-[var(--color-success)]/15 text-[var(--color-success)] hover:bg-[var(--color-success)]/25 transition-colors">
              Save & Apply
            </button>
          </Form>
        </div>
      </Form>
    </div>
  );
}
