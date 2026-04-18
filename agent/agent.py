"""
DevOps Status Dashboard - Python Agent (Zero-Config)
=====================================================
Script này chạy liên tục trên VM/Server, thu thập các thông số
hệ thống (CPU, RAM, Disk) và gửi lên Dashboard API.

Cách chạy:
  1. Chạy Zero-Config setup script từ Dashboard:
       curl -fsSL https://<dashboard-url>/api/setup | bash
  2. Hoặc tạo file .env thủ công rồi chạy: python3 agent.py
       File .env cần có:
         API_URL=https://your-dashboard.com
         TOKEN=uuid-token-của-server
"""

import time
import socket
import psutil
import requests
import os
from datetime import datetime

# ============================================================
# LOAD BIẾN MÔI TRƯỜNG TỪ FILE .env (python-dotenv)
# ============================================================
from dotenv import load_dotenv

load_dotenv()

# Đọc các biến cấu hình từ môi trường
API_URL = os.getenv("API_URL", "").rstrip("/")
TOKEN = os.getenv("TOKEN", "")

# Kiểm tra xem cấu hình đã đầy đủ chưa, nếu thiếu thì dừng lại
if not API_URL or not TOKEN:
    print("❌ LỖI: Thiếu cấu hình! Vui lòng chạy setup script hoặc tạo file .env thủ công.")
    print("   File .env cần có 2 dòng:")
    print("   API_URL=https://your-dashboard.com")
    print("   TOKEN=uuid-token-của-server")
    print("")
    print("   Hoặc chạy lệnh sau để cài đặt tự động:")
    print("   curl -fsSL https://your-dashboard.com/api/setup | bash")
    exit(1)

# ============================================================
# CẤU HÌNH HTTP HEADERS CHO DASHBOARD API
# ============================================================
HEADERS = {
    "Authorization": f"Bearer {TOKEN}",
    "Content-Type": "application/json",
}


def register_server() -> str:
    """
    Đăng ký server với Dashboard API khi agent khởi động.
    Dùng TOKEN (trong Authorization header) làm khóa nhận diện.

    Returns:
        server_id (UUID string) để dùng cho metrics và logs.

    Raises:
        Exception nếu không thể đăng ký server.
    """
    url = f"{API_URL}/api/register"
    hostname = socket.gethostname()
    try:
        response = requests.post(
            url,
            headers=HEADERS,
            json={"hostname": hostname},
            timeout=10,
        )
        response.raise_for_status()
        return response.json()["id"]
    except requests.exceptions.RequestException as e:
        raise Exception(f"Không thể đăng ký server: {e}") from e


def send_metric(server_id: str, cpu: float, memory: float, disk: float) -> bool:
    """
    Gửi dữ liệu metrics (CPU, RAM, Disk) lên Dashboard API.

    Args:
        server_id: UUID của server
        cpu: Phần trăm sử dụng CPU (0-100)
        memory: Phần trăm sử dụng RAM (0-100)
        disk: Phần trăm sử dụng Disk (0-100)

    Returns:
        True nếu gửi thành công, False nếu có lỗi
    """
    url = f"{API_URL}/api/metrics"
    data = {
        "server_id": server_id,
        "cpu": cpu,
        "memory": memory,
        "disk": disk,
    }
    try:
        response = requests.post(url, headers=HEADERS, json=data, timeout=10)
        return response.status_code == 201
    except requests.exceptions.RequestException as e:
        print(f"❌ Lỗi kết nối khi gửi metric: {e}")
        return False


def send_log(server_id: str, message: str) -> bool:
    """
    Gửi một dòng log cảnh báo lên Dashboard API.

    Args:
        server_id: UUID của server
        message: Nội dung log cần gửi

    Returns:
        True nếu gửi thành công, False nếu có lỗi
    """
    url = f"{API_URL}/api/logs"
    # Thêm timestamp vào đầu mỗi dòng log để dễ theo dõi
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    data = {
        "server_id": server_id,
        "message": f"[{timestamp}] {message}",
    }
    try:
        response = requests.post(url, headers=HEADERS, json=data, timeout=10)
        return response.status_code == 201
    except requests.exceptions.RequestException as e:
        print(f"❌ Lỗi kết nối khi gửi log: {e}")
        return False


# ============================================================
# ĐĂNG KÝ SERVER VỚI DASHBOARD API
# ============================================================
print("=" * 50)
print("🚀 DevOps Agent đang khởi động...")
print(f"   Dashboard : {API_URL}")
print("=" * 50)

try:
    SERVER_ID = register_server()
except Exception as e:
    print(f"❌ Lỗi khi đăng ký server: {e}")
    exit(1)

# ============================================================
# IN THÔNG TIN KHỞI ĐỘNG & MÃ TOKEN
# ============================================================
print("")
print("=" * 50)
print("🎉 Agent đã chạy! MÃ TOKEN CỦA BẠN LÀ:")
print(f"   👉  {TOKEN}")
print("")
print("   Dùng mã này trong Dashboard để nhận quyền")
print("   quản lý server này.")
print("=" * 50)
print(f"   Server ID : {SERVER_ID}")
print(f"   Hostname  : {socket.gethostname()}")
print(f"   Gửi dữ liệu mỗi 10 giây...")
print("=" * 50)
print("")

# Gửi log thông báo agent vừa khởi động
send_log(SERVER_ID, "✅ Agent khởi động thành công và bắt đầu monitor.")

while True:
    try:
        # --- Thu thập dữ liệu hệ thống bằng thư viện psutil ---

        # CPU: interval=1 nghĩa là đo trong 1 giây để có kết quả chính xác
        cpu_percent = psutil.cpu_percent(interval=1)

        # RAM: virtual_memory() trả về object chứa nhiều thông số
        mem = psutil.virtual_memory()

        # Disk: disk_usage('/') đo dung lượng ổ đĩa gốc
        disk = psutil.disk_usage("/")

        # --- Gửi dữ liệu lên Dashboard API ---
        success = send_metric(SERVER_ID, cpu_percent, mem.percent, disk.percent)

        if success:
            print(
                f"✅ [{datetime.now().strftime('%H:%M:%S')}] "
                f"CPU: {cpu_percent:.1f}% | "
                f"RAM: {mem.percent:.1f}% | "
                f"Disk: {disk.percent:.1f}%"
            )
        else:
            print(f"⚠️  [{datetime.now().strftime('%H:%M:%S')}] Gửi dữ liệu thất bại, thử lại sau...")

        # --- Kiểm tra CPU Spike ---
        # Nếu CPU vượt ngưỡng 80%, gửi log cảnh báo
        if cpu_percent > 80:
            warning_msg = f"⚠️ CẢNH BÁO: CPU đang quá tải! ({cpu_percent:.1f}%)"
            print(f"🔔 {warning_msg}")
            send_log(SERVER_ID, warning_msg)

        # --- Kiểm tra RAM Spike ---
        if mem.percent > 85:
            warning_msg = f"⚠️ CẢNH BÁO: RAM gần đầy! ({mem.percent:.1f}%)"
            print(f"🔔 {warning_msg}")
            send_log(SERVER_ID, warning_msg)

    except Exception as e:
        # Bắt mọi lỗi không mong muốn để script không bị crash
        print(f"❌ Lỗi không xác định: {e}")
        send_log(SERVER_ID, f"❌ Agent gặp lỗi không xác định: {e}")

    # Đợi 10 giây trước khi gửi vòng dữ liệu tiếp theo
    time.sleep(9)  # 9s + 1s của cpu_percent(interval=1) = 10s
