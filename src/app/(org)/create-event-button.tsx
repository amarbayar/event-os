"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, X, Loader2 } from "lucide-react";

export function CreateEventButton() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [venue, setVenue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const backdropRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setError("");
    setName("");
    setStartDate("");
    setEndDate("");
    setVenue("");
  }, []);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [close, open]);

  const handleCreate = async () => {
    if (!name.trim()) {
      setError("Event name is required");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/editions/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          venue: venue.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to create event");
        setLoading(false);
        return;
      }

      const { data } = await res.json();

      await fetch("/api/editions/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ editionId: data.id }),
      });

      router.push(`/events/${data.slug}`);
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  return (
    <>
      <Button onClick={() => setOpen(true)} size="sm">
        <Plus className="h-4 w-4 mr-1.5" />
        Create Event
      </Button>

      {open && (
        <div
          ref={backdropRef}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={(e) => { if (e.target === backdropRef.current) close(); }}
        >
          <div className="w-full max-w-md rounded-lg border bg-background p-6 shadow-lg space-y-4 mx-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">Create New Event</h3>
              <button
                onClick={close}
                className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <Label htmlFor="event-name" className="text-xs">Event Name</Label>
                <Input
                  id="event-name"
                  placeholder="e.g., Dev Summit 2027"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="start-date" className="text-xs">Start Date</Label>
                  <Input id="start-date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="end-date" className="text-xs">End Date</Label>
                  <Input id="end-date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </div>
              </div>

              <div>
                <Label htmlFor="venue" className="text-xs">Venue (optional)</Label>
                <Input id="venue" placeholder="e.g., Blue Sky Tower, Ulaanbaatar" value={venue} onChange={(e) => setVenue(e.target.value)} />
              </div>
            </div>

            {error && <p className="text-xs text-red-600">{error}</p>}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={close} disabled={loading}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleCreate} disabled={loading}>
                {loading ? (
                  <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Creating...</>
                ) : (
                  "Create Event"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
