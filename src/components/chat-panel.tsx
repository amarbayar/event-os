"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { useAnimatedMount } from "@/lib/use-animated-mount";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Send,
  X,
  Minimize2,
  Maximize2,
  Bot,
  User,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  FileUp,
} from "lucide-react";

type PanelSize = "expanded" | "compact" | "hidden";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  entities?: Array<{
    type: string;
    confidence: number;
    data: Record<string, unknown>;
    warnings: string[];
  }>;
  actions?: Array<{
    label: string;
    endpoint: string;
    method: string;
    payload: Record<string, unknown>;
  }>;
  questions?: string[];
  timestamp: Date;
};

function detectInputType(text: string): "csv" | "text" {
  const lines = text.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return "text";

  // Check for tab-separated data
  const tabCounts = lines.map((l) => (l.match(/\t/g) || []).length);
  if (tabCounts[0] > 0 && tabCounts.every((c) => c === tabCounts[0])) return "csv";

  // Check for comma-separated with consistent column count
  const commaCounts = lines.map((l) => (l.match(/,/g) || []).length);
  if (commaCounts[0] > 1 && commaCounts.every((c) => c === commaCounts[0])) return "csv";

  return "text";
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const t = useTranslations("Chat");
  if (confidence >= 0.9) return <Badge className="bg-emerald-50 text-emerald-700 text-[10px]">{t("confidenceHigh")}</Badge>;
  if (confidence >= 0.7) return <Badge className="bg-yellow-50 text-yellow-700 text-[10px]">{t("confidenceMedium")}</Badge>;
  return <Badge className="bg-red-50 text-red-600 text-[10px]">{t("confidenceLow")}</Badge>;
}

