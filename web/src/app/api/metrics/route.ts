/**
 * POST /api/metrics
 *
 * Agent gọi endpoint này mỗi ~10 giây để gửi dữ liệu CPU/RAM/Disk.
 * Dùng TOKEN (từ Authorization header) để xác thực và tra cứu server.
 *
 * Request:
 *   Authorization: Bearer <token>
 *   Body: {
 *     "server_id": "<uuid>",
 *     "cpu":    <float 0-100>,
 *     "memory": <float 0-100>,
 *     "disk":   <float 0-100>
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

  let body: { server_id?: string; cpu?: number; memory?: number; disk?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body không hợp lệ." }, { status: 400 });
  }

  const { server_id, cpu, memory, disk } = body;

  if (
    !server_id ||
    cpu === undefined ||
    memory === undefined ||
    disk === undefined
  ) {
    return NextResponse.json(
      { error: "Thiếu trường bắt buộc: server_id, cpu, memory, disk." },
      { status: 400 }
    );
  }

  if (
    typeof cpu !== "number" || cpu < 0 || cpu > 100 ||
    typeof memory !== "number" || memory < 0 || memory > 100 ||
    typeof disk !== "number" || disk < 0 || disk > 100
  ) {
    return NextResponse.json(
      { error: "Giá trị cpu, memory, disk phải là số trong khoảng 0–100." },
      { status: 400 }
    );
  }

  try {
    const supabase = createServerSupabaseClient();

    // Xác minh TOKEN khớp với server_id để ngăn giả mạo
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

    // Lưu metrics vào Supabase
    const { error: insertErr } = await supabase.from("metrics").insert({
      server_id,
      cpu,
      memory,
      disk,
      status: "online",
    });

    if (insertErr) throw insertErr;

    return new NextResponse(null, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Lỗi không xác định";
    return NextResponse.json(
      { error: `Không thể lưu metrics: ${message}` },
      { status: 500 }
    );
  }
}
