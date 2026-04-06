import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  X, User, Building2, Ship, HelpCircle, Calendar, Globe,
  MapPin, FileText, Hash, AlertTriangle, Copy, ExternalLink, Download
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
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

  // Also extract AKA from rawNotes format like "AKA: name1; name2"
  const akaMatch = str.match(/AKA:\s*([^|\n]+)/);
  if (akaMatch && result.alternativeNames.length === 0) {
    result.alternativeNames = akaMatch[1].split(";").map((n: string) => n.trim()).filter(Boolean);
  }

  // استخراج الملاحظات الكاملة: كل شيء بعد "ملاحظات:" حتى نهاية النص أو مفتاح معروف آخر
  const notesIdx = str.indexOf('ملاحظات:');
  if (notesIdx !== -1) {
    const afterNotes = str.slice(notesIdx + 'ملاحظات:'.length).trim();
    const knownKeys = ['الجنسية:', 'تاريخ الميلاد:', 'مكان الميلاد:', 'أسماء بديلة:', 'الرقم المرجعي:', 'العنوان:'];
    let endIdx = afterNotes.length;
    for (const key of knownKeys) {
      const idx1 = afterNotes.indexOf('| ' + key);
      if (idx1 !== -1 && idx1 < endIdx) endIdx = idx1;
      const idx2 = afterNotes.indexOf('|' + key);
      if (idx2 !== -1 && idx2 < endIdx) endIdx = idx2;
    }
    result.notes = afterNotes.slice(0, endIdx).trim();
  } else if (!result.notes && str.includes("|")) {
    // إذا لم يكن هناك مفتاح ملاحظات صريح، استخدم النص قبل أول |
    const beforePipe = str.split("|")[0].replace(/\[عدد العناوين:\s*\d+\]/, "").trim();
    if (beforePipe.length > 10) result.notes = beforePipe;
  } else if (!result.notes && str.length > 10) {
    result.notes = str;
  }

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

interface RecordModalProps {
  recordId: number;
  onClose: () => void;
}

