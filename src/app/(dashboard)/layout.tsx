"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { ChatPanel } from "@/components/chat-panel";
import { ConfirmProvider } from "@/components/confirm-dialog";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [chatOpen, setChatOpen] = useState(false);
  const [checked, setChecked] = useState(false);
  const router = useRouter();

  const toggleChat = useCallback(() => setChatOpen((prev) => !prev), []);

  // Stakeholder guard: redirect stakeholders to /portal
  useEffect(() => {
    fetch("/api/portal/me")
      .then((r) => {
        if (r.ok) {
          // User is a stakeholder — redirect to portal
          router.replace("/portal");
        } else {
          setChecked(true);
        }
      })
      .catch(() => setChecked(true));
  }, [router]);

  if (!checked) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  // Cmd+K listener lives here — always mounted, regardless of panel state
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        toggleChat();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [toggleChat]);

  return (
    <ConfirmProvider>
    <div className="min-h-screen bg-background">
      <Sidebar onToggleChat={toggleChat} />
      <main
        className={`min-h-screen pt-14 pb-16 lg:pt-0 lg:pb-0 lg:ml-56 transition-all duration-200 ${
          chatOpen ? "lg:mr-[400px]" : ""
        }`}
      >
        <div className="mx-auto max-w-6xl px-4 py-4 lg:px-6 lg:py-6">
          {children}
        </div>
      </main>
      <ChatPanel isOpen={chatOpen} onClose={() => setChatOpen(false)} />
    </div>
    </ConfirmProvider>
  );
}
