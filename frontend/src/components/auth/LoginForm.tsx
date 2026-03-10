"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginForm() {
  const router = useRouter();
  const [login, setLogin] = useState("");
  const [senha, setSenha] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isFormValid = login.trim().length > 0 && senha.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!login.trim()) {
      setError("Por favor, informe seu login.");
      return;
    }
    if (!senha) {
      setError("Por favor, informe sua senha.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login: login.trim(), senha }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Login ou senha incorretos.");
        return;
      }

      // Setar sessão Supabase no client para manter RLS funcionando
      const supabase = createClient();
      await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      });

      // Salvar session_id para tracking de logout
      sessionStorage.setItem("jc_session_id", data.session_id);
      sessionStorage.setItem("jc_colaborador_login", data.colaborador.login);

      router.push("/chat");
    } catch {
      setError("Não foi possível conectar ao servidor. Tente novamente em alguns instantes.");
    } finally {
      setLoading(false);
    }
  };

  const inputBase =
    "w-full px-4 py-4 pl-13 bg-bg-input border-2 rounded-xl text-text-primary placeholder-text-muted/70 outline-none transition-all";
  const inputNormal = "border-border-light focus:bg-bg-card focus:border-freitag-green focus:ring-4 focus:ring-freitag-accent/15";
  const inputError = "border-red-400 bg-red-50/50 focus:border-red-500 focus:ring-4 focus:ring-red-100";

  return (
    <form onSubmit={handleSubmit} className="space-y-0">
      {error && (
        <div className="flex items-start gap-3 p-4 mb-7 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm animate-[slideDown_0.3s_ease]">
          <svg className="w-5 h-5 fill-current shrink-0 mt-0.5" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
          <span>{error}</span>
        </div>
      )}

      {/* Login block */}
      <div className="mb-8">
        <label htmlFor="login" className="block text-sm font-semibold text-text-secondary mb-1.5">
          Login
        </label>
        <div className="relative">
          <input
            id="login"
            type="text"
            value={login}
            onChange={(e) => { setLogin(e.target.value); setError(""); }}
            placeholder="Digite seu login"
            className={`${inputBase} ${error ? inputError : inputNormal}`}
            autoComplete="username"
          />
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 fill-text-secondary pointer-events-none" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
        </div>
      </div>

      {/* Senha block */}
      <div className="mb-5">
        <label htmlFor="senha" className="block text-sm font-semibold text-text-secondary mb-1.5">
          Senha
        </label>
        <div className="relative">
          <input
            id="senha"
            type={showPassword ? "text" : "password"}
            value={senha}
            onChange={(e) => { setSenha(e.target.value); setError(""); }}
            placeholder="Digite sua senha"
            className={`${inputBase} pr-12 ${error ? inputError : inputNormal}`}
            autoComplete="current-password"
          />
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 fill-text-secondary pointer-events-none" viewBox="0 0 24 24"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-1"
            tabIndex={-1}
          >
            <svg className="w-5 h-5 fill-text-secondary hover:fill-freitag-green transition-colors" viewBox="0 0 24 24">
              {showPassword ? (
                <path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/>
              ) : (
                <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Lembrar + Esqueceu */}
      <div className="flex items-center justify-between mb-9">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" className="w-4 h-4 accent-freitag-green cursor-pointer" />
          <span className="text-sm text-text-secondary">Lembrar de mim</span>
        </label>
        <a href="#" className="text-sm font-semibold text-freitag-green hover:text-freitag-green-dark hover:underline transition-colors">
          Esqueceu a senha?
        </a>
      </div>

      <button
        type="submit"
        disabled={loading || !isFormValid}
        className="w-full py-4 px-8 bg-gradient-to-r from-freitag-green to-freitag-green-light text-white font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 enabled:hover:shadow-xl enabled:hover:-translate-y-0.5 enabled:active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
      >
        {loading ? (
          <>
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            <span>Entrando...</span>
          </>
        ) : (
          <>
            <span>Entrar</span>
            <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M10 17l5-5-5-5v10z"/></svg>
          </>
        )}
      </button>
    </form>
  );
}