export default function RecordModal({ recordId, onClose }: RecordModalProps) {
  const { data: record, isLoading } = trpc.search.getRecord.useQuery({ id: recordId });

  const [isDownloading, setIsDownloading] = useState(false);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const downloadReport = async () => {
    if (!record) return;
    setIsDownloading(true);
    try {
      const res = await fetch(`/api/report/sanctions/${recordId}`, { credentials: "include" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "فشل تحميل التقرير");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sanctions-report-${record.referenceNumber || recordId}-${Date.now()}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("تم تحميل التقرير بنجاح");
    } catch {
      toast.error("حدث خطأ أثناء تحميل التقرير");
    } finally {
      setIsDownloading(false);
    }
  };

  const entityIcon =
    record?.entityType === "individual" ? <User size={16} /> :
    record?.entityType === "organisation" ? <Building2 size={16} /> :
    record?.entityType === "vessel" ? <Ship size={16} /> :
    <HelpCircle size={16} />;

  // Parse rawNotes for additional fields
  const parsed = parseRawNotes(record?.rawNotes);

  // Merge: prefer DB fields, fallback to parsed rawNotes
  const nationality = record?.nationality || parsed.nationality;
  const dateOfBirth = record?.dateOfBirth || parsed.dateOfBirth;
  const placeOfBirth = record?.placeOfBirth || parsed.placeOfBirth;
  const referenceNumber = record?.referenceNumber || parsed.referenceNumber;
  const notes = record?.notes || parsed.notes;

  // Merge alternative names (DB + parsed, deduplicated)
  const dbAltNames: string[] = Array.isArray(record?.alternativeNames) ? record!.alternativeNames as string[] : [];
  const allAltNames = Array.from(new Set([...dbAltNames, ...parsed.alternativeNames]));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-destructive/20 flex items-center justify-center text-destructive">
              {entityIcon}
            </div>
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider">Record Detail</div>
              <div className="text-sm font-semibold text-foreground">
                {record?.referenceNumber || `ID: ${recordId}`}
              </div>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
            <X size={16} />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : record ? (
            <>
              {/* Alert Banner */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/30">
                <AlertTriangle size={16} className="text-destructive flex-shrink-0" />
                <div>
                  <div className="text-sm font-semibold text-destructive">SANCTIONED ENTITY</div>
                  {record.actionTaken && (
                    <div className="text-xs text-destructive/80 mt-0.5">{record.actionTaken}</div>
                  )}
                </div>
              </div>

              {/* Primary Names */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Primary Names</h3>
                <div className="bg-muted/50 rounded-lg p-4 space-y-2 border border-border">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-xs text-muted-foreground mb-0.5">English</div>
                      <div className="text-base font-semibold text-foreground">{record.nameEn}</div>
                    </div>
                    <button
                      onClick={() => copyToClipboard(record.nameEn, "Name")}
                      className="text-muted-foreground hover:text-foreground mt-1"
                    >
                      <Copy size={13} />
                    </button>
                  </div>
                  {record.nameAr && (
                    <div className="flex items-start justify-between gap-2 pt-2 border-t border-border">
                      <div>
                        <div className="text-xs text-muted-foreground mb-0.5">Arabic</div>
                        <div className="text-base font-semibold text-foreground" dir="rtl">{record.nameAr}</div>
                      </div>
                      <button
                        onClick={() => copyToClipboard(record.nameAr!, "Arabic name")}
                        className="text-muted-foreground hover:text-foreground mt-1"
                      >
                        <Copy size={13} />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Alternative Names */}
              {allAltNames.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Alternative Names / AKA
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {allAltNames.map((name, i) => (
                      <Badge key={i} variant="secondary" className="text-xs font-normal">
                        {name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <Separator className="bg-border" />

              {/* Personal Details */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Details</h3>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Entity Type", value: record.entityType, icon: entityIcon },
                    { label: "Nationality / الجنسية", value: nationality, icon: <Globe size={13} /> },
                    { label: "Date of Birth / تاريخ الميلاد", value: dateOfBirth, icon: <Calendar size={13} /> },
                    { label: "Place of Birth / مكان الميلاد", value: placeOfBirth, icon: <MapPin size={13} /> },
                  ].map((item) => item.value && (
                    <div key={item.label} className="bg-muted/40 rounded-lg p-3 border border-border/50">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                        {item.icon}
                        {item.label}
                      </div>
                      <div className="text-sm text-foreground font-medium capitalize">{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              <Separator className="bg-border" />

              {/* Listing Details */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-muted-foreibground uppercase tracking-wider">Listing Information</h3>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Issuing Body", value: record.issuingBody },
                    { label: "Listing Reason", value: record.listingReason },
                    { label: "Listing Date", value: record.listingDate },
                    { label: "Legal Basis", value: record.legalBasis },
                    { label: "Reference Number", value: referenceNumber },
                    { label: "Action Taken / الإجراء", value: record.actionTaken },
                  ].map((item) => item.value && (
                    <div key={item.label} className="bg-muted/40 rounded-lg p-3 border border-border/50">
                      <div className="text-xs text-muted-foreground mb-1">{item.label}</div>
                      <div className="text-sm text-foreground font-medium">{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Addresses */}
              {parsed.addresses.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <MapPin size={12} />
                    Addresses / العناوين {parsed.addressCount ? `(${parsed.addressCount})` : ""}
                  </h3>
                  <div className="space-y-2">
                    {parsed.addresses.map((addr, i) => (
                      <div key={i} className="bg-muted/40 rounded-lg p-3 text-sm text-foreground border border-border/50">{addr}</div>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              {notes && (
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <FileText size={12} />
                    Notes / ملاحظات
                  </h3>
                  <div className="bg-muted/40 rounded-lg p-3 text-sm text-muted-foreground leading-relaxed border border-border/50">
                    {notes}
                  </div>
                </div>
              )}

              {/* Raw Notes Full */}
              {record.rawNotes && (
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <FileText size={12} />
                    Full Source Notes / النص الكامل
                  </h3>
                  <div className="bg-muted/20 border border-border rounded-lg p-3 text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap" dir="auto">
                    {record.rawNotes}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12 text-muted-foreground">Record not found</div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-border">
          <div className="text-xs text-muted-foreground">
            Record ID: {recordId}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose} className="border-border">
              Close
            </Button>
            {record && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-border"
                  onClick={() => copyToClipboard(JSON.stringify(record, null, 2), "Record data")}
                >
                  <Copy size={13} className="mr-1.5" />
                  Copy Data
                </Button>
                <Button
                  size="sm"
                  disabled={isDownloading}
                  onClick={downloadReport}
                  className="text-white font-semibold"
                  style={{ background: isDownloading ? "#999" : "linear-gradient(135deg, #C17F3E, #a06830)" }}
                >
                  {isDownloading ? (
                    <>
                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin mr-1.5" />
                      جاري التحميل...
                    </>
                  ) : (
                    <>
                      <Download size={13} className="mr-1.5" />
                      تنزيل التقرير
                    </>
                  )}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
