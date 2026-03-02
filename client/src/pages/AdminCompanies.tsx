import { useState } from "react";
import { trpc } from "@/lib/trpc";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Building2, Plus, X, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function AdminCompanies() {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", nameAr: "", licenseNumber: "", country: "", contactEmail: "", maxUsers: 10 });
  const utils = trpc.useUtils();

  const { data: companies, isLoading } = trpc.admin.companies.list.useQuery();

  const create = trpc.admin.companies.create.useMutation({
    onSuccess: () => {
      utils.admin.companies.list.invalidate();
      setShowForm(false);
      setForm({ name: "", nameAr: "", licenseNumber: "", country: "", contactEmail: "", maxUsers: 10 });
      toast.success("Company created successfully");
    },
    onError: (e) => toast.error(e.message),
  });

  const update = trpc.admin.companies.update.useMutation({
    onSuccess: () => { utils.admin.companies.list.invalidate(); toast.success("Company updated"); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <AppLayout>
      <div className="p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Building2 size={20} className="text-primary" />
              Company Management
            </h1>
            <p className="text-sm text-muted-foreground mt-1">{companies?.length || 0} companies registered</p>
          </div>
          <Button
            size="sm"
            className="bg-primary hover:bg-primary/90"
            onClick={() => setShowForm(!showForm)}
          >
            <Plus size={14} className="mr-1.5" />
            Add Company
          </Button>
        </div>

        {/* Create Form */}
        {showForm && (
          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-foreground">New Company</h3>
              <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground">
                <X size={16} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Company Name (EN) *</label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Company name" className="h-9 text-sm bg-input border-border" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Company Name (AR)</label>
                <Input value={form.nameAr} onChange={(e) => setForm({ ...form, nameAr: e.target.value })} placeholder="اسم الشركة" dir="rtl" className="h-9 text-sm bg-input border-border" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">License Number</label>
                <Input value={form.licenseNumber} onChange={(e) => setForm({ ...form, licenseNumber: e.target.value })} placeholder="License #" className="h-9 text-sm bg-input border-border" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Country</label>
                <Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} placeholder="Country" className="h-9 text-sm bg-input border-border" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Contact Email</label>
                <Input type="email" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} placeholder="email@company.com" className="h-9 text-sm bg-input border-border" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Max Users</label>
                <Input type="number" value={form.maxUsers} onChange={(e) => setForm({ ...form, maxUsers: parseInt(e.target.value) || 10 })} className="h-9 text-sm bg-input border-border" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowForm(false)} className="border-border">Cancel</Button>
              <Button
                size="sm"
                className="bg-primary hover:bg-primary/90"
                disabled={!form.name || create.isPending}
                onClick={() => create.mutate(form)}
              >
                <Check size={13} className="mr-1.5" />
                Create Company
              </Button>
            </div>
          </div>
        )}

        {/* Companies Table */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Company</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">License</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Country</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Max Users</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Created</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i} className="border-b border-border">
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 bg-secondary animate-pulse rounded w-20" /></td>
                    ))}
                  </tr>
                ))
              ) : companies?.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground text-sm">
                    No companies yet. Add your first company.
                  </td>
                </tr>
              ) : companies?.map((company) => (
                <tr key={company.id} className="border-b border-border hover:bg-secondary/20 transition-colors">
                  <td className="px-4 py-3">
                    <div>
                      <div className="text-sm font-medium text-foreground">{company.name}</div>
                      {company.nameAr && <div className="text-xs text-muted-foreground" dir="rtl">{company.nameAr}</div>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{company.licenseNumber || "—"}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{company.country || "—"}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{company.maxUsers}</td>
                  <td className="px-4 py-3">
                    <Badge
                      variant="secondary"
                      className={cn(
                        "text-xs",
                        company.isActive
                          ? "bg-green-500/10 text-green-400 border-green-500/20"
                          : "bg-red-500/10 text-red-400 border-red-500/20"
                      )}
                    >
                      {company.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(company.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => update.mutate({ id: company.id, isActive: !company.isActive })}
                    >
                      {company.isActive ? "Deactivate" : "Activate"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
}
