#!/bin/bash
# ============================================================
# DevOps Status Dashboard - Agent Setup Script
# ============================================================
# Script này tự động hóa toàn bộ quá trình cài đặt Agent.
# Chỉ cần chạy một lần duy nhất: ./setup.sh
# ============================================================

set -e  # Dừng script ngay nếu có lệnh nào bị lỗi

# --- Màu sắc cho terminal (để output trông đẹp hơn) ---
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'  # No Color (reset)

# ============================================================
# BƯỚC 0: Màn hình chào mừng
# ============================================================
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   🚀 DevOps Status Dashboard - Agent     ║${NC}"
echo -e "${GREEN}║      Script cài đặt tự động              ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"
echo ""
echo -e "${CYAN}Bạn cần chuẩn bị 3 thông tin từ Supabase trước khi tiếp tục.${NC}"
echo -e "${CYAN}Xem hướng dẫn lấy các thông tin này trong file README.md.${NC}"
echo ""

# ============================================================
# BƯỚC 1: Thu thập thông tin từ người dùng
# ============================================================
echo -e "${YELLOW}--- Nhập thông tin cấu hình ---${NC}"
echo ""

# Yêu cầu người dùng nhập SUPABASE_URL
# (Ví dụ: https://abcdefgh.supabase.co)
read -p "🔗 Nhập SUPABASE_URL (vd: https://xxx.supabase.co): " SUPABASE_URL

# Yêu cầu người dùng nhập SERVICE_ROLE_KEY
# (Key bí mật có quyền tối cao - cần bảo vệ kỹ!)
read -p "🔑 Nhập SUPABASE_SERVICE_ROLE_KEY: " SUPABASE_SERVICE_ROLE_KEY

# Yêu cầu người dùng nhập SERVER_ID
# (UUID của server đã tạo trong bảng 'servers' trên Supabase)
read -p "🖥️  Nhập SERVER_ID (UUID từ bảng servers): " SERVER_ID

echo ""

# Kiểm tra xem người dùng đã nhập đủ thông tin chưa
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ] || [ -z "$SERVER_ID" ]; then
    echo -e "${RED}❌ LỖI: Bạn chưa nhập đủ thông tin. Vui lòng chạy lại script.${NC}"
    exit 1
fi

# ============================================================
# BƯỚC 2: Tạo file .env để lưu thông tin cấu hình
# ============================================================
echo -e "${CYAN}📝 Đang tạo file .env...${NC}"

# Ghi 3 biến vào file .env trong cùng thư mục agent/
# File này sẽ được agent.py đọc khi khởi động
cat > .env << EOF
# File cấu hình Agent - Đừng chia sẻ file này với ai!
# Được tạo tự động bởi setup.sh vào $(date)

SUPABASE_URL=${SUPABASE_URL}
SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
SERVER_ID=${SERVER_ID}
EOF

echo -e "${GREEN}✅ Đã tạo file .env thành công!${NC}"

# ============================================================
# BƯỚC 3: Cài đặt các thư viện Python cần thiết
# ============================================================
echo ""
echo -e "${CYAN}📦 Đang cài đặt thư viện Python (requirements.txt)...${NC}"
pip install -r requirements.txt

echo -e "${GREEN}✅ Đã cài đặt xong thư viện!${NC}"

# ============================================================
# BƯỚC 4: Chạy Agent dưới dạng background process
# ============================================================
echo ""
echo -e "${CYAN}🔥 Đang khởi động Agent ở chế độ nền (background)...${NC}"

# nohup: Giữ cho process chạy ngay cả khi bạn đóng terminal/SSH
# > agent_log.txt 2>&1: Redirect tất cả output (cả lỗi) vào file log
# &: Chạy nền (background)
nohup python3 agent.py > agent_log.txt 2>&1 &

# Lưu PID (Process ID) để user biết process đang chạy
AGENT_PID=$!

# Đợi 2 giây để agent khởi động và kiểm tra có bị crash không
sleep 2

if ps -p $AGENT_PID > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Agent đang chạy! (PID: ${AGENT_PID})${NC}"
else
    echo -e "${RED}❌ Agent bị lỗi khi khởi động. Kiểm tra file agent_log.txt để xem chi tiết.${NC}"
    echo ""
    echo -e "${YELLOW}--- Nội dung agent_log.txt ---${NC}"
    cat agent_log.txt
    exit 1
fi

# ============================================================
# BƯỚC 5: Thông báo hoàn tất
# ============================================================
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   🎉 CÀI ĐẶT HOÀN TẤT THÀNH CÔNG!      ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"
echo ""
echo -e "Agent đang chạy ngầm với PID: ${CYAN}${AGENT_PID}${NC}"
echo ""
echo -e "${YELLOW}📋 Các lệnh hữu ích:${NC}"
echo -e "  Xem log realtime : ${CYAN}tail -f agent_log.txt${NC}"
echo -e "  Xem toàn bộ log  : ${CYAN}cat agent_log.txt${NC}"
echo -e "  Dừng Agent       : ${CYAN}kill ${AGENT_PID}${NC}"
echo ""
