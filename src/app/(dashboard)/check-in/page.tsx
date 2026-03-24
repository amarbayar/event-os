"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ScanLine,
  Monitor,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Wifi,
  WifiOff,
} from "lucide-react";

type CheckInMode = "scanner" | "dashboard";
type ScanResult = {
  status: "success" | "already" | "not_found" | "error";
  attendee?: {
    name: string;
    ticketType: string;
    checkedInAt?: string;
  };
  message: string;
};

// Mock data
const mockStats = {
  total: 500,
  checkedIn: 347,
  remaining: 153,
  percentage: 69,
};

const mockAttendees = [
  { name: "Oyungerel B.", ticketType: "VIP / Speaker", checkedIn: true, checkedInAt: "09:12" },
  { name: "Temuulen S.", ticketType: "Professional", checkedIn: false, checkedInAt: null },
  { name: "Munkhbayar D.", ticketType: "Student", checkedIn: true, checkedInAt: "09:08" },
  { name: "Enkhzul T.", ticketType: "Sponsor Rep", checkedIn: false, checkedInAt: null },
  { name: "Ganzorig M.", ticketType: "Professional", checkedIn: true, checkedInAt: "09:15" },
];

export default function CheckInPage() {
  const [mode, setMode] = useState<CheckInMode>("dashboard");
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isOnline, setIsOnline] = useState(true);
  const [queuedScans, setQueuedScans] = useState(0);
  const [stats, setStats] = useState(mockStats);

  // 5-second polling for stats
  useEffect(() => {
    if (mode !== "dashboard") return;
    const interval = setInterval(() => {
      // In production: fetch("/api/check-in/stats?editionId=...")
      setStats((prev) => ({ ...prev })); // re-render
    }, 5000);
    return () => clearInterval(interval);
  }, [mode]);

  // Online/offline detection
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const handleScan = useCallback((qrData: string) => {
    // Simulate scan result
    const isKnown = Math.random() > 0.2;
    if (!isKnown) {
      setScanResult({
        status: "not_found",
        message: "Attendee not found. Try searching by name.",
      });
    } else {
      setScanResult({
        status: "success",
        attendee: { name: "Oyungerel B.", ticketType: "VIP / Speaker" },
        message: "Checked in successfully!",
      });
    }
    // Clear result after 3 seconds
    setTimeout(() => setScanResult(null), 3000);
  }, []);

  const filteredAttendees = mockAttendees.filter((a) =>
    a.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Scanner Mode
  if (mode === "scanner") {
    return (
      <div className="fixed inset-0 z-50 bg-stone-900 flex flex-col">
        {/* Scanner header */}
        <div className="flex items-center justify-between px-4 py-3 bg-stone-950">
          <div className="flex items-center gap-3">
            <h1 className="text-white font-medium">QR Check-in</h1>
            {!isOnline && (
              <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                <WifiOff className="mr-1 h-3 w-3" />
                Offline — {queuedScans} queued
              </Badge>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="text-stone-300 border-stone-700 hover:bg-stone-800"
            onClick={() => setMode("dashboard")}
          >
            <Monitor className="mr-2 h-3 w-3" /> Dashboard
          </Button>
        </div>

        {/* Camera area */}
        <div className="flex-1 flex items-center justify-center">
          <div className="relative w-80 h-80 border-2 border-dashed border-stone-600 rounded-lg flex items-center justify-center">
            <p className="text-stone-500 text-sm">Camera preview</p>
            <div className="absolute inset-4 border-2 border-yellow-500/50 rounded" />
          </div>
        </div>

        {/* Scan result overlay */}
        {scanResult && (
          <div
            className={`absolute inset-x-0 top-20 mx-auto max-w-md rounded-lg p-6 text-center shadow-xl ${
              scanResult.status === "success"
                ? "bg-emerald-600 text-white"
                : scanResult.status === "already"
                  ? "bg-yellow-500 text-stone-900"
                  : "bg-red-600 text-white"
            }`}
          >
            {scanResult.status === "success" ? (
              <CheckCircle2 className="h-12 w-12 mx-auto mb-2" />
            ) : scanResult.status === "already" ? (
              <AlertTriangle className="h-12 w-12 mx-auto mb-2" />
            ) : (
              <XCircle className="h-12 w-12 mx-auto mb-2" />
            )}
            {scanResult.attendee && (
              <p className="text-xl font-bold">{scanResult.attendee.name}</p>
            )}
            <p className="text-sm opacity-90">{scanResult.message}</p>
            {scanResult.attendee && (
              <Badge className="mt-2 bg-white/20">
                {scanResult.attendee.ticketType}
              </Badge>
            )}
          </div>
        )}

        {/* Search fallback */}
        <div className="p-4 bg-stone-950">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-stone-500" />
            <Input
              placeholder="Search by name or email..."
              className="pl-9 bg-stone-800 border-stone-700 text-white placeholder:text-stone-500"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Quick test button for demo */}
        <div className="p-4 bg-stone-950 border-t border-stone-800">
          <Button
            className="w-full"
            onClick={() => handleScan("test-qr-hash")}
          >
            <ScanLine className="mr-2 h-4 w-4" /> Simulate Scan
          </Button>
        </div>
      </div>
    );
  }

  // Dashboard Mode
  return (
    <div>
      <div className="mb-6 space-y-3 sm:space-y-0 sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">
            Check-in
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-sm text-muted-foreground">
              Dev Summit 2026 — Day 1
            </p>
            {isOnline ? (
              <Badge variant="outline" className="text-emerald-600 border-emerald-200">
                <Wifi className="mr-1 h-3 w-3" /> Live
              </Badge>
            ) : (
              <Badge className="bg-yellow-500/20 text-yellow-700 border-yellow-300">
                <WifiOff className="mr-1 h-3 w-3" /> Offline
              </Badge>
            )}
          </div>
        </div>
        <Button onClick={() => setMode("scanner")}>
          <ScanLine className="mr-2 h-4 w-4" /> Open Scanner
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4 mb-6">
        {[
          { label: "Checked In", value: stats.checkedIn, color: "text-emerald-600" },
          { label: "Remaining", value: stats.remaining, color: "text-foreground" },
          { label: "Attendance", value: `${stats.percentage}%`, color: "text-foreground" },
          { label: "Avg Wait", value: "~2min", color: "text-foreground" },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4">
              <p className={`text-2xl font-semibold tabular-nums ${stat.color}`}>
                {stat.value}
              </p>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">
                {stat.label}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search attendees by name..."
          className="pl-9"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Attendee list */}
      <div className="space-y-1">
        {filteredAttendees.map((attendee, i) => (
          <div
            key={i}
            className="flex items-center justify-between rounded-md border px-4 py-3 hover:bg-accent/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">{attendee.name}</span>
              <Badge variant="outline" className="text-[10px]">
                {attendee.ticketType}
              </Badge>
            </div>
            <div>
              {attendee.checkedIn ? (
                <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                  {attendee.checkedInAt}
                </Badge>
              ) : (
                <span className="text-xs text-muted-foreground">
                  Not checked in
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
