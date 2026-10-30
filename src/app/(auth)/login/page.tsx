import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { LoginTicket } from "@/components/auth/login-ticket";
import {
  DEMO_ACCOUNTS,
  DEMO_PASSWORD,
  demoLoginsEnabled,
} from "@/lib/auth/demo-accounts";

export const metadata: Metadata = {
  title: "Sign in · QueueCare",
};

// The ticket and form are prerendered; whether to offer the demo accounts is
// decided per request from the environment, so it streams in after.
export default function LoginPage() {
  return (
    <LoginTicket>
      <Suspense fallback={<LoginForm />}>
        <LoginFormWithDemo />
      </Suspense>
    </LoginTicket>
  );
}

async function LoginFormWithDemo() {
  await connection();
  return (
    <LoginForm
      demo={
        demoLoginsEnabled()
          ? { accounts: DEMO_ACCOUNTS, password: DEMO_PASSWORD }
          : undefined
      }
    />
  );
}
