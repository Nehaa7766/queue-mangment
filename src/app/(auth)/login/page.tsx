import type { Metadata } from "next";
import { DemoAccounts } from "@/components/auth/demo-accounts";
import { LoginForm } from "@/components/auth/login-form";
import { LoginTicket } from "@/components/auth/login-ticket";

export const metadata: Metadata = {
  title: "Sign in · QueueCare",
};

// Fully static. The demo accounts box asks the server for its list after
// loading (development and demo servers only), so nothing here waits on a
// request or replaces the form while someone types.
export default function LoginPage() {
  return (
    <LoginTicket>
      <LoginForm>
        <DemoAccounts />
      </LoginForm>
    </LoginTicket>
  );
}
