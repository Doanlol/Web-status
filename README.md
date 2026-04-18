# 🚀 DevOps Status Dashboard

> **Theo dõi server của bạn theo thời gian thực** — CPU, RAM, Disk và Log, tất cả hiển thị ngay lập tức trên trình duyệt mà không cần tải lại trang.

![Next.js](https://img.shields.io/badge/Frontend-Next.js%2015-black?logo=next.js)
![Supabase](https://img.shields.io/badge/Backend-Supabase-3ECF8E?logo=supabase)
![Python](https://img.shields.io/badge/Agent-Python%203-3776AB?logo=python)
![License](https://img.shields.io/badge/License-MIT-blue)

---

## 📐 Kiến trúc hệ thống

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│   🖥️  VM / Server (GCP, AWS, VPS...)                │
│   ┌─────────────────────────────────────┐           │
│   │  agent/agent.py (Python + psutil)  │           │
│   │  Thu thập CPU, RAM, Disk mỗi 10s   │           │
│   └──────────────┬──────────────────────┘           │
│                  │ HTTP POST (REST API)              │
└──────────────────┼──────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│  ☁️  Supabase (Backend-as-a-Service)                 │
│  ┌──────────┐  ┌──────────┐  ┌────────────────────┐ │
│  │ servers  │  │ metrics  │  │       logs         │ │
│  │  (bảng) │  │  (bảng) │  │      (bảng)        │ │
│  └──────────┘  └──────────┘  └────────────────────┘ │
│                PostgreSQL + RLS + Realtime           │
└──────────────────┬──────────────────────────────────┘
                   │ WebSocket (Realtime)
                   ▼
┌─────────────────────────────────────────────────────┐
│  🌐 Frontend — Next.js (Vercel)                     │
│  Dashboard hiển thị CPU/RAM/Disk + Log realtime     │
│  Không cần F5 — tự động cập nhật qua WebSocket     │
└─────────────────────────────────────────────────────┘
```

| Thành phần | Công nghệ | Vai trò |
|---|---|---|
| **Frontend** | Next.js 15 (React + TypeScript) | Giao diện hiển thị dashboard |
| **Backend** | Supabase (PostgreSQL + Realtime) | Lưu trữ dữ liệu, xác thực, WebSocket |
| **Agent** | Python 3 + psutil | Chạy trên VM, thu thập và gửi metrics |

---

## 📂 Cấu trúc thư mục

```
Web-status/
├── agent/                  # 🤖 Python Agent - chạy trên VM/Server
│   ├── agent.py            # Script chính thu thập metrics
│   ├── requirements.txt    # Thư viện Python cần thiết
│   └── setup.sh            # Script cài đặt tự động (chạy 1 lần)
│
├── web/                    # 🌐 Next.js Frontend
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx    # Dashboard chính (Realtime)
│   │   │   ├── layout.tsx  # Layout & font
│   │   │   └── globals.css # Style toàn cục
│   │   └── lib/
│   │       └── supabase.ts # Cấu hình Supabase client
│   ├── tailwind.config.js  # Theme DevOps (dark + green)
│   └── package.json
│
├── supabase_schema.sql     # 🗄️ SQL tạo Database + RLS + Realtime
└── README.md               # 📖 File này
```

---

## 🛠️ Hướng dẫn Setup từ A–Z

### ⚡ Bước 1: Setup Database (Supabase)

#### 1.1 — Tạo Project Supabase

1. Truy cập [supabase.com](https://supabase.com) và đăng ký tài khoản (miễn phí).
2. Nhấn **"New Project"**.
3. Điền tên project (VD: `devops-dashboard`), đặt mật khẩu database và chọn region gần bạn nhất.
4. Nhấn **"Create new project"** và đợi khoảng 1–2 phút để project khởi tạo.

#### 1.2 — Chạy file SQL để tạo Database

1. Khi project đã sẵn sàng, nhìn vào **thanh menu bên trái**, nhấn vào biểu tượng **SQL Editor** (hình dấu `</>`).
2. Nhấn nút **"New query"** (góc trên bên phải).
3. Mở file `supabase_schema.sql` trong repo này, **copy toàn bộ nội dung**.
4. Dán vào ô SQL Editor và nhấn nút **"Run"** (hoặc `Ctrl+Enter`).
5. Bạn sẽ thấy thông báo `Success. No rows returned` — có nghĩa là đã tạo thành công 3 bảng và cấu hình bảo mật.

#### 1.3 — Lấy API Keys

> ⚠️ **Quan trọng:** `service_role` key có quyền **tối cao**, có thể đọc/ghi/xóa toàn bộ database bất kể RLS. **Đừng bao giờ** để lộ key này ra frontend hoặc public repository!

1. Nhìn vào thanh menu bên trái, nhấn biểu tượng **bánh răng ⚙️** → chọn **"API"**.
2. Bạn sẽ thấy 3 thông tin quan trọng, hãy **copy và lưu lại vào file note**:

```
📌 Project URL:
   https://xxxxxxxxxxxx.supabase.co
   (Phần "Project URL" — dùng cho cả Frontend và Agent)

📌 anon public (dùng cho Frontend):
   eyJhbGciOiJIUzI1NiIsInR5cCI6...
   (Mục "Project API Keys" → Key có label "anon" "public")

📌 service_role secret (dùng cho Agent — BÍ MẬT!):
   eyJhbGciOiJIUzI1NiIsInR5cCI6...
   (Mục "Project API Keys" → Key có label "service_role" — nhấn 👁 để hiện)
```

#### 1.4 — Tạo Server ID

Đây là bước tạo một "bản ghi server" trong database để Agent biết nó đang gửi data cho server nào.

1. Nhìn vào thanh menu bên trái, nhấn biểu tượng **bảng 📊** → **"Table Editor"**.
2. Trong danh sách bảng bên trái, chọn bảng **`servers`**.
3. Nhấn nút **"Insert" → "Insert row"** (góc trên bên phải).
4. Điền thông tin:
   - **`name`**: Tên server của bạn (VD: `GCP Production VM`)
   - **`ip_address`**: Địa chỉ IP của VM (VD: `34.123.45.67`) — có thể bỏ trống
   - **`user_id`**: Đây là UUID của tài khoản Supabase Auth. Tạm thời bạn có thể để trống nếu chưa setup Auth, hoặc lấy từ **Authentication → Users**.
5. Nhấn **"Save"**.
6. Sau khi lưu, bạn sẽ thấy một hàng mới xuất hiện với một mã ở cột **`id`** có dạng `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`.
7. **Copy mã UUID này** — đây chính là `SERVER_ID` bạn sẽ dùng cho Agent.

---

### 🌐 Bước 2: Setup Frontend (Next.js)

#### 2.1 — Cài đặt và cấu hình

```bash
# Di chuyển vào thư mục web
cd web

# Tạo file cấu hình môi trường cho Next.js
# (file .env.local KHÔNG được commit lên GitHub)
touch .env.local
```

Mở file `web/.env.local` vừa tạo và điền thông tin đã lấy ở Bước 1.3:

```env
# web/.env.local
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6...
```

> 💡 `NEXT_PUBLIC_` là prefix bắt buộc để Next.js biết đây là biến dành cho phía trình duyệt (client-side).

#### 2.2 — Cài đặt thư viện và chạy

```bash
# Cài đặt tất cả thư viện từ package.json
npm install

# Chạy server development (mặc định tại http://localhost:3000)
npm run dev
```

Mở trình duyệt và truy cập `http://localhost:3000`. Bạn sẽ thấy giao diện Dashboard màu tối.

#### 2.3 — Deploy lên Vercel (tùy chọn)

1. Đăng nhập [vercel.com](https://vercel.com) bằng tài khoản GitHub.
2. Nhấn **"Add New... → Project"** → chọn repository `Web-status`.
3. **⚙️ Cấu hình quan trọng:**
   - **Root Directory**: Nhấn **"Edit"** và chọn thư mục **`web`** (vì Next.js nằm trong folder `web`, không phải thư mục gốc).
   - **Environment Variables**: Thêm 2 biến:
     - `NEXT_PUBLIC_SUPABASE_URL` = URL Supabase của bạn
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = anon key của bạn
4. Nhấn **"Deploy"** và đợi 1–2 phút.
5. Vercel sẽ cấp cho bạn một đường link dạng `https://web-status-xxx.vercel.app`.

---

### 🤖 Bước 3: Setup Agent trên Server/VM

#### 3.1 — Kéo code về VM

```bash
# SSH vào VM của bạn trước, sau đó:

# Clone repository
git clone https://github.com/Doanlol/Web-status.git

# Di chuyển vào thư mục agent
cd Web-status/agent
```

#### 3.2 — Cấp quyền thực thi cho script

```bash
chmod +x setup.sh
```

#### 3.3 — Chạy script cài đặt tự động

```bash
./setup.sh
```

Script sẽ hỏi bạn 3 thông tin đã lấy từ **Bước 1**. Hãy dán vào khi được hỏi:

```
======================================
🚀 CÀI ĐẶT DEVOPS AGENT TỰ ĐỘNG
======================================
Bạn cần chuẩn bị 3 thông tin từ Supabase trước khi tiếp tục.

--- Nhập thông tin cấu hình ---

🔗 Nhập SUPABASE_URL: https://xxxxxxxxxxxx.supabase.co
🔑 Nhập SUPABASE_SERVICE_ROLE_KEY: eyJhbGciOiJIUzI1NiIsInR5cCI6...
🖥️  Nhập SERVER_ID (UUID từ bảng servers): xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

Script sẽ tự động:
- ✅ Tạo file `.env` với thông tin bạn vừa nhập
- ✅ Cài đặt tất cả thư viện Python (`psutil`, `requests`, `python-dotenv`)
- ✅ Khởi động Agent chạy ngầm trong nền (background)

#### 3.4 — Kiểm tra Agent đang chạy

```bash
# Xem log realtime (nhấn Ctrl+C để thoát)
tail -f agent_log.txt

# Xem toàn bộ log từ đầu
cat agent_log.txt
```

Output mẫu khi Agent chạy thành công:

```
==================================================
🚀 DevOps Agent đã khởi động!
   Server ID : xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
   Supabase  : https://xxxxxxxxxxxx.supabase.co
   Gửi dữ liệu mỗi 10 giây...
==================================================
✅ [10:30:00] CPU: 5.2% | RAM: 42.1% | Disk: 33.8%
✅ [10:30:10] CPU: 6.1% | RAM: 42.3% | Disk: 33.8%
✅ [10:30:20] CPU: 4.8% | RAM: 41.9% | Disk: 33.8%
```

---

## ✅ Kiểm tra hệ thống hoạt động

Sau khi hoàn thành 3 bước, hãy kiểm tra:

1. **Mở Dashboard** tại địa chỉ Vercel (hoặc `http://localhost:3000`).
2. Bạn sẽ thấy card server với tên bạn đã tạo.
3. Các thanh tiến trình CPU/RAM/Disk sẽ **tự động cập nhật mỗi 10 giây** mà không cần F5.
4. Nếu CPU vượt 80%, log cảnh báo sẽ xuất hiện ngay trong phần Terminal ở cuối card.

---

## 🔧 Xử lý sự cố thường gặp

| Vấn đề | Giải pháp |
|---|---|
| Dashboard hiện `Không thể tải dữ liệu` | Kiểm tra file `web/.env.local` đã có đúng URL và Key chưa |
| Agent log báo `Lỗi kết nối` | Kiểm tra `SUPABASE_URL` và `SUPABASE_SERVICE_ROLE_KEY` trong file `agent/.env` |
| Agent chạy nhưng không có data trên Dashboard | Kiểm tra `SERVER_ID` có khớp với UUID trong bảng `servers` không |
| Dashboard offline dù agent đang chạy | Agent gửi > 20 giây mới được 1 lần — hoặc bị lỗi mạng, xem `agent_log.txt` |
| Lỗi `RLS policy violation` | Đảm bảo đã chạy file `supabase_schema.sql` đầy đủ |

---

## 🔐 Bảo mật

- **Không bao giờ** commit file `.env` hoặc `.env.local` lên GitHub — chúng đã được thêm vào `.gitignore`.
- `SERVICE_ROLE_KEY` chỉ dùng cho Agent trên server, không bao giờ dùng cho frontend.
- `anon key` an toàn để public vì đã được bảo vệ bởi RLS policies.
- Mọi truy cập đều qua RLS — user A không bao giờ thấy data của user B.

---

## 📄 License

MIT © [Cao Anh Đoàn](https://github.com/Doanlol)