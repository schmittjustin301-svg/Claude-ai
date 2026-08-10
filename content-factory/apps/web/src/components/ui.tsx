import { type ButtonHTMLAttributes, type InputHTMLAttributes, type PropsWithChildren, type SelectHTMLAttributes } from "react";
import clsx from "clsx";

export function Card({ className, children }: PropsWithChildren<{ className?: string }>) {
  return (
    <div className={clsx("rounded-2xl border border-cf-border bg-cf-surface p-5", className)}>{children}</div>
  );
}

export function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger"; size?: "sm" | "md" }) {
  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" ? "px-3 py-1.5 text-sm" : "px-4 py-2 text-sm",
        variant === "primary" && "bg-cf-accent text-white hover:bg-[#5b48f0]",
        variant === "secondary" && "bg-cf-surface-2 text-cf-text border border-cf-border hover:border-cf-accent/50",
        variant === "ghost" && "text-cf-muted hover:text-cf-text hover:bg-cf-surface-2",
        variant === "danger" && "bg-cf-danger/10 text-cf-danger border border-cf-danger/30 hover:bg-cf-danger/20",
        className,
      )}
      {...props}
    />
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={clsx(
        "w-full rounded-lg border border-cf-border bg-cf-surface-2 px-3 py-2 text-sm text-cf-text placeholder:text-cf-muted focus:border-cf-accent focus:outline-none",
        className,
      )}
      {...props}
    />
  );
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={clsx(
        "w-full rounded-lg border border-cf-border bg-cf-surface-2 px-3 py-2 text-sm text-cf-text focus:border-cf-accent focus:outline-none",
        className,
      )}
      {...props}
    />
  );
}

export function Badge({ children, tone = "default" }: PropsWithChildren<{ tone?: "default" | "success" | "warning" | "danger" | "accent" }>) {
  const tones: Record<string, string> = {
    default: "bg-cf-surface-2 text-cf-muted border-cf-border",
    success: "bg-cf-success/10 text-cf-success border-cf-success/30",
    warning: "bg-cf-warning/10 text-cf-warning border-cf-warning/30",
    danger: "bg-cf-danger/10 text-cf-danger border-cf-danger/30",
    accent: "bg-cf-accent/10 text-cf-accent border-cf-accent/30",
  };
  return (
    <span className={clsx("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium", tones[tone])}>
      {children}
    </span>
  );
}

export function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <Card className="flex flex-col gap-1">
      <span className="text-xs uppercase tracking-wide text-cf-muted">{label}</span>
      <span className="text-2xl font-semibold text-cf-text">{value}</span>
      {sub && <span className="text-xs text-cf-muted">{sub}</span>}
    </Card>
  );
}

export function Modal({ open, onClose, children, title }: PropsWithChildren<{ open: boolean; onClose: () => void; title: string }>) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl border border-cf-border bg-cf-surface p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="text-cf-muted hover:text-cf-text">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <Card className="flex flex-col items-center justify-center gap-1 py-16 text-center">
      <p className="font-medium text-cf-text">{title}</p>
      <p className="text-sm text-cf-muted">{description}</p>
    </Card>
  );
}
