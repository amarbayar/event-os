"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, RefreshCw, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useConfirm } from "@/components/confirm-dialog";
import { getApiError } from "@/lib/validation";

type Track = {
  id: string;
  name: string;
  color: string | null;
  sortOrder: number;
};

const DEFAULT_COLOR = "#0ea5e9";

export function TracksTab() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ name: "", color: "#f59e0b", sortOrder: "0" });
  const { confirm } = useConfirm();

  const fetchTracks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/tracks");
      if (!res.ok) throw new Error(await getApiError(res, "Failed to load tracks"));
      const json = await res.json();
      setTracks(json.data || []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load tracks");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchTracks();
  }, [fetchTracks]);

  const updateTrack = (id: string, field: keyof Track, value: string | number | null) => {
    setTracks((current) =>
      current.map((track) => (track.id === id ? { ...track, [field]: value } : track)),
    );
  };

  const createTrack = async () => {
    const name = draft.name.trim();
    if (!name) {
      toast.error("Track name is required");
      return;
    }

    setSavingId("new");
    const res = await fetch("/api/tracks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        color: draft.color || DEFAULT_COLOR,
        sortOrder: Number.parseInt(draft.sortOrder, 10) || 0,
      }),
    });

    if (!res.ok) {
      toast.error(await getApiError(res, "Failed to create track"));
      setSavingId(null);
      return;
    }

    setDraft({ name: "", color: "#f59e0b", sortOrder: "0" });
    setSavingId(null);
    await fetchTracks();
  };

  const saveTrack = async (track: Track) => {
    setSavingId(track.id);
    const res = await fetch(`/api/tracks/${track.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: track.name,
        color: track.color || null,
        sortOrder: track.sortOrder,
      }),
    });

    if (!res.ok) {
      toast.error(await getApiError(res, "Failed to save track"));
      setSavingId(null);
      return;
    }

    setSavingId(null);
    await fetchTracks();
  };

  const deleteTrack = async (track: Track) => {
    const confirmed = await confirm({
      title: "Delete track",
      message: `Delete ${track.name}? Agenda sessions assigned to this track will stay on the agenda, but their track will be cleared.`,
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (!confirmed) return;

    setSavingId(track.id);
    const res = await fetch(`/api/tracks/${track.id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error(await getApiError(res, "Failed to delete track"));
      setSavingId(null);
      return;
    }

    setSavingId(null);
    await fetchTracks();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Tracks</h2>
        <p className="text-sm text-muted-foreground">
          Tracks are shared by Agenda and Speaker talk assignments. Add Sponsor here, then assign it from the speaker drawer or agenda editor.
        </p>
      </div>

      <div className="rounded-lg border">
        <div className="hidden grid-cols-[minmax(0,1fr)_150px_100px_96px] gap-3 border-b bg-stone-50 px-4 py-2 text-xs font-medium uppercase text-stone-500 sm:grid">
          <span>Name</span>
          <span>Color</span>
          <span>Order</span>
          <span className="text-right">Actions</span>
        </div>

        {tracks.map((track) => (
          <div key={track.id} className="grid grid-cols-1 gap-3 border-b px-4 py-3 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_150px_100px_96px] sm:items-center">
            <div className="space-y-1 sm:space-y-0">
              <Label className="text-xs text-muted-foreground sm:hidden">Name</Label>
              <Input
                value={track.name}
                onChange={(e) => updateTrack(track.id, "name", e.target.value)}
                aria-label={`${track.name} name`}
              />
            </div>
            <div className="flex items-center gap-2">
              <Label className="w-14 text-xs text-muted-foreground sm:hidden">Color</Label>
              <Input
                type="color"
                value={track.color || DEFAULT_COLOR}
                onChange={(e) => updateTrack(track.id, "color", e.target.value)}
                aria-label={`${track.name} color`}
                className="h-9 w-12 p-1"
              />
              <span className="min-w-0 text-xs tabular-nums text-muted-foreground">{track.color || DEFAULT_COLOR}</span>
            </div>
            <div className="space-y-1 sm:space-y-0">
              <Label className="text-xs text-muted-foreground sm:hidden">Order</Label>
              <Input
                type="number"
                value={track.sortOrder}
                onChange={(e) => updateTrack(track.id, "sortOrder", Number.parseInt(e.target.value, 10) || 0)}
                aria-label={`${track.name} sort order`}
              />
            </div>
            <div className="flex justify-end gap-1 sm:justify-end">
              <Button size="icon" variant="outline" onClick={() => saveTrack(track)} disabled={savingId === track.id} title="Save track">
                <Save className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="outline" onClick={() => deleteTrack(track)} disabled={savingId === track.id} title="Delete track">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}

        {tracks.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            {loading ? "Loading tracks..." : "No tracks yet."}
          </div>
        )}
      </div>

      <div className="rounded-lg border p-4">
        <h3 className="mb-3 text-sm font-medium">Add Track</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_120px_100px_auto] sm:items-end">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input
              value={draft.name}
              onChange={(e) => setDraft((current) => ({ ...current, name: e.target.value }))}
              placeholder="Sponsor"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Color</Label>
            <Input
              type="color"
              value={draft.color}
              onChange={(e) => setDraft((current) => ({ ...current, color: e.target.value }))}
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Order</Label>
            <Input
              type="number"
              value={draft.sortOrder}
              onChange={(e) => setDraft((current) => ({ ...current, sortOrder: e.target.value }))}
            />
          </div>
          <Button onClick={createTrack} disabled={savingId === "new"}>
            <Plus className="mr-2 h-4 w-4" />
            Add
          </Button>
        </div>
      </div>

      <Button variant="outline" onClick={fetchTracks} disabled={loading}>
        <RefreshCw className="mr-2 h-4 w-4" />
        Refresh
      </Button>
    </div>
  );
}
