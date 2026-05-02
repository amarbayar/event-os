/* eslint-disable @next/next/no-img-element */
"use client";

import { Download, ExternalLink } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type UploadedAssetPreviewProps = {
  url: string;
  label?: string;
  compact?: boolean;
  imageClassName?: string;
};

function fileNameFromUrl(url: string): string {
  try {
    const parsed = new URL(url, "https://event-os.local");
    return decodeURIComponent(parsed.pathname.split("/").filter(Boolean).pop() || "download");
  } catch {
    return url.split("/").filter(Boolean).pop() || "download";
  }
}

function isImageUrl(url: string): boolean {
  return /\.(png|jpe?g|webp|gif|avif|svg)(\?.*)?$/i.test(url);
}

export function UploadedAssetPreview({
  url,
  label = "Uploaded asset",
  compact = false,
  imageClassName,
}: UploadedAssetPreviewProps) {
  const fileName = fileNameFromUrl(url);
  const image = isImageUrl(url);

  return (
    <div className={compact ? "space-y-2" : "rounded-md border bg-stone-50 p-3"}>
      <div className={compact ? "flex items-center gap-3" : "space-y-3"}>
        {image && (
          <a href={url} target="_blank" rel="noreferrer" aria-label={`Open full size ${label}`}>
            <img
              src={url}
              alt={label}
              className={
                imageClassName ||
                (compact
                  ? "h-16 w-16 rounded-md border bg-white object-cover"
                  : "h-40 w-full rounded-md border bg-white object-contain")
              }
            />
          </a>
        )}
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <p className="text-xs font-medium text-stone-700">{label}</p>
            <p className="truncate text-xs text-muted-foreground">{fileName}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-7 text-xs")}
            >
              <ExternalLink className="mr-1.5 h-3 w-3" />
              Open full size
            </a>
            <a
              href={url}
              download={fileName}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-7 text-xs")}
            >
              <Download className="mr-1.5 h-3 w-3" />
              Download
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
