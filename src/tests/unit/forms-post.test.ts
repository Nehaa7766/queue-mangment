import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

// A form handled by onSubmit falls back to a native GET if it is submitted
// before React hydrates, which puts every field (including passwords) in the
// URL. method="post" keeps them in the request body instead.

function tsxFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      return tsxFiles(path);
    }
    return entry.name.endsWith(".tsx") ? [path] : [];
  });
}

it("every script-handled form posts instead of falling back to GET", () => {
  const offenders = ["src/components", "src/app"]
    .flatMap(tsxFiles)
    .flatMap((file) => {
      const tags = readFileSync(file, "utf8").match(/<form\s[^>]*>/g) ?? [];
      return tags
        .filter(
          (tag) => tag.includes("onSubmit") && !tag.includes('method="post"'),
        )
        .map(() => file);
    });

  expect(offenders).toEqual([]);
});
