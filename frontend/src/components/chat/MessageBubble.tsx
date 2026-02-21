import type { Message } from "./ChatInterface";
import SourceCitation from "./SourceCitation";

interface MessageBubbleProps {
  message: Message;
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const time = message.createdAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className={`flex gap-3 animate-[slideIn_0.4s_ease] ${isUser ? "flex-row-reverse" : ""}`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-bold text-sm ${
        isUser
          ? "bg-gradient-to-br from-gray-200 to-gray-300 text-text-secondary"
          : "bg-gradient-to-br from-freitag-green to-freitag-green-light text-white shadow-md"
      }`}>
        {isUser ? (
          <span>Eu</span>
        ) : (
          <svg className="w-5 h-5 fill-white" viewBox="0 0 24 24"><path d="M7 2v11h3v9l7-12h-4l4-8z"/></svg>
        )}
      </div>

      <div className={`max-w-[75%] flex flex-col gap-2 ${isUser ? "items-end" : ""}`}>
        <div className={`px-5 py-4 text-[0.95rem] leading-relaxed whitespace-pre-wrap ${
          isUser
            ? "bg-gradient-to-r from-freitag-green to-freitag-green-light text-white rounded-2xl rounded-br-md shadow-md"
            : "bg-white text-text-primary border border-border-light rounded-2xl rounded-bl-md shadow-sm"
        }`}>
          {message.content}
        </div>

        {message.sources && message.sources.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {message.sources.map((source, i) => (
              <SourceCitation key={i} source={source} />
            ))}
          </div>
        )}

        <span className={`text-xs text-text-muted px-1 ${isUser ? "text-right" : ""}`}>
          {time}
        </span>
      </div>
    </div>
  );
}
