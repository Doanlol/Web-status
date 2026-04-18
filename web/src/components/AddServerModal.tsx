"use client";

/**
 * Modal "Thêm Server" — Claim Server bằng Token
 *
 * Luồng hoạt động:
 * 1. Modal tự tạo một UUID token ngẫu nhiên khi mở.
 * 2. User copy token và lệnh cài đặt, sau đó chạy trên VM.
 * 3. User điền tên server và nhấn "Thêm vào Dashboard" để
 *    đăng ký trước server (gọi POST /api/register).
 * 4. Khi agent trên VM khởi động với cùng token, nó sẽ
 *    tự cập nhật hostname và IP vào bản ghi đã có.
 */
import { useState, useCallback, useEffect } from "react";
import { X, Copy, Check, Server, Terminal, RefreshCw, Plus } from "lucide-react";

// Thời gian (ms) hiển thị thông báo thành công trước khi đóng modal
const SUCCESS_DISPLAY_DURATION_MS = 1200;

// ============================================================
// KIỂU DỮ LIỆU
// ============================================================
interface AddServerModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

// ============================================================
// COMPONENT: Nút copy với feedback
// ============================================================
function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text).catch(() => {
      // Fallback cho môi trường không hỗ trợ clipboard API
      const el = document.createElement("textarea");
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    });
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all
        bg-devops-border/50 hover:bg-devops-border text-devops-muted hover:text-devops-text"
      title="Copy"
    >
      {copied ? (
        <>
          <Check size={12} className="text-devops-green" />
          {label && <span className="text-devops-green">Đã copy!</span>}
        </>
      ) : (
        <>
          <Copy size={12} />
          {label && <span>{label}</span>}
        </>
      )}
    </button>
  );
}

