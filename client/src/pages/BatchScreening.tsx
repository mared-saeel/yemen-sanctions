import { useState, useRef, useCallback } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Upload, FileSpreadsheet, Download, Eye, AlertTriangle,
  CheckCircle, XCircle, Loader2, RotateCcw, FileDown, Info
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import RecordModal from "@/components/RecordModal";
import { useLocation } from "wouter";

interface BatchRow {
  rowNumber: number;
  submittedName: string;
  status: "MATCH" | "POSSIBLE_MATCH" | "NO_MATCH";
  matchScore: number;
  matchedName: string | null;
  matchedNameAr: string | null;
  entityType: string | null;
  issuingBody: string | null;
  listingDate: string | null;
  recordId: number | null;
}

type FilterStatus = "ALL" | "MATCH" | "POSSIBLE_MATCH" | "NO_MATCH";

const STATUS_CONFIG = {
  MATCH: {
    label: "MATCH",
    color: "bg-red-50 text-red-700 border-red-200",
    rowColor: "bg-red-50/40",
    icon: <AlertTriangle size={13} className="text-red-600" />,
    dot: "bg-red-500",
  },
  POSSIBLE_MATCH: {
    label: "POSSIBLE MATCH",
    color: "bg-amber-50 text-amber-700 border-amber-200",
    rowColor: "bg-amber-50/30",
    icon: <AlertTriangle size={13} className="text-amber-500" />,
    dot: "bg-amber-400",
  },
  NO_MATCH: {
    label: "NO MATCH",
    color: "bg-green-50 text-green-700 border-green-200",
    rowColor: "",
    icon: <CheckCircle size={13} className="text-green-600" />,
    dot: "bg-green-500",
  },
};

