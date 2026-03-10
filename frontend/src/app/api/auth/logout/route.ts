import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const sessionId = body.session_id;

    if (!sessionId) {
      return NextResponse.json(
        { error: "session_id é obrigatório" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Encerrar sessão — calcula duração automaticamente
    const { error } = await supabase.rpc("close_session", {
      p_session_id: sessionId,
    });

    if (error) {
      console.error("Error closing session:", error);
      // Fallback: update direto
      await supabase
        .from("sessions")
        .update({
          logout_at: new Date().toISOString(),
          active: false,
        })
        .eq("id", sessionId);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Logout error:", err);
    return NextResponse.json(
      { error: "Erro ao encerrar sessão" },
      { status: 500 }
    );
  }
}
