"use client";

import { CheckIcon, CopyIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

// A one-time invitation link with a copy button. The link is shown only
// once: only its hash is stored, so it can't be shown again later.
export function InviteLink({ email, url }: { email: string; url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-2 rounded-card border border-border bg-background p-4 text-sm">
      <p role="status">
        We emailed an invitation to{" "}
        <span className="font-semibold">{email}</span>. You can also send them
        this link; it works for 7 days and is shown only once.
      </p>
      <div className="flex gap-2">
        <input
          readOnly
          aria-label="Invitation link"
          value={url}
          onFocus={(event) => event.currentTarget.select()}
          className="h-10 min-w-0 flex-1 rounded-btn border border-input bg-card px-3 font-mono text-xs"
        />
        <Button
          variant="outline"
          className="h-10 shrink-0 rounded-btn px-3"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              setCopied(true);
            } catch {
              toast.error("Couldn't copy. Select the link and copy it.");
            }
          }}
        >
          {copied ? <CheckIcon aria-hidden /> : <CopyIcon aria-hidden />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
    </div>
  );
}
