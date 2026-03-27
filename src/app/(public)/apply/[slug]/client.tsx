"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { formatDate } from "@/lib/i18n/date";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle2, Loader2 } from "lucide-react";
import { isValidEmail } from "@/lib/validation";

type FormState = "editing" | "submitting" | "success" | "error";

export function CFPFormClient({
  editionId,
  organizationId,
  eventName,
  startDate,
  endDate,
  venue,
}: {
  editionId: string;
  organizationId: string;
  eventName: string;
  startDate: string | null;
  endDate: string | null;
  venue: string | null;
}) {
  const t = useTranslations("CFP");
  const locale = useLocale();
  const [state, setState] = useState<FormState>("editing");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState("");

  const dateRange = startDate
    ? `${formatDate(startDate, locale, { month: "long", day: "numeric" })}${endDate ? ` — ${formatDate(endDate, locale, { month: "long", day: "numeric", year: "numeric" })}` : ""}`
    : "";

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const data = Object.fromEntries(form);

    const newErrors: Record<string, string> = {};
    if (!data.name) newErrors.name = t("nameRequired");
    if (!data.email) newErrors.email = t("emailRequired");
    else if (!isValidEmail(data.email as string)) newErrors.email = t("emailInvalid");
    if (!data.talkTitle) newErrors.talkTitle = t("talkTitleRequired");

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setState("submitting");
    setServerError("");

    try {
      const res = await fetch("/api/speakers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          editionId,
          organizationId,
          name: data.name,
          email: data.email,
          bio: data.bio || null,
          company: data.company || null,
          title: data.title || null,
          talkTitle: data.talkTitle,
          talkAbstract: data.talkAbstract || null,
          talkType: data.talkType || "talk",
          trackPreference: data.trackPreference || null,
        }),
      });

      if (!res.ok) {
        const json = await res.json();
        setServerError(json.error || t("submissionFailed"));
        setState("error");
        return;
      }

      setState("success");
    } catch {
      setServerError(t("networkError"));
      setState("error");
    }
  };

  if (state === "success") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <Card className="max-w-md w-full">
          <CardContent className="flex flex-col items-center py-12 px-6">
            <CheckCircle2 className="h-16 w-16 text-emerald-500 mb-4" />
            <h2 className="font-heading text-xl font-bold mb-2">
              {t("submitted")}
            </h2>
            <p className="text-sm text-muted-foreground text-center">
              {t("thankYou", { eventName })}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="mx-auto max-w-lg">
        <div className="mb-8 text-center">
          <h1 className="font-heading text-3xl font-bold tracking-tight mb-2">
            {t("title")}
          </h1>
          <p className="text-muted-foreground">
            {eventName}
            {dateRange && ` — ${dateRange}`}
            {venue && `, ${venue}`}
          </p>
        </div>

        <Card>
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="name">{t("fullName")}</Label>
                  <Input
                    id="name"
                    name="name"
                    placeholder="Batbold Tumendelger"
                    aria-invalid={!!errors.name}
                  />
                  {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">{t("email")}</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="batbold@example.com"
                    aria-invalid={!!errors.email}
                  />
                  {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="company">{t("company")}</Label>
                  <Input id="company" name="company" placeholder="DataMN Inc." />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="title">{t("jobTitle")}</Label>
                  <Input id="title" name="title" placeholder="Senior Engineer" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="talkTitle">{t("talkTitle")}</Label>
                <Input
                  id="talkTitle"
                  name="talkTitle"
                  placeholder="e.g., Building ML Pipelines in Mongolia"
                  aria-invalid={!!errors.talkTitle}
                />
                {errors.talkTitle && <p className="text-xs text-destructive">{errors.talkTitle}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="talkAbstract">{t("abstract")}</Label>
                <Textarea
                  id="talkAbstract"
                  name="talkAbstract"
                  rows={4}
                  placeholder={t("abstractPlaceholder")}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>{t("sessionType")}</Label>
                  <Select name="talkType" defaultValue="talk">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="talk">{t("typeTalk")}</SelectItem>
                      <SelectItem value="workshop">{t("typeWorkshop")}</SelectItem>
                      <SelectItem value="panel">{t("typePanel")}</SelectItem>
                      <SelectItem value="keynote">{t("typeKeynote")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="trackPreference">{t("trackPreference")}</Label>
                  <Input id="trackPreference" name="trackPreference" placeholder="e.g., Main Stage" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="bio">{t("speakerBio")}</Label>
                <Textarea id="bio" name="bio" rows={3} placeholder={t("bioPlaceholder")} />
              </div>

              {serverError && (
                <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{serverError}</div>
              )}

              <Button type="submit" className="w-full" disabled={state === "submitting"}>
                {state === "submitting" ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("submitting")}</>
                ) : (
                  t("submitApplication")
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
