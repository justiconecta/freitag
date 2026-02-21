import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await authenticateRequest(request);
    if (error) return error;

    const { id } = await params;
    const body = await request.json() as { feedback: string };
    const feedback = body.feedback;

    if (feedback !== "like" && feedback !== "dislike") {
      return NextResponse.json(
        { detail: "Feedback must be 'like' or 'dislike'" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const { data, error: dbError } = await supabase
      .from("messages")
      .update({ feedback })
      .eq("id", id)
      .select();

    if (dbError || !data?.length) {
      return NextResponse.json({ detail: "Message not found" }, { status: 404 });
    }

    return NextResponse.json({ status: "updated", feedback });
  } catch (err) {
    console.error("Feedback error:", err);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}
