import { useState, useRef, useCallback, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { extractBatchNames } from "@/lib/batch-file-parser";
import { readBatchSpreadsheet } from "@/lib/batch-file-reader";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Upload,
  FileSpreadsheet,
  X,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Download,
  RotateCcw,
  Loader2,
  Shield,
  Clock,
  BarChart3,
} from "lucide-react";
import * as XLSX from "xlsx";

interface BatchResult {
  rowNumber: number;
  inputName: string;
  status: "MATCH" | "POSSIBLE_MATCH" | "NO_MATCH";
  matchScore: number;
  matchedRecord?: {
    id: string;
    name: string;
    nameArabic?: string | null;
    entityType: string | null;
    issuingBody: string | null;
    listingDate: string | null;
    matchType: string;
  };
  error?: string;
}

type FilterStatus = "ALL" | "MATCH" | "POSSIBLE_MATCH" | "NO_MATCH";

function BatchPage() {
  const [file, setFile] = useState<File | null>(null);
  const [names, setNames] = useState<string[]>([]);
  const [jobId, setJobId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isParsingFile, setIsParsingFile] = useState(false);
  const [results, setResults] = useState<BatchResult[]>([]);
  const [progress, setProgress] = useState(0);
  const [processed, setProcessed] = useState(0);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("ALL");
  const [stats, setStats] = useState<{
    total: number;
    matches: number;
    possibleMatches: number;
    noMatches: number;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // tRPC mutations
  const startBatch = trpc.batch.start.useMutation();

  // Poll for job status
  const statusQuery = trpc.batch.status.useQuery(
    { jobId: jobId || "" },
    {
      enabled: !!jobId && isProcessing,
      refetchInterval: isProcessing ? 1000 : false,
    }
  );

  // Handle status updates
  useEffect(() => {
    if (statusQuery.data && jobId) {
      const data = statusQuery.data;
      setProgress(data.progress);
      setProcessed(data.processed);
      setTotal(data.total);

      if (data.status === "done") {
        setResults(data.results as BatchResult[]);
        setStats(data.stats as any);
        setIsProcessing(false);
        setJobId(null);
      } else if (data.status === "error") {
        setError(data.error || "حدث خطأ أثناء المعالجة");
        setIsProcessing(false);
        setJobId(null);
      }
    }
  }, [statusQuery.data, jobId]);

  // Handle file selection
  const handleFileSelect = useCallback(async (selectedFile: File) => {
    setError(null);
    setResults([]);
    setStats(null);
    setNames([]);

    // Validate file type
    if (!selectedFile.name.match(/\.(xlsx|xls|csv)$/i)) {
      setError("يرجى رفع ملف Excel (.xlsx, .xls) أو CSV");
      setFile(null);
      return;
    }

    // Validate file size (max 5MB)
    if (selectedFile.size > 5 * 1024 * 1024) {
      setError("حجم الملف يتجاوز الحد الأقصى (5 ميجابايت)");
      return;
    }

    setFile(selectedFile);
    setIsParsingFile(true);

    // Parse Excel file
    try {
      const buffer = await selectedFile.arrayBuffer();
      const data = readBatchSpreadsheet(selectedFile.name, buffer);

      const extractedNames = extractBatchNames(data);

      if (extractedNames.length === 0) {
        setError("لم يتم العثور على أسماء في العمود الأول");
        setFile(null);
        return;
      }

      if (extractedNames.length > 100) {
        setError(`الملف يحتوي على ${extractedNames.length} اسم. الحد الأقصى هو 100 اسم.`);
        setFile(null);
        return;
      }

      setNames(extractedNames);
    } catch {
      setError("فشل في قراءة الملف. تأكد من أنه ملف Excel صالح.");
      setFile(null);
    } finally {
      setIsParsingFile(false);
    }
  }, []);

  // Handle drag and drop
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) handleFileSelect(droppedFile);
    },
    [handleFileSelect]
  );

  // Start batch processing
  const handleStartProcessing = async () => {
    if (names.length === 0) return;

    setIsProcessing(true);
    setProgress(0);
    setProcessed(0);
    setTotal(names.length);
    setResults([]);
    setStats(null);
    setError(null);

    try {
      const result = await startBatch.mutateAsync({ names });
      setJobId(result.jobId);
      setTotal(result.total);
    } catch (err: any) {
      setError(err.message || "فشل في بدء المعالجة");
      setIsProcessing(false);
    }
  };

  // Reset
  const handleReset = () => {
    setFile(null);
    setNames([]);
    setResults([]);
    setStats(null);
    setProgress(0);
    setProcessed(0);
    setTotal(0);
    setError(null);
    setJobId(null);
    setIsProcessing(false);
    setFilterStatus("ALL");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Export results to Excel
  const handleExport = () => {
    if (results.length === 0) return;

    const exportData = results.map((r, idx) => ({
      "#": idx + 1,
      "الاسم المقدم / Submitted Name": r.inputName,
      "الحالة / Status": r.status === "MATCH" ? "مطابقة / MATCH" : r.status === "POSSIBLE_MATCH" ? "احتمالية تطابق / POSSIBLE MATCH" : "غير مطابق / NO MATCH",
      "نسبة التطابق / Match Score (%)": r.matchScore,
      "الاسم المطابق (EN)": r.matchedRecord?.name || "—",
      "الاسم المطابق (AR)": r.matchedRecord?.nameArabic || "—",
      "نوع الكيان / Entity Type": r.matchedRecord?.entityType || "—",
      "الجهة المصدرة / Issuing Body": r.matchedRecord?.issuingBody || "—",
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Batch Results");
    XLSX.writeFile(wb, `batch-screening-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // Filter results
  const filteredResults = filterStatus === "ALL"
    ? results
    : results.filter(r => r.status === filterStatus);

  // Status badge component
  const StatusBadge = ({ status }: { status: string }) => {
    switch (status) {
      case "MATCH":
        return (
          <Badge className="bg-red-100 text-red-800 border-red-200 gap-1 font-semibold">
            <CheckCircle2 className="w-3 h-3" />
            مطابقة
          </Badge>
        );
      case "POSSIBLE_MATCH":
        return (
          <Badge className="bg-amber-100 text-amber-800 border-amber-200 gap-1 font-semibold">
            <AlertTriangle className="w-3 h-3" />
            احتمالية تطابق
          </Badge>
        );
      default:
        return (
          <Badge className="bg-green-100 text-green-800 border-green-200 gap-1 font-semibold">
            <XCircle className="w-3 h-3" />
            غير مطابق
          </Badge>
        );
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Shield className="w-7 h-7 text-primary" />
            الفحص الجماعي
          </h1>
          <p className="text-muted-foreground mt-1">
            رفع ملف Excel يحتوي على أسماء للفحص ضد قوائم العقوبات (حد أقصى 100 اسم)
          </p>
        </div>
        {results.length > 0 && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExport} className="gap-1">
              <Download className="w-4 h-4" />
              تصدير Excel
            </Button>
            <Button variant="outline" size="sm" onClick={handleReset} className="gap-1">
              <RotateCcw className="w-4 h-4" />
              فحص جديد
            </Button>
          </div>
        )}
      </div>

      {/* Upload Section */}
      {!isProcessing && results.length === 0 && (
        <Card>
          <CardContent className="pt-6">
            {/* Drop Zone */}
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors
                ${file ? "border-primary bg-primary/5" : "border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/50"}`}
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
            >
              <label htmlFor="batch-file-input" className="block cursor-pointer">
                <input
                  id="batch-file-input"
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileSelect(f);
                  }}
                />

                {!file ? (
                  <div className="space-y-3">
                    <Upload className="w-12 h-12 mx-auto text-muted-foreground" />
                    <div>
                      <p className="text-lg font-medium">اسحب الملف هنا أو اضغط للاختيار</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        يدعم ملفات Excel (.xlsx, .xls) و CSV — العمود الأول يجب أن يحتوي على الأسماء
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <FileSpreadsheet className="w-12 h-12 mx-auto text-primary" />
                    <div>
                      <p className="text-lg font-medium text-primary">{file.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {isParsingFile ? "جاري قراءة الملف..." : `${names.length} اسم جاهز للفحص`} • {(file.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>
                )}
              </label>
              {file && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-3 text-destructive"
                  onClick={handleReset}
                >
                  <X className="w-4 h-4 ml-1" />
                  إزالة
                </Button>
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-2 text-destructive">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <p className="text-sm">{error}</p>
              </div>
            )}

            {/* Start Button */}
            {file && names.length > 0 && !error && !isParsingFile && (
              <div className="mt-6 flex justify-center">
                <Button
                  size="lg"
                  onClick={handleStartProcessing}
                  className="gap-2 px-8"
                >
                  <Shield className="w-5 h-5" />
                  بدء الفحص ({names.length} اسم)
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Processing Progress */}
      {isProcessing && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-6">
              {/* Progress Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  <div>
                    <p className="font-semibold text-lg">جاري الفحص...</p>
                    <p className="text-sm text-muted-foreground">
                      يتم فحص الأسماء ضد قوائم العقوبات الدولية
                    </p>
                  </div>
                </div>
                <div className="text-left">
                  <p className="text-2xl font-bold text-primary">{progress}%</p>
                  <p className="text-xs text-muted-foreground">
                    {processed} / {total}
                  </p>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-2">
                <Progress value={progress} className="h-3" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    الوقت المتوقع: ~{Math.max(1, Math.ceil((total - processed) * 0.2))} ثانية
                  </span>
                  <span>{processed} من {total} اسم تم فحصه</span>
                </div>
              </div>

              {/* Animated dots */}
              <div className="flex justify-center gap-1">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-2 h-2 rounded-full bg-primary animate-pulse"
                    style={{ animationDelay: `${i * 0.3}s` }}
                  />
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results Section */}
      {results.length > 0 && stats && (
        <>
          {/* Statistics Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="border-r-4 border-r-blue-500">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">إجمالي الأسماء</p>
                    <p className="text-2xl font-bold">{stats.total}</p>
                  </div>
                  <BarChart3 className="w-8 h-8 text-blue-500 opacity-50" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-r-4 border-r-red-500">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">مطابقة</p>
                    <p className="text-2xl font-bold text-red-600">{stats.matches}</p>
                  </div>
                  <CheckCircle2 className="w-8 h-8 text-red-500 opacity-50" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-r-4 border-r-amber-500">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">احتمالية تطابق</p>
                    <p className="text-2xl font-bold text-amber-600">{stats.possibleMatches}</p>
                  </div>
                  <AlertTriangle className="w-8 h-8 text-amber-500 opacity-50" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-r-4 border-r-green-500">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">غير مطابق</p>
                    <p className="text-2xl font-bold text-green-600">{stats.noMatches}</p>
                  </div>
                  <XCircle className="w-8 h-8 text-green-500 opacity-50" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-2 flex-wrap">
            {[
              { key: "ALL" as FilterStatus, label: "الكل", count: results.length },
              { key: "MATCH" as FilterStatus, label: "مطابقة", count: stats.matches },
              { key: "POSSIBLE_MATCH" as FilterStatus, label: "احتمالية", count: stats.possibleMatches },
              { key: "NO_MATCH" as FilterStatus, label: "غير مطابق", count: stats.noMatches },
            ].map((tab) => (
              <Button
                key={tab.key}
                variant={filterStatus === tab.key ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterStatus(tab.key)}
                className="gap-1"
              >
                {tab.label}
                <Badge variant="secondary" className="mr-1 text-xs">
                  {tab.count}
                </Badge>
              </Button>
            ))}
          </div>

          {/* Results Table */}
          <Card>
            <CardContent className="pt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-right p-3 font-semibold">#</th>
                    <th className="text-right p-3 font-semibold">الاسم المقدم</th>
                    <th className="text-center p-3 font-semibold">الحالة</th>
                    <th className="text-center p-3 font-semibold">النسبة</th>
                    <th className="text-right p-3 font-semibold">الاسم المطابق</th>
                    <th className="text-right p-3 font-semibold">الجهة</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredResults.map((result, idx) => (
                    <tr
                      key={idx}
                      className={`border-b hover:bg-muted/30 transition-colors ${
                        result.status === "MATCH"
                          ? "bg-red-50/50 dark:bg-red-950/20"
                          : result.status === "POSSIBLE_MATCH"
                          ? "bg-amber-50/50 dark:bg-amber-950/20"
                          : ""
                      }`}
                    >
                      <td className="p-3 text-muted-foreground">{result.rowNumber}</td>
                      <td className="p-3 font-medium">{result.inputName}</td>
                      <td className="p-3 text-center">
                        <StatusBadge status={result.status} />
                      </td>
                      <td className="p-3 text-center">
                        {result.matchScore > 0 ? (
                          <span className={`font-bold ${
                            result.matchScore >= 85 ? "text-red-600" :
                            result.matchScore >= 70 ? "text-amber-600" : "text-muted-foreground"
                          }`}>
                            {result.matchScore}%
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="p-3">
                        {result.matchedRecord ? (
                          <div>
                            <p className="font-medium text-xs">{result.matchedRecord.name}</p>
                            {result.matchedRecord.nameArabic && (
                              <p className="text-xs text-muted-foreground">{result.matchedRecord.nameArabic}</p>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="p-3 text-xs text-muted-foreground">
                        {result.matchedRecord?.issuingBody || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {filteredResults.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  لا توجد نتائج تطابق الفلتر المحدد
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

export default BatchPage;
