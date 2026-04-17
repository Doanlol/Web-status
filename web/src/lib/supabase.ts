/**
 * =============================================================
 * Supabase Client Configuration
 * =============================================================
 * File này khởi tạo Supabase client để sử dụng trong toàn bộ app.
 *
 * Các biến môi trường cần có trong file .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
 *
 * Lưu ý: Tiền tố NEXT_PUBLIC_ giúp biến env khả dụng phía client.
 * KHÔNG đặt SERVICE_ROLE_KEY vào biến NEXT_PUBLIC_ vì sẽ lộ key!
 * =============================================================
 */

import { createClient } from "@supabase/supabase-js";

// Lấy URL và Anon Key từ biến môi trường
// Dấu ! cuối (non-null assertion) báo TypeScript rằng giá trị không bao giờ undefined
const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Supabase client instance - dùng cho toàn bộ ứng dụng
 *
 * Cách dùng trong component:
 *   import { supabase } from '@/lib/supabase'
 *   const { data } = await supabase.from('metrics').select('*')
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
