-- ============================================================
-- DevOps Status Dashboard - Supabase Database Schema
-- ============================================================
-- Hướng dẫn: Copy toàn bộ file này, dán vào SQL Editor trong
-- Supabase Dashboard và nhấn "Run" để tạo database.
-- ============================================================

-- Kích hoạt extension để tạo UUID tự động
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- BẢNG 1: servers - Quản lý danh sách server
-- ============================================================
CREATE TABLE IF NOT EXISTS servers (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID        REFERENCES auth.users NOT NULL,  -- Liên kết với user đăng nhập
  name        TEXT        NOT NULL,                        -- Tên server (VD: "Production VM")
  ip_address  TEXT,                                        -- Địa chỉ IP của server
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- BẢNG 2: metrics - Lưu dữ liệu CPU/RAM/Disk theo thời gian
-- ============================================================
CREATE TABLE IF NOT EXISTS metrics (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  server_id   UUID        REFERENCES servers(id) ON DELETE CASCADE, -- Xóa metrics khi xóa server
  cpu         FLOAT       NOT NULL,    -- Phần trăm CPU (0-100)
  memory      FLOAT       NOT NULL,    -- Phần trăm RAM (0-100)
  disk        FLOAT       NOT NULL,    -- Phần trăm Disk (0-100)
  status      TEXT        DEFAULT 'online',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- BẢNG 3: logs - Lưu log cảnh báo từ agent
-- ============================================================
CREATE TABLE IF NOT EXISTS logs (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  server_id   UUID        REFERENCES servers(id) ON DELETE CASCADE,
  message     TEXT        NOT NULL,    -- Nội dung log
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- BẬT ROW LEVEL SECURITY (RLS) - Bảo mật theo từng user
-- ============================================================
-- RLS đảm bảo user A không bao giờ thấy được data của user B
ALTER TABLE servers ENABLE ROW LEVEL SECURITY;
ALTER TABLE metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE logs    ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- POLICY CHO BẢNG servers
-- ============================================================
-- User chỉ được xem, thêm, sửa, xóa server của chính mình
CREATE POLICY "Users can manage their own servers"
ON servers FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- POLICY CHO BẢNG metrics
-- ============================================================
-- User chỉ được xem metrics của server mà họ sở hữu
CREATE POLICY "Users can view their server metrics"
ON metrics FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM servers
    WHERE servers.id = metrics.server_id
      AND servers.user_id = auth.uid()
  )
);

-- Agent (dùng SERVICE_ROLE_KEY) được phép insert metrics
-- SERVICE_ROLE_KEY bypass RLS nên không cần tạo thêm policy INSERT

-- ============================================================
-- POLICY CHO BẢNG logs
-- ============================================================
-- Tương tự metrics, user chỉ xem được log của server của mình
CREATE POLICY "Users can view their server logs"
ON logs FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM servers
    WHERE servers.id = logs.server_id
      AND servers.user_id = auth.uid()
  )
);

-- ============================================================
-- BẬT REALTIME - Để Frontend nhận data ngay khi Agent gửi lên
-- ============================================================
-- Thêm hai bảng này vào Realtime publication của Supabase
ALTER PUBLICATION supabase_realtime ADD TABLE metrics;
ALTER PUBLICATION supabase_realtime ADD TABLE logs;
