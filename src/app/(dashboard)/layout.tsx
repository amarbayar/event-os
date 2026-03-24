"use client";

import { useState } from "react";
import { Sidebar } from "@/components/sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [chatOpen, setChatOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar onToggleChat={() => setChatOpen(!chatOpen)} />
      <main className="min-h-screen pt-14 pb-16 lg:pt-0 lg:pb-0 lg:ml-56 transition-all duration-200">
        <div className="mx-auto max-w-6xl px-4 py-4 lg:px-6 lg:py-6">
          {children}
        </div>
      </main>
    </div>
  );
}
