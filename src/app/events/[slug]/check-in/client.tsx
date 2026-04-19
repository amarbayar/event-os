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

type CheckInStats = {
  total: number;
  checkedIn: number;
  remaining: number;
  percentage: number;
};

type Attendee = {
  id: string;
  name: string;
  ticketType: string;
  checkedIn: boolean;
  checkedInAt: Date | null;
};

export function CheckInClient({ initialStats, initialAttendees }: { initialStats: CheckInStats; initialAttendees: Attendee[] }) {
  const [mode, setMode] = useState<CheckInMode>("dashboard");
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isOnline, setIsOnline] = useState(true);
  const [stats, setStats] = useState(initialStats);

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
    void qrData;
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

  const filteredAttendees = initialAttendees.filter((a) =>
    a.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Scanner Mode
  if (mode === "scanner") {
    return (
      <div className="fixed inset-0 z-50 bg-stone-900 flex flex-col">
        {/* Scanner header — prominent back button + live stats */}
        <div className="flex items-center justify-between px-4 py-2 bg-stone-950 border-b border-stone-800">
          <Button
            size="sm"
            variant="secondary"
            className="bg-white text-stone-900 hover:bg-stone-100 font-medium"
            onClick={() => setMode("dashboard")}
          >
            <Monitor className="mr-2 h-4 w-4" /> Back to Dashboard
          </Button>
          <div className="flex items-center gap-4 text-sm">
            <div className="text-center">
              <p className="text-lg font-bold text-emerald-400 tabular-nums">{stats.checkedIn}</p>
              <p className="text-[10px] text-stone-500 uppercase">In</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-white tabular-nums">{stats.remaining}</p>
              <p className="text-[10px] text-stone-500 uppercase">Left</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-yellow-400 tabular-nums">{stats.percentage}%</p>
              <p className="text-[10px] text-stone-500 uppercase">Rate</p>
            </div>
            {!isOnline && (
              <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                <WifiOff className="mr-1 h-3 w-3" />
                Offline
              </Badge>
            )}
          </div>
        </div>

        {/* Camera area — larger */}
        <div className="flex-1 flex items-center justify-center relative">
          <div className="w-[90vw] max-w-lg aspect-square border-2 border-dashed border-stone-600 rounded-2xl flex items-center justify-center">
            <p className="text-stone-500 text-sm">Point camera at QR code</p>
            <div className="absolute inset-[15%] border-2 border-yellow-500/40 rounded-lg" />
          </div>

          {/* Scan result overlay */}
          {scanResult && (
            <div
              className={`absolute inset-x-4 top-4 mx-auto max-w-md rounded-xl p-6 text-center shadow-2xl ${
                scanResult.status === "success"
                  ? "bg-emerald-600 text-white"
                  : scanResult.status === "already"
                    ? "bg-yellow-500 text-stone-900"
                    : "bg-red-600 text-white"
              }`}
            >
              {scanResult.status === "success" ? (
                <CheckCircle2 className="h-16 w-16 mx-auto mb-3" />
              ) : scanResult.status === "already" ? (
                <AlertTriangle className="h-16 w-16 mx-auto mb-3" />
              ) : (
                <XCircle className="h-16 w-16 mx-auto mb-3" />
              )}
              {scanResult.attendee && (
                <p className="text-2xl font-bold">{scanResult.attendee.name}</p>
              )}
              <p className="text-base opacity-90 mt-1">{scanResult.message}</p>
              {scanResult.attendee && (
                <Badge className="mt-3 bg-white/20 text-sm px-3 py-1">
                  {scanResult.attendee.ticketType}
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* Bottom bar — search + simulate */}
        <div className="bg-stone-950 border-t border-stone-800 p-3 space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-stone-500" />
            <Input
              placeholder="Search by name if QR fails..."
              className="pl-9 bg-stone-800 border-stone-700 text-white placeholder:text-stone-500"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button
            className="w-full"
            variant="outline"
            size="sm"
            onClick={() => handleScan("test-qr-hash")}
          >
            <ScanLine className="mr-2 h-4 w-4" /> Simulate Scan (Demo)
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
        {filteredAttendees.map((attendee) => (
          <div
            key={attendee.id}
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
                  {attendee.checkedInAt
                    ? new Date(attendee.checkedInAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })
                    : "Checked in"}
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
