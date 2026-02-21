import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await authenticateRequest(request);
    if (error) return error;

    const { id } = await params;
    const supabase = getSupabaseAdmin();

    const { data: conversation, error: convError } = await supabase
      .from("conversations")
      .select("*")
      .eq("id", id)
      .eq("user_id", user!.id)
      .single();

    if (convError || !conversation) {
      return NextResponse.json({ detail: "Conversation not found" }, { status: 404 });
    }

    const { data: messages, error: msgError } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true });

    if (msgError) {
      return NextResponse.json({ detail: "Database error" }, { status: 500 });
    }

    const result = Object.assign({}, conversation, { messages: messages || [] });
    return NextResponse.json(result);
  } catch (err) {
    console.error("Conversation detail error:", err);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await authenticateRequest(request);
    if (error) return error;

    const { id } = await params;
    const supabase = getSupabaseAdmin();

    const { data, error: dbError } = await supabase
      .from("conversations")
      .delete()
      .eq("id", id)
      .eq("user_id", user!.id)
      .select();

    if (dbError || !data?.length) {
      return NextResponse.json({ detail: "Conversation not found" }, { status: 404 });
    }

    return NextResponse.json({ status: "deleted" });
  } catch (err) {
    console.error("Delete conversation error:", err);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}