// ============================================================
// COMPONENT CHÍNH: AddServerModal
// ============================================================
export default function AddServerModal({ onClose, onSuccess }: AddServerModalProps) {
  // Token ngẫu nhiên được tạo khi modal mở (dùng crypto.randomUUID nếu có)
  const [token, setToken] = useState<string>("");
  const [serverName, setServerName] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Tạo token khi component mount (chỉ chạy ở client)
  useEffect(() => {
    const newToken =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : generateFallbackUUID();
    setToken(newToken);
  }, []);

  // Đóng modal khi nhấn Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Lấy URL của dashboard hiện tại để hiển thị trong hướng dẫn
  const dashboardUrl =
    typeof window !== "undefined" ? window.location.origin : "https://your-dashboard.vercel.app";

  // Lệnh cài đặt agent trên VM (dùng token đã tạo)
  const installCommand =
    `export DASHBOARD_TOKEN="${token}"\n` +
    `curl -sL https://raw.githubusercontent.com/Doanlol/Web-status/main/agent/setup.sh -o setup.sh\n` +
    `bash setup.sh`;

  // ── Tạo UUID fallback (RFC 4122 v4, dùng crypto.getRandomValues) ──
  function generateFallbackUUID(): string {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    // Đặt version (4) và variant bits theo RFC 4122
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  // ── Tạo lại token mới ─────────────────────────────────────────
  const regenerateToken = useCallback(() => {
    const newToken =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : generateFallbackUUID();
    setToken(newToken);
    setError(null);
    setSuccess(false);
  }, []);

  // ── Gọi API để đăng ký trước server ──────────────────────────
  const handleRegister = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ hostname: serverName.trim() || "My Server" }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `Lỗi HTTP ${res.status}`);
      }

      setSuccess(true);
      setTimeout(onSuccess, SUCCESS_DISPLAY_DURATION_MS);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Lỗi không xác định";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [token, serverName, onSuccess]);

  return (
    /* Overlay - nhấn nền ngoài để đóng */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.7)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Panel chính */}
      <div className="bg-devops-panel border border-devops-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* ── Header ─────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-devops-border sticky top-0 bg-devops-panel rounded-t-2xl">
          <h2 className="text-devops-text font-bold text-lg flex items-center gap-2">
            <Plus size={18} className="text-devops-green" />
            Thêm Server Mới
          </h2>
          <button
            onClick={onClose}
            className="text-devops-muted hover:text-devops-text transition-colors p-1 rounded-lg hover:bg-devops-border"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-6">
          {/* ── Bước 1: Token ─────────────────────────────── */}
          <section>
            <h3 className="text-devops-green text-sm font-semibold mb-3 flex items-center gap-2">
              <span className="bg-devops-green text-devops-bg w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold">
                1
              </span>
              Token nhận diện server của bạn
            </h3>
            <p className="text-devops-muted text-xs mb-3">
              Mỗi server cần một token duy nhất. Token này sẽ được dùng để agent
              trên VM liên kết với dashboard.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-devops-bg border border-devops-border rounded-lg px-3 py-2 text-devops-green text-xs font-mono break-all select-all">
                {token || "Đang tạo token..."}
              </code>
              <div className="flex flex-col gap-1.5 shrink-0">
                <CopyButton text={token} label="Copy" />
                <button
                  onClick={regenerateToken}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all
                    bg-devops-border/50 hover:bg-devops-border text-devops-muted hover:text-devops-text"
                  title="Tạo token mới"
                >
                  <RefreshCw size={12} />
                  <span>Mới</span>
                </button>
              </div>
            </div>
          </section>

          {/* ── Bước 2: Lệnh cài đặt trên VM ─────────────── */}
          <section>
            <h3 className="text-devops-green text-sm font-semibold mb-3 flex items-center gap-2">
              <span className="bg-devops-green text-devops-bg w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold">
                2
              </span>
              Chạy lệnh này trên VM / Server của bạn
            </h3>
            <p className="text-devops-muted text-xs mb-3">
              SSH vào server, sau đó copy và chạy lệnh bên dưới. Script sẽ tự
              động cài đặt agent và kết nối với dashboard bằng token ở trên.
            </p>
            <div className="relative">
              <div className="flex items-center justify-between bg-devops-bg border border-devops-border rounded-t-lg px-3 py-1.5">
                <span className="flex items-center gap-1.5 text-devops-muted text-xs">
                  <Terminal size={11} />
                  bash
                </span>
                <CopyButton text={installCommand} label="Copy lệnh" />
              </div>
              <pre className="bg-devops-bg/70 border border-devops-border border-t-0 rounded-b-lg px-4 py-3 text-devops-green text-xs font-mono overflow-x-auto whitespace-pre leading-relaxed">
                {installCommand}
              </pre>
            </div>
            <p className="text-devops-muted text-xs mt-2">
              💡 Script sẽ hỏi{" "}
              <code className="text-devops-text">SUPABASE_URL</code> và{" "}
              <code className="text-devops-text">SUPABASE_SERVICE_ROLE_KEY</code>{" "}
              — lấy từ bảng điều khiển Supabase của bạn.
            </p>
          </section>

          {/* ── Bước 3: Đặt tên và đăng ký trước ─────────── */}
          <section>
            <h3 className="text-devops-green text-sm font-semibold mb-3 flex items-center gap-2">
              <span className="bg-devops-green text-devops-bg w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold">
                3
              </span>
              Đặt tên và thêm vào Dashboard
            </h3>
            <p className="text-devops-muted text-xs mb-3">
              Tuỳ chọn: đặt tên thân thiện cho server. Sau đó nhấn{" "}
              <strong className="text-devops-text">Thêm vào Dashboard</strong> để
              đăng ký trước — server sẽ xuất hiện ngay lập tức và tự cập nhật
              khi agent kết nối.
            </p>

            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Server size={14} className="text-devops-muted shrink-0" />
                <input
                  type="text"
                  value={serverName}
                  onChange={(e) => setServerName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !loading && !success) handleRegister();
                  }}
                  placeholder="VD: Production VM, GCP Asia..."
                  className="flex-1 bg-devops-bg border border-devops-border rounded-lg px-3 py-2 text-devops-text text-sm
                    placeholder:text-devops-muted focus:outline-none focus:border-devops-green transition-colors"
                />
              </div>

              {/* Thông báo lỗi */}
              {error && (
                <div className="flex items-start gap-2 bg-devops-red/10 border border-devops-red/30 rounded-lg px-3 py-2 text-devops-red text-xs">
                  <span className="shrink-0 mt-0.5">❌</span>
                  <span>{error}</span>
                </div>
              )}

              {/* Thông báo thành công */}
              {success && (
                <div className="flex items-center gap-2 bg-devops-green/10 border border-devops-green/30 rounded-lg px-3 py-2 text-devops-green text-xs">
                  <Check size={14} />
                  <span>
                    Server đã được thêm! Đang cập nhật dashboard...
                  </span>
                </div>
              )}

              {/* Nút hành động */}
              <div className="flex gap-2">
                <button
                  onClick={handleRegister}
                  disabled={loading || success || !token}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm
                    bg-devops-green text-devops-bg hover:opacity-90 transition-opacity
                    disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      Đang thêm...
                    </>
                  ) : success ? (
                    <>
                      <Check size={14} />
                      Thành công!
                    </>
                  ) : (
                    <>
                      <Plus size={14} />
                      Thêm vào Dashboard
                    </>
                  )}
                </button>
                <button
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-lg border border-devops-border text-devops-muted hover:text-devops-text hover:border-devops-text transition-colors text-sm"
                >
                  Đóng
                </button>
              </div>
            </div>
          </section>

          {/* ── Ghi chú thêm ──────────────────────────────── */}
          <div className="text-devops-muted text-xs bg-devops-bg/50 border border-devops-border rounded-lg px-4 py-3 leading-relaxed">
            <p className="font-medium text-devops-text mb-1">ℹ️ Ghi chú</p>
            <ul className="list-disc list-inside space-y-1">
              <li>
                Token là bí mật — không chia sẻ với người không tin tưởng.
              </li>
              <li>
                Nếu agent đã chạy, server sẽ tự cập nhật hostname và IP.
              </li>
              <li>
                URL dashboard hiện tại:{" "}
                <code className="text-devops-green">{dashboardUrl}</code>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
