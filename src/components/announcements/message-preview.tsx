import { MegaphoneIcon } from "lucide-react";
import { normalizeMessageBody } from "@/features/messaging/contracts";

// The announcement as one patient sees it: a clinic message on the left of
// their own Reception chat, marked "Announcement", in the look of the chat's
// MessageBubble (src/components/messaging). The text is normalised the way
// the server stores it and rendered as plain text, like the real chat.
export function MessagePreview({ text }: { text: string }) {
  const body = normalizeMessageBody(text);
  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
        Preview: what each patient sees
      </figcaption>
      <div className="overflow-hidden rounded-card border border-border bg-card">
        <div className="flex items-center gap-2 border-b border-divider px-4 py-2.5">
          <span className="text-sm font-semibold">Reception</span>
          <span className="text-xs text-muted-foreground">
            · their own private chat
          </span>
        </div>
        <div className="flex flex-col items-start gap-1 px-4 py-4">
          <span className="px-1 text-xs font-semibold text-muted-foreground">
            Reception
          </span>
          <div className="max-w-[85%] min-w-0 rounded-2xl rounded-bl-md bg-muted px-3.5 py-2">
            <span className="mb-1 flex items-center gap-1 text-[11px] font-semibold tracking-[0.06em] text-brand uppercase">
              <MegaphoneIcon aria-hidden className="size-3.5" />
              Announcement
            </span>
            <p
              dir="auto"
              className="text-base [overflow-wrap:anywhere] whitespace-pre-wrap"
            >
              {body || (
                <span className="text-muted-foreground">
                  Your message appears here.
                </span>
              )}
            </p>
          </div>
          <span className="px-1 text-xs text-muted-foreground">Just now</span>
        </div>
      </div>
    </figure>
  );
}
