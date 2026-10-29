import { afterAll, expect, it } from "vitest";
import { getDb } from "@/lib/db";

afterAll(async () => {
  await getDb().$disconnect();
});

it("connects to the test database", async () => {
  const [row] = await getDb().$queryRaw<
    { database: string }[]
  >`SELECT current_database() AS database`;

  expect(row.database).toBe("queuecare_test");
});
