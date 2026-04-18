/**
 * Server-side Supabase Client (SERVICE_ROLE_KEY)
 *
 * Dùng riêng trong API Routes (server-side only).
 * SERVICE_ROLE_KEY có quyền bypass RLS nên KHÔNG được expose ra client.
 */
import { createClient } from "@supabase/supabase-js";

export function createServerSupabaseClient() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Thiếu biến môi trường SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY. " +
        "Hãy thêm vào file web/.env.local."
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
}
