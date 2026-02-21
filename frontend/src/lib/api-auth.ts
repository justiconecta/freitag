import { NextRequest, NextResponse } from "next/server";
import { getUserFromToken } from "@/lib/supabase/server";

export async function authenticateRequest(request: NextRequest) {
  const authHeader = request.headers.get("authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return { user: null, error: NextResponse.json({ detail: "Missing authorization header" }, { status: 401 }) };
  }

  const token = authHeader.replace("Bearer ", "");
  const user = await getUserFromToken(token);

  if (!user) {
    return { user: null, error: NextResponse.json({ detail: "Invalid or expired token" }, { status: 401 }) };
  }

  return { user, error: null };
}
