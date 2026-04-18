/**
 * POST /api/logs
 *
 * Agent gọi endpoint này để gửi log cảnh báo (CPU spike, RAM cao, v.v.)
 * lên Dashboard. Dùng TOKEN (từ Authorization header) để xác thực.
 *
 * Request:
 *   Authorization: Bearer <token>
 *   Body: {
 *     "server_id": "<uuid>",
 *     "message":   "<nội dung log>"
 *   }
 *
 * Response: 201 Created
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export async function POST(request: NextRequest) {
  // Lấy TOKEN từ header Authorization
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : "";

  if (!token) {
    return NextResponse.json(
      { error: "Thiếu TOKEN trong Authorization header." },
      { status: 401 }
    );
  }

  let body: { server_id?: string; message?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body không hợp lệ." }, { status: 400 });
  }

  const { server_id, message } = body;

  if (!server_id || !message) {
    return NextResponse.json(
      { error: "Thiếu trường bắt buộc: server_id, message." },
      { status: 400 }
    );
  }

  try {
    const supabase = createServerSupabaseClient();

    // Xác minh TOKEN khớp với server_id
    const { data: server, error: verifyErr } = await supabase
      .from("servers")
      .select("id")
      .eq("id", server_id)
      .eq("token", token)
      .maybeSingle();

    if (verifyErr) throw verifyErr;
    if (!server) {
      return NextResponse.json(
        { error: "TOKEN không hợp lệ hoặc server không tồn tại." },
        { status: 403 }
      );
    }

    // Lưu log vào Supabase
    const { error: insertErr } = await supabase.from("logs").insert({
      server_id,
      message,
    });

    if (insertErr) throw insertErr;

    return new NextResponse(null, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Lỗi không xác định";
    return NextResponse.json(
      { error: `Không thể lưu log: ${message}` },
      { status: 500 }
    );
  }
}