export default function BatchScreening() {
  const { isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();

  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [results, setResults] = useState<BatchRow[] | null>(null);
  const [summary, setSummary] = useState<{ total: number; matchCount: number; possibleCount: number } | null>(null);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("ALL");
  const [selectedRecord, setSelectedRecord] = useState<number | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!loading && !isAuthenticated) {
    navigate("/login");
    return null;
  }

  const handleFile = (f: File) => {
    if (!f.name.endsWith(".xlsx") && !f.name.endsWith(".xls")) {
      toast.error("Please upload an Excel file (.xlsx or .xls)");
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      toast.error("File size must be less than 10MB");
      return;
    }
    // Note: Server enforces 100 name limit
    setFile(f);
    setResults(null);
    setSummary(null);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) handleFile(dropped);
  }, []);

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);

  const downloadTemplate = () => {
    // Create a simple CSV that opens in Excel
    const csv = "Name\nJohn Doe\nمحمد علي\nOsama bin Laden";
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "batch-screening-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const runBatch = async () => {
    if (!file) return;
    setIsProcessing(true);
    setProgress(5);
    setProgressLabel("Uploading file...");

    try {
      const formData = new FormData();
      formData.append("file", file);

      // Step 1: Upload file and get jobId immediately
      const uploadRes = await fetch("/api/batch/screen", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!uploadRes.ok) {
        const err = await uploadRes.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(err.error || `Server error ${uploadRes.status}`);
      }

      const { jobId, total } = await uploadRes.json();
      setProgress(10);
      setProgressLabel(`Processing 0 / ${total} names...`);

      // Step 2: Poll for progress every 1.5 seconds
      await new Promise<void>((resolve, reject) => {
        const poll = setInterval(async () => {
          try {
            const statusRes = await fetch(`/api/batch/status/${jobId}`, {
              credentials: "include",
            });
            if (!statusRes.ok) {
              clearInterval(poll);
              reject(new Error("Failed to get job status"));
              return;
            }
            const status = await statusRes.json();

            // Update progress bar based on real server progress
            const serverProgress = Math.max(10, Math.round(status.progress * 0.9));
            setProgress(serverProgress);
            setProgressLabel(`Processing ${status.processed} / ${status.total} names...`);

            if (status.status === "done") {
              clearInterval(poll);
              setProgress(95);
              setProgressLabel("Preparing results...");
              await new Promise(r => setTimeout(r, 300));
              setResults(status.results);
              setSummary({
                total: status.total,
                matchCount: status.matchCount,
                possibleCount: status.possibleCount,
              });
              setProgress(100);
              setProgressLabel("Done!");
              toast.success(`Screening complete: ${status.total} names processed`);
              resolve();
            } else if (status.status === "error") {
              clearInterval(poll);
              reject(new Error(status.error || "Processing failed"));
            }
          } catch (pollErr) {
            clearInterval(poll);
            reject(pollErr);
          }
        }, 1500);
      });

    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Batch screening failed");
      setProgress(0);
    } finally {
      setIsProcessing(false);
    }
  };

  const exportExcel = async () => {
    if (!results) return;
    setIsExporting(true);
    try {
      const res = await fetch("/api/batch/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ results }),
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `batch-screening-${Date.now()}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Excel report downloaded");
    } catch {
      toast.error("Failed to export Excel");
    } finally {
      setIsExporting(false);
    }
  };

  const reset = () => {
    setFile(null);
    setResults(null);
    setSummary(null);
    setProgress(0);
    setProgressLabel("");
    setFilterStatus("ALL");
  };

  const filteredResults = results?.filter(r =>
    filterStatus === "ALL" || r.status === filterStatus
  ) ?? [];

  return (
    <AppLayout>
      <div className="flex flex-col h-full min-h-0">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border bg-background flex items-center justify-between flex-shrink-0">
          <div>
            <h1 className="text-lg font-semibold text-foreground">Batch Screening</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Screen multiple names at once by uploading an Excel file
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-1.5 text-xs">
              <FileDown size={14} />
              Download Template
            </Button>
            {results && (
              <>
                <Button variant="outline" size="sm" onClick={reset} className="gap-1.5 text-xs">
                  <RotateCcw size={14} />
                  New Batch
                </Button>
                <Button size="sm" onClick={exportExcel} disabled={isExporting} className="gap-1.5 text-xs bg-[#1B3A6B] hover:bg-[#1B3A6B]/90">
                  {isExporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                  Export Excel
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6 min-h-0">
          {!results ? (
            <div className="max-w-2xl mx-auto space-y-6">
              {/* Upload zone */}
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => !file && fileInputRef.current?.click()}
                className={cn(
                  "border-2 border-dashed rounded-xl p-10 text-center transition-all cursor-pointer",
                  isDragging
                    ? "border-[#1B5EBF] bg-blue-50"
                    : file
                    ? "border-green-400 bg-green-50/50 cursor-default"
                    : "border-border hover:border-[#1B5EBF]/50 hover:bg-muted/30"
                )}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
                />
                {file ? (
                  <div className="space-y-2">
                    <FileSpreadsheet size={40} className="mx-auto text-green-600" />
                    <p className="font-medium text-foreground">{file.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(file.size / 1024).toFixed(1)} KB — Ready to screen
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-muted-foreground"
                      onClick={e => { e.stopPropagation(); setFile(null); }}
                    >
                      <XCircle size={13} className="mr-1" /> Remove
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Upload size={40} className="mx-auto text-muted-foreground" />
                    <div>
                      <p className="font-medium text-foreground">Drop your Excel file here</p>
                      <p className="text-sm text-muted-foreground mt-1">or click to browse</p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Supports .xlsx and .xls — up to 100 names, 10MB max
                    </p>
                  </div>
                )}
              </div>

              {/* Instructions */}
              <div className="rounded-lg border border-border bg-muted/20 p-4 flex gap-3">
                <Info size={16} className="text-[#1B5EBF] mt-0.5 flex-shrink-0" />
                <div className="text-sm text-muted-foreground space-y-1">
                  <p className="font-medium text-foreground">How it works</p>
                  <p>1. Download the template or prepare an Excel file with names in the <strong>first column</strong> (row 1 = header, rows 2+ = names)</p>
                  <p>2. Names can be in Arabic or English</p>
                  <p>3. Click "Run Batch Screening" — results appear instantly</p>
                  <p>4. Export results to Excel with color-coded status for each name</p>
                </div>
              </div>

              {/* Progress */}
              {isProcessing && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <Loader2 size={14} className="animate-spin" />
                      {progressLabel}
                    </span>
                    <span className="font-medium">{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
              )}

              {/* Run button */}
              <Button
                className="w-full bg-[#1B3A6B] hover:bg-[#1B3A6B]/90 h-11"
                disabled={!file || isProcessing}
                onClick={runBatch}
              >
                {isProcessing ? (
                  <><Loader2 size={16} className="animate-spin mr-2" /> Processing...</>
                ) : (
                  <><FileSpreadsheet size={16} className="mr-2" /> Run Batch Screening</>
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Summary cards */}
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: "Total Screened", value: summary!.total, color: "text-foreground", bg: "bg-muted/30" },
                  { label: "MATCH", value: summary!.matchCount, color: "text-red-700", bg: "bg-red-50" },
                  { label: "POSSIBLE MATCH", value: summary!.possibleCount, color: "text-amber-700", bg: "bg-amber-50" },
                  { label: "NO MATCH", value: summary!.total - summary!.matchCount - summary!.possibleCount, color: "text-green-700", bg: "bg-green-50" },
                ].map(card => (
                  <div key={card.label} className={cn("rounded-lg border border-border p-4", card.bg)}>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{card.label}</p>
                    <p className={cn("text-2xl font-bold mt-1", card.color)}>{card.value}</p>
                  </div>
                ))}
              </div>

              {/* Filter tabs */}
              <div className="flex items-center gap-2 border-b border-border pb-3">
                {(["ALL", "MATCH", "POSSIBLE_MATCH", "NO_MATCH"] as FilterStatus[]).map(s => (
                  <button
                    key={s}
                    onClick={() => setFilterStatus(s)}
                    className={cn(
                      "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                      filterStatus === s
                        ? "bg-[#1B3A6B] text-white"
                        : "text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {s === "ALL" ? `All (${results.length})` :
                     s === "MATCH" ? `Match (${summary!.matchCount})` :
                     s === "POSSIBLE_MATCH" ? `Possible (${summary!.possibleCount})` :
                     `No Match (${results.length - summary!.matchCount - summary!.possibleCount})`}
                  </button>
                ))}
              </div>

              {/* Results table */}
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 border-b border-border">
                      <th className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide w-10">#</th>
                      <th className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide">Submitted Name</th>
                      <th className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide w-36">Status</th>
                      <th className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide w-24">Score</th>
                      <th className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide">Matched Name</th>
                      <th className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide w-28">Entity</th>
                      <th className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide w-20">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredResults.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground text-sm">
                          No results for this filter
                        </td>
                      </tr>
                    ) : (
                      filteredResults.map((row, idx) => {
                        const cfg = STATUS_CONFIG[row.status];
                        return (
                          <tr
                            key={row.rowNumber}
                            className={cn(
                              "border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors",
                              cfg.rowColor
                            )}
                          >
                            <td className="px-4 py-3 text-muted-foreground text-xs">{idx + 1}</td>
                            <td className="px-4 py-3 font-medium text-foreground">{row.submittedName}</td>
                            <td className="px-4 py-3">
                              <span className={cn(
                                "inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-xs font-semibold",
                                cfg.color
                              )}>
                                {cfg.icon}
                                {cfg.label}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              {row.matchScore > 0 ? (
                                <div className="flex items-center gap-2">
                                  <div className="w-16 bg-muted rounded-full h-1.5">
                                    <div
                                      className={cn("h-1.5 rounded-full", cfg.dot)}
                                      style={{ width: `${row.matchScore}%` }}
                                    />
                                  </div>
                                  <span className="text-xs text-muted-foreground">{row.matchScore}%</span>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {row.matchedName ? (
                                <div>
                                  <p className="text-foreground text-xs font-medium">{row.matchedName}</p>
                                  {row.matchedNameAr && (
                                    <p className="text-muted-foreground text-xs" dir="rtl">{row.matchedNameAr}</p>
                                  )}
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-xs">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {row.entityType ? (
                                <Badge variant="outline" className="text-xs capitalize">{row.entityType}</Badge>
                              ) : (
                                <span className="text-muted-foreground text-xs">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {row.recordId && row.status !== "NO_MATCH" ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-xs gap-1"
                                  onClick={() => setSelectedRecord(row.recordId)}
                                >
                                  <Eye size={12} />
                                  View
                                </Button>
                              ) : (
                                <span className="text-muted-foreground text-xs">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Record detail modal */}
      {selectedRecord && (
        <RecordModal
          recordId={selectedRecord}
          onClose={() => setSelectedRecord(null)}
        />
      )}
    </AppLayout>
  );
}
