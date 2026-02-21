import Image from "next/image";
import LoginForm from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-freitag-green-dark via-freitag-green to-freitag-green-light flex items-center justify-center p-4 sm:p-6 relative overflow-hidden">
      {/* Subtle pattern overlay */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
      }} />

      {/* Floating Card */}
      <div className="relative z-10 w-full max-w-[440px] bg-white rounded-3xl shadow-[0_8px_80px_rgba(4,68,40,0.18),0_2px_20px_rgba(0,0,0,0.06)] px-8 py-10 sm:px-10 sm:py-12">
        {/* Logo */}
        <div className="text-center mb-4">
          <Image
            src="/logo-freitag.png"
            alt="Freitag Laboratórios"
            width={480}
            height={140}
            className="h-44 w-auto mx-auto mb-1"
            priority
          />
          <h2 className="text-2xl font-bold text-text-primary mb-1">Bem-vindo!</h2>
          <p className="text-text-secondary text-sm">Faça login para acessar o NormaChat</p>
        </div>

        <LoginForm />

        <div className="text-center mt-10 pt-7 border-t border-border-light">
          <p className="text-sm text-text-secondary">
            Não tem acesso?{" "}
            <a href="#" className="text-freitag-green font-semibold hover:underline">
              Solicitar ao administrador
            </a>
          </p>
        </div>
      </div>

      {/* Footer */}
      <p className="absolute bottom-5 text-white/50 text-xs tracking-wide">
        Freitag Laboratorios &mdash; NormaChat
      </p>
    </div>
  );
}
