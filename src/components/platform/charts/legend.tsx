// Chart key above a chart. The numbers themselves are in the card's text.
export function ChartLegend({
  items,
}: {
  items: { label: string; color: string; shape?: "bar" | "line" }[];
}) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {items.map((item) => (
        <li key={item.label} className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className={
              item.shape === "line"
                ? "h-0.5 w-4 rounded-full"
                : "size-2.5 rounded-sm"
            }
            style={{ backgroundColor: item.color }}
          />
          {item.label}
        </li>
      ))}
    </ul>
  );
}
