import type { Route } from "./+types/roles";
import { PageHeader, RoleBadge, ModelBadge, Section, cardClass } from "../components/ui";

interface RoleDetail {
  id: string;
  name: string;
  type: string;
  description: string;
  tagline: string;
  tone: string;
  domain: string[];
  responsibilities: string[];
  instructions: string;
  model: string;
  reasoning: string;
}

export function meta() {
  return [{ title: "disclaw-team — Roles Library" }];
}

export async function loader() {
  const { join } = await import("path");
  const { homedir } = await import("os");
  const { existsSync, readdirSync, readFileSync } = await import("fs");
  const { parse: parseYaml } = await import("yaml");

  const rolesDir = join(homedir(), ".disclaw-team", "roles");
  const roles: RoleDetail[] = [];

  if (existsSync(rolesDir)) {
    for (const file of readdirSync(rolesDir)) {
      if (!file.endsWith(".yaml")) continue;
      try {
        const raw = parseYaml(readFileSync(join(rolesDir, file), "utf-8"));
        roles.push({
          id: file.replace(".yaml", ""),
          name: raw.name || file.replace(".yaml", ""),
          type: raw.type || "unknown",
          description: raw.description || "",
          tagline: raw.personality?.tagline || "",
          tone: raw.personality?.tone || "",
          domain: raw.personality?.domain || [],
          responsibilities: raw.responsibilities || [],
          instructions: raw.personality?.instructions || "",
          model: raw.model_config?.model || "sonnet",
          reasoning: raw.model_config?.reasoning || "medium",
        });
      } catch {}
    }
  }

  roles.sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name));
  return { roles };
}

function RoleCard({ role }: { role: RoleDetail }) {
  const typeColors: Record<string, string> = {
    orchestrator: "border-l-[var(--color-accent)]",
    specialist: "border-l-emerald-500",
    executor: "border-l-amber-500",
  };

  return (
    <a href={`/roles/${role.id}`} className={`block ${cardClass} border-l-2 ${typeColors[role.type] || "border-l-gray-500"} p-4 hover:border-[var(--color-border)] hover:shadow-lg hover:shadow-black/10 transition-all`}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="font-medium text-sm">{role.name}</span>
        <RoleBadge role={role.type} size="xs" />
      </div>
      <p className="text-xs text-[var(--color-text-secondary)] mb-3 line-clamp-2">{role.tagline}</p>
      <div className="flex items-center justify-between">
        {role.domain.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {role.domain.slice(0, 3).map((d) => (
              <span key={d} className="text-[10px] bg-[var(--color-surface)] px-1.5 py-0.5 rounded text-[var(--color-text-secondary)]">
                {d}
              </span>
            ))}
            {role.domain.length > 3 && (
              <span className="text-[10px] text-[var(--color-text-secondary)]">+{role.domain.length - 3}</span>
            )}
          </div>
        ) : (
          <span />
        )}
        <ModelBadge model={role.model} reasoning={role.reasoning} />
      </div>
    </a>
  );
}

export default function Roles({ loaderData }: Route.ComponentProps) {
  const { roles } = loaderData;

  const grouped = new Map<string, RoleDetail[]>();
  for (const role of roles) {
    if (!grouped.has(role.type)) grouped.set(role.type, []);
    grouped.get(role.type)!.push(role);
  }

  return (
    <div>
      <PageHeader
        title="Roles Library"
        subtitle={`${roles.length} roles available. Click any role to edit.`}
        action={
          <a href="/roles/new" className="px-4 py-2 text-sm bg-[var(--color-accent)] text-white rounded-lg hover:bg-[var(--color-accent-hover)] transition-colors">
            + New Role
          </a>
        }
      />

      {['orchestrator', 'specialist', 'executor'].map((type) => {
        const typeRoles = grouped.get(type) || [];
        if (typeRoles.length === 0) return null;
        const typeLabels: Record<string, string> = {
          orchestrator: "Orchestrators — lead and delegate",
          specialist: "Specialists — domain experts",
          executor: "Executors — build and implement",
        };
        return (
          <Section key={type} title={`${typeLabels[type]} (${typeRoles.length})`}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {typeRoles.map((role) => (
                <RoleCard key={role.id} role={role} />
              ))}
            </div>
          </Section>
        );
      })}
    </div>
  );
}
