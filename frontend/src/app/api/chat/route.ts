import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { processQuery } from "@/lib/services/rag";

export async function POST(request: NextRequest) {
  try {
    const { user, error } = await authenticateRequest(request);
    if (error) return error;

    const body = await request.json();
    const { message, conversation_id } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json({ detail: "Message is required" }, { status: 400 });
    }

    const result = await processQuery(user!.id, message, conversation_id || null);

    return NextResponse.json(result);
  } catch (err) {
    console.error("Chat API error:", err);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}
