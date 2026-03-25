"use client";

import { useState } from "react";
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
  const [state, setState] = useState<FormState>("editing");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState("");

  const dateRange = startDate
    ? `${new Date(startDate).toLocaleDateString("en-US", { month: "long", day: "numeric" })}${endDate ? ` — ${new Date(endDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}` : ""}`
    : "";

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const data = Object.fromEntries(form);

    const newErrors: Record<string, string> = {};
    if (!data.name) newErrors.name = "Name is required";
    if (!data.email) newErrors.email = "Email is required";
    else if (!isValidEmail(data.email as string)) newErrors.email = "Email must be a valid email address";
    if (!data.talkTitle) newErrors.talkTitle = "Talk title is required";

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
        setServerError(json.error || "Submission failed");
        setState("error");
        return;
      }

      setState("success");
    } catch {
      setServerError("Network error. Please try again.");
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
              Application submitted!
            </h2>
            <p className="text-sm text-muted-foreground text-center">
              Thank you for your interest in speaking at {eventName}.
              You&apos;ll hear back from our team soon.
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
            Call for Speakers
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
                  <Label htmlFor="name">Full Name *</Label>
                  <Input
                    id="name"
                    name="name"
                    placeholder="Batbold Tumendelger"
                    aria-invalid={!!errors.name}
                  />
                  {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email *</Label>
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
                  <Label htmlFor="company">Company / Organization</Label>
                  <Input id="company" name="company" placeholder="DataMN Inc." />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="title">Job Title</Label>
                  <Input id="title" name="title" placeholder="Senior Engineer" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="talkTitle">Talk Title *</Label>
                <Input
                  id="talkTitle"
                  name="talkTitle"
                  placeholder="e.g., Building ML Pipelines in Mongolia"
                  aria-invalid={!!errors.talkTitle}
                />
                {errors.talkTitle && <p className="text-xs text-destructive">{errors.talkTitle}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="talkAbstract">Abstract</Label>
                <Textarea
                  id="talkAbstract"
                  name="talkAbstract"
                  rows={4}
                  placeholder="Describe your talk in 2-3 paragraphs..."
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Session Type</Label>
                  <Select name="talkType" defaultValue="talk">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="talk">Talk (30 min)</SelectItem>
                      <SelectItem value="workshop">Workshop (1-3 hrs)</SelectItem>
                      <SelectItem value="panel">Panel</SelectItem>
                      <SelectItem value="keynote">Keynote</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="trackPreference">Track Preference</Label>
                  <Input id="trackPreference" name="trackPreference" placeholder="e.g., Main Stage" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="bio">Speaker Bio</Label>
                <Textarea id="bio" name="bio" rows={3} placeholder="A short bio for the event website..." />
              </div>

              {serverError && (
                <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{serverError}</div>
              )}

              <Button type="submit" className="w-full" disabled={state === "submitting"}>
                {state === "submitting" ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...</>
                ) : (
                  "Submit Application"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
