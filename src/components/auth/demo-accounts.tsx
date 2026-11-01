"use client";

import { use, useEffect, useState } from "react";
import { z } from "zod";
import { DemoFillContext } from "@/components/auth/login-form";

const demoListSchema = z.object({
  accounts: z.array(z.object({ role: z.string(), email: z.string() })),
  password: z.string().nullable(),
});

type DemoList = z.infer<typeof demoListSchema>;

// One button per seeded account under the sign-in button. Choosing one fills
// in the form; it doesn't sign in. The list comes from /api/demo-accounts
// after the page loads (empty unless enabled), so the page stays static.
// Rendered inside <LoginForm>.
export function DemoAccounts() {
  const fill = use(DemoFillContext);
  const [demo, setDemo] = useState<DemoList | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/demo-accounts", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: unknown) => {
        const parsed = demoListSchema.safeParse(data);
        if (!cancelled && parsed.success) setDemo(parsed.data);
      })
      // The box is a convenience; sign-in works the same without it.
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const password = demo?.password;
  if (!fill || !demo || !password || demo.accounts.length === 0) return null;

  return (
    <section
      aria-labelledby="demo-accounts-title"
      className="rounded-btn border border-dashed border-border bg-background/60 p-3"
    >
      {/* Named "Demo accounts" only, so the region doesn't also match
          getByLabel("Password"). */}
      <p className="text-xs font-semibold">
        <span id="demo-accounts-title">Demo accounts</span>{" "}
        <span className="font-normal text-muted-foreground">
          · password <code className="font-mono">{password}</code>
        </span>
      </p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {demo.accounts.map((account) => (
          <button
            key={account.email}
            type="button"
            onClick={() => fill(account.email, password)}
            className="min-w-0 rounded-btn border border-border bg-card px-3 py-2 text-left transition-colors outline-none hover:border-brand hover:bg-brand-tint focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <span className="block text-xs font-semibold">{account.role}</span>
            <span className="block truncate text-[11px] text-muted-foreground">
              {account.email}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
