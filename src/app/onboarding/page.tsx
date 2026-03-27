"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, ArrowRight, ArrowLeft, Loader2 } from "lucide-react";

type Step = "org" | "event" | "account" | "done";

export default function OnboardingPage() {
  const t = useTranslations("Onboarding");
  const [step, setStep] = useState<Step>("org");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Form state
  const [orgName, setOrgName] = useState("");
  const [eventName, setEventName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [venue, setVenue] = useState("");
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userPassword, setUserPassword] = useState("");

  const handleSubmit = async () => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgName,
          eventName,
          startDate: startDate || null,
          endDate: endDate || null,
          venue: venue || null,
          userName,
          userEmail,
          userPassword,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || t("somethingWrong"));
        setLoading(false);
        return;
      }

      setStep("done");
    } catch {
      setError(t("failedToCreate"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="font-heading text-3xl font-bold tracking-tight">
            Event OS
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("setupTitle")}
          </p>
        </div>

        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {(["org", "event", "account"] as const).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium transition-colors ${
                  step === s
                    ? "bg-yellow-500 text-stone-900"
                    : step === "done" || (["org", "event", "account"].indexOf(step) > i)
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-stone-100 text-stone-400"
                }`}
              >
                {step === "done" || ["org", "event", "account"].indexOf(step) > i ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  i + 1
                )}
              </div>
              {i < 2 && (
                <div className={`h-px w-8 ${["org", "event", "account"].indexOf(step) > i || step === "done" ? "bg-emerald-300" : "bg-stone-200"}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step: Organization */}
        {step === "org" && (
          <Card>
            <CardContent className="p-6 space-y-4">
              <div>
                <h2 className="font-heading text-lg font-semibold">{t("orgTitle")}</h2>
                <p className="text-sm text-muted-foreground">{t("orgDescription")}</p>
              </div>
              <div className="space-y-1.5">
                <Label>{t("orgNameLabel")}</Label>
                <Input
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder={t("orgNamePlaceholder")}
                  autoFocus
                />
              </div>
              <Button
                className="w-full"
                disabled={!orgName.trim()}
                onClick={() => setStep("event")}
              >
                {t("next")} <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step: Event */}
        {step === "event" && (
          <Card>
            <CardContent className="p-6 space-y-4">
              <div>
                <h2 className="font-heading text-lg font-semibold">{t("eventTitle")}</h2>
                <p className="text-sm text-muted-foreground">{t("eventDescription")}</p>
              </div>
              <div className="space-y-1.5">
                <Label>{t("eventNameLabel")}</Label>
                <Input
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  placeholder={t("eventNamePlaceholder")}
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>{t("startDate")}</Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("endDate")}</Label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>{t("venue")}</Label>
                <Input
                  value={venue}
                  onChange={(e) => setVenue(e.target.value)}
                  placeholder={t("venuePlaceholder")}
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep("org")}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> {t("back")}
                </Button>
                <Button
                  className="flex-1"
                  disabled={!eventName.trim()}
                  onClick={() => setStep("account")}
                >
                  {t("next")} <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step: Account */}
        {step === "account" && (
          <Card>
            <CardContent className="p-6 space-y-4">
              <div>
                <h2 className="font-heading text-lg font-semibold">{t("accountTitle")}</h2>
                <p className="text-sm text-muted-foreground">{t("accountDescription")}</p>
              </div>
              <div className="space-y-1.5">
                <Label>{t("yourName")}</Label>
                <Input
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder={t("namePlaceholder")}
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("emailLabel")}</Label>
                <Input
                  type="email"
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  placeholder={t("emailPlaceholder")}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("passwordLabel")}</Label>
                <Input
                  type="password"
                  value={userPassword}
                  onChange={(e) => setUserPassword(e.target.value)}
                  placeholder={t("passwordPlaceholder")}
                />
              </div>
              {error && (
                <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              )}
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep("event")}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> {t("back")}
                </Button>
                <Button
                  className="flex-1"
                  disabled={!userEmail.trim() || !userPassword.trim() || loading}
                  onClick={handleSubmit}
                >
                  {loading ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("creating")}</>
                  ) : (
                    t("createWorkspace")
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step: Done */}
        {step === "done" && (
          <Card>
            <CardContent className="flex flex-col items-center py-12 px-6">
              <CheckCircle2 className="h-16 w-16 text-emerald-500 mb-4" />
              <h2 className="font-heading text-xl font-bold mb-2">
                {t("doneTitle")}
              </h2>
              <p className="text-sm text-muted-foreground text-center mb-6">
                {t.rich("doneDescription", { eventName, strong: (chunks) => <strong>{chunks}</strong> })}
              </p>
              <Button className="w-full" onClick={() => window.location.href = "/"}>
                {t("goToDashboard")}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
