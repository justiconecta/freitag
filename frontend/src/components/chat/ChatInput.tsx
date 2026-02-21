"use client";

import { useState, useRef, useEffect } from "react";

interface ChatInputProps {
  onSend: (message: string) => void;
  isLoading: boolean;
}

export default function ChatInput({ onSend, isLoading }: ChatInputProps) {
  const [message, setMessage] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const hasText = message.trim().length > 0;

  const handleSend = () => {
    const trimmed = message.trim();
    if (!trimmed || isLoading) return;
    onSend(trimmed);
    setMessage("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 150) + "px";
    }
  }, [message]);

  return (
    <div className="shrink-0 bg-bg-primary border-t border-border-light p-4 relative">
      <div className="absolute top-[-40px] left-0 right-0 h-10 bg-gradient-to-t from-bg-primary to-transparent pointer-events-none" />
      <div className="max-w-[820px] mx-auto">
        <div className="bg-bg-input border-2 border-border-light rounded-2xl flex items-end gap-3 pl-6 pr-4 py-3 shadow-sm focus-within:bg-bg-card focus-within:border-freitag-green focus-within:ring-4 focus-within:ring-freitag-accent/15 transition-all">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite sua pergunta sobre normas técnicas..."
            rows={1}
            maxLength={4000}
            className="flex-1 border-none outline-none resize-none bg-transparent text-text-primary placeholder-text-muted py-1.5 max-h-[150px] min-h-[24px]"
          />
          <button
            onClick={handleSend}
            disabled={!hasText || isLoading}
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all duration-200 ${
              hasText
                ? "text-freitag-green hover:bg-freitag-green/10 active:scale-95"
                : "text-border-medium cursor-default"
            }`}
            title="Enviar mensagem"
          >
            <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
          </button>
        </div>
        <div className="flex items-center justify-center gap-2 mt-3 text-xs text-text-muted">
          <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/></svg>
          <span>Respostas baseadas em normas técnicas oficiais</span>
        </div>
      </div>
    </div>
  );
}
