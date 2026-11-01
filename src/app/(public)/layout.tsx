import type { ReactNode } from "react";
import { BrandMark, BrandName } from "@/components/layout/brand-mark";
import { messages } from "@/components/patient/messages";

// Patient screens: mobile-first, no login, no staff navigation. White top bar
// over a light grey page; each screen adds its own clinic strip and column.
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col bg-background text-base">
      <header className="sticky top-0 z-10 border-b border-border bg-card">
        <div className="mx-auto flex h-16 w-full max-w-md items-center gap-2.5 px-4 lg:max-w-6xl lg:px-6">
          <BrandMark />
          <BrandName />
          <span className="ml-auto text-sm text-muted-foreground">
            {messages.patientTag}
          </span>
        </div>
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
