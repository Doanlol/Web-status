/**
 * POST /api/register
 *
 * Agent gọi endpoint này khi khởi động để đăng ký server với Dashboard.
 * Dùng TOKEN (từ Authorization header) làm khóa nhận diện server.
 *
 * Request:
 *   Authorization: Bearer <token>
 *   Body: { "hostname": "<hostname>" }
 *
 * Response (201):
 *   { "id": "<server_uuid>" }
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

  let hostname = "unknown";
  try {
    const body = await request.json();
    if (body.hostname) hostname = String(body.hostname);
  } catch {
    // Body không phải JSON hoặc bị trống — bỏ qua, dùng giá trị mặc định
  }

  // Lấy IP của agent từ request headers
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    null;

  try {
    const supabase = createServerSupabaseClient();

    // Tìm server đã tồn tại với token này
    const { data: existing, error: selectErr } = await supabase
      .from("servers")
      .select("id")
      .eq("token", token)
      .maybeSingle();

    if (selectErr) throw selectErr;

    if (existing) {
      // Server đã tồn tại → cập nhật hostname và IP
      await supabase
        .from("servers")
        .update({ name: hostname, ip_address: ip })
        .eq("id", existing.id);

      return NextResponse.json({ id: existing.id }, { status: 200 });
    }

    // Server chưa tồn tại → tạo mới
    const { data: created, error: insertErr } = await supabase
      .from("servers")
      .insert({ token, name: hostname, ip_address: ip })
      .select("id")
      .single();

    if (insertErr) throw insertErr;

    return NextResponse.json({ id: created.id }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Lỗi không xác định";
    return NextResponse.json(
      { error: `Không thể đăng ký server: ${message}` },
      { status: 500 }
    );
  }
}
