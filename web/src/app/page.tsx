/**
 * =============================================================
 * DevOps Status Dashboard - Trang Chính
 * =============================================================
 * Trang này hiển thị danh sách server và metrics realtime.
 *
 * Tính năng:
 *  - Hiển thị danh sách server với CPU, RAM, Disk progress bar
 *  - Status badge Online/Offline tự động cập nhật
 *  - Nhận dữ liệu realtime qua Supabase WebSocket (không reload trang)
 *  - Hiển thị log realtime dạng terminal
 *
 * Cấu trúc dữ liệu:
 *  - Fetch initial data từ Supabase khi trang load
 *  - Subscribe channel 'metrics_updates' để nhận INSERT mới
 * =============================================================
 */

"use client"; // Next.js App Router: đây là Client Component (có state, effect)

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import {
  Server,
  Activity,
  HardDrive,
  Cpu,
  RefreshCw,
  Terminal,
  Wifi,
  WifiOff,
  Clock,
} from "lucide-react";

// =============================================================
// TYPE DEFINITIONS - Định nghĩa kiểu dữ liệu
// =============================================================

/** Kiểu dữ liệu cho một server */
type ServerData = {
  id: string;
  name: string;
  ip_address: string | null;
  user_id: string;
  created_at: string;
};

/** Kiểu dữ liệu cho một bản ghi metrics */
type Metric = {
  id: string;
  server_id: string;
  cpu: number;
  memory: number;
  disk: number;
  status: string;
  created_at: string;
};

/** Kiểu dữ liệu cho một dòng log */
type Log = {
  id: string;
  server_id: string;
  message: string;
  created_at: string;
};

/** State tổng hợp: mỗi server kèm metric mới nhất và logs */
type ServerWithMetrics = ServerData & {
  latestMetric: Metric | null;
  isOnline: boolean;
};

// =============================================================
// CONSTANTS
// =============================================================

/** Số giây không có metrics → server offline (15 giây) */
const OFFLINE_THRESHOLD_SECONDS = 15;

/** Số dòng log tối đa hiển thị */
const MAX_LOGS_DISPLAY = 50;

// =============================================================
// HELPER FUNCTIONS
// =============================================================

/**
 * Kiểm tra server có online không dựa trên thời gian metric cuối cùng.
 * Nếu không có metrics trong OFFLINE_THRESHOLD_SECONDS giây → offline
 */
function checkIsOnline(lastMetric: Metric | null): boolean {
  if (!lastMetric) return false;
  const now = new Date().getTime();
  const lastSeen = new Date(lastMetric.created_at).getTime();
  const diffSeconds = (now - lastSeen) / 1000;
  return diffSeconds < OFFLINE_THRESHOLD_SECONDS;
}

/**
 * Format thời gian tương đối (vd: "2 giây trước", "1 phút trước")
 */
