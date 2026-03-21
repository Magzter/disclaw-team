import { Form, useLoaderData, redirect } from "react-router";
import { useState } from "react";
import type { Route } from "./+types/schedules";
import { PageHeader, SubmitButton, EmptyState, cardClass, inputClass, labelClass } from "../components/ui";

interface Schedule {
  id: string;
  name: string;
  prompt: string;
  bot_id: string;
  cron: string;
  enabled: boolean;
}

export function meta() {
  return [{ title: "disclaw-team — Schedules" }];
}

export async function loader() {
  const { listSchedules, describeCron } = await import("../lib/schedules.server");
  const { getTeamStatus } = await import("../lib/status.server");

  const schedules = listSchedules();
  const status = getTeamStatus();
  return {
    schedules: schedules.map((s) => ({ ...s, cronDesc: describeCron(s.cron) })),
    bots: status.bots.map((b) => ({ id: b.id, name: b.name })),
  };
}

export async function action({ request }: { request: Request }) {
  const { createSchedule, deleteSchedule, toggleSchedule } = await import("../lib/schedules.server");

  const form = await request.formData();
  const intent = form.get("intent") as string;

  switch (intent) {
    case "create": {
      const name = form.get("name") as string;
      const prompt = form.get("prompt") as string;
      const botId = form.get("bot_id") as string;
      const frequency = form.get("frequency") as string;
      const hour = form.get("hour") as string;
      const minute = form.get("minute") as string;

      let cron = "0 9 * * *";
      switch (frequency) {
        case "hourly": cron = `${minute || "0"} * * * *`; break;
        case "daily": cron = `${minute || "0"} ${hour || "9"} * * *`; break;
        case "weekdays": cron = `${minute || "0"} ${hour || "9"} * * 1-5`; break;
        case "custom": cron = form.get("cron") as string || "0 9 * * *"; break;
      }

      if (name && prompt && botId) {
        createSchedule({ name, prompt, bot_id: botId, cron, enabled: true });

        // Inject cron into running bot session immediately
        try {
          const { execSync } = await import("child_process");
          // Find the bot's tmux window (botId-roleName format)
          const windows = execSync('tmux list-windows -t disclaw-team -F "#{window_name}" 2>/dev/null', { stdio: "pipe" }).toString().trim().split("\n");
          const window = windows.find(w => w.startsWith(`${botId}-`));
          if (window) {
            const escaped = `Set up a recurring cron job: cron expression "${cron}", prompt: "${prompt.replace(/"/g, '\\"').replace(/\n/g, ' ')}" — use CronCreate to schedule this.`;
            execSync(`tmux send-keys -t disclaw-team:${window} '${escaped.replace(/'/g, "'\\''")}' Enter`, { stdio: "pipe" });
          }
        } catch {
          // Bot might not be running — schedule saved, will inject on next start
        }
      }
      break;
    }
    case "delete": {
      const id = form.get("id") as string;
      if (id) deleteSchedule(id);
      break;
    }
    case "toggle": {
      const id = form.get("id") as string;
      if (id) toggleSchedule(id);
      break;
    }
    case "run": {
      const id = form.get("id") as string;
      if (id) {
        try {
          const { listSchedules } = await import("../lib/schedules.server");
          const { execSync } = await import("child_process");
          const schedule = listSchedules().find(s => s.id === id);
          if (schedule) {
            // Find the bot's tmux window (botId-roleName format)
            const windows = execSync('tmux list-windows -t disclaw-team -F "#{window_name}" 2>/dev/null', { stdio: "pipe" }).toString().trim().split("\n");
            const window = windows.find(w => w.startsWith(`${schedule.bot_id}-`));
            if (window) {
              const escaped = schedule.prompt.replace(/'/g, "'\\''").replace(/\n/g, " ");
              execSync(`tmux send-keys -t disclaw-team:${window} '${escaped}' Enter`, { stdio: "pipe" });
            }
          }
        } catch (err) {
          console.error("Run schedule failed:", err);
        }
      }
      break;
    }
  }

  return redirect("/schedules");
}

export default function Schedules({ loaderData }: Route.ComponentProps) {
  const { schedules, bots } = loaderData;
  const [showCreate, setShowCreate] = useState(false);
  const [frequency, setFrequency] = useState("daily");

  return (
    <div>
      <PageHeader
        title="Schedules"
        subtitle="Recurring tasks for your bots."
        action={
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="px-4 py-2 text-sm bg-[var(--color-accent)] text-white rounded-lg hover:bg-[var(--color-accent-hover)] transition-colors"
          >
            + New Schedule
          </button>
        }
      />

      {/* Create form */}
      {showCreate && (
        <Form method="post" className={`${cardClass} p-4 mb-6`}>
          <input type="hidden" name="intent" value="create" />
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className={labelClass}>Name</label>
              <input className={inputClass} name="name" placeholder="Daily standup" required />
            </div>
            <div>
              <label className={labelClass}>Bot</label>
              <select name="bot_id" className={inputClass} required>
                <option value="">Select a bot...</option>
                {bots.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="mb-3">
            <label className={labelClass}>Prompt</label>
            <textarea className={`${inputClass} min-h-[80px]`} name="prompt" placeholder="What should the bot do?" required rows={3} />
          </div>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div>
              <label className={labelClass}>Frequency</label>
              <select name="frequency" className={inputClass} value={frequency} onChange={(e) => setFrequency(e.target.value)}>
                <option value="hourly">Hourly</option>
                <option value="daily">Daily</option>
                <option value="weekdays">Weekdays</option>
                <option value="custom">Custom cron</option>
              </select>
            </div>
            {frequency !== "custom" && (
              <>
                <div>
                  <label className={labelClass}>Hour</label>
                  <select name="hour" className={inputClass} defaultValue="9">
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={i}>{i.toString().padStart(2, "0")}:00</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Minute</label>
                  <select name="minute" className={inputClass} defaultValue="0">
                    {[0, 5, 10, 15, 20, 30, 45].map((m) => (
                      <option key={m} value={m}>:{m.toString().padStart(2, "0")}</option>
                    ))}
                  </select>
                </div>
              </>
            )}
            {frequency === "custom" && (
              <div className="col-span-2">
                <label className={labelClass}>Cron Expression</label>
                <input className={inputClass} name="cron" placeholder="0 9 * * *" defaultValue="0 9 * * *" />
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <SubmitButton>Create</SubmitButton>
            <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-surface-hover)] transition-colors">Cancel</button>
          </div>
        </Form>
      )}

      {/* Schedule list */}
      {schedules.length === 0 ? (
        <EmptyState
          icon="📅"
          title="No schedules yet"
          description="Create one to run recurring tasks."
          action={
            !showCreate ? (
              <button
                onClick={() => setShowCreate(true)}
                className="px-4 py-2 text-sm bg-[var(--color-accent)] text-white rounded-lg hover:bg-[var(--color-accent-hover)] transition-colors"
              >
                + New Schedule
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-2">
          {schedules.map((s) => (
            <div key={s.id} className={`${cardClass} flex items-center justify-between px-4 py-3 transition-opacity ${s.enabled ? "" : "opacity-50"}`}>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm">{s.name}</span>
                  <span className="text-xs bg-[var(--color-surface)] px-2 py-0.5 rounded text-[var(--color-text-secondary)]">{s.cronDesc}</span>
                </div>
                <p className="text-xs text-[var(--color-text-secondary)] truncate max-w-md">{s.prompt}</p>
              </div>
              <div className="flex items-center gap-3 ml-4">
                <span className="text-xs text-[var(--color-text-secondary)]">{bots.find(b => b.id === s.bot_id)?.name || s.bot_id}</span>
                <Form method="post">
                  <input type="hidden" name="intent" value="toggle" />
                  <input type="hidden" name="id" value={s.id} />
                  <button
                    type="submit"
                    className={`w-11 h-6 rounded-full relative transition-colors duration-200 ${s.enabled ? "bg-[var(--color-success)]" : "bg-[var(--color-border)]"}`}
                    aria-label={s.enabled ? "Disable schedule" : "Enable schedule"}
                  >
                    <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${s.enabled ? "translate-x-[22px]" : "translate-x-1"}`} />
                  </button>
                </Form>
                <Form method="post">
                  <input type="hidden" name="intent" value="run" />
                  <input type="hidden" name="id" value={s.id} />
                  <button type="submit" className="text-xs text-[var(--color-accent)] hover:underline">Run Now</button>
                </Form>
                <Form method="post">
                  <input type="hidden" name="intent" value="delete" />
                  <input type="hidden" name="id" value={s.id} />
                  <button type="submit" className="text-xs text-[var(--color-danger)] hover:underline">Delete</button>
                </Form>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
