/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Upload, X, Loader2 } from "lucide-react";

type FileUploadProps = {
  value: string; // current URL
  onChange: (url: string) => void;
  folder?: string; // upload subfolder (e.g., "headshots")
  accept?: string; // file input accept attribute
  label?: string;
  preview?: boolean; // show image preview
};

export function FileUpload({
  value,
  onChange,
  folder = "general",
  accept = "image/*",
  label = "Upload",
  preview = true,
}: FileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File) => {
    setUploading(true);
    setError("");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("folder", folder);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const json = await res.json();
        setError(json.error || "Upload failed");
        setUploading(false);
        return;
      }

      const json = await res.json();
      onChange(json.data.url);
    } catch {
      setError("Upload failed. Try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  };

  return (
    <div className="space-y-2">
      {preview && value && (
        <div className="relative inline-block">
          <img
            src={value}
            alt="Upload preview"
            className="h-20 w-20 rounded-lg object-cover border border-stone-200"
          />
          <button
            onClick={() => onChange("")}
            className="absolute -top-1.5 -right-1.5 rounded-full bg-red-500 p-0.5 text-white hover:bg-red-600"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className="flex items-center gap-2"
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={handleFileSelect}
          className="hidden"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? (
            <><Loader2 className="mr-2 h-3 w-3 animate-spin" /> Uploading...</>
          ) : (
            <><Upload className="mr-2 h-3 w-3" /> {label}</>
          )}
        </Button>
        {value && !preview && (
          <span className="text-xs text-muted-foreground truncate max-w-[200px]">{value}</span>
        )}
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
