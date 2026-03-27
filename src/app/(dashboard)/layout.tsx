"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { ChatPanel } from "@/components/chat-panel";
import { ConfirmProvider } from "@/components/confirm-dialog";

function DynamicFavicon() {
  useEffect(() => {
    fetch("/api/organizations")
      .then((r) => r.json())
      .then((d) => {
        const logoUrl = d.data?.logoUrl;
        if (logoUrl) {
          let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null;
          if (!link) {
            link = document.createElement("link");
            link.rel = "icon";
            document.head.appendChild(link);
          }
          link.href = logoUrl;
        }
      })
      .catch(() => {});
  }, []);
  return null;
}

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
          router.replace("/portal");
        } else {
          setChecked(true);
        }
      })
      .catch(() => setChecked(true));
  }, [router]);

  // Cmd+K listener — always mounted, regardless of panel state
  useEffect(() => {
    if (!checked) return; // don't bind until ready
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        toggleChat();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [toggleChat, checked]);

  if (!checked) {
    return (
      <div className="min-h-screen bg-background">
        <aside className="fixed inset-y-0 left-0 hidden lg:flex w-56 flex-col bg-stone-900" />
        <main className="min-h-screen lg:ml-56">
          <div className="mx-auto max-w-6xl px-4 py-4 lg:px-6 lg:py-6 space-y-4">
            <div className="h-8 w-48 animate-pulse rounded bg-muted" />
            <div className="h-4 w-32 animate-pulse rounded bg-muted" />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <ConfirmProvider>
    <DynamicFavicon />
    <div className="min-h-screen bg-background">
      <Sidebar onToggleChat={toggleChat} chatOpen={chatOpen} />
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
