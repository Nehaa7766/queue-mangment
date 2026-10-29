import { Button } from "@/components/ui/button";

// Phase 1 placeholder: shows the design tokens with sample data.
// The real patient and staff screens start in Phase 4.
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-6 px-4 py-12">
      <header className="flex flex-col gap-1">
        <p className="text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
          QueueCare
        </p>
        <h1 className="font-display text-[26px] font-bold">
          Clinic queue management
        </h1>
        <p className="text-sm text-muted-foreground">
          Design preview with sample data. Screens arrive from Phase 4.
        </p>
      </header>

      <section
        aria-label="Now serving"
        className="flex flex-col overflow-hidden rounded-card border border-border bg-card sm:flex-row"
      >
        <div className="flex flex-col gap-1 border-b-2 border-dashed border-background bg-slate px-6 py-5 text-white sm:w-44 sm:border-r-2 sm:border-b-0">
          <span className="text-[11px] font-semibold tracking-[0.08em] text-slate-muted uppercase">
            Now serving
          </span>
          <span className="font-display text-5xl font-extrabold tabular-nums">
            A-17
          </span>
          <span className="text-sm text-sand">Room 2</span>
        </div>

        <div className="flex flex-1 flex-col gap-4 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold">Priya R.</p>
              <p className="text-sm text-muted-foreground">
                General · Dr. Anjali Shah
              </p>
            </div>
            <span className="rounded-full bg-status-wait px-3 py-1 text-xs font-semibold text-status-wait-foreground tabular-nums">
              Called 1:42
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button className="h-11 rounded-btn px-5 font-semibold">
              Call next
            </Button>
            <Button variant="outline" className="h-11 rounded-btn px-5">
              Recall
            </Button>
            <Button variant="outline" className="h-11 rounded-btn px-5">
              Skip
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
