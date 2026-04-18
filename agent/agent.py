"""
DevOps Status Dashboard - Python Agent
=======================================
Script này chạy liên tục trên VM/Server, thu thập các thông số
hệ thống (CPU, RAM, Disk) và gửi realtime lên Supabase.

Cách chạy:
  1. Chạy ./setup.sh để cấu hình tự động
  2. Hoặc tạo file .env thủ công rồi chạy: python3 agent.py
"""

import time
import psutil
import requests
import os
from datetime import datetime

# ============================================================
# LOAD BIẾN MÔI TRƯỜNG TỪ FILE .env (python-dotenv)
# ============================================================
# Thư viện python-dotenv giúp đọc các biến từ file .env
# mà không cần phải gắn cứng (hardcode) thông tin nhạy cảm vào code.
from dotenv import load_dotenv

# Tải các biến từ file .env trong cùng thư mục với script này
load_dotenv()

# Đọc các biến cấu hình từ môi trường
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
# SUPABASE_KEY ở đây là SERVICE_ROLE_KEY - có quyền bypass RLS để insert data
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
SERVER_ID = os.getenv("SERVER_ID", "")

# Kiểm tra xem cấu hình đã đầy đủ chưa, nếu thiếu thì dừng lại
if not SUPABASE_URL or not SUPABASE_KEY or not SERVER_ID:
    print("❌ LỖI: Thiếu cấu hình! Vui lòng chạy ./setup.sh hoặc tạo file .env thủ công.")
    print("   File .env cần có 3 dòng:")
    print("   SUPABASE_URL=https://your-project.supabase.co")
    print("   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key")
    print("   SERVER_ID=uuid-của-server-trong-db")
    exit(1)

# ============================================================
# CẤU HÌNH HTTP HEADERS CHO SUPABASE REST API
# ============================================================
HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    # "return=minimal" để Supabase không trả về data sau khi insert (tiết kiệm bandwidth)
    "Prefer": "return=minimal",
}


def send_metric(cpu: float, memory: float, disk: float) -> bool:
    """
    Gửi dữ liệu metrics (CPU, RAM, Disk) lên bảng 'metrics' trong Supabase.

    Args:
        cpu: Phần trăm sử dụng CPU (0-100)
        memory: Phần trăm sử dụng RAM (0-100)
        disk: Phần trăm sử dụng Disk (0-100)

    Returns:
        True nếu gửi thành công, False nếu có lỗi
    """
    url = f"{SUPABASE_URL}/rest/v1/metrics"
    data = {
        "server_id": SERVER_ID,
        "cpu": cpu,
        "memory": memory,
        "disk": disk,
        "status": "online",
    }
    try:
        response = requests.post(url, headers=HEADERS, json=data, timeout=10)
        # Supabase trả về 201 Created khi insert thành công
        return response.status_code == 201
    except requests.exceptions.RequestException as e:
        print(f"❌ Lỗi kết nối khi gửi metric: {e}")
        return False


def send_log(message: str) -> bool:
    """
    Gửi một dòng log cảnh báo lên bảng 'logs' trong Supabase.

    Args:
        message: Nội dung log cần gửi

    Returns:
        True nếu gửi thành công, False nếu có lỗi
    """
    url = f"{SUPABASE_URL}/rest/v1/logs"
    # Thêm timestamp vào đầu mỗi dòng log để dễ theo dõi
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    data = {
        "server_id": SERVER_ID,
        "message": f"[{timestamp}] {message}",
    }
    try:
        response = requests.post(url, headers=HEADERS, json=data, timeout=10)
        return response.status_code == 201
    except requests.exceptions.RequestException as e:
        print(f"❌ Lỗi kết nối khi gửi log: {e}")
        return False


# ============================================================
# VÒNG LẶP CHÍNH - CHẠY VÔ TẬN
# ============================================================
print("=" * 50)
print("🚀 DevOps Agent đã khởi động!")
print(f"   Server ID : {SERVER_ID}")
print(f"   Supabase  : {SUPABASE_URL}")
print(f"   Gửi dữ liệu mỗi 10 giây...")
print("=" * 50)

# Gửi log thông báo agent vừa khởi động
send_log("✅ Agent khởi động thành công và bắt đầu monitor.")

while True:
    try:
        # --- Thu thập dữ liệu hệ thống bằng thư viện psutil ---

        # CPU: interval=1 nghĩa là đo trong 1 giây để có kết quả chính xác
        cpu_percent = psutil.cpu_percent(interval=1)

        # RAM: virtual_memory() trả về object chứa nhiều thông số
        mem = psutil.virtual_memory()

        # Disk: disk_usage('/') đo dung lượng ổ đĩa gốc
        disk = psutil.disk_usage("/")

        # --- Gửi dữ liệu lên Supabase ---
        success = send_metric(cpu_percent, mem.percent, disk.percent)

        if success:
            print(
                f"✅ [{datetime.now().strftime('%H:%M:%S')}] "
                f"CPU: {cpu_percent:.1f}% | "
                f"RAM: {mem.percent:.1f}% | "
                f"Disk: {disk.percent:.1f}%"
            )
        else:
            print(f"⚠️  [{datetime.now().strftime('%H:%M:%S')}] Gửi dữ liệu thất bại, thử lại sau...")

        # --- Kiểm tra CPU Spike (Bonus Alert) ---
        # Nếu CPU vượt ngưỡng 80%, gửi log cảnh báo lên Supabase
        if cpu_percent > 80:
            warning_msg = f"⚠️ CẢNH BÁO: CPU đang quá tải! ({cpu_percent:.1f}%)"
            print(f"🔔 {warning_msg}")
            send_log(warning_msg)

        # --- Kiểm tra RAM Spike ---
        if mem.percent > 85:
            warning_msg = f"⚠️ CẢNH BÁO: RAM gần đầy! ({mem.percent:.1f}%)"
            print(f"🔔 {warning_msg}")
            send_log(warning_msg)

    except Exception as e:
        # Bắt mọi lỗi không mong muốn để script không bị crash
        print(f"❌ Lỗi không xác định: {e}")
        send_log(f"❌ Agent gặp lỗi không xác định: {e}")

    # Đợi 10 giây trước khi gửi vòng dữ liệu tiếp theo
    time.sleep(9)  # 9s + 1s của cpu_percent(interval=1) = 10s
