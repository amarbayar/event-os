"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { Plus, Calendar, Send, X } from "lucide-react";

type CampaignStatus = "draft" | "scheduled" | "published" | "cancelled";

const statusConfig: Record<CampaignStatus, { label: string; color: string }> = {
  draft: { label: "Draft", color: "bg-stone-100 text-stone-600" },
  scheduled: { label: "Scheduled", color: "bg-yellow-50 text-yellow-700" },
  published: { label: "Published", color: "bg-emerald-50 text-emerald-700" },
  cancelled: { label: "Cancelled", color: "bg-red-50 text-red-600" },
};

const platformColors: Record<string, string> = {
  Twitter: "bg-sky-100 text-sky-700",
  Facebook: "bg-blue-100 text-blue-700",
  Instagram: "bg-pink-100 text-pink-700",
  LinkedIn: "bg-indigo-100 text-indigo-700",
  Telegram: "bg-cyan-100 text-cyan-700",
};

type Campaign = {
  id: string;
  title: string;
  type: string;
  platform: string | null;
  status: string;
  scheduledDate: Date | null;
  content: string | null;
  speakerId: string | null;
};

export function MarketingClient({ initialCampaigns }: { initialCampaigns: Campaign[] }) {
  const [filter, setFilter] = useState<CampaignStatus | "all">("all");
  const [showForm, setShowForm] = useState(false);

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const data = Object.fromEntries(form);
    await fetch("/api/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setShowForm(false);
    window.location.reload();
  };

  const campaigns = initialCampaigns;
  const filtered = filter === "all" ? campaigns : campaigns.filter((c) => c.status === filter);

  const counts = {
    total: campaigns.length,
    draft: campaigns.filter((c) => c.status === "draft").length,
    scheduled: campaigns.filter((c) => c.status === "scheduled").length,
    published: campaigns.filter((c) => c.status === "published").length,
  };

  return (
    <div>
      <div className="mb-6 space-y-3 sm:space-y-0 sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">Marketing</h1>
          <p className="text-sm text-muted-foreground">Social media campaigns and announcements</p>
        </div>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          {showForm ? <><X className="mr-2 h-3 w-3" /> Cancel</> : <><Plus className="mr-2 h-3 w-3" /> New Campaign</>}
        </Button>
      </div>

      {showForm && (
        <Card className="mb-6">
          <CardContent className="p-4">
            <form onSubmit={handleCreate} className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Title *</Label>
                  <Input name="title" placeholder="e.g., Speaker Spotlight: Sarah K." required />
                </div>
                <div className="space-y-1.5">
                  <Label>Type *</Label>
                  <Select name="type" defaultValue="speaker_announcement">
                    <SelectTrigger><SelectValue className="capitalize" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="speaker_announcement">Speaker Announcement</SelectItem>
                      <SelectItem value="sponsor_promo">Sponsor Promo</SelectItem>
                      <SelectItem value="event_update">Event Update</SelectItem>
                      <SelectItem value="social_post">Social Post</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Platform</Label>
                  <Select name="platform" defaultValue="twitter">
                    <SelectTrigger><SelectValue className="capitalize" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="twitter">Twitter/X</SelectItem>
                      <SelectItem value="facebook">Facebook</SelectItem>
                      <SelectItem value="instagram">Instagram</SelectItem>
                      <SelectItem value="linkedin">LinkedIn</SelectItem>
                      <SelectItem value="telegram">Telegram</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Scheduled Date</Label>
                  <Input name="scheduledDate" type="date" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Content</Label>
                <Textarea name="content" placeholder="Write the post content..." rows={3} />
              </div>
              <Button type="submit" className="w-full sm:w-auto">Create Campaign</Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4 mb-6">
        <Card><CardContent className="p-4"><p className="text-2xl font-semibold tabular-nums">{counts.total}</p><p className="text-xs text-muted-foreground">Campaigns</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-2xl font-semibold tabular-nums text-stone-500">{counts.draft}</p><p className="text-xs text-muted-foreground">Drafts</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-2xl font-semibold tabular-nums text-yellow-600">{counts.scheduled}</p><p className="text-xs text-muted-foreground">Scheduled</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-2xl font-semibold tabular-nums text-emerald-600">{counts.published}</p><p className="text-xs text-muted-foreground">Published</p></CardContent></Card>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {(["all", "draft", "scheduled", "published"] as const).map((status) => (
          <Button key={status} variant={filter === status ? "default" : "outline"} size="sm" onClick={() => setFilter(status)} className="capitalize">
            {status}
          </Button>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.map((campaign) => (
          <Card key={campaign.id} className="hover:border-yellow-500/30 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{campaign.title}</p>
                    <Badge className={statusConfig[campaign.status as CampaignStatus]?.color}>{statusConfig[campaign.status as CampaignStatus]?.label ?? campaign.status}</Badge>
                    {campaign.platform && <Badge className={platformColors[campaign.platform] || "bg-stone-100 text-stone-600"} variant="outline">{campaign.platform}</Badge>}
                  </div>
                  {campaign.content && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{campaign.content}</p>}
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                    {campaign.scheduledDate && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(campaign.scheduledDate).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {campaign.status === "draft" && (
                <div className="flex gap-2 mt-3 sm:justify-end">
                  <Button size="sm" variant="outline" className="flex-1 sm:flex-none">
                    <Calendar className="mr-2 h-3 w-3" /> Schedule
                  </Button>
                  <Button size="sm" className="flex-1 sm:flex-none">
                    <Send className="mr-2 h-3 w-3" /> Publish Now
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
