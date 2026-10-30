import type { ReactNode } from "react";
import { messages } from "@/components/patient/messages";

// Patient screens: mobile-first, no login, no staff navigation.
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col text-base">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex h-14 w-full max-w-md items-center gap-2.5 px-4">
          <span
            aria-hidden="true"
            className="flex size-9 items-center justify-center rounded-btn bg-slate font-display text-lg font-extrabold text-sand"
          >
            Q
          </span>
          <span className="font-display text-base font-bold">
            {messages.brand}
          </span>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-6">
        {children}
      </main>
    </div>
  );
}
