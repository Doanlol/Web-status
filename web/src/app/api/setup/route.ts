/**
 * GET /api/setup
 *
 * Trả về một Bash script (text/plain) để cài đặt Agent hoàn toàn tự động
 * (Zero-Config). Người dùng chỉ cần chạy:
 *
 *   curl -fsSL https://<dashboard-url>/api/setup | bash
 *
 * Script sẽ tự:
 *  1. Tải agent.py từ GitHub
 *  2. Tạo TOKEN (UUID ngẫu nhiên)
 *  3. Lưu API_URL + TOKEN vào file .env
 *  4. Cài đặt thư viện Python
 *  5. Chạy agent.py ở background
 *  6. In nổi bật TOKEN ra terminal
 */
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  // Xác định URL gốc của Dashboard để agent biết nơi gửi dữ liệu
  const host =
    request.headers.get("x-forwarded-host") ||
    request.headers.get("host") ||
    "localhost:3000";
  const proto = request.headers.get("x-forwarded-proto") || "http";
  const apiUrl = `${proto}://${host}`;

  // Raw URL của agent.py trên GitHub (Zero-Config: không cần user tự tải)
  const agentRawUrl =
    "https://raw.githubusercontent.com/Doanlol/Web-status/main/agent/agent.py";

  const script = `#!/bin/bash
# ============================================================
# DevOps Status Dashboard - Zero-Config Agent Setup
# ============================================================
# Chạy lệnh này để cài đặt Agent hoàn toàn tự động:
#
#   curl -fsSL ${apiUrl}/api/setup | bash
#
# Không cần cấu hình gì thêm!
# ============================================================

set -e

GREEN='\\033[0;32m'
CYAN='\\033[0;36m'
YELLOW='\\033[1;33m'
RED='\\033[0;31m'
BOLD='\\033[1m'
NC='\\033[0m'

echo ""
echo -e "\${GREEN}╔══════════════════════════════════════════╗\${NC}"
echo -e "\${GREEN}║   🚀 DevOps Status Dashboard - Agent     ║\${NC}"
echo -e "\${GREEN}║      Zero-Config Setup                   ║\${NC}"
echo -e "\${GREEN}╚══════════════════════════════════════════╝\${NC}"
echo ""

# ============================================================
# BƯỚC 1: Tải agent.py từ GitHub
# ============================================================
echo -e "\${CYAN}📥 Đang tải agent.py từ GitHub...\${NC}"
curl -fsSL ${agentRawUrl} -o agent.py
echo -e "\${GREEN}✅ Đã tải agent.py thành công!\${NC}"
echo ""

# ============================================================
# BƯỚC 2: Tự động tạo TOKEN (UUID ngẫu nhiên)
# ============================================================
echo -e "\${CYAN}🔐 Đang tạo TOKEN ngẫu nhiên...\${NC}"
TOKEN=\$(python3 -c "import uuid; print(uuid.uuid4())")
echo -e "\${GREEN}✅ TOKEN đã được tạo!\${NC}"
echo ""

# ============================================================
# BƯỚC 3: Lưu API_URL và TOKEN vào file .env
# ============================================================
echo -e "\${CYAN}📝 Đang lưu cấu hình vào file .env...\${NC}"
printf 'API_URL=${apiUrl}\\nTOKEN=%s\\n' "\$TOKEN" > .env
echo -e "\${GREEN}✅ Đã tạo file .env thành công!\${NC}"
echo ""

# ============================================================
# BƯỚC 4: Cài đặt thư viện Python cần thiết
# ============================================================
echo -e "\${CYAN}📦 Đang cài đặt thư viện Python...\${NC}"
pip install psutil requests python-dotenv
echo -e "\${GREEN}✅ Đã cài đặt xong thư viện!\${NC}"
echo ""

# ============================================================
# BƯỚC 5: Chạy Agent dưới dạng background process
# ============================================================
echo -e "\${CYAN}🔥 Đang khởi động Agent ở chế độ nền (background)...\${NC}"
nohup python3 agent.py > agent_log.txt 2>&1 &
AGENT_PID=\$!
sleep 2

if ps -p \$AGENT_PID > /dev/null 2>&1; then
    echo -e "\${GREEN}✅ Agent đang chạy! (PID: \${AGENT_PID})\${NC}"
else
    echo -e "\${RED}❌ Agent bị lỗi khi khởi động. Kiểm tra agent_log.txt để biết chi tiết.\${NC}"
    echo ""
    cat agent_log.txt
    exit 1
fi

# ============================================================
# BƯỚC 6: Thông báo hoàn tất — in TOKEN nổi bật
# ============================================================
echo ""
echo -e "\${GREEN}\${BOLD}╔════════════════════════════════════════════════════════════╗\${NC}"
echo -e "\${GREEN}\${BOLD}║   🎉 CÀI ĐẶT THÀNH CÔNG!                                  ║\${NC}"
echo -e "\${GREEN}\${BOLD}╠════════════════════════════════════════════════════════════╣\${NC}"
echo -e "\${GREEN}\${BOLD}║                                                            ║\${NC}"
echo -e "\${GREEN}\${BOLD}║   MÃ SERVER TOKEN CỦA BẠN LÀ:                             ║\${NC}"
echo -e "\${GREEN}\${BOLD}║                                                            ║\${NC}"
echo -e "\${GREEN}\${BOLD}║   👉  \${TOKEN}  ║\${NC}"
echo -e "\${GREEN}\${BOLD}║                                                            ║\${NC}"
echo -e "\${GREEN}\${BOLD}╚════════════════════════════════════════════════════════════╝\${NC}"
echo ""
echo -e "\${YELLOW}📌 Sao chép TOKEN trên, mở Dashboard và dán vào ô\${NC}"
echo -e "\${YELLOW}   \"Thêm Server\" để kết nối server này với tài khoản của bạn.\${NC}"
echo ""
echo -e "\${YELLOW}📋 Các lệnh hữu ích:\${NC}"
echo -e "  Xem log realtime : \${CYAN}tail -f agent_log.txt\${NC}"
echo -e "  Xem toàn bộ log  : \${CYAN}cat agent_log.txt\${NC}"
echo -e "  Dừng Agent       : \${CYAN}kill \${AGENT_PID}\${NC}"
echo ""
`;

  return new NextResponse(script, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
