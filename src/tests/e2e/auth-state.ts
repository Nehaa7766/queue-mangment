// Saved by auth.setup.ts, reused by specs that need a signed-in receptionist.
export const RECEPTION_STATE = "playwright/.auth/reception.json";

// Sign-in is limited to 5 attempts a minute per client address. The E2E
// server trusts X-Forwarded-For (docker-compose.yml, `web`), so each spec that
// signs in uses its own address: test.use(clientAddress(N)).
export function clientAddress(n: number) {
  return { extraHTTPHeaders: { "x-forwarded-for": `10.0.0.${n}` } };
}
