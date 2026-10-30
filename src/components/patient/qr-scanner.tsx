"use client";

import jsQR from "jsqr";
import { CameraOffIcon, QrCodeIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { clinicPathFromCode, clinicPathFromQr } from "./qr-target";

type CameraState =
  | "starting"
  | "scanning"
  | "wrong-code"
  | "denied"
  | "unavailable"
  | "insecure";

const STATUS: Record<CameraState, string> = {
  starting: "Starting the camera…",
  scanning: "Looking for a QR code…",
  "wrong-code":
    "That QR code isn't a QueueCare clinic code. Try the code on the clinic's poster.",
  denied:
    "Camera access is blocked. Allow the camera in your browser settings, or enter the clinic code below.",
  unavailable:
    "No camera is available here. Enter the clinic code printed under the QR code below.",
  insecure:
    "The camera only works on a secure (https) page. Enter the clinic code below.",
};

const LIVE: CameraState[] = ["starting", "scanning", "wrong-code"];

// "Scan QR code" on the home page: reads a clinic's QR code with the camera
// and opens that clinic's queue page. Only QueueCare clinic links are opened.
export function ScanQrButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant="outline"
            className={cn("h-12 rounded-btn px-6 text-base", className)}
          />
        }
      >
        <QrCodeIcon aria-hidden />
        Scan QR code
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Scan your clinic&apos;s QR code</DialogTitle>
          <DialogDescription>
            Point your camera at the QR code on the poster at the clinic.
          </DialogDescription>
        </DialogHeader>
        {/* Mounted only while open, so the camera runs only then. */}
        {open && <Scanner onDone={close} />}
      </DialogContent>
    </Dialog>
  );
}

function initialState(): CameraState {
  if (!window.isSecureContext) return "insecure";
  // mediaDevices is missing on insecure pages and some older browsers.
  return typeof navigator.mediaDevices?.getUserMedia === "function"
    ? "starting"
    : "unavailable";
}

function Scanner({ onDone }: { onDone: () => void }) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<CameraState>(initialState);
  const [codeError, setCodeError] = useState(false);

  const open = useCallback(
    (path: string) => {
      onDone();
      router.push(path);
    },
    [onDone, router],
  );

  useEffect(() => {
    if (initialState() !== "starting") return;
    let cancelled = false;
    let stream: MediaStream | null = null;
    let frame = 0;
    let lastScan = 0;
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });

    const stop = () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((track) => track.stop());
    };

    // About five reads a second on a frame scaled to 640px wide is plenty
    // for a printed poster and light on phones.
    const scan = (time: number) => {
      if (cancelled) return;
      frame = requestAnimationFrame(scan);
      const video = videoRef.current;
      if (!video || !context || time - lastScan < 200 || video.readyState < 2) {
        return;
      }
      lastScan = time;
      const scale = Math.min(1, 640 / video.videoWidth);
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const image = context.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(image.data, image.width, image.height, {
        inversionAttempts: "dontInvert",
      });
      if (!code) return;
      const path = clinicPathFromQr(code.data);
      if (path) {
        stop();
        open(path);
      } else {
        setState("wrong-code");
      }
    };

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: "environment" } } })
      .then(async (media) => {
        if (cancelled) {
          media.getTracks().forEach((track) => track.stop());
          return;
        }
        stream = media;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = media;
        await video.play();
        setState("scanning");
        frame = requestAnimationFrame(scan);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const name = error instanceof DOMException ? error.name : "";
        setState(
          name === "NotAllowedError" || name === "SecurityError"
            ? "denied"
            : "unavailable",
        );
      });

    return stop;
  }, [open]);

  function submitCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = new FormData(event.currentTarget).get("code");
    const path = typeof code === "string" ? clinicPathFromCode(code) : null;
    if (!path) {
      setCodeError(true);
      return;
    }
    open(path);
  }

  const live = LIVE.includes(state);
  return (
    <div className="flex flex-col gap-4">
      <div className="relative aspect-square w-full overflow-hidden rounded-card bg-foreground">
        {live ? (
          <>
            <video
              ref={videoRef}
              muted
              playsInline
              aria-hidden
              className="size-full object-cover"
            />
            {/* Viewfinder corners; decoration only. */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-[18%] rounded-card border-2 border-white/80 shadow-[0_0_0_9999px_rgb(0_0_0/0.35)]"
            />
          </>
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-2 text-white/80">
            <CameraOffIcon className="size-10" aria-hidden />
            <span className="text-sm">Camera unavailable</span>
          </div>
        )}
      </div>

      <p
        aria-live="polite"
        className={cn(
          "text-sm",
          state === "wrong-code" || !live
            ? "text-danger-text"
            : "text-muted-foreground",
        )}
      >
        {STATUS[state]}
      </p>

      <form
        method="post"
        noValidate
        onSubmit={submitCode}
        className="flex flex-col gap-2 border-t border-border pt-4"
      >
        <Label htmlFor="clinic-code">Or enter the clinic code</Label>
        <div className="flex gap-2">
          <Input
            id="clinic-code"
            name="code"
            autoComplete="off"
            autoCapitalize="none"
            placeholder="e.g. demo-clinic"
            className="h-11"
            aria-invalid={codeError || undefined}
            aria-describedby={codeError ? "clinic-code-error" : undefined}
            onChange={() => setCodeError(false)}
          />
          <Button type="submit" className="h-11 rounded-btn px-5">
            Open
          </Button>
        </div>
        {codeError && (
          <p id="clinic-code-error" className="text-sm text-danger-text">
            Enter the code printed under the QR code, e.g. demo-clinic.
          </p>
        )}
      </form>
    </div>
  );
}
