import { useMemo, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { FileText, Globe, Calendar, MapPin, Scale, Gavel, IdCard, Info, Link2, ChevronDown } from "lucide-react";
import { actionToText, formatSanctionsRecord, type SanctionsRecordInput } from "@shared/record-formatter";

/**
 * Structured, bilingual presentation of a sanctions record.
 * Uses the same shared presenter as the PDF report, so the platform and the
 * report always show identical, clean content. Every value is rendered with
 * dir="auto" so numbers, dates and brackets keep their correct order.
 */

const ENTITY_TYPES: Record<string, string> = {
  individual: "Individual / فرد",
  organisation: "Organisation / كيان",
  vessel: "Vessel / سفينة",
  unspecified: "Unspecified / غير محدد",
};

function Section({ title, icon, children }: { title: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
        {icon}
        {title}
      </h3>
      {children}
    </div>
  );
}

function Value({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div dir="auto" className={`text-sm text-foreground font-medium break-words whitespace-pre-line [text-align:match-parent] ${className}`}>
      {children}
    </div>
  );
}

function LabelledRows({ rows }: { rows: { label: string; value: string }[] }) {
  return (
    <div className="rounded-lg border border-border/60 overflow-hidden divide-y divide-border/60">
      {rows.map((row, i) => (
        <div key={`${row.label}-${i}`} className={`grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-1 sm:gap-3 p-3 ${i % 2 === 0 ? "bg-muted/40" : "bg-card"}`}>
          <div className="text-xs text-muted-foreground font-medium leading-5">{row.label}</div>
          <Value>{row.value}</Value>
        </div>
      ))}
    </div>
  );
}

export function useFormattedRecord(record: SanctionsRecordInput | null | undefined) {
  return useMemo(() => (record ? formatSanctionsRecord(record) : null), [record]);
}

export default function FormattedRecordSections({ record }: { record: SanctionsRecordInput & { entityType?: string | null } }) {
  const f = useFormattedRecord(record);
  if (!f) return null;

  const keyData = [
    { label: "Entity Type / الفئة", value: record.entityType ? ENTITY_TYPES[record.entityType] || record.entityType : "", icon: <Info size={13} /> },
    { label: "Nationality / الجنسية", value: f.personal.nationality || "", icon: <Globe size={13} /> },
    { label: "Date of Birth / تاريخ الميلاد", value: f.personal.dateOfBirth || "", icon: <Calendar size={13} /> },
    { label: "Place of Birth / مكان الميلاد", value: f.personal.placeOfBirth || "", icon: <MapPin size={13} /> },
    { label: "Gender / الجنس", value: f.personal.gender || "", icon: <Info size={13} /> },
    { label: "Listing Date / تاريخ الإدراج", value: f.listingDate || "", icon: <Calendar size={13} /> },
    { label: "Issuing Body / جهة الإصدار", value: record.issuingBody || "", icon: <Scale size={13} /> },
  ].filter((item) => item.value);

  const context = f.listingContext
    .filter((item) => item.key !== "issuingBody")
    .map((item) => ({ label: `${item.labelEn} / ${item.labelAr}`, value: item.value }));

  return (
    <div className="space-y-5">
      {keyData.length > 0 && (
        <Section title="Key Data / البيانات الجوهرية">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {keyData.map((item) => (
              <div key={item.label} className="bg-muted/40 rounded-lg p-3 border border-border/50">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                  {item.icon}
                  {item.label}
                </div>
                <Value>{item.value}</Value>
              </div>
            ))}
          </div>
        </Section>
      )}

      {context.length > 0 && (
        <Section title="Listing Context / سياق الإدراج" icon={<Scale size={12} />}>
          <LabelledRows rows={context} />
        </Section>
      )}

      {f.actions.length > 0 && (
        <Section title="Action Taken / الإجراء المتخذ" icon={<Gavel size={12} />}>
          <ul className="rounded-lg border border-border/60 overflow-hidden divide-y divide-border/60">
            {f.actions.map((action, i) => (
              <li key={i} className={`p-3 ${i % 2 === 0 ? "bg-muted/40" : "bg-card"}`}>
                <Value>{actionToText(action)}</Value>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {f.aliases.length > 0 && (
        <Section title="Alternative Names / الأسماء البديلة">
          <div className="flex flex-wrap gap-2">
            {f.aliases.map((name, i) => (
              <Badge key={i} variant="secondary" className="text-xs font-normal" dir="auto">
                {name}
              </Badge>
            ))}
          </div>
        </Section>
      )}

      {f.identityDocuments.length > 0 && (
        <Section title="Identity Documents / وثائق الهوية" icon={<IdCard size={12} />}>
          <div className="rounded-lg border border-border/60 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-xs text-muted-foreground">
                <tr>
                  <th className="p-2.5 text-start font-semibold">Document Type / نوع الوثيقة</th>
                  <th className="p-2.5 text-start font-semibold">Number / الرقم</th>
                  <th className="p-2.5 text-start font-semibold">Issuing Country / بلد الإصدار</th>
                  <th className="p-2.5 text-start font-semibold">Details / تفاصيل</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {f.identityDocuments.map((d, i) => (
                  <tr key={i} className={i % 2 === 0 ? "bg-muted/30" : "bg-card"}>
                    <td className="p-2.5 [text-align:match-parent] align-top">
                      <div dir="auto">{d.type}</div>
                      {d.typeAr && d.typeAr !== d.type && <div dir="auto" className="text-xs text-muted-foreground">{d.typeAr}</div>}
                    </td>
                    <td className="p-2.5 [text-align:match-parent] align-top font-mono" dir="ltr">{d.number || "—"}</td>
                    <td className="p-2.5 [text-align:match-parent] align-top" dir="auto">{d.country || "—"}</td>
                    <td className="p-2.5 [text-align:match-parent] align-top text-xs text-muted-foreground" dir="auto">
                      {[d.issueDate ? `Issued / الإصدار: ${d.issueDate}` : "", d.details || ""].filter(Boolean).join(" — ") || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {f.addresses.length > 0 && (
        <Section title={`Addresses / العناوين (${f.addresses.length})`} icon={<MapPin size={12} />}>
          <div className="space-y-2">
            {f.addresses.map((addr, i) => (
              <div key={i} className="bg-muted/40 rounded-lg p-3 border border-border/50">
                <Value className="font-normal">{addr}</Value>
              </div>
            ))}
          </div>
        </Section>
      )}

      {f.additionalInfo.length > 0 && (
        <Section title="Additional Information / معلومات إضافية" icon={<Info size={12} />}>
          <LabelledRows rows={f.additionalInfo.map((item) => ({ label: `${item.labelEn} / ${item.labelAr}`, value: item.value }))} />
        </Section>
      )}

      {f.relationships.length > 0 && (
        <Section title="Relationships / الارتباطات" icon={<Link2 size={12} />}>
          <LabelledRows rows={f.relationships.map((r) => ({ label: r.type || "Related / مرتبط", value: r.entity }))} />
        </Section>
      )}

      {f.notes.length > 0 && (
        <Section title="Notes / ملاحظات" icon={<FileText size={12} />}>
          <div className="bg-muted/40 rounded-lg p-3 border border-border/50 space-y-2">
            {f.notes.map((note, i) => (
              <Value key={i} className="font-normal text-muted-foreground leading-relaxed">{note}</Value>
            ))}
          </div>
        </Section>
      )}

      {record.rawNotes && (
        <details className="group rounded-lg border border-border bg-muted/20">
          <summary className="cursor-pointer select-none list-none p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <FileText size={12} />
            Full Source Text / النص الأصلي الكامل
            <ChevronDown size={13} className="ms-auto transition-transform group-open:rotate-180" />
          </summary>
          <div className="px-3 pb-3 text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap" dir="auto">
            {record.rawNotes}
          </div>
        </details>
      )}
    </div>
  );
}
