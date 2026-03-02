import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  X, User, Building2, Ship, HelpCircle, Calendar, Globe,
  MapPin, FileText, Hash, AlertTriangle, Copy, ExternalLink
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface RecordModalProps {
  recordId: number;
  onClose: () => void;
}

export default function RecordModal({ recordId, onClose }: RecordModalProps) {
  const { data: record, isLoading } = trpc.search.getRecord.useQuery({ id: recordId });

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const entityIcon =
    record?.entityType === "individual" ? <User size={16} /> :
    record?.entityType === "organisation" ? <Building2 size={16} /> :
    record?.entityType === "vessel" ? <Ship size={16} /> :
    <HelpCircle size={16} />;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
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
                <div className="bg-secondary/50 rounded-lg p-4 space-y-2">
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
              {record.alternativeNames && (record.alternativeNames as string[]).length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Alternative Names / AKA
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {(record.alternativeNames as string[]).map((name, i) => (
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
                    { label: "Nationality", value: record.nationality, icon: <Globe size={13} /> },
                    { label: "Date of Birth", value: record.dateOfBirth, icon: <Calendar size={13} /> },
                    { label: "Place of Birth", value: record.placeOfBirth, icon: <MapPin size={13} /> },
                  ].map((item) => item.value && (
                    <div key={item.label} className="bg-secondary/30 rounded-lg p-3">
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
                    { label: "Reference Number", value: record.referenceNumber },
                  ].map((item) => item.value && (
                    <div key={item.label} className="bg-secondary/30 rounded-lg p-3">
                      <div className="text-xs text-muted-foreground mb-1">{item.label}</div>
                      <div className="text-sm text-foreground font-medium">{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Notes */}
              {record.notes && (
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <FileText size={12} />
                    Notes
                  </h3>
                  <div className="bg-secondary/30 rounded-lg p-3 text-sm text-muted-foreground leading-relaxed">
                    {record.notes}
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
              <Button
                size="sm"
                className="bg-primary hover:bg-primary/90"
                onClick={() => copyToClipboard(JSON.stringify(record, null, 2), "Record data")}
              >
                <Copy size={13} className="mr-1.5" />
                Copy Data
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
