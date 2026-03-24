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
import { CheckCircle2 } from "lucide-react";

type FormState = "editing" | "submitting" | "success" | "error";

export default function CFPPage() {
  const [state, setState] = useState<FormState>("editing");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const data = Object.fromEntries(form);

    // Client-side validation
    const newErrors: Record<string, string> = {};
    if (!data.name) newErrors.name = "Name is required";
    if (!data.email) newErrors.email = "Email is required";
    if (!data.talkTitle) newErrors.talkTitle = "Talk title is required";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setState("submitting");
    // In production, this would POST to /api/speakers
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setState("success");
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
              Thank you for your interest in speaking at Dev Summit 2026.
              You&apos;ll hear back from our team by March 15.
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
            Dev Summit 2026 — March 28-29, Ulaanbaatar
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
                    className={errors.name ? "border-red-500" : ""}
                  />
                  {errors.name && (
                    <p className="text-xs text-red-600">{errors.name}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="batbold@example.com"
                    className={errors.email ? "border-red-500" : ""}
                  />
                  {errors.email && (
                    <p className="text-xs text-red-600">{errors.email}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="company">Company / Organization</Label>
                  <Input
                    id="company"
                    name="company"
                    placeholder="DataMN Inc."
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="title">Job Title</Label>
                  <Input
                    id="title"
                    name="title"
                    placeholder="Senior Engineer"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="talkTitle">Talk Title *</Label>
                <Input
                  id="talkTitle"
                  name="talkTitle"
                  placeholder="e.g., Building ML Pipelines in Mongolia"
                  className={errors.talkTitle ? "border-red-500" : ""}
                />
                {errors.talkTitle && (
                  <p className="text-xs text-red-600">{errors.talkTitle}</p>
                )}
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
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="talk">Talk (30 min)</SelectItem>
                      <SelectItem value="workshop">
                        Workshop (1-3 hrs)
                      </SelectItem>
                      <SelectItem value="panel">Panel</SelectItem>
                      <SelectItem value="keynote">Keynote</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="trackPreference">Track Preference</Label>
                  <Input
                    id="trackPreference"
                    name="trackPreference"
                    placeholder="e.g., Main Stage"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="bio">Speaker Bio</Label>
                <Textarea
                  id="bio"
                  name="bio"
                  rows={3}
                  placeholder="A short bio for the event website..."
                />
              </div>

              {state === "error" && (
                <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                  Submission failed. Please try again.
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={state === "submitting"}
              >
                {state === "submitting"
                  ? "Submitting..."
                  : "Submit Application"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
