import { useRevalidator, redirect, Form } from "react-router";
import { useEffect } from "react";
import { StatusBadge, RoleBadge, ModelBadge, Section, PageHeader, EmptyState, cardClass } from "../components/ui";
import type { Route } from "./+types/home";

interface BotStatus {
  id: string;
  name: string;
  role: string;
  roleId: string;
  tagline: string;
  hasToken: boolean;
  hasState: boolean;
  hasRegistry: boolean;
  isRunning: boolean;
}

export function meta() {
  return [
    { title: "disclaw-team — Dashboard" },
    { name: "description", content: "AI Team Manager" },
  ];
}

export async function loader() {
  const { getTeamStatus } = await import("../lib/status.server");
  const status = getTeamStatus();
  if (!status.configured) return redirect("/onboarding");
  return status;
}

function BotCard({ bot }: { bot: BotStatus }) {
  return (
    <a href={`/bots/${bot.id}`} className={`group block ${cardClass} p-4 hover:border-[var(--color-accent)]/40 transition-all hover:shadow-lg hover:shadow-[var(--color-accent)]/5`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2.5">
          <StatusBadge active={bot.isRunning} />
          <span className="font-medium">{bot.name}</span>
        </div>
        <RoleBadge role={bot.role} />
      </div>

      <p className="text-sm text-[var(--color-text-secondary)] mb-3 line-clamp-1">{bot.tagline}</p>

      <div className="flex items-center justify-between">
        <div className="flex gap-3 text-xs text-[var(--color-text-secondary)]">
          <span className={bot.hasToken ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"}>
            {bot.hasToken ? "✓" : "✗"} Token
          </span>
          <span className={bot.hasRegistry ? "text-[var(--color-success)]" : "text-[var(--color-text-secondary)]"}>
            {bot.hasRegistry ? "✓" : "✗"} Discord
          </span>
        </div>
        <span className="text-xs text-[var(--color-accent)] opacity-0 group-hover:opacity-100">Details →</span>
      </div>
    </a>
  );
}

export default function Dashboard({ loaderData }: Route.ComponentProps) {
  const status = loaderData;
  const { revalidate } = useRevalidator();

  useEffect(() => {
    const interval = setInterval(revalidate, 3000);
    return () => clearInterval(interval);
  }, [revalidate]);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold">{status.teamName}</h2>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-sm text-[var(--color-text-secondary)]">Server: <span className="font-mono text-xs">{status.guildId}</span></span>
            {status.activeProfile && (
              <span className="text-xs bg-[var(--color-accent)]/10 text-[var(--color-accent)] px-2.5 py-0.5 rounded-full">
                {status.activeProfile}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge active={status.sessionRunning} label={status.sessionRunning ? "Running" : "Stopped"} />
          <div className="flex gap-2">
            {status.sessionRunning && (
              <form method="post" action="/api/action">
                <input type="hidden" name="action" value="restart" />
                <button type="submit" className="px-4 py-2 text-sm rounded-lg transition-colors bg-[var(--color-accent)]/15 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/25">
                  Restart
                </button>
              </form>
            )}
            <form method="post" action="/api/action">
              <input type="hidden" name="action" value={status.sessionRunning ? "stop" : "start"} />
              <button
                type="submit"
                className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                  status.sessionRunning
                    ? "bg-[var(--color-danger)]/15 text-[var(--color-danger)] hover:bg-[var(--color-danger)]/25"
                    : "bg-[var(--color-success)]/15 text-[var(--color-success)] hover:bg-[var(--color-success)]/25"
                }`}
              >
                {status.sessionRunning ? "Stop All" : "Start All"}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Bots */}
      <Section
        title={`Bots (${status.bots.length})`}
        action={
          <a href="/bots/new" className="text-xs px-3 py-1.5 bg-[var(--color-accent)]/15 text-[var(--color-accent)] rounded-lg hover:bg-[var(--color-accent)]/25 transition-colors">
            + Add Bot
          </a>
        }
      >
        {status.bots.length === 0 ? (
          <EmptyState
            icon="🤖"
            title="No bots yet"
            description="Add your first Discord bot to get started."
            action={
              <a href="/bots/new" className="inline-block px-4 py-2 text-sm bg-[var(--color-accent)] text-white rounded-lg hover:bg-[var(--color-accent-hover)]">
                + Add Bot
              </a>
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {status.bots.map((bot) => (
              <BotCard key={bot.id} bot={bot} />
            ))}
          </div>
        )}
      </Section>

      {/* Humans */}
      {status.humans.length > 0 && (
        <Section title="Humans">
          <div className="flex gap-3">
            {status.humans.map((h, i) => (
              <div key={i} className={`${cardClass} px-4 py-3`}>
                <span className="text-sm font-medium">{h.name}</span>
                <span className="text-xs text-[var(--color-text-secondary)] ml-2">{h.role}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

    </div>
  );
}
