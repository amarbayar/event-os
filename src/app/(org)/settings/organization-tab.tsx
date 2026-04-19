/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { FileUpload } from "@/components/file-upload";
import { useConfirm } from "@/components/confirm-dialog";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { toastApiError } from "@/lib/toast-helpers";
import { applyBrandColor } from "@/lib/brand";
import { Loader2 } from "lucide-react";

type Org = {
  id: string;
  name: string;
  slug: string;
  contactEmail: string | null;
  website: string | null;
  brandColor: string | null;
  logoUrl: string | null;
};

type OrgUser = { id: string; name: string | null; email: string; role: string };

const BRAND_COLORS = [
  { value: "#eab308", label: "Yellow" },
  { value: "#0284c7", label: "Sky" },
  { value: "#047857", label: "Emerald" },
  { value: "#7c3aed", label: "Violet" },
  { value: "#e11d48", label: "Rose" },
  { value: "#ea580c", label: "Orange" },
  { value: "#1c1917", label: "Stone" },
];

export function OrganizationTab() {
  const t = useTranslations("OrgSettings");
  const tc = useTranslations("Common");
  const { confirm } = useConfirm();

  const [org, setOrg] = useState<Org | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userRole, setUserRole] = useState("viewer");

  // Form state
  const [name, setName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [brandColor, setBrandColor] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const savedColorRef = useRef("");

  // Live-preview brand color — skip until org data has loaded
  useEffect(() => {
    if (!brandColor) return;
    applyBrandColor(brandColor);
  }, [brandColor]);

  // Restore saved color if user navigates away without saving
  useEffect(() => {
    return () => {
      if (savedColorRef.current) applyBrandColor(savedColorRef.current);
    };
  }, []);

  // Danger zone state
  const [members, setMembers] = useState<OrgUser[]>([]);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  const isOwner = userRole === "owner";
  const isAdmin = userRole === "owner" || userRole === "admin";

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => { if (d.data?.role) setUserRole(d.data.role); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/organizations")
      .then((r) => r.json())
      .then((d) => {
        if (d.data) {
          const o = d.data as Org;
          setOrg(o);
          setName(o.name);
          setContactEmail(o.contactEmail || "");
          setWebsite(o.website || "");
          const color = o.brandColor || "#eab308";
          setBrandColor(color);
          savedColorRef.current = color;
          setLogoUrl(o.logoUrl || "");
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    if (isOwner) {
      fetch("/api/users")
        .then((r) => r.json())
        .then((d) => { if (d.data) setMembers(d.data); })
        .catch(() => {});
    }
  }, [isOwner]);

  const handleSave = async () => {
    setSaving(true);
    const res = await fetch("/api/organizations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, contactEmail: contactEmail || null, website: website || null, brandColor, logoUrl: logoUrl || null }),
    });
    if (res.ok) {
      const d = await res.json();
      setOrg(d.data);
      savedColorRef.current = brandColor;
      toast.success(t("saved"));
    } else {
      await toastApiError(res, t("saveFailed"));
    }
    setSaving(false);
  };

  const handleTransfer = async (newOwnerId: string, newOwnerName: string) => {
    const confirmed = await confirm({
      title: t("transferTitle"),
      message: t("transferConfirm", { name: org?.name || "", newOwner: newOwnerName }),
      confirmLabel: t("transferButton"),
      variant: "danger",
    });
    if (!confirmed) return;

    setTransferring(true);
    const res = await fetch("/api/organizations/transfer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newOwnerId }),
    });
    if (res.ok) {
      toast.success(t("transferDone"));
      window.location.reload();
    } else {
      await toastApiError(res, t("saveFailed"));
    }
    setTransferring(false);
  };

  const handleDelete = async () => {
    setDeleting(true);
    const res = await fetch("/api/organizations/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmName: deleteConfirmName }),
    });
    if (res.ok) {
      window.location.href = "/login";
    } else {
      await toastApiError(res, t("deleteFailed"));
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 max-w-xl">
        {[1, 2, 3].map((i) => <div key={i} className="h-14 rounded-md bg-stone-100 animate-pulse" />)}
      </div>
    );
  }

  if (!org) return null;

  const initials = org.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="max-w-xl space-y-8">
      {/* ── Branding ── */}
      <section>
        <h2 className="text-base font-semibold mb-1">{t("branding")}</h2>
        <p className="text-sm text-muted-foreground mb-4">{t("brandingDesc")}</p>

        <div className="space-y-4">
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
                  <FileUpload
                    value={logoUrl}
                    onChange={(url) => setLogoUrl(url)}
                    folder="logos"
                    label={t("upload")}
                  />
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
        </div>
      </section>

      <hr className="border-stone-200" />

      {/* ── General ── */}
      <section>
        <h2 className="text-base font-semibold mb-1">{t("general")}</h2>
        <p className="text-sm text-muted-foreground mb-4">{t("generalDesc")}</p>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t("orgName")}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} disabled={!isAdmin} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>{t("contactEmail")}</Label>
              <Input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="hello@example.com"
                disabled={!isAdmin}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("website")}</Label>
              <Input
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://example.com"
                disabled={!isAdmin}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Save */}
      {isAdmin && (
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => {
            if (org) {
              setName(org.name);
              setContactEmail(org.contactEmail || "");
              setWebsite(org.website || "");
              setBrandColor(org.brandColor || "#eab308");
              setLogoUrl(org.logoUrl || "");
            }
          }}>
            {tc("cancel")}
          </Button>
          <Button onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {tc("save")}...</> : tc("save")}
          </Button>
        </div>
      )}

      {/* ── Danger Zone ── */}
      {isOwner && (
        <section className="pt-6 border-t border-red-200">
          <h2 className="text-base font-semibold text-destructive mb-1">{t("dangerZone")}</h2>
          <p className="text-sm text-muted-foreground mb-4">{t("dangerZoneDesc")}</p>

          {/* Transfer Ownership */}
          <div className="flex items-center justify-between px-4 py-3 border border-red-200 rounded-lg mb-2">
            <div>
              <p className="text-sm font-medium">{t("transferOwnership")}</p>
              <p className="text-xs text-muted-foreground">{t("transferDesc")}</p>
            </div>
            <div className="relative">
              <select
                className="rounded-md border border-stone-200 bg-white px-3 py-1.5 text-xs cursor-pointer"
                defaultValue=""
                disabled={transferring}
                onChange={(e) => {
                  const userId = e.target.value;
                  const user = members.find((m) => m.id === userId);
                  if (user) handleTransfer(userId, user.name || user.email);
                  e.target.value = "";
                }}
              >
                <option value="" disabled>{t("transferButton")}</option>
                {members
                  .filter((m) => m.role !== "owner")
                  .map((m) => (
                    <option key={m.id} value={m.id}>{m.name || m.email} ({m.role})</option>
                  ))}
              </select>
            </div>
          </div>

          {/* Delete Organization */}
          <div className="px-4 py-3 border border-red-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{t("deleteOrg")}</p>
                <p className="text-xs text-muted-foreground">{t("deleteDesc")}</p>
              </div>
              {!showDelete && (
                <Button size="sm" variant="destructive" onClick={() => setShowDelete(true)}>
                  {t("deleteButton")}
                </Button>
              )}
            </div>

            {showDelete && (
              <div className="mt-3 pt-3 border-t border-red-200 space-y-3">
                <p className="text-xs text-stone-600">{t("deleteMessage")}</p>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t("typeToConfirm", { name: org.name })}</Label>
                  <Input
                    value={deleteConfirmName}
                    onChange={(e) => setDeleteConfirmName(e.target.value)}
                    placeholder={org.name}
                    autoFocus
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={handleDelete}
                    disabled={deleteConfirmName !== org.name || deleting}
                  >
                    {deleting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("deleteButton")}</> : t("deleteButton")}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { setShowDelete(false); setDeleteConfirmName(""); }}>
                    {tc("cancel")}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
