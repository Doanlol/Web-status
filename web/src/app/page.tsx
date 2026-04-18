"use client";

/**
 * Trang Dashboard chính - Hiển thị danh sách server và metrics realtime.
 *
 * Kiến trúc:
 * 1. Fetch dữ liệu ban đầu từ Supabase khi component mount
 * 2. Subscribe Supabase Realtime để nhận cập nhật không cần reload trang
 * 3. Hiển thị từng server với thanh progress CPU/RAM/Disk
 */
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Server, Activity, HardDrive, Cpu, RefreshCw, Terminal } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

// ============================================================
// KIỂU DỮ LIỆU (TypeScript Types)
// ============================================================
type ServerRow = {
  id: string;
  name: string;
  ip_address: string | null;
  created_at: string;
};

type Metric = {
  id: string;
  server_id: string;
  cpu: number;
  memory: number;
  disk: number;
  status: string;
  created_at: string;
};

type Log = {
  id: string;
  server_id: string;
  message: string;
  created_at: string;
};

// ============================================================
// COMPONENT PHỤ: Thanh tiến trình (Progress Bar)
// ============================================================
function ProgressBar({ value, label }: { value: number; label: string }) {
  // Màu thay đổi theo mức độ: xanh lá → vàng → đỏ
  const getColor = (v: number) => {
    if (v > 85) return "bg-devops-red";
    if (v > 70) return "bg-yellow-400";
    return "bg-devops-green";
  };

  return (
    <div className="flex items-center gap-3">
      <span className="text-devops-muted text-xs w-10">{label}</span>
      <div className="flex-1 h-2 bg-devops-border rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${getColor(value)}`}
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
      <span className="text-devops-text text-xs w-12 text-right">
        {value.toFixed(1)}%
      </span>
    </div>
  );
}

