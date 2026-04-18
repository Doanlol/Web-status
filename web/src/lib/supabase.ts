/**
 * Cấu hình Supabase Client cho Frontend.
 *
 * File này tạo một instance kết nối đến Supabase dùng chung
 * cho toàn bộ ứng dụng. Biến môi trường được đặt trong .env.local.
 */
import { createClient } from "@supabase/supabase-js";

// NEXT_PUBLIC_ prefix cho phép Next.js expose biến này ra phía client (browser)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Thiếu biến môi trường! Hãy tạo file web/.env.local và điền NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY"
  );
}

// Tạo client Supabase - dùng ANON key (public key) cho frontend
// ANON key chỉ được phép truy cập data theo đúng RLS policy đã thiết lập
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
