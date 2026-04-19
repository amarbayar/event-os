"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslations, useLocale } from "next-intl";
import { formatDate, formatTime } from "@/lib/i18n/date";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, X, Send, Trash2, Pencil, Loader2 } from "lucide-react";

type Note = {
  id: string;
  authorName: string;
  content: string;
  createdAt: string;
  updatedAt: string;
};

type NotesPanelProps = {
  entityType: string;
  entityId: string;
  isOpen: boolean;
  onClose: () => void;
  currentUser?: string; // for edit/delete permissions
};

export function NotesPanel({
  entityType,
  entityId,
  isOpen,
  onClose,
  currentUser = "Organizer",
}: NotesPanelProps) {
  const t = useTranslations("Notes");
  const tC = useTranslations("Common");
  const locale = useLocale();
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNote, setNewNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch notes when panel opens
  useEffect(() => {
    if (!isOpen || !entityId) return;

    let cancelled = false;
    const timeoutId = window.setTimeout(() => {
      void (async () => {
        setLoading(true);
        try {
          const response = await fetch(
            `/api/notes?entityType=${entityType}&entityId=${entityId}`
          );
          const data = await response.json();
          if (!cancelled) {
            setNotes(data.data || []);
          }
        } catch {
          // Keep the last successful note list.
        } finally {
          if (!cancelled) {
            setLoading(false);
          }
        }
      })();
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [isOpen, entityType, entityId]);

  // Scroll to bottom on new notes
  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [notes]);

  const handleSend = async () => {
    if (!newNote.trim()) return;
    setSending(true);

    const res = await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entityType,
        entityId,
        content: newNote,
        authorName: currentUser,
      }),
    });

    if (res.ok) {
      const json = await res.json();
      setNotes((prev) => [...prev, json.data]);
      setNewNote("");
    }
    setSending(false);
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/notes/${id}`, { method: "DELETE" });
    setNotes((prev) => prev.filter((n) => n.id !== id));
  };

  const handleEdit = async (id: string) => {
    if (!editContent.trim()) return;
    const res = await fetch(`/api/notes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: editContent }),
    });
    if (res.ok) {
      const json = await res.json();
      setNotes((prev) => prev.map((n) => (n.id === id ? json.data : n)));
      setEditingId(null);
      setEditContent("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[380px] flex flex-col bg-white border-l border-stone-200 shadow-xl">
        {/* Header */}
        <div className="flex h-12 items-center justify-between border-b border-stone-200 px-4 shrink-0">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-yellow-600" />
            <span className="text-sm font-medium">{t("title", { count: notes.length })}</span>
          </div>
          <button onClick={onClose} className="rounded p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-600">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Notes list */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-stone-400" />
            </div>
          ) : notes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">{t("empty")}</p>
          ) : (
            notes.map((note) => (
              <div key={note.id} className="group rounded-lg border border-stone-100 bg-stone-50 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium">{note.authorName}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {formatDate(note.createdAt, locale)} {formatTime(note.createdAt, locale)}
                      </span>
                      {note.updatedAt !== note.createdAt && (
                        <span className="text-[10px] text-muted-foreground italic">{t("edited")}</span>
                      )}
                    </div>

                    {editingId === note.id ? (
                      <div className="mt-1 space-y-1">
                        <Textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          rows={3}
                          className="text-xs"
                          autoFocus
                        />
                        <div className="flex gap-1">
                          <Button size="sm" className="h-6 text-[10px]" onClick={() => handleEdit(note.id)}>{tC("save")}</Button>
                          <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => setEditingId(null)}>{tC("cancel")}</Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-stone-700 mt-1 whitespace-pre-wrap">{note.content}</p>
                    )}
                  </div>

                  {/* Edit/delete — only for own notes */}
                  {note.authorName === currentUser && editingId !== note.id && (
                    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button
                        onClick={() => { setEditingId(note.id); setEditContent(note.content); }}
                        className="rounded p-1 text-stone-300 hover:text-stone-600 hover:bg-white"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => handleDelete(note.id)}
                        className="rounded p-1 text-stone-300 hover:text-red-500 hover:bg-white"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Input */}
        <div className="border-t border-stone-200 p-3 shrink-0">
          <div className="flex gap-2">
            <Textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t("placeholder")}
              rows={2}
              className="text-xs resize-none flex-1"
            />
            <Button
              size="sm"
              onClick={handleSend}
              disabled={!newNote.trim() || sending}
              className="h-auto px-3"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

// Button to show in table rows — shows note count
export function NotesButton({
  count,
  onClick,
}: {
  count: number;
  onClick: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(e); }}
      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-stone-400 hover:text-yellow-600 hover:bg-yellow-50 transition-colors"
      title="Notes"
    >
      <MessageSquare className="h-3 w-3" />
      {count > 0 && <span className="tabular-nums font-medium">{count}</span>}
    </button>
  );
}
