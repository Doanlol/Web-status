"""
=============================================================
DevOps Status Dashboard - Python Agent
=============================================================
Script này chạy trên VM/Server và làm các việc sau:
  1. Thu thập CPU, RAM, Disk mỗi 10 giây (dùng psutil)
  2. Gửi dữ liệu lên Supabase REST API (bảng metrics)
  3. Gửi log cảnh báo nếu CPU > 80% (bảng logs)

Cách chạy:
  pip install -r requirements.txt
  cp .env.example .env      # Điền thông tin Supabase vào .env
  python agent.py

Chạy ngầm trên Linux/Mac:
  nohup python agent.py > agent.log 2>&1 &
=============================================================
"""

import time
import psutil
import requests
import os
from datetime import datetime
from dotenv import load_dotenv

# -----------------------------------------------------------
# Load biến môi trường từ file .env
# -----------------------------------------------------------
load_dotenv()

# -----------------------------------------------------------
# CẤU HÌNH - Đọc từ file .env (hoặc điền trực tiếp để test)
# -----------------------------------------------------------
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://<YOUR_PROJECT_REF>.supabase.co")
# Dùng SERVICE_ROLE_KEY để agent có quyền INSERT mà không cần đăng nhập user
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "<YOUR_SUPABASE_SERVICE_ROLE_KEY>")
# UUID của server được tạo trong Supabase Dashboard (bảng servers)
SERVER_ID    = os.getenv("SERVER_ID", "<UUID_CUA_SERVER_TRONG_DB>")

# Khoảng thời gian giữa các lần gửi dữ liệu (giây)
SEND_INTERVAL = int(os.getenv("SEND_INTERVAL", "10"))

# Ngưỡng CPU để gửi cảnh báo (%)
CPU_ALERT_THRESHOLD = float(os.getenv("CPU_ALERT_THRESHOLD", "80"))

# -----------------------------------------------------------
# HTTP Headers dùng cho tất cả API call đến Supabase
# -----------------------------------------------------------
HEADERS = {
    "apikey": SUPABASE_KEY,                    # API key xác thực với Supabase
    "Authorization": f"Bearer {SUPABASE_KEY}", # Bearer token (Service Role)
    "Content-Type": "application/json",         # Dữ liệu gửi dạng JSON
    "Prefer": "return=minimal"                  # Không cần Supabase trả về data sau INSERT
}


def get_system_metrics() -> dict:
    """
    Thu thập thông tin hệ thống hiện tại.

    Returns:
        dict với các key: cpu, memory, disk (đơn vị: %)
    """
    # cpu_percent(interval=1): đo CPU trong 1 giây (chính xác hơn là đo ngay lập tức)
    cpu_percent = psutil.cpu_percent(interval=1)

    # virtual_memory(): thông tin RAM (total, used, available, percent)
    mem = psutil.virtual_memory()

    # disk_usage('/'): thông tin ổ đĩa root (Linux/Mac)
    # Trên Windows: disk_usage('C:\\')
    disk = psutil.disk_usage('/')

    return {
        "cpu":    cpu_percent,   # VD: 45.2 (%)
        "memory": mem.percent,   # VD: 72.1 (%)
        "disk":   disk.percent,  # VD: 60.0 (%)
    }


def send_metric(cpu: float, memory: float, disk: float) -> bool:
    """
    Gửi dữ liệu metrics lên Supabase REST API (bảng metrics).

    Args:
        cpu (float): % CPU đang sử dụng
        memory (float): % RAM đang sử dụng
        disk (float): % Disk đang sử dụng

    Returns:
        bool: True nếu gửi thành công, False nếu lỗi
    """
    url = f"{SUPABASE_URL}/rest/v1/metrics"

    # Dữ liệu sẽ được INSERT vào bảng metrics
    data = {
        "server_id": SERVER_ID,
        "cpu":       cpu,
        "memory":    memory,
        "disk":      disk,
        "status":    "online"  # Agent đang chạy → server online
    }

    try:
        response = requests.post(url, headers=HEADERS, json=data, timeout=10)
        # Supabase trả về 201 Created khi INSERT thành công
        return response.status_code == 201
    except requests.exceptions.RequestException as e:
        print(f"  ❌ Lỗi kết nối Supabase: {e}")
        return False


