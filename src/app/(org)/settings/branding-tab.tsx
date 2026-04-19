/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect, useRef } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { FileUpload } from "@/components/file-upload";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { toastApiError } from "@/lib/toast-helpers";
import { applyBrandColor } from "@/lib/brand";
import { Loader2 } from "lucide-react";

type Org = {
  name: string;
  brandColor: string | null;
  logoUrl: string | null;
};

const BRAND_COLORS = [
  { value: "#eab308", label: "Yellow" },
  { value: "#0284c7", label: "Sky" },
  { value: "#047857", label: "Emerald" },
  { value: "#7c3aed", label: "Violet" },
  { value: "#e11d48", label: "Rose" },
  { value: "#ea580c", label: "Orange" },
  { value: "#1c1917", label: "Stone" },
];

export function BrandingTab() {
  const t = useTranslations("OrgSettings");
  const tc = useTranslations("Common");

  const [org, setOrg] = useState<Org | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [brandColor, setBrandColor] = useState("#eab308");
  const [logoUrl, setLogoUrl] = useState("");
  const savedColorRef = useRef("");

  useEffect(() => {
    if (brandColor) applyBrandColor(brandColor);
  }, [brandColor]);

  useEffect(() => {
    return () => {
      if (savedColorRef.current) applyBrandColor(savedColorRef.current);
    };
  }, []);

  useEffect(() => {
    fetch("/api/organizations")
      .then((r) => r.json())
      .then((d) => {
        if (d.data) {
          const o = d.data as Org;
          setOrg(o);
          const color = o.brandColor || "#eab308";
          setBrandColor(color);
          savedColorRef.current = color;
          setLogoUrl(o.logoUrl || "");
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const res = await fetch("/api/organizations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brandColor, logoUrl: logoUrl || null }),
    });
    if (res.ok) {
      savedColorRef.current = brandColor;
      toast.success(t("saved"));
    } else {
      await toastApiError(res, t("saveFailed"));
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="space-y-4 max-w-xl">
        {[1, 2].map((i) => <div key={i} className="h-14 rounded-md bg-stone-100 animate-pulse" />)}
      </div>
    );
  }

  if (!org) return null;

  const initials = org.name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

  return (
    <div className="max-w-xl space-y-6">
      {/* Logo */}
      <div>
        <Label className="mb-1.5">{t("logo")}</Label>
        <div className="flex gap-4 items-start">
          <div className="w-20 h-20 rounded-xl border-2 border-dashed border-stone-300 flex items-center justify-center overflow-hidden bg-stone-100 shrink-0">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
            ) : (
              <span className="text-2xl font-bold text-stone-400">{initials}</span>
            )}
          </div>
          <div className="flex-1">
            <p className="text-xs text-muted-foreground mb-2">{t("logoHint")}</p>
            <div className="flex gap-2">
              <FileUpload value={logoUrl} onChange={(url) => setLogoUrl(url)} folder="logos" label={t("upload")} />
              {logoUrl && (
                <Button size="sm" variant="outline" onClick={() => setLogoUrl("")} className="text-destructive">
                  {t("remove")}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Favicon preview */}
        <div className="flex items-center gap-4 mt-3 px-4 py-3 bg-stone-100 rounded-lg">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-t-lg border border-b-0 border-stone-200 text-xs text-stone-600">
            <div className="w-4 h-4 rounded-sm overflow-hidden flex-shrink-0 flex items-center justify-center" style={{ background: brandColor }}>
              {logoUrl ? (
                <img src={logoUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-[8px] font-bold text-white">{initials.charAt(0)}</span>
              )}
            </div>
            <span className="truncate max-w-[160px]">{org.name} — Event OS</span>
          </div>
          <span className="text-xs text-muted-foreground">{t("faviconPreview")}</span>
        </div>
      </div>

      {/* Brand Color */}
      <div>
        <Label className="mb-1.5">{t("brandColor")}</Label>
        <p className="text-xs text-muted-foreground mb-2">{t("brandColorDesc")}</p>
        <div className="flex gap-2 mb-2">
          {BRAND_COLORS.map((c) => (
            <button
              key={c.value}
              onClick={() => setBrandColor(c.value)}
              title={c.label}
              className="w-8 h-8 rounded-lg border-2 transition-transform hover:scale-110"
              style={{
                background: c.value,
                borderColor: brandColor === c.value ? "var(--foreground)" : "transparent",
                boxShadow: brandColor === c.value ? "0 0 0 2px var(--background), 0 0 0 4px var(--foreground)" : "none",
              }}
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={brandColor}
            onChange={(e) => setBrandColor(e.target.value)}
            className="w-8 h-8 rounded-lg border border-stone-200 cursor-pointer p-0"
          />
          <span className="text-xs text-muted-foreground font-mono">{brandColor}</span>
        </div>
      </div>

      {/* Save */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {tc("save")}...</> : tc("save")}
        </Button>
      </div>
    </div>
  );
}
