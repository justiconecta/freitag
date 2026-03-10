"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function Header() {
  const router = useRouter();
  const [userName, setUserName] = useState(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem("jc_colaborador_login") || "Usuário";
    }
    return "Usuário";
  });

  useEffect(() => {
    // Se já temos o login do sessionStorage, não precisa buscar no Supabase
    if (sessionStorage.getItem("jc_colaborador_login")) return;

    // Fallback: pegar do Supabase Auth
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        const name =
          user.user_metadata?.full_name ||
          user.email?.split("@")[0] ||
          "Usuário";
        setUserName(name);
      }
    });
  }, []);

  const handleLogout = async () => {
    // 1. Encerrar sessão de tracking
    const sessionId = sessionStorage.getItem("jc_session_id");
    if (sessionId) {
      try {
        await fetch("/api/auth/logout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: sessionId }),
        });
      } catch (err) {
        console.error("Error closing session:", err);
      }
      sessionStorage.removeItem("jc_session_id");
      sessionStorage.removeItem("jc_colaborador_login");
    }

    // 2. Encerrar sessão Supabase
    const supabase = createClient();
    await supabase.auth.signOut();

    router.push("/login");
  };

  const handleNewChat = () => {
    window.location.reload();
  };

  return (
    <header className="bg-gradient-to-r from-freitag-green-dark via-freitag-green to-freitag-green-light relative shrink-0 z-50 shadow-[0_4px_20px_rgba(0,0,0,0.12)]">
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-freitag-accent via-freitag-green-light to-freitag-accent" />
      <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
        {/* Logo icon + Freitag + NormaChat */}
        <div className="flex items-center gap-3">
          <svg className="w-9 h-9" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="50" cy="50" r="46" stroke="white" strokeWidth="5" opacity="0.95"/>
            <circle cx="40" cy="55" r="20" stroke="white" strokeWidth="4.5" opacity="0.95"/>
            <circle cx="62" cy="36" r="13" fill="white" opacity="0.95"/>
            <circle cx="38" cy="34" r="6" fill="white" opacity="0.95"/>
          </svg>
          <div className="flex items-center gap-2.5">
            <span className="text-white font-bold text-lg tracking-tight">Freitag</span>
            <div className="h-5 w-px bg-white/30" />
            <span className="text-white/65 text-xs tracking-widest uppercase font-medium">NormaChat</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Online indicator */}
          <div className="hidden sm:flex items-center gap-1.5 px-3">
            <div className="w-2 h-2 bg-freitag-accent rounded-full animate-pulse" />
            <span className="text-white/70 text-xs font-medium">Online</span>
          </div>

          {/* Avatar */}
          <div className="flex items-center gap-2 px-2">
            <div className="w-8 h-8 bg-white/15 rounded-full flex items-center justify-center">
              <span className="text-white text-xs font-bold uppercase leading-none">{userName.charAt(0)}</span>
            </div>
            <span className="hidden sm:inline text-white/80 text-sm font-medium max-w-[120px] truncate capitalize leading-none">{userName}</span>
          </div>

          {/* Nova conversa */}
          <button
            onClick={handleNewChat}
            className="flex items-center gap-2 px-4 py-2 bg-white text-freitag-green rounded-full text-sm font-semibold hover:bg-white/90 transition-all shadow-sm"
            title="Nova conversa"
          >
            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
            <span className="hidden sm:inline">Nova conversa</span>
          </button>

          {/* Sair */}
          <button
            onClick={handleLogout}
            className="flex items-center justify-center w-9 h-9 text-white/60 hover:text-white/95 transition-colors"
            title="Sair"
          >
            <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/></svg>
          </button>
        </div>
      </div>
    </header>
  );
}
