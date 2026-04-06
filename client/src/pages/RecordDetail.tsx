import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, AlertTriangle, Copy, User, Building2, Ship, HelpCircle, FileText } from "lucide-react";
import { toast } from "sonner";

// Parse rawNotes string into structured fields
function parseRawNotes(rawNotes: string | null | undefined) {
  const result: {
    nationality: string | null;
    dateOfBirth: string | null;
    placeOfBirth: string | null;
    alternativeNames: string[];
    notes: string | null;
    referenceNumber: string | null;
    addresses: string[];
    addressCount: number | null;
  } = {
    nationality: null,
    dateOfBirth: null,
    placeOfBirth: null,
    alternativeNames: [],
    notes: null,
    referenceNumber: null,
    addresses: [],
    addressCount: null,
  };

  if (!rawNotes) return result;
  const str = String(rawNotes);

  const natMatch = str.match(/الجنسية:\s*([^|]+)/);
  if (natMatch) result.nationality = natMatch[1].trim();

  const dobMatch = str.match(/تاريخ الميلاد:\s*([^|]+)/);
  if (dobMatch) result.dateOfBirth = dobMatch[1].trim();

  const pobMatch = str.match(/مكان الميلاد:\s*([^|]+)/);
  if (pobMatch) result.placeOfBirth = pobMatch[1].trim();

  const altMatch = str.match(/أسماء بديلة:\s*([^|]+)/);
  if (altMatch) {
    result.alternativeNames = altMatch[1].split(",").map((n: string) => n.trim()).filter(Boolean);
  }

  const notesMatch = str.match(/ملاحظات:\s*([^|]+)/);
  if (notesMatch) result.notes = notesMatch[1].trim();

  const refMatch = str.match(/الرقم المرجعي:\s*([^|]+)/);
  if (refMatch) result.referenceNumber = refMatch[1].trim();

  const addrCountMatch = str.match(/\[عدد العناوين:\s*(\d+)\]/);
  if (addrCountMatch) result.addressCount = parseInt(addrCountMatch[1]);

  const addrMatch = str.match(/العنوان:\s*([^|]+)/g);
  if (addrMatch) {
    result.addresses = addrMatch.map(a => a.replace(/العنوان:\s*/, "").trim());
  }

  return result;
}

export default function RecordDetail() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const id = parseInt(params.id || "0");

  const { data: record, isLoading } = trpc.search.getRecord.useQuery({ id });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  if (!record) {
    return (
      <AppLayout>
        <div className="p-6 text-center text-muted-foreground">Record not found</div>
      </AppLayout>
    );
  }

  const entityIcon =
    record.entityType === "individual" ? <User size={16} /> :
    record.entityType === "organisation" ? <Building2 size={16} /> :
    record.entityType === "vessel" ? <Ship size={16} /> :
    <HelpCircle size={16} />;

  // Parse rawNotes for additional fields
  const parsed = parseRawNotes(record.rawNotes);

  // Merge: prefer DB fields, fallback to parsed rawNotes
  const nationality = record.nationality || parsed.nationality;
  const dateOfBirth = record.dateOfBirth || parsed.dateOfBirth;
  const placeOfBirth = record.placeOfBirth || parsed.placeOfBirth;
  const referenceNumber = record.referenceNumber || parsed.referenceNumber;
  const notes = record.notes || parsed.notes;

  // Merge alternative names (DB + parsed, deduplicated)
  const dbAltNames: string[] = Array.isArray(record.alternativeNames) ? record.alternativeNames as string[] : [];
  const allAltNames = Array.from(new Set([...dbAltNames, ...parsed.alternativeNames]));

  return (
    <AppLayout>
      <div className="p-6 max-w-3xl">
        <Button variant="ghost" size="sm" onClick={() => navigate("/search")} className="mb-4 text-muted-foreground">
          <ArrowLeft size={14} className="mr-1.5" />
          Back to Search
        </Button>

        <div className="bg-card border border-border rounded-xl p-6 space-y-6">
          {/* Alert */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/30">
            <AlertTriangle size={16} className="text-destructive" />
            <div>
              <div className="text-sm font-semibold text-destructive">SANCTIONED ENTITY</div>
              {record.actionTaken && <div className="text-xs text-destructive/80">{record.actionTaken}</div>}
            </div>
          </div>

          {/* Names */}
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Primary Names</div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-foreground">{record.nameEn}</h1>
              <button onClick={() => copyToClipboard(record.nameEn)} className="text-muted-foreground hover:text-foreground">
                <Copy size={14} />
              </button>
            </div>
            {record.nameAr && (
              <div className="flex items-center gap-2 mt-1">
                <div className="text-lg text-muted-foreground" dir="rtl">{record.nameAr}</div>
                <button onClick={() => copyToClipboard(record.nameAr!)} className="text-muted-foreground hover:text-foreground">
                  <Copy size={14} />
                </button>
              </div>
            )}
          </div>

          {/* Alt Names */}
          {allAltNames.length > 0 && (
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Alternative Names / AKA</div>
              <div className="flex flex-wrap gap-2">
                {allAltNames.map((name, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">{name}</Badge>
                ))}
              </div>
            </div>
          )}

          {/* Details Grid */}
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Key Data</div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Entity Type", value: record.entityType },
                { label: "Nationality / الجنسية", value: nationality },
                { label: "Date of Birth / تاريخ الميلاد", value: dateOfBirth },
                { label: "Place of Birth / مكان الميلاد", value: placeOfBirth },
                { label: "Issuing Body / الجهة المدرجة", value: record.issuingBody },
                { label: "Listing Reason / سبب الإدراج", value: record.listingReason },
                { label: "Listing Date / تاريخ الإدراج", value: record.listingDate },
                { label: "Legal Basis / سند الإدراج", value: record.legalBasis },
                { label: "Reference Number / الرقم المرجعي", value: referenceNumber },
                { label: "Action Taken / الإجراء المتخذ", value: record.actionTaken },
              ].filter((item) => item.value).map((item) => (
                <div key={item.label} className="bg-secondary/30 rounded-lg p-3">
                  <div className="text-xs text-muted-foreground mb-1">{item.label}</div>
                  <div className="text-sm text-foreground font-medium">{item.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Addresses */}
          {parsed.addresses.length > 0 && (
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
                Addresses / العناوين {parsed.addressCount ? `(${parsed.addressCount})` : ""}
              </div>
              <div className="space-y-2">
                {parsed.addresses.map((addr, i) => (
                  <div key={i} className="bg-secondary/30 rounded-lg p-3 text-sm text-foreground">{addr}</div>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {notes && (
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Notes / ملاحظات</div>
              <div className="bg-secondary/30 rounded-lg p-3 text-sm text-muted-foreground leading-relaxed">{notes}</div>
            </div>
          )}

          {/* Raw Notes (full) */}
          {record.rawNotes && (
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <FileText size={12} />
                Full Source Notes / النص الكامل
              </div>
              <div className="bg-secondary/20 border border-border rounded-lg p-3 text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap" dir="auto">
                {record.rawNotes}
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