// ============================================================
// COMPONENT PHỤ: Card một Server
// ============================================================
function ServerCard({
  server,
  metrics,
  logs,
}: {
  server: ServerRow;
  metrics: Metric[];
  logs: Log[];
}) {
  // Metric mới nhất của server này
  const latest = metrics[0];

  // Server được coi là ONLINE nếu metric gần nhất < 20 giây trước
  const isOnline =
    latest &&
    new Date().getTime() - new Date(latest.created_at).getTime() < 20000;

  // Chuẩn bị data cho biểu đồ Recharts (lấy 10 điểm gần nhất, đảo ngược để đúng thứ tự thời gian)
  const chartData = [...metrics]
    .reverse()
    .slice(-10)
    .map((m) => ({
      time: new Date(m.created_at).toLocaleTimeString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
      CPU: m.cpu,
      RAM: m.memory,
      Disk: m.disk,
    }));

  return (
    <div className="bg-devops-panel border border-devops-border rounded-xl p-6 shadow-lg flex flex-col gap-5">
      {/* Header: Tên server + badge trạng thái */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Server className="text-devops-green" size={20} />
          <div>
            <h2 className="font-bold text-devops-text text-lg">{server.name}</h2>
            {server.ip_address && (
              <span className="text-devops-muted text-xs">{server.ip_address}</span>
            )}
          </div>
        </div>
        <span
          className={`px-3 py-1 rounded-full text-xs font-semibold ${
            isOnline
              ? "bg-devops-green/10 text-devops-green border border-devops-green/30"
              : "bg-devops-red/10 text-devops-red border border-devops-red/30"
          }`}
        >
          {isOnline ? "● ONLINE" : "● OFFLINE"}
        </span>
      </div>

      {/* Metrics Progress Bars */}
      {latest ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-devops-muted text-xs mb-1">
            <Cpu size={12} />
            <Activity size={12} />
            <HardDrive size={12} />
            <span>Cập nhật lúc: {new Date(latest.created_at).toLocaleTimeString("vi-VN")}</span>
          </div>
          <ProgressBar value={latest.cpu} label="CPU" />
          <ProgressBar value={latest.memory} label="RAM" />
          <ProgressBar value={latest.disk} label="Disk" />
        </div>
      ) : (
        <p className="text-devops-muted text-sm text-center py-4">
          Chưa có dữ liệu — Agent chưa gửi metrics
        </p>
      )}

      {/* Biểu đồ Line Chart (Recharts) */}
      {chartData.length > 1 && (
        <div>
          <p className="text-devops-muted text-xs mb-2 flex items-center gap-1">
            <Activity size={12} /> Biểu đồ 10 điểm gần nhất
          </p>
          <ResponsiveContainer width="100%" height={120}>
            <LineChart data={chartData}>
              <XAxis dataKey="time" tick={false} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "#8B949E" }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{
                  background: "#161B22",
                  border: "1px solid #30363D",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              <Line type="monotone" dataKey="CPU" stroke="#00FF9C" dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey="RAM" stroke="#00BFFF" dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey="Disk" stroke="#FFD700" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
          <div className="flex gap-4 text-xs text-devops-muted mt-1">
            <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-devops-green inline-block" /> CPU</span>
            <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-blue-400 inline-block" /> RAM</span>
            <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-yellow-400 inline-block" /> Disk</span>
          </div>
        </div>
      )}

      {/* Log Terminal */}
      {logs.length > 0 && (
        <div>
          <p className="text-devops-muted text-xs mb-2 flex items-center gap-1">
            <Terminal size={12} /> Logs gần đây
          </p>
          <div className="bg-devops-bg border border-devops-border rounded-lg p-3 max-h-32 overflow-y-auto">
            {logs.map((log) => (
              <p key={log.id} className="text-devops-green text-xs leading-relaxed">
                {log.message}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// COMPONENT CHÍNH: Dashboard
// ============================================================
export default function Dashboard() {
  const [servers, setServers] = useState<ServerRow[]>([]);
  const [metricsMap, setMetricsMap] = useState<Record<string, Metric[]>>({});
  const [logsMap, setLogsMap] = useState<Record<string, Log[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Hàm fetch dữ liệu ban đầu từ Supabase
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch servers
      const { data: serverData, error: serverErr } = await supabase
        .from("servers")
        .select("*")
        .order("created_at", { ascending: false });

      if (serverErr) throw serverErr;
      setServers(serverData || []);

      // Fetch metrics cho mỗi server (20 điểm mới nhất)
      const newMetrics: Record<string, Metric[]> = {};
      const newLogs: Record<string, Log[]> = {};

      for (const srv of serverData || []) {
        const { data: mData } = await supabase
          .from("metrics")
          .select("*")
          .eq("server_id", srv.id)
          .order("created_at", { ascending: false })
          .limit(20);

        const { data: lData } = await supabase
          .from("logs")
          .select("*")
          .eq("server_id", srv.id)
          .order("created_at", { ascending: false })
          .limit(5);

        newMetrics[srv.id] = mData || [];
        newLogs[srv.id] = lData || [];
      }

      setMetricsMap(newMetrics);
      setLogsMap(newLogs);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Lỗi không xác định";
      setError(`Không thể tải dữ liệu: ${message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();

    // ============================================================
    // SUPABASE REALTIME - Lắng nghe thay đổi từ database
    // Khi Agent insert metrics/logs mới → frontend tự cập nhật
    // ============================================================
    const channel = supabase
      .channel("dashboard_realtime")
      // Lắng nghe INSERT vào bảng metrics
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "metrics" },
        (payload) => {
          const newMetric = payload.new as Metric;
          setMetricsMap((prev) => {
            const current = prev[newMetric.server_id] || [];
            // Thêm metric mới vào đầu mảng, giữ tối đa 20 bản ghi
            return {
              ...prev,
              [newMetric.server_id]: [newMetric, ...current].slice(0, 20),
            };
          });
        }
      )
      // Lắng nghe INSERT vào bảng logs
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "logs" },
        (payload) => {
          const newLog = payload.new as Log;
          setLogsMap((prev) => {
            const current = prev[newLog.server_id] || [];
            return {
              ...prev,
              [newLog.server_id]: [newLog, ...current].slice(0, 5),
            };
          });
        }
      )
      .subscribe();

    // Cleanup: hủy subscription khi component unmount
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData]);

  return (
    <div className="min-h-screen bg-devops-bg p-6 md:p-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-devops-green flex items-center gap-3">
            <Server size={28} />
            DevOps Status Dashboard
          </h1>
          <p className="text-devops-muted text-sm mt-1">
            Realtime monitoring · Powered by Supabase
          </p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-4 py-2 bg-devops-panel border border-devops-border rounded-lg text-devops-muted hover:text-devops-green hover:border-devops-green transition-colors text-sm"
        >
          <RefreshCw size={14} />
          Tải lại
        </button>
      </div>

      {/* Trạng thái loading / lỗi */}
      {loading && (
        <div className="text-center py-20 text-devops-muted">
          <RefreshCw className="animate-spin mx-auto mb-3" size={24} />
          <p>Đang tải dữ liệu...</p>
        </div>
      )}

      {error && (
        <div className="bg-devops-red/10 border border-devops-red/30 text-devops-red rounded-xl p-4 mb-6">
          <p className="font-semibold">❌ {error}</p>
          <p className="text-sm mt-1 text-devops-muted">
            Hãy kiểm tra file web/.env.local và cài đặt Supabase của bạn.
          </p>
        </div>
      )}

      {/* Khi đã tải xong */}
      {!loading && !error && (
        <>
          {servers.length === 0 ? (
            <div className="text-center py-20 text-devops-muted">
              <Server className="mx-auto mb-4 opacity-30" size={48} />
              <p className="text-lg">Chưa có server nào.</p>
              <p className="text-sm mt-2">
                Thêm một server vào bảng{" "}
                <code className="text-devops-green">servers</code> trong Supabase
                để bắt đầu.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {servers.map((srv) => (
                <ServerCard
                  key={srv.id}
                  server={srv}
                  metrics={metricsMap[srv.id] || []}
                  logs={logsMap[srv.id] || []}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
