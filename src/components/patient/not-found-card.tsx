import { SearchX } from "lucide-react";

export function NotFoundCard({ title, body }: { title: string; body: string }) {
  return (
    <section className="flex flex-col items-center gap-3 rounded-card border border-border bg-card p-6 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-slate-tint text-slate">
        <SearchX aria-hidden="true" className="size-6" />
      </span>
      <h1 className="font-display text-xl font-bold">{title}</h1>
      <p className="text-base text-muted-foreground">{body}</p>
    </section>
  );
}
