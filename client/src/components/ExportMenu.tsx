import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, FileText, FileSpreadsheet, Code, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface SearchResult {
  id: number;
  nameEn: string;
  nameAr: string | null;
  entityType: string;
  listingDate: string | null;
  listingReason: string | null;
  issuingBody: string | null;
  nationality: string | null;
  matchScore: number;
  matchType: string;
  alternativeNames: string[];
  actionTaken: string | null;
}

interface ExportMenuProps {
  query: string;
  results: SearchResult[];
}

export default function ExportMenu({ query, results }: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);

  const logExport = trpc.export.logExport.useMutation();

  const exportJSON = () => {
    const data = JSON.stringify({ query, exportedAt: new Date().toISOString(), results }, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sanctions-screening-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    logExport.mutate({ query, format: "json", count: results.length });
    toast.success("Exported as JSON");
  };

  const exportCSV = () => {
    const headers = ["Name (EN)", "Name (AR)", "Entity Type", "Nationality", "Issuing Body", "Listing Date", "Listing Reason", "Action Taken", "Match Score", "Match Type", "Alternative Names"];
    const rows = results.map((r) => [
      r.nameEn,
      r.nameAr || "",
      r.entityType,
      r.nationality || "",
      r.issuingBody || "",
      r.listingDate || "",
      r.listingReason || "",
      r.actionTaken || "",
      r.matchScore + "%",
      r.matchType,
      (r.alternativeNames || []).join("; "),
    ]);
    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sanctions-screening-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    logExport.mutate({ query, format: "excel", count: results.length });
    toast.success("Exported as CSV/Excel");
  };

  const exportPDF = async () => {
    setExporting("pdf");
    try {
      // Build HTML report
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Sanctions Screening Report</title>
          <style>
            body { font-family: Arial, sans-serif; font-size: 12px; color: #333; margin: 20px; }
            h1 { font-size: 18px; color: #1a1a2e; border-bottom: 2px solid #3b82f6; padding-bottom: 8px; }
            .meta { color: #666; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th { background: #1e293b; color: white; padding: 8px; text-align: left; font-size: 11px; }
            td { padding: 7px 8px; border-bottom: 1px solid #e2e8f0; font-size: 11px; }
            tr:nth-child(even) { background: #f8fafc; }
            .score-high { color: #16a34a; font-weight: bold; }
            .score-med { color: #d97706; font-weight: bold; }
            .score-low { color: #dc2626; font-weight: bold; }
          </style>
        </head>
        <body>
          <h1>🔍 Sanctions Screening Report</h1>
          <div class="meta">
            <strong>Query:</strong> ${query} &nbsp;|&nbsp;
            <strong>Results:</strong> ${results.length} &nbsp;|&nbsp;
            <strong>Date:</strong> ${new Date().toLocaleString()}
          </div>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Name (EN)</th>
                <th>Name (AR)</th>
                <th>Type</th>
                <th>Nationality</th>
                <th>Issuing Body</th>
                <th>Listing Date</th>
                <th>Action</th>
                <th>Score</th>
              </tr>
            </thead>
            <tbody>
              ${results.map((r, i) => `
                <tr>
                  <td>${i + 1}</td>
                  <td>${r.nameEn}</td>
                  <td dir="rtl">${r.nameAr || "-"}</td>
                  <td>${r.entityType}</td>
                  <td>${r.nationality || "-"}</td>
                  <td>${r.issuingBody || "-"}</td>
                  <td>${r.listingDate || "-"}</td>
                  <td>${r.actionTaken || "-"}</td>
                  <td class="${r.matchScore >= 85 ? "score-high" : r.matchScore >= 60 ? "score-med" : "score-low"}">${r.matchScore}%</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
          <p style="margin-top:20px;color:#999;font-size:10px;">Generated by SanctionCheck Compliance Platform</p>
        </body>
        </html>
      `;
      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const win = window.open(url, "_blank");
      if (win) {
        win.onload = () => { win.print(); };
      }
      logExport.mutate({ query, format: "pdf", count: results.length });
      toast.success("PDF report opened for printing");
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        className="h-11 border-border text-muted-foreground hover:text-foreground"
        onClick={() => setOpen(!open)}
      >
        <Download size={15} className="mr-1.5" />
        Export
      </Button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 bg-popover border border-border rounded-lg shadow-xl py-1 min-w-[160px]">
            <button
              onClick={() => { exportPDF(); setOpen(false); }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-foreground hover:bg-secondary transition-colors"
            >
              <FileText size={14} className="text-red-400" />
              Export as PDF
            </button>
            <button
              onClick={() => { exportCSV(); setOpen(false); }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-foreground hover:bg-secondary transition-colors"
            >
              <FileSpreadsheet size={14} className="text-green-400" />
              Export as Excel/CSV
            </button>
            <button
              onClick={() => { exportJSON(); setOpen(false); }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-foreground hover:bg-secondary transition-colors"
            >
              <Code size={14} className="text-blue-400" />
              Export as JSON
            </button>
          </div>
        </>
      )}
    </div>
  );
}
