"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { UserPlus } from "lucide-react";

export function PortalInviteSection({
  entityType,
  entityId,
  entityEmail,
}: {
  entityType: string;
  entityId: string;
  entityEmail: string;
}) {
  const [status, setStatus] = useState<"checking" | "idle" | "loading" | "invited" | "already" | "error">("checking");
  const [showConfirm, setShowConfirm] = useState(false);
  const [inviteInfo, setInviteInfo] = useState<{ email: string; password?: string; resent?: boolean } | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    fetch(`/api/portal/status?entityType=${entityType}&entityId=${entityId}`)
      .then((r) => r.json())
      .then((d) => { setStatus(d.data?.invited ? "already" : "idle"); })
      .catch(() => setStatus("idle"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleInvite = async () => {
    setStatus("loading");
    setErrorMessage("");
    const res = await fetch("/api/portal/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entityType, entityId, resend: status === "already" }),
    });
    const data = await res.json();
    if (res.ok) {
      if (data.data.alreadyInvited && !data.data.resent) {
        setStatus("already");
      } else {
        setInviteInfo({
          email: entityEmail,
          password: data.data.tempPassword,
          resent: !!data.data.resent,
        });
        setStatus("invited");
      }
    } else {
      setStatus("error");
      setErrorMessage(data.error || t("inviteFailed"));
    }
    setShowConfirm(false);
  };
  const t = useTranslations("Portal");
  const tC = useTranslations("Common");

  return (
    <div className="pt-4 border-t space-y-2">
      <Label className="text-xs text-muted-foreground uppercase tracking-wider">{t("title")}</Label>

      {status === "already" && (
        <div className="rounded-md bg-sky-50 px-3 py-2 text-xs text-sky-700">
          {t("alreadyInvited", { email: entityEmail })}
          <Button size="sm" variant="outline" className="h-6 text-[10px] ml-2" onClick={() => setShowConfirm(true)}>
            {t("resendInvite")}
          </Button>
        </div>
      )}

      {status === "invited" && inviteInfo && (
        <div className="rounded-md bg-emerald-50 px-3 py-2 space-y-1">
          <p className="text-xs font-medium text-emerald-800">
            {inviteInfo.resent ? t("inviteResent") : t("inviteCreated")}
          </p>
          <p className="text-xs text-emerald-700">{t("inviteEmail", { email: inviteInfo.email })}</p>
          {inviteInfo.password ? (
            <>
              <p className="text-xs text-emerald-700">{t("invitePassword", { password: inviteInfo.password })}</p>
              <p className="text-xs text-emerald-600">{t("shareCredentials")}</p>
            </>
          ) : (
            <p className="text-xs text-emerald-600">{t("checkInbox")}</p>
          )}
        </div>
      )}

      {status === "error" && (
        <p className="text-xs text-red-600">{errorMessage || t("inviteFailed")}</p>
      )}

      {showConfirm && (
        <div className="rounded-md border p-3 space-y-2">
          <p className="text-xs text-stone-600">
            {t.rich("inviteExplainer", { email: entityEmail, strong: (chunks) => <strong>{chunks}</strong> })}
          </p>
          <div className="flex gap-2">
            <Button size="sm" className="h-7 text-xs" onClick={handleInvite} disabled={status === "loading"}>
              {status === "loading" ? t("inviting") : t("confirmInvite")}
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowConfirm(false)}>
              {tC("cancel")}
            </Button>
          </div>
        </div>
      )}

      {status === "idle" && !showConfirm && (
        <Button size="sm" className="w-full" onClick={() => setShowConfirm(true)}>
          <UserPlus className="mr-2 h-3 w-3" /> {t("inviteToPortal")}
        </Button>
      )}
    </div>
  );
}
