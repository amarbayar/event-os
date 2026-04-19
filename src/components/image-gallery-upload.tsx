/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Upload, X, Loader2 } from "lucide-react";

type ImageGalleryUploadProps = {
  images: string[];
  onChange: (urls: string[]) => void;
  folder: string;
  label?: string;
  maxImages?: number;
};

export function ImageGalleryUpload({
  images,
  onChange,
  folder,
  label = "Upload Images",
  maxImages = 20,
}: ImageGalleryUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (files: FileList) => {
    setUploading(true);
    setError("");
    const newUrls: string[] = [];

    for (const file of Array.from(files)) {
      if (images.length + newUrls.length >= maxImages) break;

      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", folder);

      try {
        const res = await fetch("/api/upload", { method: "POST", body: formData });
        if (res.ok) {
          const json = await res.json();
          newUrls.push(json.data.url);
        }
      } catch {
        setError("Some uploads failed.");
      }
    }

    onChange([...images, ...newUrls]);
    setUploading(false);
  };

  const removeImage = (index: number) => {
    onChange(images.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      {images.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {images.map((url, i) => (
            <div key={i} className="relative group">
              <img src={url} alt="" className="h-16 w-full rounded object-cover border border-stone-200" />
              <button
                onClick={() => removeImage(i)}
                className="absolute -top-1.5 -right-1.5 rounded-full bg-red-500 p-0.5 text-white opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => e.target.files && handleUpload(e.target.files)}
        className="hidden"
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => inputRef.current?.click()}
        disabled={uploading || images.length >= maxImages}
      >
        {uploading ? (
          <><Loader2 className="mr-2 h-3 w-3 animate-spin" /> Uploading...</>
        ) : (
          <><Upload className="mr-2 h-3 w-3" /> {label} ({images.length}/{maxImages})</>
        )}
      </Button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
