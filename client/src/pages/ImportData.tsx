import { useState, useRef, useCallback } from "react";
import { Upload, FileSpreadsheet, CheckCircle2, XCircle, AlertCircle, Clock, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface ImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  total: number;
  importMode: string;
  message: string;
}

interface ImportLogEntry {
  id: number;
  fileName: string;
  importMode: string;
  status: string;
  totalRows: number | null;
  importedRows: number | null;
  skippedRows: number | null;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
  userName: string | null;
}

export default function ImportData() {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importMode, setImportMode] = useState<"append" | "replace">("append");
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<ImportLogEntry[]>([]);
  const [logsLoaded, setLogsLoaded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadLogs = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/import-logs", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
        setLogsLoaded(true);
      }
    } catch {
      // ignore
    }
  }, []);

  const handleFileSelect = (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["xlsx", "xls"].includes(ext || "")) {
      toast.error("يرجى اختيار ملف Excel (.xlsx أو .xls) فقط");
      return;
    }
    if (file.size > 100 * 1024 * 1024) {
      toast.error("حجم الملف كبير جداً (الحد الأقصى 100MB)");
      return;
    }
    setSelectedFile(file);
    setResult(null);
    setError(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setProgress(0);
    setResult(null);
    setError(null);

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("importMode", importMode);

    // Simulate progress while uploading
    const progressInterval = setInterval(() => {
      setProgress(p => Math.min(p + 2, 90));
    }, 300);

    try {
      const res = await fetch("/api/admin/import-sanctions", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      clearInterval(progressInterval);
      setProgress(100);

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "حدث خطأ أثناء الاستيراد");
        toast.error(data.error || "فشل الاستيراد");
      } else {
        setResult(data);
        toast.success(data.message);
        loadLogs();
      }
    } catch (err) {
      clearInterval(progressInterval);
      setError("فشل الاتصال بالخادم. يرجى المحاولة مرة أخرى.");
      toast.error("فشل الاتصال بالخادم");
    } finally {
      setIsUploading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString("ar-SA", {
      year: "numeric", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  };

  const statusIcon = (status: string) => {
    if (status === "completed") return <CheckCircle2 className="w-4 h-4 text-green-500" />;
    if (status === "failed") return <XCircle className="w-4 h-4 text-red-500" />;
    if (status === "processing") return <RefreshCw className="w-4 h-4 text-amber-500 animate-spin" />;
    return <Clock className="w-4 h-4 text-slate-400" />;
  };

  const statusLabel = (status: string) => {
    const map: Record<string, string> = {
      completed: "مكتمل", failed: "فشل", processing: "جاري المعالجة", pending: "في الانتظار",
    };
    return map[status] || status;
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #C17F3E22, #C17F3E44)" }}>
          <FileSpreadsheet className="w-5 h-5" style={{ color: "#C17F3E" }} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">استيراد بيانات العقوبات</h1>
          <p className="text-sm text-slate-500">رفع ملفات Excel لتحديث قاعدة بيانات العقوبات الدولية</p>
        </div>
      </div>

      {/* Import Mode Selection */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">وضع الاستيراد</h2>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setImportMode("append")}
            className={`p-4 rounded-lg border-2 text-right transition-all ${
              importMode === "append"
                ? "border-amber-500 bg-amber-50"
                : "border-slate-200 hover:border-slate-300"
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${importMode === "append" ? "border-amber-500" : "border-slate-300"}`}>
                {importMode === "append" && <div className="w-2 h-2 rounded-full bg-amber-500" />}
              </div>
              <span className="font-semibold text-slate-800">إضافة (Append)</span>
            </div>
            <p className="text-xs text-slate-500 mr-6">إضافة السجلات الجديدة إلى قاعدة البيانات الحالية دون حذف أي بيانات موجودة</p>
          </button>

          <button
            onClick={() => setImportMode("replace")}
            className={`p-4 rounded-lg border-2 text-right transition-all ${
              importMode === "replace"
                ? "border-red-500 bg-red-50"
                : "border-slate-200 hover:border-slate-300"
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${importMode === "replace" ? "border-red-500" : "border-slate-300"}`}>
                {importMode === "replace" && <div className="w-2 h-2 rounded-full bg-red-500" />}
              </div>
              <span className="font-semibold text-slate-800">استبدال (Replace)</span>
            </div>
            <p className="text-xs text-slate-500 mr-6">حذف جميع السجلات الحالية واستبدالها بالبيانات الجديدة من الملف</p>
          </button>
        </div>

        {importMode === "replace" && (
          <div className="mt-3 flex items-start gap-2 p-3 bg-red-50 rounded-lg border border-red-200">
            <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-red-700">
              <strong>تحذير:</strong> وضع الاستبدال سيحذف جميع السجلات الموجودة ({">"}39,000 سجل) ويستبدلها بالبيانات الجديدة. هذا الإجراء لا يمكن التراجع عنه.
            </p>
          </div>
        )}
      </div>

      {/* File Upload Area */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">اختيار الملف</h2>

        <div
          className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
            isDragging
              ? "border-amber-400 bg-amber-50"
              : selectedFile
              ? "border-green-400 bg-green-50"
              : "border-slate-300 hover:border-amber-400 hover:bg-amber-50/30"
          }`}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }}
          />

          {selectedFile ? (
            <div className="space-y-2">
              <FileSpreadsheet className="w-12 h-12 mx-auto text-green-500" />
              <p className="font-semibold text-slate-800">{selectedFile.name}</p>
              <p className="text-sm text-slate-500">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
              <button
                onClick={(e) => { e.stopPropagation(); setSelectedFile(null); setResult(null); setError(null); }}
                className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1 mx-auto"
              >
                <Trash2 className="w-3 h-3" /> إزالة الملف
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <Upload className="w-12 h-12 mx-auto text-slate-400" />
              <div>
                <p className="font-semibold text-slate-700">اسحب وأفلت ملف Excel هنا</p>
                <p className="text-sm text-slate-500 mt-1">أو انقر لاختيار الملف</p>
              </div>
              <p className="text-xs text-slate-400">يدعم: .xlsx، .xls — الحد الأقصى: 100MB</p>
            </div>
          )}
        </div>

        {/* Column format hint */}
        <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
          <p className="text-xs font-semibold text-slate-600 mb-1">أعمدة الملف المطلوبة:</p>
          <div className="flex flex-wrap gap-1">
            {["الاسم", "الاسم بالعربية", "الصفة", "تاريخ الإدراج", "سبب الإدراج", "الجهة المدرجة", "سند الإدراج", "الإجراء المتخذ", "الملاحظات"].map(col => (
              <span key={col} className="text-xs bg-white border border-slate-200 rounded px-2 py-0.5 text-slate-600">{col}</span>
            ))}
          </div>
          <p className="text-xs text-slate-400 mt-1">عمود "الاسم" إلزامي. باقي الأعمدة اختيارية.</p>
        </div>
      </div>

      {/* Progress & Upload Button */}
      {isUploading && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-700">جاري الاستيراد...</span>
            <span className="text-sm text-slate-500">{progress}%</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-3">
            <div
              className="h-3 rounded-full transition-all duration-300"
              style={{ width: `${progress}%`, background: "linear-gradient(90deg, #C17F3E, #e09a50)" }}
            />
          </div>
          <p className="text-xs text-slate-400 mt-2 text-center">يتم معالجة الملف وإدراج السجلات في قاعدة البيانات...</p>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="bg-green-50 rounded-xl border border-green-200 p-5">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-green-800 mb-2">{result.message}</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white rounded-lg p-3 text-center border border-green-200">
                  <p className="text-2xl font-bold text-green-700">{result.imported.toLocaleString("ar-SA")}</p>
                  <p className="text-xs text-slate-500">سجل مستورد</p>
                </div>
                <div className="bg-white rounded-lg p-3 text-center border border-green-200">
                  <p className="text-2xl font-bold text-slate-700">{result.total.toLocaleString("ar-SA")}</p>
                  <p className="text-xs text-slate-500">إجمالي الصفوف</p>
                </div>
                <div className="bg-white rounded-lg p-3 text-center border border-green-200">
                  <p className="text-2xl font-bold text-amber-600">{result.skipped.toLocaleString("ar-SA")}</p>
                  <p className="text-xs text-slate-500">صف تم تخطيه</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 rounded-xl border border-red-200 p-4 flex items-start gap-3">
          <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Upload Button */}
      <button
        onClick={handleUpload}
        disabled={!selectedFile || isUploading}
        className="w-full py-3 rounded-xl font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ background: selectedFile && !isUploading ? "linear-gradient(135deg, #C17F3E, #a06830)" : "#ccc" }}
      >
        {isUploading ? (
          <span className="flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin" />
            جاري الاستيراد...
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2">
            <Upload className="w-4 h-4" />
            {importMode === "replace" ? "استبدال قاعدة البيانات" : "إضافة إلى قاعدة البيانات"}
          </span>
        )}
      </button>

      {/* Import History */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-700">سجل عمليات الاستيراد</h2>
          <button
            onClick={loadLogs}
            className="text-xs text-amber-600 hover:text-amber-700 flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" /> تحديث
          </button>
        </div>

        {!logsLoaded ? (
          <div className="p-8 text-center">
            <button onClick={loadLogs} className="text-sm text-amber-600 hover:text-amber-700 flex items-center gap-2 mx-auto">
              <RefreshCw className="w-4 h-4" /> تحميل السجل
            </button>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">لا توجد عمليات استيراد سابقة</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {logs.map((log) => (
              <div key={log.id} className="p-4 hover:bg-slate-50 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2 flex-1 min-w-0">
                    {statusIcon(log.status)}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{log.fileName}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-xs text-slate-400">{formatDate(log.createdAt)}</span>
                        {log.userName && <span className="text-xs text-slate-400">• {log.userName}</span>}
                        <span className={`text-xs px-1.5 py-0.5 rounded ${log.importMode === "replace" ? "bg-red-100 text-red-600" : "bg-green-100 text-green-600"}`}>
                          {log.importMode === "replace" ? "استبدال" : "إضافة"}
                        </span>
                      </div>
                      {log.errorMessage && (
                        <p className="text-xs text-red-500 mt-1 truncate">{log.errorMessage}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className={`text-xs font-medium ${
                      log.status === "completed" ? "text-green-600" :
                      log.status === "failed" ? "text-red-600" :
                      "text-amber-600"
                    }`}>{statusLabel(log.status)}</span>
                    {log.importedRows != null && (
                      <p className="text-xs text-slate-400 mt-0.5">{log.importedRows.toLocaleString("ar-SA")} سجل</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
