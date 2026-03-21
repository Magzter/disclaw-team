import { useNavigation } from "react-router";

// Shared styles
export const inputClass = "w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]/30 text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)]/50 transition-colors";

export const labelClass = "block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5";

export const cardClass = "bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-lg";

// Submit button that shows loading state during form submission
export function SubmitButton({ children, variant = "primary", className = "" }: {
  children: React.ReactNode;
  variant?: "primary" | "success" | "danger";
  className?: string;
}) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const colors = {
    primary: "bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white",
    success: "bg-[var(--color-success)] hover:bg-[var(--color-success)]/80 text-white",
    danger: "bg-[var(--color-danger)]/15 text-[var(--color-danger)] hover:bg-[var(--color-danger)]/25",
  };

  return (
    <button
      type="submit"
      disabled={isSubmitting}
      className={`px-5 py-2 text-sm rounded-lg transition-all ${colors[variant]} ${isSubmitting ? "opacity-50 cursor-wait" : ""} ${className}`}
    >
      {isSubmitting ? "Saving..." : children}
    </button>
  );
}

// Page header with optional back link
export function PageHeader({ title, subtitle, backTo, backLabel, action }: {
  title: string;
  subtitle?: string;
  backTo?: string;
  backLabel?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        {backTo && (
          <a href={backTo} className="text-xs text-[var(--color-accent)] hover:underline mb-1 inline-block">
            ← {backLabel || "Back"}
          </a>
        )}
        <h2 className="text-xl font-semibold">{title}</h2>
        {subtitle && <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

// Empty state
export function EmptyState({ icon, title, description, action }: {
  icon?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className={`${cardClass} p-12 text-center`}>
      {icon && <div className="text-4xl mb-3 opacity-50">{icon}</div>}
      <h3 className="text-base font-medium text-[var(--color-text-primary)] mb-1">{title}</h3>
      {description && <p className="text-sm text-[var(--color-text-secondary)] mb-4">{description}</p>}
      {action}
    </div>
  );
}

// Status dot with label
export function StatusBadge({ active, label }: { active: boolean; label?: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`inline-block w-2 h-2 rounded-full ${active ? "bg-[var(--color-success)] shadow-[0_0_6px_var(--color-success)]" : "bg-[var(--color-text-secondary)]/30"}`} />
      {label && <span className="text-xs text-[var(--color-text-secondary)]">{label}</span>}
    </span>
  );
}

// Role badge with consistent colors
export function RoleBadge({ role, size = "sm" }: { role: string; size?: "sm" | "xs" }) {
  const colors: Record<string, string> = {
    orchestrator: "bg-[var(--color-accent)]/15 text-[var(--color-accent)]",
    specialist: "bg-emerald-500/15 text-emerald-400",
    executor: "bg-amber-500/15 text-amber-400",
    unassigned: "bg-gray-500/15 text-gray-500",
  };
  const sizeClass = size === "xs" ? "text-[10px] px-1.5 py-0" : "text-xs px-2 py-0.5";
  const displayName = role.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  return (
    <span className={`${sizeClass} rounded-full ${colors[role] || "bg-gray-500/15 text-gray-400"}`}>
      {displayName}
    </span>
  );
}

// Model badge
export function ModelBadge({ model, reasoning }: { model?: string; reasoning?: string }) {
  if (!model) return null;
  const modelColors: Record<string, string> = {
    opus: "bg-purple-500/15 text-purple-400",
    sonnet: "bg-blue-500/15 text-blue-400",
    haiku: "bg-cyan-500/15 text-cyan-400",
  };
  return (
    <span className="flex items-center gap-1">
      <span className={`text-[10px] px-1.5 rounded ${modelColors[model] || "bg-gray-500/15 text-gray-400"}`}>{model}</span>
      {reasoning && (
        <span className="text-[10px] px-1.5 rounded bg-[var(--color-surface)] text-[var(--color-text-secondary)]">{reasoning}</span>
      )}
    </span>
  );
}

// Section divider
export function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}
