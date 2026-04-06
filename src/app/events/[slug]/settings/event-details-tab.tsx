"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useEventContext } from "@/lib/event-context";
import { toast } from "sonner";
import { toastApiError } from "@/lib/toast-helpers";
import { useSmartT } from "@/lib/hooks/use-i18n-with-fallback";

type EditionData = {
  id: string;
  name: string;
  slug: string;
  startDate: string | null;
  endDate: string | null;
  venue: string | null;
  status: string;
  cfpOpen: boolean;
  timezone: string | null;
  agendaGapMinutes: number;
  agendaStartTime: string | null;
  agendaEndTime: string | null;
};

export function EventDetailsTab() {
  const event = useEventContext();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [edition, setEdition] = useState<EditionData | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [venue, setVenue] = useState("");
  const [timezone, setTimezone] = useState("Asia/Ulaanbaatar");
  const [status, setStatus] = useState("draft");
  const [cfpOpen, setCfpOpen] = useState(false);

  const tSmart = useSmartT("Common");

  const basicInfoText = tSmart("basicInformation", "Basic Information");
  const eventNameText = tSmart("eventName", "Event Name");

  useEffect(() => {
    fetch(`/api/editions/${event.editionId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.data) {
          const e = d.data as EditionData;
          setEdition(e);
          setName(e.name);
          setStartDate(
            e.startDate ? new Date(e.startDate).toISOString().slice(0, 10) : "",
          );
          setEndDate(
            e.endDate ? new Date(e.endDate).toISOString().slice(0, 10) : "",
          );
          setVenue(e.venue ?? "");
          setTimezone(e.timezone ?? "Asia/Ulaanbaatar");
          setStatus(e.status);
          setCfpOpen(e.cfpOpen);
        }
      })
      .catch(() => {
        toast.error("Failed to load edition data");
      })
      .finally(() => setLoading(false));
  }, [event.editionId]);

  const handleSave = async () => {
    setSaving(true);
    const res = await fetch(`/api/editions/${event.editionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        startDate: startDate || null,
        endDate: endDate || null,
        venue: venue || null,
        timezone,
        status,
        cfpOpen,
      }),
    });

    if (res.ok) {
      const d = await res.json();
      setEdition(d.data);
      toast.success("Event settings saved");
    } else {
      await toastApiError(res, "Failed to save settings");
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="space-y-3 max-w-xl">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-10 rounded-md bg-stone-100 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!edition) {
    return (
      <p className="text-sm text-muted-foreground">
        Could not load edition data.
      </p>
    );
  }

  return (
    <div className="max-w-xl space-y-6">
      {/* Basic Info */}
      <div className="space-y-4">
        <h2 className="text-lg font-medium">{basicInfoText}</h2>

        <div className="space-y-1.5">
          <Label htmlFor="event-name">{eventNameText}</Label>
          <Input
            id="event-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Event 2026"
          />
        </div>

        <div className="space-y-1.5">
          <Label>Slug</Label>
          <div className="rounded-md border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
            {edition.slug}
          </div>
          <p className="text-[11px] text-muted-foreground">
            The URL slug cannot be changed after creation.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="start-date">Start Date</Label>
            <Input
              id="start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="end-date">End Date</Label>
            <Input
              id="end-date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="venue">Venue</Label>
          <Input
            id="venue"
            value={venue}
            onChange={(e) => setVenue(e.target.value)}
            placeholder="Convention Center, City"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="timezone">Timezone</Label>
          <Input
            id="timezone"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            placeholder="Asia/Ulaanbaatar"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="status">Status</Label>
          <select
            id="status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
        </div>

        <div className="flex items-center gap-3 py-1">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={cfpOpen}
              onChange={(e) => setCfpOpen(e.target.checked)}
              className="rounded"
            />
            Call for Proposals open
          </label>
          <p className="text-[11px] text-muted-foreground">
            When enabled, speakers can submit proposals via the public CFP form.
          </p>
        </div>
      </div>

      {/* Save */}
      <div className="pt-2">
        <Button onClick={handleSave} disabled={saving || !name.trim()}>
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
            </>
          ) : (
            "Save Changes"
          )}
        </Button>
      </div>
    </div>
  );
}
