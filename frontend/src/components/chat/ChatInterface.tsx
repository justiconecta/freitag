"use client";

import { useState, useRef } from "react";
import WelcomeState from "./WelcomeState";
import ChatMessages from "./ChatMessages";
import ChatInput from "./ChatInput";
import { createClient } from "@/lib/supabase/client";
import { sendChatMessage } from "@/lib/api";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  createdAt: Date;
}

export interface Source {
  documentName: string;
  section: string | null;
  page: number | null;
  similarity: number;
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const conversationId = useRef<string | null>(null);

  const handleSend = async (content: string) => {
    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: "user",
      content,
      createdAt: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("Sessao expirada");
      }

      const response = await sendChatMessage(
        {
          message: content,
          conversation_id: conversationId.current || undefined,
        },
        session.access_token
      );

      conversationId.current = response.conversation_id;

      const assistantMessage: Message = {
        id: response.message_id || `msg-${Date.now()}-resp`,
        role: "assistant",
        content: response.message,
        sources: response.sources?.map((s) => ({
          documentName: s.document_name,
          section: s.section,
          page: s.page,
          similarity: s.similarity,
        })),
        createdAt: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch {
      const errorMessage: Message = {
        id: `msg-${Date.now()}-err`,
        role: "assistant",
        content: "Desculpe, ocorreu um erro ao processar sua pergunta. Verifique se o backend esta rodando e tente novamente.",
        createdAt: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {messages.length === 0 ? (
        <WelcomeState onSuggestionClick={handleSend} />
      ) : (
        <ChatMessages messages={messages} isLoading={isLoading} />
      )}
      <ChatInput onSend={handleSend} isLoading={isLoading} />
    </div>
  );
}
