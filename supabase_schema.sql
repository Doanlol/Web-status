-- =============================================================
-- DevOps Status Dashboard - Supabase Database Schema
-- =============================================================
-- Hướng dẫn sử dụng:
-- 1. Đăng nhập vào Supabase (https://supabase.com)
-- 2. Tạo project mới
-- 3. Vào SQL Editor và chạy toàn bộ file này
-- =============================================================

-- Kích hoạt extension tạo UUID tự động
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================
-- BẢNG 1: servers
-- Lưu thông tin các server được người dùng thêm vào
-- =============================================================
CREATE TABLE servers (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),  -- ID duy nhất cho mỗi server
  user_id     UUID REFERENCES auth.users NOT NULL,          -- Liên kết với người dùng Supabase Auth
  name        TEXT NOT NULL,                                 -- Tên server (vd: "Production VM")
  ip_address  TEXT,                                          -- Địa chỉ IP của server
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()        -- Thời điểm thêm server
);

-- =============================================================
-- BẢNG 2: metrics
-- Lưu dữ liệu CPU, RAM, Disk được agent gửi lên mỗi 10 giây
-- =============================================================
CREATE TABLE metrics (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),  -- ID duy nhất của mỗi bản ghi
  server_id   UUID REFERENCES servers(id) ON DELETE CASCADE, -- Liên kết tới server (xóa server thì xóa metrics)
  cpu         FLOAT NOT NULL,                                -- Phần trăm CPU đang dùng (vd: 45.2)
  memory      FLOAT NOT NULL,                               -- Phần trăm RAM đang dùng (vd: 72.1)
  disk        FLOAT NOT NULL,                               -- Phần trăm Disk đang dùng (vd: 60.0)
  status      TEXT DEFAULT 'online',                        -- Trạng thái server ('online' hoặc 'offline')
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()        -- Thời điểm ghi nhận metric
);

-- =============================================================
-- BẢNG 3: logs
-- Lưu các log/cảnh báo được agent gửi lên (vd: CPU spike)
-- =============================================================
CREATE TABLE logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),  -- ID duy nhất của log
  server_id   UUID REFERENCES servers(id) ON DELETE CASCADE, -- Liên kết tới server
  message     TEXT NOT NULL,                                -- Nội dung log (vd: "⚠️ CPU quá tải 85%")
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()        -- Thời điểm ghi log
);

-- =============================================================
-- ROW LEVEL SECURITY (RLS)
-- Đảm bảo mỗi user chỉ truy cập được data của chính mình
-- =============================================================

-- Bật RLS cho tất cả các bảng
ALTER TABLE servers ENABLE ROW LEVEL SECURITY;
ALTER TABLE metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE logs    ENABLE ROW LEVEL SECURITY;

-- POLICY cho bảng servers:
-- User chỉ có thể xem/thêm/sửa/xóa server mà họ sở hữu
CREATE POLICY "Users can manage their own servers"
  ON servers FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- POLICY cho bảng metrics (SELECT):
-- User chỉ xem được metrics của server thuộc về họ
CREATE POLICY "Users can view their server metrics"
  ON metrics FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM servers
      WHERE servers.id = metrics.server_id
        AND servers.user_id = auth.uid()
    )
  );

-- POLICY cho bảng metrics (INSERT):
-- Cho phép insert metrics nếu server tồn tại (dùng Service Role Key từ agent)
-- Khi agent dùng SERVICE_ROLE_KEY, policy RLS sẽ bị bypass
-- Dòng policy này dành cho trường hợp dùng anon key
CREATE POLICY "Service role can insert metrics"
  ON metrics FOR INSERT
  WITH CHECK (true); -- Agent dùng service_role key nên có toàn quyền

-- POLICY cho bảng logs (SELECT):
-- User chỉ xem được logs của server thuộc về họ
CREATE POLICY "Users can view their server logs"
  ON logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM servers
      WHERE servers.id = logs.server_id
        AND servers.user_id = auth.uid()
    )
  );

-- POLICY cho bảng logs (INSERT):
-- Agent dùng service_role key để insert logs
CREATE POLICY "Service role can insert logs"
  ON logs FOR INSERT
  WITH CHECK (true);

-- =============================================================
-- BẬT REALTIME
-- Cho phép frontend nhận dữ liệu real-time qua WebSocket
-- khi có INSERT/UPDATE/DELETE trên bảng metrics và logs
-- =============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE metrics, logs;

-- =============================================================
-- INDEX (Tối ưu truy vấn)
-- =============================================================
-- Index để lấy metrics mới nhất theo server nhanh hơn
CREATE INDEX idx_metrics_server_id_created_at
  ON metrics (server_id, created_at DESC);

-- Index để lấy logs mới nhất theo server nhanh hơn
CREATE INDEX idx_logs_server_id_created_at
  ON logs (server_id, created_at DESC);