export function ChatPanel({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("Chat");
  const [size, setSize] = useState<PanelSize>("expanded");
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: t("welcome"),
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus textarea when panel opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSubmit = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date(),
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    setLoading(true);

    const inputType = detectInputType(input);

    // Build conversation context from last 10 messages (sliding window)
    const recentMessages = updatedMessages
      .filter((m) => m.id !== "welcome")
      .slice(-10)
      .map((m) => `${m.role === "user" ? "User" : "Agent"}: ${m.content}`)
      .join("\n");

    try {
      const res = await fetch("/api/agent/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input,
          inputType,
          context: recentMessages || undefined,
        }),
      });

      const json = await res.json();
      const data = json.data;

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.message || t("processFailed"),
        entities: data.entities,
        actions: data.actions,
        questions: data.questions,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: t("agentUnavailable"),
          timestamp: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleAction = async (action: NonNullable<Message["actions"]>[0]) => {
    try {
      const res = await fetch(action.endpoint, {
        method: action.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action.payload),
      });

      const json = await res.json();

      if (res.ok) {
        const name = json.data?.name || json.data?.companyName || json.data?.title || "";
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            role: "assistant",
            content: t("actionCompleted", { label: action.label, detail: name ? t("actionCreated", { name }) : "" }),
            timestamp: new Date(),
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            role: "assistant",
            content: t("actionError", { error: json.error || "Unknown" }),
            timestamp: new Date(),
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "assistant",
          content: t("networkError"),
          timestamp: new Date(),
        },
      ]);
    }
  };

  const { mounted, visible } = useAnimatedMount(isOpen);

  if (!mounted) return null;

  return (
    <div
      className={cn(
        "fixed inset-y-0 right-0 z-50 flex flex-col bg-white border-l border-stone-200 shadow-xl",
        size === "expanded" && "w-full sm:w-[400px]",
        size === "compact" && "w-[60px]",
        visible ? "slide-right-active" : mounted ? "slide-right-exit" : "slide-right-enter"
      )}
    >
      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b border-stone-200 px-4">
        {size === "expanded" ? (
          <>
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-yellow-600" />
              <span className="font-medium text-sm">{t("title")}</span>
              <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border border-stone-200 bg-stone-50 px-1.5 py-0.5 text-[10px] text-stone-500">
                <span className="text-xs">⌘</span>K
              </kbd>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setSize("compact")}
                className="rounded p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
              >
                <Minimize2 className="h-4 w-4" />
              </button>
              <button
                onClick={onClose}
                className="rounded p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </>
        ) : (
          <button
            onClick={() => setSize("expanded")}
            className="mx-auto rounded p-1.5 text-yellow-600 hover:bg-yellow-50"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {size === "expanded" && (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg) => (
              <div key={msg.id}>
                <div
                  className={cn(
                    "flex gap-2",
                    msg.role === "user" && "justify-end"
                  )}
                >
                  {msg.role === "assistant" && (
                    <Bot className="h-6 w-6 shrink-0 text-yellow-600 mt-0.5" />
                  )}
                  <div
                    className={cn(
                      "rounded-lg px-3 py-2 text-sm max-w-[85%]",
                      msg.role === "user"
                        ? "bg-stone-900 text-white"
                        : "bg-stone-50 text-stone-800"
                    )}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>

                    {/* Entity preview */}
                    {msg.entities && msg.entities.length > 0 && (
                      <div className="mt-2 space-y-1.5">
                        {msg.entities.slice(0, 5).map((entity, i) => (
                          <div
                            key={i}
                            className="flex items-center gap-2 rounded border border-stone-200 bg-white px-2 py-1.5 text-xs"
                          >
                            <Badge variant="outline" className="text-[10px] capitalize">
                              {entity.type}
                            </Badge>
                            <span className="truncate flex-1">
                              {(entity.data.name as string) ||
                                (entity.data.companyName as string) ||
                                (entity.data.title as string) ||
                                t("unknown")}
                            </span>
                            <ConfidenceBadge confidence={entity.confidence} />
                            {entity.warnings.length > 0 && (
                              <AlertTriangle className="h-3 w-3 text-yellow-500 shrink-0" />
                            )}
                          </div>
                        ))}
                        {msg.entities.length > 5 && (
                          <p className="text-[10px] text-stone-400">
                            {t("moreEntities", { count: msg.entities.length - 5 })}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Action buttons — always show, partial records are OK */}
                    {msg.actions && msg.actions.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {msg.actions.length > 1 && (
                          <Button
                            size="sm"
                            className="text-xs h-7"
                            onClick={async () => {
                              for (const action of msg.actions!) {
                                await handleAction(action);
                              }
                            }}
                          >
                            <CheckCircle2 className="mr-1 h-3 w-3" />
                            {t("importAll", { count: msg.actions.length })}
                          </Button>
                        )}
                        {msg.actions.map((action, i) => (
                          <Button
                            key={i}
                            size="sm"
                            variant={i === 0 ? "default" : "outline"}
                            className="text-xs h-7"
                            onClick={() => handleAction(action)}
                          >
                            <CheckCircle2 className="mr-1 h-3 w-3" />
                            {action.label}
                          </Button>
                        ))}
                      </div>
                    )}

                    {/* Questions */}
                    {msg.questions && msg.questions.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {msg.questions.map((q, i) => (
                          <p
                            key={i}
                            className="text-xs text-yellow-700 bg-yellow-50 rounded px-2 py-1"
                          >
                            {q}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                  {msg.role === "user" && (
                    <User className="h-6 w-6 shrink-0 text-stone-400 mt-0.5" />
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex gap-2">
                <Bot className="h-6 w-6 shrink-0 text-yellow-600 mt-0.5" />
                <div className="rounded-lg bg-stone-50 px-3 py-2">
                  <Loader2 className="h-4 w-4 animate-spin text-yellow-600" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-stone-200 p-3">
            <div className="flex items-end gap-2">
              <div className="relative flex-1">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={t("inputPlaceholder")}
                  className="w-full resize-none rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm placeholder:text-stone-400 focus:border-yellow-500 focus:outline-none focus:ring-1 focus:ring-yellow-500 min-h-[40px] max-h-[120px]"
                  rows={1}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = "auto";
                    target.style.height = Math.min(target.scrollHeight, 120) + "px";
                  }}
                />
              </div>
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={!input.trim() || loading}
                className="h-10 w-10 p-0 shrink-0"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-[10px] text-stone-400 mt-1.5">
              {t("inputHint")}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
