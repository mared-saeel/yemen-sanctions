import { useCallback, useRef, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";
import { toast } from "sonner";
import RecordModal from "@/components/RecordModal";
import ExportMenu from "@/components/ExportMenu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { AlertTriangle, Building2, CheckCircle2, ChevronDown, Clock3, Download, Eye, FileSearch, Filter, HelpCircle, ListFilter, Loader2, RotateCcw, Search, Ship, SlidersHorizontal, Sparkles, User, UsersRound, X } from "lucide-react";

const ENTITY_TYPES = [
  { value: null, label: "جميع أنواع الكيانات" },
  { value: "individual", label: "فرد" },
  { value: "organisation", label: "منظمة / شركة" },
  { value: "vessel", label: "سفينة" },
  { value: "unspecified", label: "كيان غير محدد" },
] as const;

type EntityType = "individual" | "organisation" | "vessel" | "unspecified" | null;

interface SearchResult {
  id: number; nameEn: string; nameAr: string | null; entityType: string; listingDate: string | null;
  listingReason: string | null; issuingBody: string | null; nationality: string | null; matchScore: number;
  matchType: string; alternativeNames: string[]; actionTaken: string | null;
}

const formatEntity = (type: string) => ({ individual: "فرد", organisation: "منظمة", vessel: "سفينة", unspecified: "غير محدد" }[type] || type);

export default function SearchPage() {
  const { isAuthenticated, loading } = useAuth();
  const [query, setQuery] = useState("");
  const [entityType, setEntityType] = useState<EntityType>(null);
  const [nationality, setNationality] = useState("");
  const [issuingBody, setIssuingBody] = useState("");
  const [listingReason, setListingReason] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [enableAI, setEnableAI] = useState(false);
  const [showFilters, setShowFilters] = useState(true);
  const [selectedRecord, setSelectedRecord] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [queryTime, setQueryTime] = useState(0);
  const [hasSearched, setHasSearched] = useState(false);
  const [page, setPage] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const filterOptions = trpc.search.filterOptions.useQuery(undefined, { enabled: isAuthenticated });

  const searchMutation = trpc.search.query.useMutation({
    onSuccess: (data) => { setResults(data.results as SearchResult[]); setTotal(data.total); setQueryTime(data.queryTime); setHasSearched(true); },
    onError: (err) => toast.error(`تعذر تنفيذ البحث: ${err.message}`),
  });
  const deleteRecordMutation = trpc.admin.deleteSanctionRecord.useMutation({
    onSuccess: (_data, variables) => { setResults((items) => items.filter((item) => item.id !== variables.id)); setTotal((value) => Math.max(0, value - 1)); setSelectedRecord((id) => id === variables.id ? null : id); setDeleteTarget(null); toast.success("تم حذف السجل وتوثيق العملية في سجل التدقيق"); },
    onError: (error) => toast.error(`تعذر حذف السجل: ${error.message}`),
  });

  const handleSearch = useCallback((offset = 0) => {
    if (!query.trim()) { toast.warning("أدخل اسماً أو معرفاً للبحث"); return; }
    setPage(offset / 20);
    searchMutation.mutate({ query: query.trim(), filters: { entityType: entityType || null, nationality: nationality || null, issuingBody: issuingBody || null, listingReason: listingReason || null, dateFrom: dateFrom || null, dateTo: dateTo || null }, limit: 20, offset, enableAI, threshold: 0.35 });
  }, [query, entityType, nationality, issuingBody, listingReason, dateFrom, dateTo, enableAI]);
  const clearFilters = () => { setEntityType(null); setNationality(""); setIssuingBody(""); setListingReason(""); setDateFrom(""); setDateTo(""); };
  const activeFilterCount = [entityType, nationality, issuingBody, listingReason, dateFrom, dateTo].filter(Boolean).length;
  const exactCount = results.filter((result) => result.matchScore >= 85).length;

  if (!loading && !isAuthenticated) { window.location.replace("/login"); return null; }

  return <AppLayout>
    <div className="flex min-h-full bg-[#fafaf8]" dir="ltr">
      <aside className="hidden w-[254px] flex-shrink-0 border-r border-border bg-card xl:flex" dir="rtl">
        <div className="flex w-full flex-col p-4">
          <div className="border-b border-border pb-4 text-right"><h2 className="text-sm font-bold text-foreground">ملخص الفحص اليومي</h2><p className="mt-1 text-[10px] text-muted-foreground">مؤشرات الجلسة الحالية</p></div>
          <div className="py-5 text-center"><div className="mx-auto flex h-28 w-28 items-center justify-center rounded-full border-[7px] border-emerald-500 border-t-amber-500 border-r-red-400"><div><div className="text-xl font-bold text-foreground">{hasSearched ? total.toLocaleString("en-US") : "—"}</div><div className="mt-1 text-[9px] text-muted-foreground">نتيجة مطابقة</div></div></div></div>
          <div className="space-y-2 border-b border-border pb-5 text-xs"><SummaryRow label="تطابقات عالية" value={hasSearched ? exactCount : "—"} color="bg-red-500" /><SummaryRow label="تطابقات محتملة" value={hasSearched ? Math.max(results.length - exactCount, 0) : "—"} color="bg-amber-500" /><SummaryRow label="نتائج المراجعة" value={hasSearched ? results.length : "—"} color="bg-emerald-500" /></div>
          <div className="border-b border-border py-5"><div className="text-xs text-muted-foreground">زمن الاستجابة</div><div className="mt-1 flex items-end justify-between"><span className="text-2xl font-bold text-foreground">{hasSearched ? queryTime : "—"}{hasSearched && <span className="mr-1 text-xs font-medium">ms</span>}</span><span className="text-[10px] text-emerald-700">استعلام مباشر</span></div></div>
          <Button variant="outline" className="mt-4 h-9 border-primary/30 text-xs text-primary" onClick={() => { clearFilters(); setResults([]); setHasSearched(false); }}>عرض التقرير الكامل</Button>
          <div className="mt-5 border border-border bg-muted/20"><div className="border-b border-border px-3 py-3 text-right text-xs font-bold text-foreground">المرشحات المطبقة</div><div className="space-y-2 px-3 py-3 text-xs text-muted-foreground"><div className="flex justify-between"><span>نوع الكيان</span><span className="font-medium text-foreground">{ENTITY_TYPES.find((item) => item.value === entityType)?.label || "الكل"}</span></div><div className="flex justify-between"><span>القائمة</span><span className="font-medium text-foreground">{issuingBody || "جميع القوائم"}</span></div><div className="flex justify-between"><span>الجنسية</span><span className="font-medium text-foreground">{nationality || "جميع الجنسيات"}</span></div></div></div>
          <button onClick={clearFilters} className="mt-4 flex items-center justify-center gap-2 text-xs font-medium text-primary hover:underline"><RotateCcw size={13} /> إعادة ضبط المرشحات</button>
        </div>
      </aside>

      <main className="min-w-0 flex-1" dir="rtl">
        <div className="mx-auto max-w-[1100px] px-5 py-6 lg:px-8">
          <div className="mb-5 flex items-center gap-2 text-xs text-muted-foreground"><span>الرئيسية</span><span>/</span><span className="font-semibold text-primary">البحث في العقوبات</span></div>
          <div className="mb-5 text-right"><h1 className="text-2xl font-bold tracking-tight text-foreground">البحث في قوائم العقوبات</h1><p className="mt-1 text-sm text-muted-foreground">البحث والتحقق من الأفراد والكيانات والسفن المدرجة في قوائم العقوبات المحلية والدولية.</p></div>

          <section className="border border-border bg-card p-4 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row">
              <Button onClick={() => handleSearch(0)} disabled={searchMutation.isPending} className="h-11 min-w-28 bg-primary text-sm font-bold text-primary-foreground hover:bg-primary/90">{searchMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <><Search size={15} className="ml-2" />بحث</>}</Button>
              <div className="relative flex-1"><Search size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === "Enter" && handleSearch(0)} placeholder="ابحث بالاسم، رقم التعريف، رقم الجواز، أو أي معرف آخر…" className="h-11 border-border bg-background pr-11 text-right shadow-none" />{query && <button onClick={() => { setQuery(""); setResults([]); setHasSearched(false); }} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X size={15} /></button>}</div>
              <select value={entityType || ""} onChange={(event) => setEntityType((event.target.value || null) as EntityType)} className="h-11 min-w-[172px] border border-border bg-background px-3 text-sm text-foreground"><option value="">جميع أنواع الكيانات</option>{ENTITY_TYPES.slice(1).map((item) => <option key={item.value} value={item.value || ""}>{item.label}</option>)}</select>
            </div>
            <div className="mt-3 flex items-center justify-between"><button onClick={() => setShowFilters((value) => !value)} className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-primary"><SlidersHorizontal size={14} /> تصفية متقدمة <ChevronDown size={14} className={cn(showFilters && "rotate-180")} /></button><button onClick={() => setEnableAI((value) => !value)} className={cn("flex items-center gap-2 text-xs", enableAI ? "text-primary" : "text-muted-foreground")}><span className={cn("h-4 w-7 rounded-full p-0.5 transition-colors", enableAI ? "bg-primary" : "bg-muted")}><span className={cn("block h-3 w-3 rounded-full bg-white transition-transform", enableAI && "translate-x-3")} /></span><Sparkles size={13} /> تحسين نتائج البحث</button></div>
            {showFilters && <div className="mt-4 grid grid-cols-1 gap-2 border-t border-border pt-4 sm:grid-cols-2 lg:grid-cols-5"><FilterField label="جميع القوائم"><select value={issuingBody} onChange={(event) => setIssuingBody(event.target.value)}><option value="">جميع القوائم</option>{filterOptions.data?.issuingBodies.map((body) => <option key={body} value={body}>{body}</option>)}</select></FilterField><FilterField label="الجنسية"><Input value={nationality} onChange={(event) => setNationality(event.target.value)} placeholder="جميع الجنسيات" /></FilterField><FilterField label="سبب الإدراج"><Input value={listingReason} onChange={(event) => setListingReason(event.target.value)} placeholder="أي سبب" /></FilterField><FilterField label="تاريخ الإدراج"><Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} /></FilterField><FilterField label="حتى تاريخ"><Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} /></FilterField></div>}
          </section>

          <section className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="دقة المطابقة" value={hasSearched ? `${Math.max(...results.map((item) => item.matchScore), 0)}%` : "—"} detail="أعلى نتيجة في الجلسة" /><Stat label="إجمالي النتائج" value={hasSearched ? total.toLocaleString("en-US") : "—"} detail="سجل مطابق للاستعلام" /><Stat label="زمن البحث" value={hasSearched ? `${queryTime} ms` : "—"} detail="من طلب البحث الحالي" /><Stat label="المرشحات النشطة" value={activeFilterCount.toString()} detail="معايير تحقق مفعلة" />
          </section>

          <section className="mt-6 border border-border bg-card">
            <div className="flex flex-col gap-3 border-b border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between"><div className="text-right"><h2 className="text-base font-bold text-foreground">نتائج البحث</h2><p className="mt-1 text-xs text-muted-foreground">{hasSearched ? `تم العثور على ${total.toLocaleString("en-US")} نتيجة خلال ${queryTime} ms` : "ابدأ البحث لعرض النتائج المطابقة"}</p></div><div className="flex items-center gap-2">{hasSearched && results.length > 0 && <ExportMenu query={query} results={results} />}<Button variant="outline" size="sm" className="h-8 border-border text-xs" onClick={() => toast.info("سيتم توفير إنشاء التقرير المركب ضمن شاشة التقارير")}>إنشاء تقرير</Button></div></div>
            {!hasSearched && <div className="py-16 text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary"><Search size={23} /></div><h3 className="mt-4 text-base font-bold text-foreground">ابدأ فحصاً جديداً</h3><p className="mt-2 text-sm text-muted-foreground">أدخل اسماً عربياً أو إنجليزياً لتبدأ المراجعة.</p></div>}
            {hasSearched && results.length === 0 && <div className="py-16 text-center"><CheckCircle2 size={35} className="mx-auto text-emerald-600" /><h3 className="mt-4 text-base font-bold text-foreground">لا توجد نتائج مطابقة</h3><p className="mt-2 text-sm text-muted-foreground">جرّب تعديل الاسم أو توسيع معايير البحث.</p></div>}
            {results.length > 0 && <ResultsTable results={results} onView={setSelectedRecord} onDelete={(result) => setDeleteTarget({ id: result.id, name: result.nameEn })} />}
            {total > 20 && <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs"><span className="text-muted-foreground">عرض {page * 20 + 1} إلى {Math.min((page + 1) * 20, total)} من {total}</span><div className="flex gap-1"><Button variant="outline" size="sm" disabled={page === 0} onClick={() => handleSearch((page - 1) * 20)}>السابق</Button><Button variant="outline" size="sm" disabled={(page + 1) * 20 >= total} onClick={() => handleSearch((page + 1) * 20)}>التالي</Button></div></div>}
          </section>
        </div>
      </main>
    </div>
    {selectedRecord && <RecordModal recordId={selectedRecord} onClose={() => setSelectedRecord(null)} />}
    <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && !deleteRecordMutation.isPending && setDeleteTarget(null)}><AlertDialogContent dir="rtl"><AlertDialogHeader className="text-right"><AlertDialogTitle>حذف سجل عقوبات</AlertDialogTitle><AlertDialogDescription className="leading-6">سيُحذف السجل <strong dir="ltr" className="text-foreground">{deleteTarget?.name}</strong> نهائياً من قاعدة البيانات. هذه العملية مقصورة على المدير وسيتم تسجيلها في سجل التدقيق.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter className="sm:flex-row-reverse"><AlertDialogCancel disabled={deleteRecordMutation.isPending}>إلغاء</AlertDialogCancel><AlertDialogAction disabled={deleteRecordMutation.isPending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={(event) => { event.preventDefault(); if (deleteTarget) deleteRecordMutation.mutate({ id: deleteTarget.id }); }}>{deleteRecordMutation.isPending ? "جارٍ الحذف..." : "تأكيد الحذف"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </AppLayout>;
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block text-right"><span className="mb-1.5 block text-[10px] font-medium text-muted-foreground">{label}</span><div className="[&_input]:h-9 [&_input]:rounded-none [&_select]:h-9 [&_select]:w-full [&_select]:rounded-none [&_select]:border [&_select]:border-border [&_select]:bg-background [&_select]:px-2 [&_select]:text-xs">{children}</div></label>; }
function SummaryRow({ label, value, color }: { label: string; value: string | number; color: string }) { return <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-muted-foreground"><span className={cn("h-2 w-1 rounded-full", color)} />{label}</span><span className="font-semibold text-foreground">{value}</span></div>; }
function Stat({ label, value, detail }: { label: string; value: string; detail: string }) { return <div className="border border-border bg-card p-4 text-right shadow-sm"><div className="text-xs text-muted-foreground">{label}</div><div className="mt-2 text-2xl font-bold text-foreground">{value}</div><div className="mt-1 text-[10px] text-muted-foreground">{detail}</div></div>; }

function ResultsTable({ results, onView, onDelete }: { results: SearchResult[]; onView: (id: number) => void; onDelete: (result: SearchResult) => void; }) {
  const { user } = useAuth(); const [, navigate] = useLocation();
  return <div className="overflow-x-auto"><table className="min-w-[1020px] w-full border-collapse text-right" dir="rtl"><thead><tr className="border-b border-border bg-muted/45 text-[10px] font-bold text-muted-foreground"><th className="px-4 py-3">نوع التطابق</th><th className="px-4 py-3">الاسم</th><th className="px-4 py-3">نوع الكيان</th><th className="px-4 py-3">القائمة</th><th className="px-4 py-3">بلد العقوبة</th><th className="px-4 py-3">تاريخ الإدراج</th><th className="px-4 py-3">الإجراء</th></tr></thead><tbody>{results.map((result) => { const high = result.matchScore >= 85; const possible = result.matchScore >= 60; const label = high ? "تطابق عالي" : possible ? "تطابق محتمل" : "تطابق منخفض"; return <tr key={result.id} className="border-b border-border last:border-b-0 hover:bg-muted/25"><td className="px-4 py-4"><div className={cn("inline-flex min-w-[94px] flex-col px-2 py-1 text-center text-[10px] font-bold", high ? "bg-red-50 text-red-700" : possible ? "bg-amber-50 text-amber-800" : "bg-slate-100 text-slate-700")}><span>{label}</span><span className="mt-0.5 text-sm">{result.matchScore}%</span></div></td><td className="px-4 py-4"><button onClick={() => onView(result.id)} className="text-right hover:text-primary"><div dir="ltr" className="text-left text-sm font-bold text-foreground">{result.nameEn}</div>{result.nameAr && <div className="mt-1 text-sm text-muted-foreground">{result.nameAr}</div>}{result.alternativeNames?.length > 0 && <div dir="ltr" className="mt-1 max-w-[240px] truncate text-left text-[10px] text-muted-foreground">AKA: {result.alternativeNames.slice(0, 2).join(", ")}</div>}</button></td><td className="px-4 py-4"><span className="inline-flex items-center gap-1.5 border border-border bg-card px-2 py-1 text-xs text-foreground">{result.entityType === "individual" ? <User size={13} /> : result.entityType === "organisation" ? <Building2 size={13} /> : result.entityType === "vessel" ? <Ship size={13} /> : <HelpCircle size={13} />}{formatEntity(result.entityType)}</span></td><td className="px-4 py-4 text-xs text-foreground">{result.issuingBody || "—"}</td><td className="px-4 py-4 text-xs text-foreground">{result.nationality || "—"}</td><td className="px-4 py-4 text-xs text-foreground">{result.listingDate || "—"}</td><td className="px-4 py-4"><div className="flex items-center gap-2 whitespace-nowrap text-xs"><button onClick={() => onView(result.id)} className="border border-border px-2 py-1.5 text-muted-foreground hover:border-primary hover:text-primary">عرض التفاصيل</button>{user?.role === "admin" && <button onClick={() => navigate(`/record/${result.id}/edit`)} className="text-primary hover:underline">تعديل</button>}{user?.role === "admin" && <button onClick={() => onDelete(result)} className="text-destructive hover:underline">حذف</button>}</div></td></tr>; })}</tbody></table></div>;
}
