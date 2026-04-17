# 🖥️ DevOps Status Dashboard

Một web application giúp theo dõi trạng thái server theo thời gian thực, xây dựng với kiến trúc hiện đại:

- **Frontend**: Next.js (React) + TypeScript + Tailwind CSS → Deploy trên Vercel
- **Backend**: Supabase (PostgreSQL + Realtime WebSocket + Auth)
- **Agent**: Python script chạy trên VM, thu thập và gửi metrics

---

## 🎯 Tính năng

- ✅ **Realtime Monitoring**: CPU, RAM, Disk cập nhật tức thời qua WebSocket
- ✅ **Status Detection**: Tự động phát hiện server Online/Offline
- ✅ **Log System**: Agent gửi log cảnh báo khi CPU > 80%
- ✅ **Dark Theme**: Giao diện DevOps style, màu xanh hacker
- ✅ **Responsive**: Hoạt động tốt trên mobile và desktop

---

## 📂 Cấu trúc dự án

```
Web-status/
├── supabase_schema.sql     # Schema database Supabase (chạy trong SQL Editor)
├── agent/                  # Python Agent chạy trên VM
│   ├── requirements.txt    # Thư viện Python: psutil, requests, python-dotenv
│   ├── agent.py            # Script thu thập và gửi metrics
│   └── .env.example        # Mẫu file cấu hình agent
└── web/                    # Next.js Frontend
    ├── src/
    │   ├── app/
    │   │   ├── layout.tsx  # Root layout (font, màu nền)
    │   │   ├── page.tsx    # Dashboard chính (Realtime)
    │   │   └── globals.css # CSS toàn cục (DevOps theme)
    │   ├── lib/
    │   │   └── supabase.ts # Khởi tạo Supabase client
    │   └── components/     # (Để thêm component mới)
    ├── tailwind.config.ts  # Cấu hình màu DevOps theme
    ├── package.json        # Dependencies
    └── .env.local.example  # Mẫu biến môi trường Next.js
```

---

## 🚀 Hướng dẫn Setup

### Bước 1: Setup Supabase Database

1. Đăng ký tại [supabase.com](https://supabase.com) và tạo project mới
2. Vào **SQL Editor** và chạy toàn bộ file [`supabase_schema.sql`](./supabase_schema.sql)
3. Vào **Settings > API** để lấy:
   - `Project URL` → dùng cho `SUPABASE_URL` (agent) và `NEXT_PUBLIC_SUPABASE_URL` (web)
   - `anon` key → dùng cho `NEXT_PUBLIC_SUPABASE_ANON_KEY` (web)
   - `service_role` key → dùng cho `SUPABASE_SERVICE_ROLE_KEY` (agent)
4. Thêm một server thủ công vào bảng `servers`:
   ```sql
   -- Chạy trong SQL Editor của Supabase
   -- (Thay user_id bằng UUID của bạn từ Auth > Users)
   INSERT INTO servers (name, ip_address, user_id)
   VALUES ('Production VM', '192.168.1.1', '<YOUR_USER_UUID>');
   ```
5. Copy UUID của server vừa tạo → dùng làm `SERVER_ID` cho agent

---

### Bước 2: Chạy Python Agent trên VM

```bash
# Clone repo hoặc copy thư mục agent lên VM
cd agent

# Cài thư viện
pip install -r requirements.txt

# Tạo file .env từ mẫu và điền thông tin
cp .env.example .env
nano .env  # Điền SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SERVER_ID

# Chạy agent (foreground để test)
python agent.py

# Chạy ngầm (production)
nohup python agent.py > agent.log 2>&1 &
```

**Nội dung file `.env` của agent:**
```env
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
SERVER_ID=uuid-của-server-trong-db
SEND_INTERVAL=10
CPU_ALERT_THRESHOLD=80
```

---

### Bước 3: Deploy Frontend lên Vercel

```bash
cd web

# Cài thư viện (lần đầu)
npm install

# Chạy development server để test
cp .env.local.example .env.local
# Điền NEXT_PUBLIC_SUPABASE_URL và NEXT_PUBLIC_SUPABASE_ANON_KEY vào .env.local
npm run dev
# Mở http://localhost:3000
```

**Deploy lên Vercel:**
1. Push code lên GitHub
2. Vào [vercel.com](https://vercel.com) → **New Project** → Import repo này
3. Chọn **Root Directory** là `web/`
4. Thêm Environment Variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. Click **Deploy** 🚀

---

## 🏗️ Kiến trúc hệ thống

```
[VM / GCP]                [Supabase]              [Vercel]
  Python Agent  ──POST──▶  REST API  ◀──WebSocket──  Next.js
  (psutil)                 Database                  (React)
                           Realtime
```

**Luồng dữ liệu:**
1. Agent thu thập CPU/RAM/Disk bằng `psutil` mỗi 10 giây
2. Agent POST dữ liệu đến Supabase REST API (bảng `metrics`)
3. Supabase phát sự kiện qua WebSocket đến tất cả client đang subscribe
4. Frontend Next.js nhận sự kiện và cập nhật UI ngay lập tức (không reload)

---

## 🔐 Bảo mật

| Key | Dùng ở đâu | Có thể public? |
|-----|-----------|----------------|
| `anon` key | Frontend (Next.js) | ✅ An toàn (RLS bảo vệ) |
| `service_role` key | Agent (Python, server-side) | ❌ Tuyệt đối bí mật |

- **RLS (Row Level Security)**: User chỉ thấy data của chính mình
- **Service Role Key**: Chỉ dùng trong agent chạy trên VM, không bao giờ đưa vào frontend

---

## 🛠️ Tech Stack

| Phần | Công nghệ |
|------|-----------|
| Frontend | Next.js 14, React, TypeScript |
| Styling | Tailwind CSS (dark theme) |
| Database | Supabase (PostgreSQL) |
| Realtime | Supabase Realtime (WebSocket) |
| Agent | Python 3, psutil, requests |
| Deploy | Vercel (frontend), any VM (agent) |

---

## 📝 License

MIT License - Xem file [LICENSE](./LICENSE) để biết thêm chi tiết.