def send_log(message: str) -> bool:
    """
    Gửi một dòng log lên Supabase (bảng logs).
    Dùng cho cảnh báo hoặc sự kiện quan trọng.

    Args:
        message (str): Nội dung log cần gửi

    Returns:
        bool: True nếu gửi thành công, False nếu lỗi
    """
    url = f"{SUPABASE_URL}/rest/v1/logs"

    # Thêm timestamp vào đầu message để dễ theo dõi
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    full_message = f"[{timestamp}] {message}"

    data = {
        "server_id": SERVER_ID,
        "message":   full_message
    }

    try:
        response = requests.post(url, headers=HEADERS, json=data, timeout=10)
        return response.status_code == 201
    except requests.exceptions.RequestException as e:
        print(f"  ❌ Lỗi gửi log: {e}")
        return False


def run_agent():
    """
    Vòng lặp chính của agent:
      - Thu thập metrics
      - Gửi lên Supabase
      - Kiểm tra và gửi cảnh báo nếu cần
      - Lặp lại sau SEND_INTERVAL giây
    """
    print("=" * 55)
    print("  🚀 DevOps Status Dashboard - Agent đang khởi động")
    print("=" * 55)
    print(f"  📡 Supabase URL : {SUPABASE_URL}")
    print(f"  🖥️  Server ID   : {SERVER_ID}")
    print(f"  ⏱️  Gửi mỗi    : {SEND_INTERVAL} giây")
    print(f"  ⚠️  Cảnh báo CPU: > {CPU_ALERT_THRESHOLD}%")
    print("=" * 55)
    print()

    # Biến đếm số lần gửi thành công / thất bại
    success_count = 0
    error_count   = 0

    while True:
        try:
            print(f"[{datetime.now().strftime('%H:%M:%S')}] Đang thu thập metrics...")

            # 1. Thu thập thông tin hệ thống
            metrics = get_system_metrics()
            cpu    = metrics["cpu"]
            memory = metrics["memory"]
            disk   = metrics["disk"]

            print(f"  📊 CPU: {cpu:.1f}% | RAM: {memory:.1f}% | Disk: {disk:.1f}%")

            # 2. Gửi metrics lên Supabase
            if send_metric(cpu, memory, disk):
                success_count += 1
                print(f"  ✅ Đã gửi thành công! (Tổng: {success_count} lần)")
            else:
                error_count += 1
                print(f"  ❌ Gửi thất bại (Lỗi: {error_count} lần)")

            # 3. Kiểm tra CPU có vượt ngưỡng cảnh báo không
            if cpu > CPU_ALERT_THRESHOLD:
                warning_msg = f"⚠️ CẢNH BÁO: CPU đang quá tải ({cpu:.1f}% > {CPU_ALERT_THRESHOLD}%)"
                print(f"  {warning_msg}")
                # Gửi log cảnh báo lên Supabase để hiển thị trên dashboard
                send_log(warning_msg)

        except KeyboardInterrupt:
            # Người dùng bấm Ctrl+C để dừng agent
            print("\n\n🛑 Agent đã dừng bởi người dùng.")
            print(f"   Tổng gửi thành công: {success_count}")
            print(f"   Tổng lỗi           : {error_count}")
            break
        except Exception as e:
            # Lỗi không mong đợi - ghi log nhưng không dừng agent
            error_count += 1
            print(f"  ❌ Lỗi không mong đợi: {e}")

        # Đợi SEND_INTERVAL giây trước khi gửi lần tiếp theo
        print(f"  💤 Đợi {SEND_INTERVAL} giây...\n")
        time.sleep(SEND_INTERVAL)


# -----------------------------------------------------------
# Điểm vào chính của chương trình
# -----------------------------------------------------------
if __name__ == "__main__":
    run_agent()
