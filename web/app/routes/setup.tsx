import { useLoaderData, Form, redirect } from "react-router";
import type { Route } from "./+types/setup";
import { PageHeader, RoleBadge, Section, cardClass } from "../components/ui";

interface TemplateInfo {
  name: string;
  description: string;
  botCount: number;
  bots: Array<{ key: string; name: string; role: string }>;
}

export function meta() {
  return [{ title: "disclaw-team — Setup" }];
}

export async function loader() {
  const { listTemplates } = await import("../lib/templates.server");
  const { getTeamStatus } = await import("../lib/status.server");

  const status = getTeamStatus();
  return {
    templates: listTemplates(),
    botCount: status.bots.length,
    botIds: status.bots.map(b => b.id),
  };
}

export async function action({ request }: { request: Request }) {
  const form = await request.formData();
  const templateName = form.get("template") as string;
  if (!templateName) return null;

  const { join } = await import("path");
  const { homedir } = await import("os");
  const { existsSync, readFileSync, writeFileSync } = await import("fs");
  const { parse: parseYaml, stringify: toYaml } = await import("yaml");
  const { listTemplates } = await import("../lib/templates.server");
  const { cliStop, cliStart } = await import("../lib/cli.server");

  const ASSIGNMENT_FILE = join(homedir(), ".disclaw-team", "assignment.yaml");
  if (!existsSync(ASSIGNMENT_FILE)) return redirect("/onboarding");

  // Load the template to get its role assignments
  const templates = listTemplates();
  const template = templates.find(t => t.name === templateName);
  if (!template) return null;

  // Load current assignment
  const assignment = parseYaml(readFileSync(ASSIGNMENT_FILE, "utf-8"));
  const botIds = Object.keys(assignment.assignments || {});

  // Clear all existing assignments, then apply template
  const templateBots = template.bots;
  for (let i = 0; i < botIds.length; i++) {
    if (i < templateBots.length) {
      assignment.assignments[botIds[i]] = templateBots[i].key;
    } else {
      // Bots beyond template size: unassign
      assignment.assignments[botIds[i]] = "";
    }
  }

  writeFileSync(ASSIGNMENT_FILE, toYaml(assignment, { lineWidth: 0 }));

  // Regenerate all bot state with new assignments
  const { regenerateAllState } = await import("../lib/regenerate.server");
  await regenerateAllState();

  return redirect("/");
}

const templateIcons: Record<string, string> = {
  executive: "👔",
  "dev-team": "💻",
  content: "✍️",
  research: "🔬",
  solo: "🤖",
};

const templateColors: Record<string, string> = {
  executive: "border-[var(--color-accent)]",
  "dev-team": "border-emerald-500",
  content: "border-amber-500",
  research: "border-purple-500",
  solo: "border-gray-500",
};

function TemplateCard({ template, botCount }: { template: TemplateInfo; botCount: number }) {
  const canApply = botCount >= template.botCount;
  return (
    <Form method="post" className="h-full">
      <input type="hidden" name="template" value={template.name} />
      <button
        type="submit"
        disabled={!canApply}
        className={`w-full h-full text-left ${cardClass} border-2 ${
          templateColors[template.name] || "border-[var(--color-border)]"
        } border-opacity-30 !rounded-xl p-5 hover:border-opacity-60 hover:shadow-lg hover:shadow-[var(--color-surface)]/50 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none`}
      >
      <div className="flex flex-col h-full">
        <div className="flex items-start justify-between mb-2">
          <div>
            <span className="text-2xl mr-2">{templateIcons[template.name] || "📦"}</span>
            <span className="text-lg font-semibold capitalize">{template.name.replace("-", " ")}</span>
          </div>
          <span className="text-xs text-[var(--color-text-secondary)] bg-[var(--color-surface)] px-2 py-1 rounded">
            {template.botCount} bot{template.botCount !== 1 ? "s" : ""}
          </span>
        </div>
        <p className="text-sm text-[var(--color-text-secondary)] mb-3 line-clamp-2">{template.description}</p>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {template.bots.map((bot) => (
            <span key={bot.key} className="inline-flex items-center gap-1 text-xs bg-[var(--color-surface)] px-2 py-0.5 rounded">
              {bot.name} <RoleBadge role={bot.role} size="xs" />
            </span>
          ))}
        </div>
        <div className="mt-auto opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          {canApply ? (
            <span className="text-xs text-[var(--color-accent)]">Click to apply →</span>
          ) : (
            <span className="text-xs text-[var(--color-danger)]">Need {template.botCount} bots (you have {botCount})</span>
          )}
        </div>
      </div>
    </button>
    </Form>
  );
}

export default function Setup({ loaderData }: Route.ComponentProps) {
  const { templates, botCount } = loaderData;

  return (
    <div>
      <PageHeader
        title="Team Presets"
        subtitle="One-click role assignments. Applies a preset to your existing bots."
      />

      <Section title="Templates">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map((t) => (
            <TemplateCard key={t.name} template={t} botCount={botCount} />
          ))}
        </div>
      </Section>
    </div>
  );
}
