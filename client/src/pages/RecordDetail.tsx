import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, AlertTriangle, Copy, User, Building2, Ship, HelpCircle, FileText } from "lucide-react";
import { toast } from "sonner";
import FormattedRecordSections from "@/components/FormattedRecordSections";
import { actionToText, formatSanctionsRecord } from "@shared/record-formatter";

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
              {record.actionTaken && <div className="text-xs text-destructive/80" dir="auto">{formatSanctionsRecord(record).actions.map(actionToText).join(" · ")}</div>}
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

          <FormattedRecordSections record={record} />
        </div>
      </div>
    </AppLayout>
  );
}
