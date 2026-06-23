import React, { useState, useEffect, useRef } from "react";
import { 
  AlertTriangle, 
  Bug, 
  Terminal, 
  List, 
  X, 
  Send, 
  ChevronDown, 
  ChevronUp, 
  Clock, 
  Info, 
  CheckCircle2, 
  Activity, 
  TrendingUp, 
  MousePointer,
  Cpu
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "react-router-dom";

interface ConsoleLogEntry {
  type: "log" | "warn" | "error" | "api" | "perf" | "action";
  message: string;
  timestamp: string;
}

interface SubmittedBug {
  id: number;
  description: string;
  context: any;
  created_at: string;
}

interface PerformanceStats {
  totalRequests: number;
  failedRequests: number;
  totalLatency: number;
  averageLatency: number;
  lastLatency: number;
  totalClicks: number;
  routeHistory: string[];
}

// Global log buffer and metrics that persist between mount/unmount of the BugReporter
const globalLogs: ConsoleLogEntry[] = [];
const maxLogs = 100;

const globalStats: PerformanceStats = {
  totalRequests: 0,
  failedRequests: 0,
  totalLatency: 0,
  averageLatency: 0,
  lastLatency: 0,
  totalClicks: 0,
  routeHistory: [],
};

// Listeners collection to trigger re-renders in the active instance
const statsListeners = new Set<() => void>();
function notifyStatsChanged() {
  statsListeners.forEach((listener) => listener());
}

function pushLog(type: "log" | "warn" | "error" | "api" | "perf" | "action", args: any[]) {
  const message = args
    .map((arg) => (typeof arg === "object" ? JSON.stringify(arg) : String(arg)))
    .join(" ");
  const entry: ConsoleLogEntry = {
    type,
    message,
    timestamp: new Date().toLocaleTimeString(),
  };
  globalLogs.push(entry);
  if (globalLogs.length > maxLogs) {
    globalLogs.shift();
  }
  notifyStatsChanged();
}

// Intercept window console logs immediately
const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;

console.log = (...args) => {
  pushLog("log", args);
  originalLog.apply(console, args);
};
console.warn = (...args) => {
  pushLog("warn", args);
  originalWarn.apply(console, args);
};
console.error = (...args) => {
  pushLog("error", args);
  originalError.apply(console, args);
};

// Intercept window fetch API for real-time outbound/inbound and roundtrip latency tracking
if (!(window as any).__fetchIntercepted__) {
  (window as any).__fetchIntercepted__ = true;
  try {
    const originalFetch = window.fetch;
    const interceptedFetch = async (...args: any[]) => {
      const url = typeof args[0] === "string" ? args[0] : (args[0] as any).url || "unknown";
      const method = (args[1] as any)?.method || "GET";
      const start = performance.now();
      
      pushLog("api", [`[API Request] OUTBOUND ↗ [${method}] ${url}`]);
      
      try {
        const response = await originalFetch(args[0], args[1]);
        const duration = Math.round(performance.now() - start);
        
        // Update global performance metrics
        globalStats.totalRequests += 1;
        globalStats.totalLatency += duration;
        globalStats.lastLatency = duration;
        globalStats.averageLatency = Math.round(globalStats.totalLatency / globalStats.totalRequests);

        if (response.ok) {
          pushLog("api", [`[API Response] INBOUND ↙ [${method}] ${url} | OK ${response.status} | Latency: ${duration}ms`]);
        } else {
          globalStats.failedRequests += 1;
          pushLog("error", [`[API Response] INBOUND ↙ [${method}] ${url} | ERROR ${response.status} | Latency: ${duration}ms`]);
        }
        return response;
      } catch (error: any) {
        const duration = Math.round(performance.now() - start);
        globalStats.totalRequests += 1;
        globalStats.failedRequests += 1;
        globalStats.totalLatency += duration;
        globalStats.lastLatency = duration;
        globalStats.averageLatency = Math.round(globalStats.totalLatency / globalStats.totalRequests);

        pushLog("error", [`[API Failure] ↙ [${method}] ${url} | FAILED: ${error.message || error} | Latency: ${duration}ms`]);
        throw error;
      }
    };

    try {
      (window as any).fetch = interceptedFetch;
    } catch (e) {
      // If assignment fails (e.g. read-only or getter-only property), try Object.defineProperty
      Object.defineProperty(window, "fetch", {
        value: interceptedFetch,
        writable: true,
        configurable: true,
      });
    }
  } catch (err) {
    originalError.apply(console, ["[Telemetry] Failed to intercept fetch:", err]);
  }
}

export default function BugReporter() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"report" | "performance" | "logs" | "submitted">("performance");
  const [description, setDescription] = useState("");
  const [logs, setLogs] = useState<ConsoleLogEntry[]>([]);
  const [stats, setStats] = useState<PerformanceStats>({ ...globalStats });
  const [submittedBugs, setSubmittedBugs] = useState<SubmittedBug[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [showContext, setShowContext] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const logsEndRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  // Force re-renders when global logs or statistics update
  useEffect(() => {
    const handleUpdate = () => {
      setLogs([...globalLogs]);
      setStats({ ...globalStats });
    };
    
    handleUpdate();
    statsListeners.add(handleUpdate);
    return () => {
      statsListeners.delete(handleUpdate);
    };
  }, []);

  // Track page navigation in real-time
  useEffect(() => {
    const routeStr = `${location.pathname}${location.search}`;
    pushLog("perf", [`[Navigation] Routed to "${routeStr}"`]);
    if (!globalStats.routeHistory.includes(routeStr)) {
      globalStats.routeHistory.push(routeStr);
      notifyStatsChanged();
    }
  }, [location]);

  // Track global user mouse interactions (clicks on interactive elements)
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target) return;
      
      const interactive = target.closest("button, a, input, select, textarea, [role='button']");
      if (interactive) {
        globalStats.totalClicks += 1;
        const text = interactive.textContent?.trim().slice(0, 35) || (interactive as HTMLInputElement).placeholder || (interactive as HTMLInputElement).value || "";
        const idStr = interactive.id ? `#${interactive.id}` : "";
        const tagStr = interactive.tagName.toLowerCase();
        
        // Skip logging developer HUD's own control clicks to prevent cluttering the log
        if (interactive.closest(".fixed.bottom-20") || interactive.closest(".fixed.bottom-5")) {
          return;
        }

        pushLog("action", [`[User Click] <${tagStr}${idStr}> ${text ? `"${text}"` : ""}`]);
      }
    };
    
    window.addEventListener("click", handleGlobalClick, { capture: true });
    return () => window.removeEventListener("click", handleGlobalClick, { capture: true });
  }, []);

  // Auto-scroll inside logs panel
  useEffect(() => {
    if (activeTab === "logs" && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, activeTab]);

  // Fetch bug submissions
  const fetchBugs = async () => {
    try {
      const res = await fetch("/api/bugs");
      if (!res.ok) throw new Error("Failed to fetch submitted bugs.");
      const body = await res.json();
      if (body.data) {
        setSubmittedBugs(body.data);
      }
    } catch (err: any) {
      console.error("Error loading bugs", err);
    }
  };

  useEffect(() => {
    if (activeTab === "submitted") {
      fetchBugs();
    }
  }, [activeTab]);

  const getContextPayload = () => {
    return {
      url: window.location.href,
      pathname: window.location.pathname,
      search: window.location.search,
      userAgent: navigator.userAgent,
      screenSize: `${window.innerWidth}x${window.innerHeight}`,
      timestamp: new Date().toISOString(),
      localTime: new Date().toLocaleString(),
      recentLogs: logs.slice(-25),
      stats,
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;

    setIsSubmitting(true);
    setError(null);
    setSubmitSuccess(false);

    try {
      const res = await fetch("/api/bugs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: description.trim(),
          context: getContextPayload(),
        }),
      });

      if (!res.ok) {
        throw new Error(`Failed to submit: ${res.status}`);
      }

      setSubmitSuccess(true);
      setDescription("");
      fetchBugs();
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* Floating real-time status trigger button in bottom right corner */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-5 right-5 z-[9999] flex items-center gap-2 bg-[#FF6B6B] hover:bg-[#FF8585] text-white px-4 py-2.5 rounded-full shadow-lg font-semibold tracking-wide transition-all scale-100 hover:scale-105 active:scale-95"
        style={{ boxShadow: "0 10px 25px -5px rgba(255, 107, 107, 0.4)" }}
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
        </span>
        <Bug className="w-4 h-4" />
        <span className="text-xs font-mono">Telemetry Log</span>
        {stats.totalRequests > 0 && (
          <span className="bg-black/20 text-[10px] px-1.5 py-0.5 rounded-md text-white/90">
            {stats.averageLatency}ms
          </span>
        )}
      </button>

      {/* Main Sandbox Diagnostics Drawer Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 100, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed bottom-20 right-5 z-[9999] w-[460px] max-w-[92vw] h-[580px] max-h-[82vh] border border-white/10 bg-[#090b11]/95 backdrop-blur-xl rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-white/5">
              <div className="flex items-center gap-2 text-white">
                <Cpu className="w-5 h-5 text-[#FF6B6B]" />
                <span className="font-bold text-sm tracking-wide">Developer Sandbox Tools</span>
                <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded font-mono">
                  ACTIVE
                </span>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-white/50 hover:text-white p-1 rounded-full hover:bg-white/5 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-white/10 bg-white/5 px-1.5 overflow-x-auto whitespace-nowrap">
              <button
                onClick={() => {
                  setActiveTab("performance");
                }}
                className={`flex-1 flex items-center justify-center gap-1 py-3 px-2 text-[10px] font-semibold uppercase tracking-wider border-b-2 transition-all ${
                  activeTab === "performance"
                    ? "border-[#FF6B6B] text-white bg-white/5"
                    : "border-transparent text-white/50 hover:text-white"
                }`}
              >
                <Activity className="w-3.5 h-3.5 text-[#FF6B6B]" />
                Performance
              </button>
              <button
                onClick={() => setActiveTab("logs")}
                className={`flex-1 flex items-center justify-center gap-1 py-3 px-2 text-[10px] font-semibold uppercase tracking-wider border-b-2 transition-all ${
                  activeTab === "logs"
                    ? "border-[#FF6B6B] text-white bg-white/5"
                    : "border-transparent text-white/50 hover:text-white"
                }`}
              >
                <Terminal className="w-3.5 h-3.5 text-blue-400" />
                Live Logs ({logs.length})
              </button>
              <button
                onClick={() => {
                  setActiveTab("report");
                  setSubmitSuccess(false);
                }}
                className={`flex-1 flex items-center justify-center gap-1 py-3 px-2 text-[10px] font-semibold uppercase tracking-wider border-b-2 transition-all ${
                  activeTab === "report"
                    ? "border-[#FF6B6B] text-white bg-white/5"
                    : "border-transparent text-white/50 hover:text-white"
                }`}
              >
                <Send className="w-3.5 h-3.5 text-amber-400" />
                Submit Bug
              </button>
              <button
                onClick={() => setActiveTab("submitted")}
                className={`flex-1 flex items-center justify-center gap-1 py-3 px-2 text-[10px] font-semibold uppercase tracking-wider border-b-2 transition-all ${
                  activeTab === "submitted"
                    ? "border-[#FF6B6B] text-white bg-white/5"
                    : "border-transparent text-white/50 hover:text-white"
                }`}
              >
                <List className="w-3.5 h-3.5 text-emerald-400" />
                Database
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-5">
              
              {/* Performance & Live Analytics HUD */}
              {activeTab === "performance" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    
                    <div className="bg-white/5 border border-white/10 rounded-xl p-3.5 flex flex-col justify-between">
                      <div className="flex items-center gap-1.5 text-white/60 text-[10px] uppercase font-bold tracking-wide">
                        <Activity className="w-4 h-4 text-[#FF6B6B]" />
                        Avg API Latency
                      </div>
                      <div className="mt-2 text-2xl font-bold text-white font-mono">
                        {stats.averageLatency || 0}<span className="text-xs text-white/50 ml-0.5">ms</span>
                      </div>
                      <div className="text-[9px] text-white/40 mt-1">
                        Last request: {stats.lastLatency || 0}ms
                      </div>
                    </div>

                    <div className="bg-white/5 border border-white/10 rounded-xl p-3.5 flex flex-col justify-between">
                      <div className="flex items-center gap-1.5 text-white/60 text-[10px] uppercase font-bold tracking-wide">
                        <TrendingUp className="w-4 h-4 text-emerald-400" />
                        API Success Rate
                      </div>
                      <div className="mt-2 text-2xl font-bold text-white font-mono">
                        {stats.totalRequests - stats.failedRequests}/{stats.totalRequests}
                      </div>
                      <div className="text-[9px] text-white/40 mt-1">
                        {stats.totalRequests > 0 
                          ? `${Math.round(((stats.totalRequests - stats.failedRequests) / stats.totalRequests) * 100)}% successful requests` 
                          : "No outbound queries yet"}
                      </div>
                    </div>

                    <div className="bg-white/5 border border-white/10 rounded-xl p-3.5 flex flex-col justify-between col-span-2">
                      <div className="flex items-center gap-1.5 text-white/60 text-[10px] uppercase font-bold tracking-wide">
                        <MousePointer className="w-4 h-4 text-blue-400" />
                        User UI Interactions Tracked
                      </div>
                      <div className="mt-2 text-xl font-bold text-white font-mono flex items-center gap-2">
                        <span>{stats.totalClicks} interaction{stats.totalClicks === 1 ? "" : "s"}</span>
                        {stats.totalClicks > 0 && (
                          <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded font-sans font-medium">
                            Capturing clicks
                          </span>
                        )}
                      </div>
                      <div className="text-[9px] text-white/40 mt-1">
                        Automatically recording component elements, headers, buttons, and input clicks to map replication steps.
                      </div>
                    </div>

                  </div>

                  {/* Route History List */}
                  <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-2">
                    <div className="flex justify-between items-center border-b border-white/5 pb-1.5">
                      <h4 className="text-[10px] text-white/60 uppercase font-bold tracking-wider">
                        Route Flow Logs
                      </h4>
                      <span className="text-[9px] font-mono text-[#FF6B6B]">
                        {stats.routeHistory.length} view changes
                      </span>
                    </div>
                    {stats.routeHistory.length === 0 ? (
                      <p className="text-[10px] text-white/40 italic py-2">No routes recorded yet. Try navigating.</p>
                    ) : (
                      <div className="space-y-1.5 font-mono text-[10px]">
                        {stats.routeHistory.map((route, i) => (
                          <div key={i} className="flex items-center justify-between text-white/80 py-0.5">
                            <div className="flex items-center gap-2">
                              <span className="text-[#FF6B6B] font-bold">▸</span>
                              <span className="truncate max-w-[280px]">{route}</span>
                            </div>
                            <span className="text-[8px] text-white/30 uppercase font-bold">viewed</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* System & Screen Data */}
                  <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-1.5">
                    <h4 className="text-[10px] text-white/60 uppercase font-bold tracking-wider border-b border-white/5 pb-1.5">
                      System Metrics
                    </h4>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[10px] font-mono text-white/70">
                      <div><span className="text-white/40">Viewport:</span> {window.innerWidth}x{window.innerHeight}</div>
                      <div className="truncate"><span className="text-white/40">UA:</span> {navigator.userAgent.slice(0, 30)}...</div>
                      <div><span className="text-white/40">Local Time:</span> {new Date().toLocaleTimeString()}</div>
                      <div><span className="text-white/40">Buffer:</span> {logs.length} entries</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Live Interactive Logger */}
              {activeTab === "logs" && (
                <div className="flex flex-col h-full space-y-2">
                  <div className="flex items-center justify-between text-white/50 text-[10px] uppercase font-mono border-b border-white/5 pb-1.5">
                    <span>Severity & Payload</span>
                    <span>Timestamp</span>
                  </div>

                  <div className="flex-1 space-y-1.5 font-mono text-[10px] min-h-[300px]">
                    {logs.length === 0 ? (
                      <p className="text-white/30 text-center py-10 font-sans italic text-xs">No sandbox logs recorded yet.</p>
                    ) : (
                      logs.map((log, index) => {
                        let badgeBg = "bg-white/10 text-white/60";
                        let borderStyle = "border-transparent";
                        let textStyle = "text-white/80";

                        if (log.type === "error") {
                          badgeBg = "bg-red-500/20 text-red-400";
                          borderStyle = "bg-red-500/5 border-red-500/10";
                          textStyle = "text-red-400";
                        } else if (log.type === "warn") {
                          badgeBg = "bg-amber-500/20 text-amber-400";
                          borderStyle = "bg-amber-500/5 border-amber-500/10";
                          textStyle = "text-amber-300";
                        } else if (log.type === "api") {
                          badgeBg = "bg-[#FF6B6B]/20 text-[#FF6B6B]";
                          borderStyle = "bg-[#FF6B6B]/5 border-[#FF6B6B]/10";
                          textStyle = "text-[#FF8585]";
                        } else if (log.type === "action") {
                          badgeBg = "bg-blue-500/20 text-blue-400";
                          borderStyle = "bg-blue-500/5 border-blue-500/10";
                          textStyle = "text-blue-300";
                        } else if (log.type === "perf") {
                          badgeBg = "bg-emerald-500/20 text-emerald-400";
                          borderStyle = "bg-emerald-500/5 border-emerald-500/10";
                          textStyle = "text-emerald-300";
                        }

                        return (
                          <div
                            key={index}
                            className={`flex items-start gap-2 p-1.5 rounded border ${borderStyle}`}
                          >
                            <span
                              className={`px-1.5 py-0.2 rounded text-[8px] uppercase font-bold flex-shrink-0 mt-0.5 ${badgeBg}`}
                            >
                              {log.type}
                            </span>
                            <span className={`flex-1 break-all select-all leading-normal ${textStyle}`}>
                              {log.message}
                            </span>
                            <span className="text-[8px] text-white/30 flex-shrink-0 mt-0.5 font-sans flex items-center gap-0.5">
                              <Clock className="w-2.5 h-2.5" />
                              {log.timestamp}
                            </span>
                          </div>
                        );
                      })
                    )}
                    <div ref={logsEndRef} />
                  </div>
                </div>
              )}

              {/* Bug Submission Form */}
              {activeTab === "report" && (
                <div className="space-y-4">
                  <div className="bg-white/5 border border-white/5 rounded-xl p-3 flex gap-2 text-white/70">
                    <Info className="w-4 h-4 text-[#FF6B6B] flex-shrink-0 mt-0.5" />
                    <p className="text-[11px] leading-relaxed">
                      Submitting a report compiles current view routes, browser specs, screen dimensions, real-time performance latency values, and the last 25 captured event logs directly into the sandbox database.
                    </p>
                  </div>

                  {submitSuccess ? (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-xl flex flex-col items-center text-center gap-2"
                    >
                      <CheckCircle2 className="w-10 h-10 text-emerald-400" />
                      <h4 className="font-semibold text-xs uppercase tracking-wider">Bug Logged Successfully</h4>
                      <p className="text-[11px] text-white/70 leading-relaxed">
                        The visual bug database has stored your description and captured telemetry state context. View the 'Database' tab to see it!
                      </p>
                      <button
                        onClick={() => setSubmitSuccess(false)}
                        className="mt-2 text-xs bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 px-3 py-1.5 rounded-lg font-medium transition-all"
                      >
                        File Another Report
                      </button>
                    </motion.div>
                  ) : (
                    <form onSubmit={handleSubmit} className="space-y-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-[11px] text-white/60 font-semibold uppercase tracking-wider">
                          What is broken / What happened?
                        </label>
                        <textarea
                          required
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          placeholder="e.g. Card animation delayed or voice synthesizer didn't play correctly."
                          className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs text-white placeholder-white/30 h-28 focus:outline-none focus:border-[#FF6B6B]/50 resize-none leading-relaxed"
                        />
                      </div>

                      {/* Context Details */}
                      <div className="border border-white/5 rounded-xl overflow-hidden bg-white/2">
                        <button
                          type="button"
                          onClick={() => setShowContext(!showContext)}
                          className="w-full flex items-center justify-between px-3 py-2 text-[10px] uppercase font-bold text-white/60 hover:text-white bg-white/5"
                        >
                          <span>Preview Context Payload</span>
                          {showContext ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>

                        {showContext && (
                          <div className="p-3 bg-black/30 font-mono text-[9px] text-white/70 space-y-1 overflow-x-auto max-h-40">
                            <div><span className="text-[#FF6B6B]">Route:</span> {window.location.pathname}</div>
                            <div><span className="text-[#FF6B6B]">Screen:</span> {window.innerWidth}x{window.innerHeight}</div>
                            <div><span className="text-[#FF6B6B]">Avg Latency:</span> {stats.averageLatency}ms</div>
                            <div><span className="text-[#FF6B6B]">Clicks:</span> {stats.totalClicks} tracked</div>
                            <div><span className="text-[#FF6B6B]">Buffered Logs:</span> {logs.length} logged</div>
                          </div>
                        )}
                      </div>

                      {error && (
                        <div className="text-[11px] text-red-400 bg-red-500/10 border border-red-500/20 p-2.5 rounded-lg flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                          <span>{error}</span>
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={isSubmitting || !description.trim()}
                        className="w-full bg-[#FF6B6B] hover:bg-[#FF8585] disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider py-3 rounded-xl shadow-md transition-all active:scale-98 flex items-center justify-center gap-1.5"
                      >
                        <Send className="w-3.5 h-3.5" />
                        {isSubmitting ? "Submitting..." : "Submit Bug Report"}
                      </button>
                    </form>
                  )}
                </div>
              )}

              {/* Submitted Bug DB List */}
              {activeTab === "submitted" && (
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold text-white uppercase tracking-wider border-b border-white/10 pb-2 flex items-center gap-1.5">
                    <List className="w-4 h-4 text-emerald-400" />
                    visual database bugs logged ({submittedBugs.length})
                  </h3>

                  {submittedBugs.length === 0 ? (
                    <p className="text-white/30 text-center py-10 font-sans italic text-xs">No submitted bug reports found.</p>
                  ) : (
                    <div className="space-y-2.5">
                      {submittedBugs.map((bug) => (
                        <div
                          key={bug.id}
                          className="bg-white/5 border border-white/10 rounded-xl p-3.5 space-y-2 text-xs"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-[#FF6B6B] bg-[#FF6B6B]/15 px-2 py-0.5 rounded-md">
                              BUG-{bug.id}
                            </span>
                            <span className="text-[9px] text-white/40 font-mono">
                              {new Date(bug.created_at).toLocaleString()}
                            </span>
                          </div>

                          <p className="text-white font-medium leading-relaxed">{bug.description}</p>

                          {bug.context && (
                            <div className="bg-black/25 rounded-lg p-2 font-mono text-[9px] text-white/60 space-y-0.5 border border-white/5">
                              <div><span className="text-[#FF6B6B]/70">URL:</span> {bug.context.pathname || "/"}</div>
                              <div><span className="text-[#FF6B6B]/70">Screen:</span> {bug.context.screenSize || "unknown"}</div>
                              <div><span className="text-[#FF6B6B]/70">Captured Logs:</span> {bug.context.recentLogs?.length || 0} entries</div>
                              {bug.context.stats && (
                                <div><span className="text-[#FF6B6B]/70">Avg Latency:</span> {bug.context.stats.averageLatency || 0}ms</div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
