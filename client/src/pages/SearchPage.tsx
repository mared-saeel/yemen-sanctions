import { useState, useCallback, useRef } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Search, Filter, X, ChevronDown, ChevronUp, Zap, Clock,
  User, Building2, Ship, HelpCircle, AlertTriangle, CheckCircle,
  Download, Eye, RotateCcw, Loader2, Sparkles
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";
import { toast } from "sonner";
import RecordModal from "@/components/RecordModal";
import ExportMenu from "@/components/ExportMenu";

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

  if (!loading && !isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">Please sign in to access screening</p>
          <Button onClick={() => window.location.href = getLoginUrl()}>Sign In</Button>
        </div>
      </div>
    );
  }

  return (
    <AppLayout>
      <div className="flex h-full">
        {/* Left Sidebar - Filters */}
        <aside className="w-64 flex-shrink-0 border-r border-border bg-sidebar flex flex-col overflow-y-auto hidden lg:flex">
          <div className="p-4 border-b border-sidebar-border">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Screening Settings</h3>
              {hasActiveFilters && (
                <button onClick={clearFilters} className="text-xs text-primary hover:underline">Clear</button>
              )}
            </div>
          </div>

          <div className="p-4 space-y-5 flex-1">
            {/* Mode */}
            <div>
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Mode</div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-white text-sm font-semibold cursor-pointer shadow-sm">
                  Single
                </div>
                <div
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-muted-foreground text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground"
                  onClick={() => toast.info("Batch screening coming soon")}
                >
                  Batch
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
                      "flex items-center gap-2 px-3 py-2 rounded-lg text-sm cursor-pointer transition-all duration-150",
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
              <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-accent/60 border border-border">
                <div className="flex items-center gap-2 text-sm text-foreground">
                  <span>🌐</span> World-Check
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
                className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-accent/60 border border-border cursor-pointer hover:bg-accent transition-colors"
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
          <div className="p-6 border-b border-border bg-card">
            <div className="max-w-4xl">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                Single Screening
              </h2>

              {/* Search Bar */}
              <div className="relative">
                <div className="flex gap-3">
                  <div className="flex-1 relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      ref={inputRef}
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Enter name to screen (Arabic or English)..."
                      className="pl-9 h-11 bg-background border-border text-foreground placeholder:text-muted-foreground text-sm focus-visible:ring-2 focus-visible:ring-primary/30 shadow-sm"
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
                    className="h-11 px-8 bg-primary hover:bg-primary/90 text-primary-foreground font-bold tracking-wide shadow-sm"
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
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-primary">
                    <Sparkles size={11} />
                    AI-enhanced search enabled
                  </div>
                )}
              </div>

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
          <div className="flex-1 overflow-y-auto p-6">
            {/* Search Stats */}
            {hasSearched && (
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">{total}</span> results found
                  <span className="flex items-center gap-1">
                    <Clock size={12} />
                    {queryTime}ms
                  </span>
                  {aiEnhancement?.expandedQuery && aiEnhancement.expandedQuery !== query && (
                    <span className="text-primary text-xs">
                      (AI expanded: "{aiEnhancement.expandedQuery}")
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {hasActiveFilters && (
                    <Badge variant="secondary" className="text-xs">
                      Filters active
                    </Badge>
                  )}
                </div>
              </div>
            )}

            {/* Empty State */}
            {!hasSearched && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
                  <Search size={28} className="text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Start Screening</h3>
                <p className="text-muted-foreground text-sm max-w-sm">
                  Enter a name in Arabic or English to screen against{" "}
                  <span className="text-foreground font-medium">39,710+</span> sanctioned entities.
                  Our AI handles spelling variations and transliterations.
                </p>
                <div className="mt-6 grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                  {["صدام حسين", "Osama bin Laden", "HAMAS", "حزب العمال الكردستاني"].map((ex) => (
                    <button
                      key={ex}
                      onClick={() => { setQuery(ex); setTimeout(() => inputRef.current?.focus(), 100); }}
                      className="px-3 py-1.5 rounded border border-border hover:border-primary/40 hover:text-foreground transition-colors"
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
              <div className="space-y-2">
                {results.map((result) => (
                  <ResultCard
                    key={result.id}
                    result={result}
                    query={query}
                    onView={() => setSelectedRecord(result.id)}
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
    </AppLayout>
  );
}

// ─── Result Card ──────────────────────────────────────────────────────────────

function ResultCard({
  result,
  query,
  onView,
}: {
  result: SearchResult;
  query: string;
  onView: () => void;
}) {
  const scoreColor =
    result.matchScore >= 85 ? "score-high" :
    result.matchScore >= 60 ? "score-medium" : "score-low";

  const entityIcon =
    result.entityType === "individual" ? <User size={14} /> :
    result.entityType === "organisation" ? <Building2 size={14} /> :
    result.entityType === "vessel" ? <Ship size={14} /> :
    <HelpCircle size={14} />;

  return (
    <div
      className="bg-card border border-border rounded-xl p-4 hover:border-primary/30 hover:shadow-md transition-all duration-200 cursor-pointer group"
      onClick={onView}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Names */}
          <div className="flex items-start gap-3 mb-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-foreground text-sm">{result.nameEn}</span>
                {result.nameAr && (
                  <span className="text-muted-foreground text-sm" dir="rtl">{result.nameAr}</span>
                )}
              </div>
              {result.alternativeNames && result.alternativeNames.length > 0 && (
                <div className="text-xs text-muted-foreground mt-0.5 truncate">
                  AKA: {result.alternativeNames.slice(0, 3).join(", ")}
                  {result.alternativeNames.length > 3 && ` +${result.alternativeNames.length - 3} more`}
                </div>
              )}
            </div>
          </div>

          {/* Metadata */}
          <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              {entityIcon}
              <span className="capitalize">{result.entityType}</span>
            </span>
            {result.nationality && (
              <span>🌍 {result.nationality}</span>
            )}
            {result.issuingBody && (
              <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium border border-primary/20">
                {result.issuingBody}
              </span>
            )}
            {result.listingReason && (
              <span className="text-warning">{result.listingReason}</span>
            )}
            {result.listingDate && (
              <span>{result.listingDate}</span>
            )}
          </div>

          {result.actionTaken && (
            <div className="mt-1.5 flex items-center gap-1.5 text-xs text-destructive">
              <AlertTriangle size={11} />
              {result.actionTaken}
            </div>
          )}
        </div>

        {/* Score & Actions */}
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <div className={cn("px-2.5 py-1 rounded text-xs font-bold", scoreColor)}>
            {result.matchScore}%
          </div>
          <div className="text-xs text-muted-foreground capitalize">{result.matchType}</div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => { e.stopPropagation(); onView(); }}
          >
            <Eye size={12} className="mr-1" />
            View
          </Button>
        </div>
      </div>
    </div>
  );
}
