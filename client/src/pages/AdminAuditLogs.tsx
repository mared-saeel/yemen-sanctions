import { useState } from "react";
import { trpc } from "@/lib/trpc";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Search, Download, Eye, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const ACTION_COLORS: Record<string, string> = {
  search: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  view: "bg-green-500/10 text-green-400 border-green-500/20",
  export: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  login: "bg-purple-500/10 text-purple-400 border-purple-500/20",
};

const ACTION_ICONS: Record<string, React.ReactNode> = {
  search: <Search size={11} />,
  view: <Eye size={11} />,
  export: <Download size={11} />,
};

export default function AdminAuditLogs() {
  const [page, setPage] = useState(1);
  const [filterAction, setFilterAction] = useState("");

  const { data, isLoading } = trpc.admin.auditLogs.list.useQuery({
    page,
    pageSize: 50,
    action: filterAction || undefined,
  });

  const totalPages = data ? Math.ceil(data.total / 50) : 1;

  return (
    <AppLayout>
      <div className="p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <FileText size={20} className="text-primary" />
              Audit Logs
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {data?.total || 0} total activities recorded
            </p>
          </div>
          {/* Filter */}
          <div className="flex items-center gap-2">
            <select
              value={filterAction}
              onChange={(e) => { setFilterAction(e.target.value); setPage(1); }}
              className="h-8 text-xs bg-input border border-border rounded-md px-2 text-foreground"
            >
              <option value="">All Actions</option>
              <option value="search">Search</option>
              <option value="view">View</option>
              <option value="export">Export</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-secondary/30">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Time</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">User</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Action</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Query</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Results</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Score</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Duration</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="border-b border-border">
                      {Array.from({ length: 7 }).map((_, j) => (
                        <td key={j} className="px-4 py-3"><div className="h-4 bg-secondary animate-pulse rounded w-20" /></td>
                      ))}
                    </tr>
                  ))
                ) : data?.logs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground text-sm">
                      No audit logs yet
                    </td>
                  </tr>
                ) : data?.logs.map((log) => (
                  <tr key={log.id} className="border-b border-border hover:bg-secondary/20 transition-colors">
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs text-foreground">{log.userName || `User #${log.userId}`}</div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant="secondary"
                        className={cn("text-xs gap-1", ACTION_COLORS[log.action] || "bg-secondary text-secondary-foreground")}
                      >
                        {ACTION_ICONS[log.action]}
                        {log.action}
                        {log.exportFormat && ` (${log.exportFormat})`}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs text-foreground max-w-[200px] truncate">{log.query || "—"}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {log.resultsCount !== null ? log.resultsCount : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {log.topMatchScore !== null ? (
                        <span className={cn(
                          "text-xs font-semibold",
                          log.topMatchScore >= 85 ? "text-green-400" :
                          log.topMatchScore >= 60 ? "text-yellow-400" : "text-red-400"
                        )}>
                          {log.topMatchScore}%
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {log.duration ? `${log.duration}ms` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <span className="text-xs text-muted-foreground">Page {page} of {totalPages} ({data?.total} total)</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)} className="h-7 border-border">
                  <ChevronLeft size={14} />
                </Button>
                <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)} className="h-7 border-border">
                  <ChevronRight size={14} />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