function formatRelativeTime(dateStr: string): string {
  const now = new Date().getTime();
  const date = new Date(dateStr).getTime();
  const diffSeconds = Math.floor((now - date) / 1000);

  if (diffSeconds < 5)  return "vừa xong";
  if (diffSeconds < 60) return `${diffSeconds} giây trước`;
  if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)} phút trước`;
  return `${Math.floor(diffSeconds / 3600)} giờ trước`;
}

/**
 * Xác định màu sắc của progress bar dựa trên % sử dụng
 *  - < 60%: xanh lá (an toàn)
 *  - 60-80%: vàng (cảnh báo)
 *  - > 80%: đỏ (nguy hiểm)
 */
function getProgressColor(percent: number): string {
  if (percent < 60) return "bg-devops-green";
  if (percent < 80) return "bg-devops-yellow";
  return "bg-devops-red";
}

// =============================================================
// SUB-COMPONENTS
// =============================================================

/**
 * Component ProgressBar - Thanh hiển thị phần trăm sử dụng
 */
function ProgressBar({ value, label, icon }: { value: number; label: string; icon: React.ReactNode }) {
  const colorClass = getProgressColor(value);
  return (
    <div className="flex items-center gap-3">
      {/* Icon */}
      <div className="text-devops-green flex-shrink-0">{icon}</div>
      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-center mb-1">
          <span className="text-sm text-devops-muted uppercase tracking-wider">{label}</span>
          <span className={`text-sm font-bold ${value >= 80 ? "text-devops-red" : "text-devops-green"}`}>
            {value.toFixed(1)}%
          </span>
        </div>
        {/* Progress bar track */}
        <div className="h-1.5 bg-devops-bg rounded-full overflow-hidden">
          {/* Progress bar fill */}
          <div
            className={`h-full ${colorClass} rounded-full progress-bar`}
            style={{ width: `${Math.min(value, 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Component StatusBadge - Badge Online/Offline
 */
function StatusBadge({ isOnline }: { isOnline: boolean }) {
  return (
    <span
      className={`
        inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest
        ${isOnline
          ? "bg-devops-green/10 text-devops-green border border-devops-green/30 badge-online"
          : "bg-devops-red/10 text-devops-red border border-devops-red/30 badge-offline"
        }
      `}
    >
      {isOnline ? <Wifi size={12} /> : <WifiOff size={12} />}
      {isOnline ? "ONLINE" : "OFFLINE"}
    </span>
  );
}

/**
 * Component ServerCard - Card hiển thị thông tin một server
 */
function ServerCard({ server }: { server: ServerWithMetrics }) {
  const metric = server.latestMetric;

  return (
    <div className="server-card bg-devops-panel border border-devops-border rounded-xl p-6 shadow-lg">
      {/* Header: Tên server + Status badge */}
      <div className="flex justify-between items-start mb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Server size={16} className="text-devops-green" />
            <h2 className="text-lg font-bold text-white">{server.name}</h2>
          </div>
          {/* IP Address */}
          {server.ip_address && (
            <p className="text-xs text-devops-muted font-mono">{server.ip_address}</p>
          )}
        </div>
        <StatusBadge isOnline={server.isOnline} />
      </div>

      {/* Metrics hoặc thông báo offline */}
      {metric ? (
        <div className="space-y-4">
          {/* CPU Progress Bar */}
          <ProgressBar
            value={metric.cpu}
            label="CPU"
            icon={<Cpu size={16} />}
          />
          {/* RAM Progress Bar */}
          <ProgressBar
            value={metric.memory}
            label="RAM"
            icon={<Activity size={16} />}
          />
          {/* Disk Progress Bar */}
          <ProgressBar
            value={metric.disk}
            label="Disk"
            icon={<HardDrive size={16} />}
          />
        </div>
      ) : (
        /* Chưa có dữ liệu */
        <div className="text-center py-6 text-devops-muted">
          <RefreshCw size={24} className="mx-auto mb-2 opacity-50" />
          <p className="text-sm">Chưa nhận được dữ liệu từ agent</p>
          <p className="text-xs mt-1">Hãy chắc chắn agent đang chạy trên server</p>
        </div>
      )}

      {/* Footer: Thời gian cập nhật cuối */}
      {metric && (
        <div className="flex items-center gap-1.5 mt-4 pt-4 border-t border-devops-border">
          <Clock size={12} className="text-devops-muted" />
          <span className="text-xs text-devops-muted">
            Cập nhật: {formatRelativeTime(metric.created_at)}
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * Component LogTerminal - Hiển thị logs dạng terminal
 */
function LogTerminal({ logs }: { logs: Log[] }) {
  return (
    <div className="terminal p-4">
      {/* Terminal Header */}
      <div className="flex items-center gap-2 mb-3 pb-3 border-b border-devops-border">
        <Terminal size={14} className="text-devops-green" />
        <span className="text-sm font-bold text-devops-green">System Logs</span>
        <span className="ml-auto text-xs text-devops-muted">
          {logs.length} dòng
        </span>
      </div>

      {/* Log Lines */}
      <div className="space-y-1 max-h-64 overflow-y-auto">
        {logs.length === 0 ? (
          <p className="text-devops-muted text-sm">
            <span className="text-devops-green">$</span> Chưa có log nào...
            <span className="cursor-blink">_</span>
          </p>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="terminal-line text-sm">
              {/* Timestamp */}
              <span className="text-devops-muted text-xs">
                {new Date(log.created_at).toLocaleTimeString("vi-VN")}
              </span>
              {" "}
              {/* Log message - màu sắc theo nội dung */}
              <span
                className={
                  log.message.includes("CẢNH BÁO") || log.message.includes("⚠️")
                    ? "text-devops-yellow"
                    : "text-devops-green"
                }
              >
                {log.message}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// =============================================================
// MAIN COMPONENT - Dashboard Page
// =============================================================

export default function Dashboard() {
  // State: danh sách server kèm metrics
  const [servers, setServers] = useState<ServerWithMetrics[]>([]);
  // State: danh sách log realtime
  const [logs, setLogs] = useState<Log[]>([]);
  // State: đang tải dữ liệu lần đầu
  const [isLoading, setIsLoading] = useState(true);
  // State: số lần nhận được realtime update
  const [realtimeCount, setRealtimeCount] = useState(0);

  // -----------------------------------------------------------
  // Fetch dữ liệu ban đầu khi trang load
  // -----------------------------------------------------------
  const fetchInitialData = useCallback(async () => {
    setIsLoading(true);

    try {
      // Fetch danh sách servers
      const { data: serversData, error: serversError } = await supabase
        .from("servers")
        .select("*")
        .order("created_at", { ascending: true });

      if (serversError) {
        console.error("Lỗi fetch servers:", serversError);
        return;
      }

      if (!serversData || serversData.length === 0) {
        setServers([]);
        setIsLoading(false);
        return;
      }

      // Fetch metrics mới nhất cho mỗi server
      // Lấy metrics trong 1 query duy nhất (tối ưu hơn gọi riêng từng server)
      const serverIds = serversData.map((s) => s.id);
      const { data: metricsData } = await supabase
        .from("metrics")
        .select("*")
        .in("server_id", serverIds)
        .order("created_at", { ascending: false });

      // Fetch logs gần đây
      const { data: logsData } = await supabase
        .from("logs")
        .select("*")
        .in("server_id", serverIds)
        .order("created_at", { ascending: false })
        .limit(MAX_LOGS_DISPLAY);

      if (logsData) {
        setLogs(logsData);
      }

      // Ghép server với metric mới nhất của nó
      const serversWithMetrics: ServerWithMetrics[] = serversData.map((server) => {
        // Tìm metric mới nhất của server này
        const serverMetrics = (metricsData || []).filter(
          (m) => m.server_id === server.id
        );
        const latestMetric = serverMetrics.length > 0 ? serverMetrics[0] : null;

        return {
          ...server,
          latestMetric,
          isOnline: checkIsOnline(latestMetric),
        };
      });

      setServers(serversWithMetrics);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // -----------------------------------------------------------
  // Setup Supabase Realtime Subscription
  // -----------------------------------------------------------
  useEffect(() => {
    // Fetch dữ liệu ban đầu
    fetchInitialData();

    /**
     * Subscribe nhận metrics mới qua WebSocket.
     *
     * Khi agent gửi INSERT vào bảng metrics:
     *   Supabase → WebSocket → Frontend (payload.new)
     *
     * Channel name: 'metrics_updates'
     * Event: INSERT trên bảng metrics
     */
    const metricsChannel = supabase
      .channel("metrics_updates")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "metrics",
        },
        (payload) => {
          const newMetric = payload.new as Metric;
          console.log("📡 Realtime metric nhận được:", newMetric);

          // Cập nhật metric mới nhất cho server tương ứng
          setServers((prevServers) =>
            prevServers.map((server) => {
              if (server.id !== newMetric.server_id) return server;
              return {
                ...server,
                latestMetric: newMetric,
                isOnline: checkIsOnline(newMetric),
              };
            })
          );

          // Tăng đếm realtime để hiển thị trên UI
          setRealtimeCount((c) => c + 1);
        }
      )
      .subscribe((status) => {
        console.log("📡 Trạng thái Realtime channel:", status);
      });

    /**
     * Subscribe nhận logs mới qua WebSocket.
     * Khi agent gửi log (vd: CPU spike), hiển thị ngay trên terminal.
     */
    const logsChannel = supabase
      .channel("logs_updates")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "logs",
        },
        (payload) => {
          const newLog = payload.new as Log;
          console.log("📋 Realtime log nhận được:", newLog);

          // Thêm log mới vào đầu danh sách, giữ tối đa MAX_LOGS_DISPLAY dòng
          setLogs((prevLogs) => [newLog, ...prevLogs].slice(0, MAX_LOGS_DISPLAY));
        }
      )
      .subscribe();

    // Cleanup: Hủy subscription khi component unmount
    // (tránh memory leak và kết nối WebSocket thừa)
    return () => {
      console.log("🔌 Đóng Realtime connections...");
      supabase.removeChannel(metricsChannel);
      supabase.removeChannel(logsChannel);
    };
  }, [fetchInitialData]);

  // -----------------------------------------------------------
  // Cập nhật trạng thái online/offline định kỳ
  // (vì checkIsOnline() dựa trên thời gian hiện tại)
  // -----------------------------------------------------------
  useEffect(() => {
    const interval = setInterval(() => {
      setServers((prevServers) =>
        prevServers.map((server) => ({
          ...server,
          isOnline: checkIsOnline(server.latestMetric),
        }))
      );
    }, 5000); // Kiểm tra mỗi 5 giây

    return () => clearInterval(interval);
  }, []);

  // -----------------------------------------------------------
  // Stats summary
  // -----------------------------------------------------------
  const totalServers  = servers.length;
  const onlineServers = servers.filter((s) => s.isOnline).length;
  const offlineServers = totalServers - onlineServers;

  // =============================================================
  // RENDER
  // =============================================================
  return (
    <div className="min-h-screen bg-devops-bg text-devops-text font-mono">
      {/* =========================================================
          HEADER
          ========================================================= */}
      <header className="border-b border-devops-border bg-devops-panel sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          {/* Logo + Title */}
          <div className="flex items-center gap-3">
            <div className="text-devops-green">
              <Activity size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white leading-none">
                DevOps Status Dashboard
              </h1>
              <p className="text-xs text-devops-muted mt-0.5">
                Realtime Server Monitoring
              </p>
            </div>
          </div>

          {/* Realtime indicator */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm">
              <span className="inline-block w-2 h-2 rounded-full bg-devops-green animate-pulse" />
              <span className="text-devops-muted text-xs">
                Realtime ({realtimeCount} updates)
              </span>
            </div>
            {/* Refresh button */}
            <button
              onClick={fetchInitialData}
              className="p-2 rounded-lg border border-devops-border hover:border-devops-green/50 hover:text-devops-green transition-colors"
              title="Tải lại dữ liệu"
            >
              <RefreshCw size={14} />
            </button>
          </div>
        </div>
      </header>

      {/* =========================================================
          MAIN CONTENT
          ========================================================= */}
      <main className="max-w-7xl mx-auto px-6 py-8">

        {/* Stats Summary Bar */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-devops-panel border border-devops-border rounded-lg px-4 py-3">
            <p className="text-xs text-devops-muted uppercase tracking-wider">Tổng Server</p>
            <p className="text-2xl font-bold text-white mt-1">{totalServers}</p>
          </div>
          <div className="bg-devops-panel border border-devops-green/30 rounded-lg px-4 py-3">
            <p className="text-xs text-devops-green uppercase tracking-wider">Online</p>
            <p className="text-2xl font-bold text-devops-green mt-1">{onlineServers}</p>
          </div>
          <div className="bg-devops-panel border border-devops-red/30 rounded-lg px-4 py-3">
            <p className="text-xs text-devops-red uppercase tracking-wider">Offline</p>
            <p className="text-2xl font-bold text-devops-red mt-1">{offlineServers}</p>
          </div>
        </div>

        {/* Loading State */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <RefreshCw size={32} className="text-devops-green animate-spin mb-4" />
            <p className="text-devops-muted">Đang tải dữ liệu từ Supabase...</p>
          </div>
        ) : servers.length === 0 ? (
          /* Empty State - Chưa có server nào */
          <div className="text-center py-24 border border-dashed border-devops-border rounded-xl">
            <Server size={48} className="mx-auto text-devops-muted mb-4 opacity-50" />
            <h3 className="text-lg font-bold text-white mb-2">Chưa có server nào</h3>
            <p className="text-devops-muted text-sm mb-4">
              Thêm server vào bảng <code className="text-devops-green">servers</code> trong Supabase Dashboard
            </p>
            <div className="inline-block text-left bg-devops-panel border border-devops-border rounded-lg p-4 text-xs text-devops-muted font-mono">
              <p className="text-devops-green mb-1">-- Thêm server mẫu:</p>
              <p>INSERT INTO servers (name, ip_address, user_id)</p>
              <p>VALUES (&#39;Production VM&#39;, &#39;192.168.1.1&#39;, auth.uid());</p>
            </div>
          </div>
        ) : (
          <>
            {/* Server Grid */}
            <section className="mb-8">
              <h2 className="text-sm font-bold text-devops-muted uppercase tracking-widest mb-4">
                Servers ({totalServers})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {servers.map((server) => (
                  <ServerCard key={server.id} server={server} />
                ))}
              </div>
            </section>

            {/* Logs Terminal */}
            <section>
              <h2 className="text-sm font-bold text-devops-muted uppercase tracking-widest mb-4">
                System Logs (Realtime)
              </h2>
              <LogTerminal logs={logs} />
            </section>
          </>
        )}
      </main>

      {/* =========================================================
          FOOTER
          ========================================================= */}
      <footer className="border-t border-devops-border mt-12 py-4">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <p className="text-xs text-devops-muted">
            DevOps Status Dashboard • Powered by{" "}
            <span className="text-devops-green">Next.js</span> +{" "}
            <span className="text-devops-green">Supabase Realtime</span>
          </p>
        </div>
      </footer>
    </div>
  );
}
