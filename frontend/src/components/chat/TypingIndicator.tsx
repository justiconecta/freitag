export default function TypingIndicator() {
  return (
    <div className="flex gap-3 animate-[slideIn_0.4s_ease]">
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-freitag-green to-freitag-green-light flex items-center justify-center shadow-md">
        <svg className="w-5 h-5 fill-white" viewBox="0 0 24 24"><path d="M7 2v11h3v9l7-12h-4l4-8z"/></svg>
      </div>
      <div className="bg-white border border-border-light rounded-2xl rounded-bl-md px-6 py-4 flex items-center gap-1.5 shadow-sm">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-2 h-2 bg-freitag-green rounded-full animate-bounce"
            style={{ animationDelay: `${i * 0.2}s`, animationDuration: "1.4s" }}
          />
        ))}
      </div>
    </div>
  );
}
