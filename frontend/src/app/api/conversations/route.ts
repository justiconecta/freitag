import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const { user, error } = await authenticateRequest(request);
    if (error) return error;

    const supabase = getSupabaseAdmin();

    const { data, error: dbError } = await supabase
      .from("conversations")
      .select("*")
      .eq("user_id", user!.id)
      .order("updated_at", { ascending: false });

    if (dbError) {
      console.error("DB error:", dbError);
      return NextResponse.json({ detail: "Database error" }, { status: 500 });
    }

    return NextResponse.json({ conversations: data });
  } catch (err) {
    console.error("Conversations API error:", err);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}
