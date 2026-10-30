import type { ReactNode } from "react";

// Centered card on the page background, used by sign-in and the
// standalone status pages (unauthorized, not found, error).
export function AuthShell({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="flex size-9 items-center justify-center rounded-btn bg-slate font-display text-lg font-extrabold text-sand"
          >
            Q
          </span>
          <span className="font-display text-lg font-bold">QueueCare</span>
        </div>
        <section className="flex flex-col gap-5 rounded-card border border-border bg-card p-6">
          <header className="flex flex-col gap-1">
            <h1 className="font-display text-[26px] font-bold">{title}</h1>
            {description && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
          </header>
          {children}
        </section>
      </div>
    </main>
  );
}
