import { useState, useCallback, useRef } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Search, Filter, X, ChevronDown, ChevronUp, Zap, Clock,
  User, Building2, Ship, HelpCircle, AlertTriangle, CheckCircle,
  Download, Eye, RotateCcw, Loader2, Sparkles, Trash2, ShieldCheck,
  SlidersHorizontal, FileSearch, BadgeCheck, ListFilter
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";
import { toast } from "sonner";
import RecordModal from "@/components/RecordModal";
import ExportMenu from "@/components/ExportMenu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const ENTITY_TYPES = [
  { value: null, label: "All Types", icon: <HelpCircle size={14} /> },
  { value: "individual", label: "Individual", icon: <User size={14} /> },
  { value: "organisation", label: "Organisation", icon: <Building2 size={14} /> },
  { value: "vessel", label: "Vessel", icon: <Ship size={14} /> },
  { value: "unspecified", label: "Unspecified", icon: <HelpCircle size={14} /> },
] as const;

type EntityType = "individual" | "organisation" | "vessel" | "unspecified" | null;

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

export default function SearchPage() {
  const { isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();

  const [query, setQuery] = useState("");
  const [entityType, setEntityType] = useState<EntityType>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [nationality, setNationality] = useState("");
  const [issuingBody, setIssuingBody] = useState("");
  const [listingReason, setListingReason] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [enableAI, setEnableAI] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [queryTime, setQueryTime] = useState(0);
  const [aiEnhancement, setAiEnhancement] = useState<{ expandedQuery?: string; suggestions?: string[]; explanation?: string } | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [page, setPage] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filterOptions = trpc.search.filterOptions.useQuery(undefined, { enabled: isAuthenticated });

  const searchMutation = trpc.search.query.useMutation({
    onSuccess: (data) => {
      setResults(data.results as SearchResult[]);
      setTotal(data.total);
      setQueryTime(data.queryTime);
      setAiEnhancement(data.aiEnhancement);
      setHasSearched(true);
    },
    onError: (err) => {
      toast.error("Search failed: " + err.message);
    },
  });

  const deleteRecordMutation = trpc.admin.deleteSanctionRecord.useMutation({
    onSuccess: (_data, variables) => {
      setResults((current) => current.filter((record) => record.id !== variables.id));
      setTotal((current) => Math.max(0, current - 1));
      setSelectedRecord((current) => current === variables.id ? null : current);
      setDeleteTarget(null);
      toast.success("تم حذف السجل وتوثيق العملية في سجل التدقيق");
    },
    onError: (error) => {
      toast.error(`تعذر حذف السجل: ${error.message}`);
    },
  });

  const handleSearch = useCallback((offset = 0) => {
    if (!query.trim()) { toast.warning("Please enter a search query"); return; }
    setPage(offset / 20);
    searchMutation.mutate({
      query: query.trim(),
      filters: {
        entityType: entityType || null,
        nationality: nationality || null,
        issuingBody: issuingBody || null,
        listingReason: listingReason || null,
        dateFrom: dateFrom || null,
        dateTo: dateTo || null,
      },
      limit: 20,
      offset,
      enableAI,
      threshold: 0.35,
    });
  }, [query, entityType, nationality, issuingBody, listingReason, dateFrom, dateTo, enableAI]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch(0);
  };

  const clearFilters = () => {
    setEntityType(null);
    setNationality("");
    setIssuingBody("");
    setListingReason("");
    setDateFrom("");
    setDateTo("");
  };

  const hasActiveFilters = entityType || nationality || issuingBody || listingReason || dateFrom || dateTo;
  const activeFilterCount = [entityType, nationality, issuingBody, listingReason, dateFrom, dateTo]
    .filter(Boolean)
    .length;

  if (!loading && !isAuthenticated) {
    window.location.replace("/login");
    return null;
  }

  return (
    <AppLayout>
      <div className="flex h-full">
        {/* Left Sidebar - Filters */}
        <aside className="w-[272px] flex-shrink-0 border-r border-border bg-sidebar flex flex-col overflow-y-auto hidden lg:flex">
          <div className="px-5 py-5 border-b border-sidebar-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <SlidersHorizontal size={15} />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Screening Settings</h3>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">Refine your review</p>
                </div>
              </div>
              {hasActiveFilters && (
                <button onClick={clearFilters} className="text-xs font-semibold text-primary hover:underline">Clear</button>
              )}
            </div>
          </div>

          <div className="px-5 py-5 space-y-5 flex-1">
            {/* Mode */}
            <div>
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Mode</div>
              <div className="space-y-1">
                <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-md bg-primary text-white text-sm font-semibold cursor-pointer shadow-sm">
                  <span className="h-1.5 w-1.5 rounded-full bg-white/90" /> Single screening
                </div>
                <div
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-muted-foreground text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground"
                  onClick={() => toast.info("Batch screening coming soon")}
                >
                  Batch screening
                </div>
              </div>
            </div>

            <Separator className="bg-border" />

            {/* Entity Type */}
            <div>
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Entity Type</div>
              <div className="space-y-1">
                {ENTITY_TYPES.map((et) => (
                  <div
                    key={String(et.value)}
                    onClick={() => setEntityType(et.value as EntityType)}
                    className={cn(
                      "flex items-center gap-2.5 px-3 py-2.5 rounded-md text-sm cursor-pointer transition-all duration-150",
                      entityType === et.value
                        ? "bg-primary text-white font-semibold shadow-sm"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    )}
                  >
                    {et.icon}
                    {et.label}
                  </div>
                ))}
              </div>
            </div>

            <Separator className="bg-border" />

            {/* Check Types */}
            <div>
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Check Types</div>
              <div className="flex items-center justify-between px-3 py-2.5 rounded-md bg-accent/60 border border-border">
                <div className="flex items-center gap-2 text-sm text-foreground">
                  <span>🛡️</span> Sanctions Database
                </div>
                <div className="w-8 h-4 bg-primary rounded-full flex items-center justify-end pr-0.5">
                  <div className="w-3 h-3 bg-white rounded-full" />
                </div>
              </div>
            </div>

            <Separator className="bg-border" />

            {/* AI Enhancement */}
            <div>
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">AI Enhancement</div>
              <div
                className="flex items-center justify-between px-3 py-2.5 rounded-md bg-accent/60 border border-border cursor-pointer hover:bg-accent transition-colors"
                onClick={() => setEnableAI(!enableAI)}
              >
                <div className="flex items-center gap-2 text-sm text-foreground">
                  <Sparkles size={14} className="text-primary" />
                  AI Search
                </div>
                <div className={cn(
                  "w-8 h-4 rounded-full flex items-center transition-colors",
                  enableAI ? "bg-primary justify-end pr-0.5" : "bg-muted justify-start pl-0.5"
                )}>
                  <div className="w-3 h-3 bg-white rounded-full" />
                </div>
              </div>
            </div>

            <Separator className="bg-border" />

            {/* Advanced Filters */}
            <div>
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Advanced Filters</div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Nationality</label>
                  <Input
                    value={nationality}
                    onChange={(e) => setNationality(e.target.value)}
                    placeholder="e.g. IRAQ"
                    className="h-8 text-xs bg-card border-border"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Issuing Body</label>
                  <select
                    value={issuingBody}
                    onChange={(e) => setIssuingBody(e.target.value)}
                    className="w-full h-8 text-xs bg-card border border-border rounded-md px-2 text-foreground"
                  >
                    <option value="">All Bodies</option>
                    {filterOptions.data?.issuingBodies.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Date From</label>
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="h-8 text-xs bg-card border-border"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Date To</label>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="h-8 text-xs bg-card border-border"
                  />
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Search Header */}
          <div className="border-b border-border bg-card px-6 py-6 lg:px-8">
            <div className="max-w-5xl">
              <div className="mb-5 flex items-start justify-between gap-5">
                <div>
                  <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-primary">
                    <ShieldCheck size={14} /> Sanctions screening
                  </div>
                  <h2 className="text-xl font-semibold tracking-tight text-foreground">Search the sanctions database</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Review individuals, organisations and vessels using the existing matching engine.</p>
                </div>
                <div className="hidden sm:flex items-center gap-2 border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                  <span className="h-2 w-2 rounded-full bg-emerald-600" /> Database available
                </div>
              </div>

              {/* Search Bar */}
              <div className="relative border border-border bg-background p-2 shadow-sm">
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      ref={inputRef}
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Enter name to screen (Arabic or English)..."
                      className="pl-11 h-12 border-0 bg-transparent text-foreground placeholder:text-muted-foreground text-sm focus-visible:ring-0 shadow-none"
                    />
                    {query && (
                      <button
                        onClick={() => { setQuery(""); setResults([]); setHasSearched(false); }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  <Button
                    onClick={() => handleSearch(0)}
                    disabled={searchMutation.isPending}
                    className="h-12 px-7 bg-primary hover:bg-primary/90 text-primary-foreground font-bold tracking-wide shadow-sm"
                  >
                    {searchMutation.isPending ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      "SCREEN"
                    )}
                  </Button>
                  {hasSearched && results.length > 0 && (
                    <ExportMenu query={query} results={results} />
                  )}
                </div>

                {/* AI Enhancement indicator */}
                {enableAI && (
                  <div className="mt-3 flex items-center gap-1.5 text-xs text-primary">
                    <Sparkles size={11} />
                    AI-enhanced search enabled
                  </div>
                )}
              </div>

              {hasActiveFilters && (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><ListFilter size={13} /> Active filters</span>
                  {entityType && <Badge variant="secondary" className="rounded-sm font-medium">{entityType}</Badge>}
                  {nationality && <Badge variant="secondary" className="rounded-sm font-medium">Nationality: {nationality}</Badge>}
                  {issuingBody && <Badge variant="secondary" className="rounded-sm font-medium">Body: {issuingBody}</Badge>}
                  {(dateFrom || dateTo) && <Badge variant="secondary" className="rounded-sm font-medium">Date range</Badge>}
                  <button onClick={clearFilters} className="ml-1 text-xs font-semibold text-primary hover:underline">Clear all</button>
                </div>
              )}

              {/* AI Suggestions */}
              {aiEnhancement?.suggestions && aiEnhancement.suggestions.length > 0 && (
                <div className="mt-3 flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-muted-foreground">AI suggestions:</span>
                  {aiEnhancement.suggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => { setQuery(s); }}
                      className="text-xs px-2 py-0.5 rounded border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Results Area */}
          <div className="flex-1 overflow-y-auto bg-muted/25 px-6 py-6 lg:px-8">
            {/* Search Stats */}
            {hasSearched && (
              <div className="mb-5 flex items-center justify-between border-y border-border bg-card px-4 py-3">
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <FileSearch size={16} className="text-primary" />
                  <span className="font-semibold text-foreground">{total}</span> results found
                  <span className="h-4 border-l border-border" />
                  <span className="flex items-center gap-1">
                    <Clock size={12} />
                    {queryTime}ms
                  </span>
                  {activeFilterCount > 0 && (
                    <><span className="h-4 border-l border-border" /><span>{activeFilterCount} filter{activeFilterCount > 1 ? "s" : ""} active</span></>
                  )}
                  {aiEnhancement?.expandedQuery && aiEnhancement.expandedQuery !== query && (
                    <span className="text-primary text-xs">
                      (AI expanded: "{aiEnhancement.expandedQuery}")
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Review ranked matches below</span>
                </div>
              </div>
            )}

            {/* Empty State */}
              {!hasSearched && (
              <div className="mx-auto flex max-w-2xl flex-col items-center justify-center py-16 text-center">
                <div className="w-14 h-14 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
                  <Search size={28} className="text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Start a screening review</h3>
                <p className="text-muted-foreground text-sm max-w-md leading-6">
                  Enter a name in Arabic or English to screen against <span className="font-semibold text-foreground">50,000+</span> sanctioned entities.
                  Matching and transliteration checks use the existing search engine.
                </p>
                <div className="mt-7 grid w-full grid-cols-1 divide-y divide-border border-y border-border bg-card text-left sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                  <div className="px-4 py-3.5">
                    <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-primary">Input</div>
                    <div className="mt-1 text-xs font-medium text-foreground">Arabic & English names</div>
                  </div>
                  <div className="px-4 py-3.5">
                    <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-primary">Review</div>
                    <div className="mt-1 text-xs font-medium text-foreground">Ranked match confidence</div>
                  </div>
                  <div className="px-4 py-3.5">
                    <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-primary">Control</div>
                    <div className="mt-1 text-xs font-medium text-foreground">Audited user actions</div>
                  </div>
                </div>
                <div className="mt-6 flex flex-wrap justify-center gap-2 text-xs text-muted-foreground">
                  <span className="mr-1 self-center font-semibold uppercase tracking-wide">Examples</span>
                  {["صدام حسين", "Osama bin Laden", "HAMAS", "حزب العمال الكردستاني"].map((ex) => (
                    <button
                      key={ex}
                      onClick={() => { setQuery(ex); setTimeout(() => inputRef.current?.focus(), 100); }}
                      className="border border-border bg-card px-3 py-1.5 hover:border-primary/40 hover:text-foreground transition-colors"
                    >
                      {ex}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* No Results */}
            {hasSearched && results.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <CheckCircle size={40} className="text-green-500 mb-3" />
                <h3 className="text-lg font-semibold text-foreground mb-2">No Matches Found</h3>
                <p className="text-muted-foreground text-sm">
                  No sanctioned entities match "{query}". This entity appears to be clear.
                </p>
                {!enableAI && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4 border-primary/30 text-primary"
                    onClick={() => { setEnableAI(true); handleSearch(0); }}
                  >
                    <Sparkles size={14} className="mr-2" />
                    Try AI-Enhanced Search
                  </Button>
                )}
              </div>
            )}

            {/* Results List */}
            {results.length > 0 && (
              <div className="space-y-3">
                {results.map((result) => (
                  <ResultCard
                    key={result.id}
                    result={result}
                    onView={() => setSelectedRecord(result.id)}
                    onDelete={() => setDeleteTarget({ id: result.id, name: result.nameEn })}
                  />
                ))}

                {/* Pagination */}
                {total > 20 && (
                  <div className="flex items-center justify-center gap-3 pt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page === 0}
                      onClick={() => handleSearch((page - 1) * 20)}
                      className="border-border"
                    >
                      Previous
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Page {page + 1} of {Math.ceil(total / 20)}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={(page + 1) * 20 >= total}
                      onClick={() => handleSearch((page + 1) * 20)}
                      className="border-border"
                    >
                      Next
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Record Detail Modal */}
      {selectedRecord && (
        <RecordModal
          recordId={selectedRecord}
          onClose={() => setSelectedRecord(null)}
        />
      )}

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !deleteRecordMutation.isPending) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader className="text-right">
            <AlertDialogTitle>حذف سجل عقوبات</AlertDialogTitle>
            <AlertDialogDescription className="leading-6">
              سيُحذف السجل <strong dir="ltr" className="text-foreground">{deleteTarget?.name}</strong> نهائياً من قاعدة البيانات.
              هذه العملية مقصورة على المدير وسيتم تسجيلها في سجل التدقيق.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:flex-row-reverse">
            <AlertDialogCancel disabled={deleteRecordMutation.isPending}>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteRecordMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                if (deleteTarget) deleteRecordMutation.mutate({ id: deleteTarget.id });
              }}
            >
              {deleteRecordMutation.isPending ? "جارٍ الحذف..." : "تأكيد الحذف"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}

// ─── Result Card ──────────────────────────────────────────────────────────────

function ResultCard({
  result,
  onView,
  onDelete,
}: {
  result: SearchResult;
  onView: () => void;
  onDelete: () => void;
}) {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const scoreColor =
    result.matchScore >= 85 ? "score-high" :
    result.matchScore >= 60 ? "score-medium" : "score-low";

  const entityIcon =
    result.entityType === "individual" ? <User size={14} /> :
    result.entityType === "organisation" ? <Building2 size={14} /> :
    result.entityType === "vessel" ? <Ship size={14} /> :
    <HelpCircle size={14} />;

  const matchLabel = result.matchScore >= 85 ? "Exact match" : result.matchScore >= 60 ? "Possible match" : "Low confidence";
  const matchBadgeClass = result.matchScore >= 85
    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
    : result.matchScore >= 60
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : "border-slate-200 bg-slate-50 text-slate-700";

  return (
    <div
      className="group cursor-pointer border border-border bg-card transition-colors hover:border-primary/45"
      onClick={onView}
    >
      <div className="flex items-stretch">
        <div className={cn("w-1 flex-shrink-0", result.matchScore >= 85 ? "bg-emerald-500" : result.matchScore >= 60 ? "bg-amber-500" : "bg-slate-300")} />
        <div className="min-w-0 flex-1 px-5 py-4">
          <div className="flex items-start justify-between gap-5">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <BadgeCheck size={16} className="flex-shrink-0 text-primary" />
                <span className="truncate text-base font-semibold text-foreground">{result.nameEn}</span>
              </div>
              {result.nameAr && (
                <div className="mt-1 pl-6 text-sm text-muted-foreground" dir="rtl">{result.nameAr}</div>
              )}
              {result.alternativeNames && result.alternativeNames.length > 0 && (
                <div className="mt-2 truncate pl-6 text-xs text-muted-foreground">
                  Also known as: {result.alternativeNames.slice(0, 3).join(", ")}
                  {result.alternativeNames.length > 3 && ` +${result.alternativeNames.length - 3} more`}
                </div>
              )}
            </div>
            <div className={cn("flex-shrink-0 border px-2.5 py-1 text-right text-xs font-bold", matchBadgeClass)}>
              <div>{result.matchScore}%</div>
              <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide">{matchLabel}</div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="text-foreground">{entityIcon}</span><span className="capitalize">{result.entityType}</span></span>
            {result.nationality && <span>Nationality: <strong className="font-medium text-foreground">{result.nationality}</strong></span>}
            {result.issuingBody && <span>Source: <strong className="font-medium text-foreground">{result.issuingBody}</strong></span>}
            {result.listingDate && <span>Listed: <strong className="font-medium text-foreground">{result.listingDate}</strong></span>}
          </div>

          {(result.listingReason || result.actionTaken) && (
            <div className="mt-3 flex items-center gap-2 text-xs">
              <AlertTriangle size={13} className="flex-shrink-0 text-amber-600" />
              <span className="font-medium text-foreground">{result.listingReason || result.actionTaken}</span>
            </div>
          )}
        </div>

        <div className="flex w-28 flex-shrink-0 flex-col items-end justify-center gap-1 border-l border-border bg-muted/20 px-3 py-4">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-full justify-end text-xs text-muted-foreground hover:text-primary"
            onClick={(e) => { e.stopPropagation(); onView(); }}
          >
            <Eye size={12} className="mr-1" />
            View
          </Button>
          {user?.role === "admin" && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-full justify-end text-xs text-primary hover:text-primary"
              onClick={(e) => { e.stopPropagation(); navigate(`/record/${result.id}/edit`); }}
            >
              Edit
            </Button>
          )}
          {user?.role === "admin" && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-full justify-end text-xs text-destructive hover:text-destructive"
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
            >
              <Trash2 size={12} className="mr-1" />
              Delete
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
