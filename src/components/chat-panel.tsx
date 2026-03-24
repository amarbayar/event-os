"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
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
  if (confidence >= 0.9) return <Badge className="bg-emerald-50 text-emerald-700 text-[10px]">High</Badge>;
  if (confidence >= 0.7) return <Badge className="bg-yellow-50 text-yellow-700 text-[10px]">Medium</Badge>;
  return <Badge className="bg-red-50 text-red-600 text-[10px]">Low</Badge>;
}

export function ChatPanel({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [size, setSize] = useState<PanelSize>("expanded");
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Paste a spreadsheet, drop a CSV, type a note from a phone call, or ask me anything about your event. I'll figure out the rest.",
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

  // Cmd+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (!isOpen) onClose(); // toggle
        textareaRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  const handleSubmit = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    const inputType = detectInputType(input);

    try {
      const res = await fetch("/api/agent/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input,
          inputType,
          editionId: "placeholder-edition-id", // TODO: wire to real edition
        }),
      });

      const json = await res.json();
      const data = json.data;

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.message || "I couldn't process that. Try a different format.",
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
          content: "Agent unavailable. Check your API key configuration or try again.",
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
      await fetch(action.endpoint, {
        method: action.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action.payload),
      });
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "assistant",
          content: `Done! ${action.label} completed.`,
          timestamp: new Date(),
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "assistant",
          content: `Failed to execute: ${action.label}. Try again.`,
          timestamp: new Date(),
        },
      ]);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className={cn(
        "fixed inset-y-0 right-0 z-50 flex flex-col bg-white border-l border-stone-200 shadow-xl transition-all duration-200",
        size === "expanded" && "w-full sm:w-[400px]",
        size === "compact" && "w-[60px]"
      )}
    >
      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b border-stone-200 px-4">
        {size === "expanded" ? (
          <>
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-yellow-600" />
              <span className="font-medium text-sm">Event Agent</span>
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
                                "Unknown"}
                            </span>
                            <ConfidenceBadge confidence={entity.confidence} />
                            {entity.warnings.length > 0 && (
                              <AlertTriangle className="h-3 w-3 text-yellow-500 shrink-0" />
                            )}
                          </div>
                        ))}
                        {msg.entities.length > 5 && (
                          <p className="text-[10px] text-stone-400">
                            + {msg.entities.length - 5} more
                          </p>
                        )}
                      </div>
                    )}

                    {/* Action buttons */}
                    {msg.actions && msg.actions.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
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
                  placeholder="Paste a spreadsheet, type a note, or ask a question..."
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
              Shift+Enter for new line. Paste CSV, tables, or chat logs directly.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
