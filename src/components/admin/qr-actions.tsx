"use client";

import { DownloadIcon, PrinterIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function CopyLink({ url }: { url: string }) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied.");
    } catch {
      toast.error("Couldn't copy. Select the link and copy it by hand.");
    }
  }
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <Input
        readOnly
        value={url}
        aria-label="Clinic page link"
        onFocus={(event) => event.target.select()}
        className="h-10 font-mono text-xs"
      />
      <Button
        type="button"
        variant="outline"
        className="h-10 rounded-btn"
        onClick={copy}
      >
        Copy link
      </Button>
    </div>
  );
}

// Data URLs keep the downloads working without another endpoint.
export function QrDownloads({
  slug,
  svg,
  pngDataUrl,
}: {
  slug: string;
  svg: string;
  pngDataUrl: string;
}) {
  const svgDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  const link =
    "inline-flex h-10 items-center gap-1.5 rounded-btn border border-border bg-card px-3 text-sm font-medium outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50";
  return (
    <div className="flex flex-wrap gap-2">
      <a href={pngDataUrl} download={`${slug}-qr.png`} className={link}>
        <DownloadIcon aria-hidden className="size-4" /> PNG
      </a>
      <a href={svgDataUrl} download={`${slug}-qr.svg`} className={link}>
        <DownloadIcon aria-hidden className="size-4" /> SVG
      </a>
    </div>
  );
}

export function PrintButton() {
  return (
    <Button
      className="h-10 rounded-btn px-5 font-semibold"
      onClick={() => window.print()}
    >
      <PrinterIcon aria-hidden /> Print poster
    </Button>
  );
}
