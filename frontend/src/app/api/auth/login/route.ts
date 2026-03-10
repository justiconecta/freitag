import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const FREITAG_LOGIN_URL =
  "https://freitag.glabnet2.com.br/integracao/justconecta/login.php";

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
}

export async function POST(request: NextRequest) {
  const supabase = getSupabaseAdmin();
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  const userAgent = request.headers.get("user-agent") || "unknown";

  let login = "";

  try {
    const body = await request.json();
    login = body.login;
    const senha = body.senha;

    if (!login || !senha) {
      return NextResponse.json(
        { error: "Login e senha são obrigatórios" },
        { status: 400 }
      );
    }

    // 1. Chama a API Freitag direto
    const freitagResponse = await fetch(FREITAG_LOGIN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ type: "colaborador", login, senha }),
    });

    // Retorno é sempre array: [{ status, numeroColaborador }] ou [{ status, erro }]
    const freitagData = await freitagResponse.json();
    const resultado = Array.isArray(freitagData) ? freitagData[0] : freitagData;

    if (!resultado || resultado.status !== "ok") {
      await supabase.from("access_logs").insert({
        login,
        success: false,
        ip_address: ip,
        user_agent: userAgent,
        error_message: resultado?.erro || "Usuário não localizado",
      });

      return NextResponse.json(
        { error: resultado?.erro || "Login ou senha incorretos" },
        { status: 401 }
      );
    }

    // 2. status "ok" — pega o numeroColaborador
    const freitagId = String(resultado.numeroColaborador);

    // 3. Cria/atualiza colaborador no banco
    const { data: colab } = await supabase
      .from("colaboradores")
      .select("id")
      .eq("freitag_id", freitagId)
      .single();

    let colaboradorId: string;

    if (colab) {
      colaboradorId = colab.id;
      await supabase
        .from("colaboradores")
        .update({ ultimo_acesso_at: new Date().toISOString() })
        .eq("id", colaboradorId);
    } else {
      const { data: novo } = await supabase
        .from("colaboradores")
        .insert({
          freitag_id: freitagId,
          login,
          primeiro_acesso_at: new Date().toISOString(),
          ultimo_acesso_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      colaboradorId = novo!.id;
    }

    // 4. Garante user no Supabase Auth (para sessão/RLS funcionar)
    const internalEmail = `${login}@freitag.colaborador`;
    const internalPassword = `freitag_${freitagId}_jc`;

    // Tenta criar, se já existe ignora
    await supabase.auth.admin.createUser({
      email: internalEmail,
      password: internalPassword,
      email_confirm: true,
      user_metadata: { full_name: login, freitag_id: freitagId },
    });

    // Vincula supabase_user_id se ainda não tem
    const { data: users } = await supabase.auth.admin.listUsers();
    const supabaseUser = users?.users?.find((u) => u.email === internalEmail);

    if (supabaseUser) {
      await supabase
        .from("colaboradores")
        .update({ supabase_user_id: supabaseUser.id })
        .eq("id", colaboradorId);
    }

    // 5. Faz login no Supabase para gerar sessão
    const authClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: signIn, error: signInError } =
      await authClient.auth.signInWithPassword({
        email: internalEmail,
        password: internalPassword,
      });

    if (signInError || !signIn.session) {
      throw new Error(`Falha ao gerar sessão: ${signInError?.message}`);
    }

    // 6. Registra sessão + log
    const { data: session } = await supabase
      .from("sessions")
      .insert({ colaborador_id: colaboradorId, ip_address: ip, user_agent: userAgent })
      .select("id")
      .single();

    await supabase.from("access_logs").insert({
      colaborador_id: colaboradorId,
      freitag_id: freitagId,
      login,
      success: true,
      ip_address: ip,
      user_agent: userAgent,
    });

    // 7. Retorna tudo pro frontend
    return NextResponse.json({
      access_token: signIn.session.access_token,
      refresh_token: signIn.session.refresh_token,
      session_id: session?.id,
      colaborador: { id: colaboradorId, freitag_id: freitagId, login },
    });
  } catch (err) {
    console.error("Login error:", err);

    if (login) {
      await supabase.from("access_logs").insert({
        login,
        success: false,
        ip_address: ip,
        user_agent: userAgent,
        error_message: err instanceof Error ? err.message : "Erro desconhecido",
      });
    }

    return NextResponse.json({ error: "Erro interno no servidor" }, { status: 500 });
  }
}
