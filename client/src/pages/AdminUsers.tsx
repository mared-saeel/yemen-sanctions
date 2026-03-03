import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Users,
  Shield,
  UserX,
  UserCheck,
  ChevronLeft,
  ChevronRight,
  UserPlus,
  KeyRound,
  Eye,
  EyeOff,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ─── Create User Dialog ────────────────────────────────────────────────────────
function CreateUserDialog({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState({
    username: "",
    password: "",
    name: "",
    role: "user" as "user" | "admin",
  });
  const [showPwd, setShowPwd] = useState(false);

  const createMutation = trpc.admin.users.create.useMutation({
    onSuccess: () => {
      toast.success("تم إنشاء المستخدم بنجاح");
      setForm({ username: "", password: "", name: "", role: "user" });
      onSuccess();
      onClose();
    },
    onError: (e) => {
      if (e.data?.code === "CONFLICT") {
        toast.error("اسم المستخدم مستخدم بالفعل");
      } else {
        toast.error(e.message || "فشل إنشاء المستخدم");
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.username || !form.password || !form.name) {
      toast.error("يرجى تعبئة جميع الحقول المطلوبة");
      return;
    }
    if (form.password.length < 6) {
      toast.error("كلمة المرور يجب أن تكون 6 أحرف على الأقل");
      return;
    }
    createMutation.mutate(form);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-800">
            <UserPlus className="w-5 h-5 text-blue-600" />
            إضافة مستخدم جديد
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-slate-700">الاسم الكامل <span className="text-red-500">*</span></Label>
            <Input
              placeholder="مثال: أحمد محمد"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="text-right"
              disabled={createMutation.isPending}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-slate-700">
              اسم المستخدم <span className="text-red-500">*</span>
              <span className="text-xs text-slate-400 mr-1">(حروف وأرقام فقط)</span>
            </Label>
            <Input
              placeholder="مثال: ahmed123"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "") })}
              className="text-left ltr"
              dir="ltr"
              disabled={createMutation.isPending}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-slate-700">كلمة المرور <span className="text-red-500">*</span></Label>
            <div className="relative">
              <Input
                type={showPwd ? "text" : "password"}
                placeholder="6 أحرف على الأقل"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="pl-10 text-right"
                dir="ltr"
                disabled={createMutation.isPending}
              />
              <button
                type="button"
                onClick={() => setShowPwd(!showPwd)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-slate-700">الصلاحية</Label>
            <Select
              value={form.role}
              onValueChange={(v) => setForm({ ...form, role: v as "user" | "admin" })}
              disabled={createMutation.isPending}
            >
              <SelectTrigger className="text-right">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">مستخدم عادي (قراءة وبحث فقط)</SelectItem>
                <SelectItem value="admin">مدير (كامل الصلاحيات)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="gap-2 flex-row-reverse">
            <Button type="submit" disabled={createMutation.isPending} className="bg-blue-600 hover:bg-blue-700">
              {createMutation.isPending ? "جاري الإنشاء..." : "إنشاء المستخدم"}
            </Button>
            <Button type="button" variant="outline" onClick={onClose} disabled={createMutation.isPending}>
              إلغاء
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Change Password Dialog ────────────────────────────────────────────────────
function ChangePasswordDialog({
  userId,
  userName,
  open,
  onClose,
}: {
  userId: number;
  userName: string;
  open: boolean;
  onClose: () => void;
}) {
  const [newPassword, setNewPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);

  const changePwdMutation = trpc.admin.users.changePassword.useMutation({
    onSuccess: () => {
      toast.success("تم تغيير كلمة المرور بنجاح");
      setNewPassword("");
      onClose();
    },
    onError: (e) => toast.error(e.message || "فشل تغيير كلمة المرور"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error("كلمة المرور يجب أن تكون 6 أحرف على الأقل");
      return;
    }
    changePwdMutation.mutate({ userId, newPassword });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-800">
            <KeyRound className="w-5 h-5 text-amber-600" />
            تغيير كلمة المرور
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-slate-500">تغيير كلمة مرور المستخدم: <strong>{userName}</strong></p>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-slate-700">كلمة المرور الجديدة</Label>
            <div className="relative">
              <Input
                type={showPwd ? "text" : "password"}
                placeholder="6 أحرف على الأقل"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="pl-10"
                dir="ltr"
                disabled={changePwdMutation.isPending}
              />
              <button
                type="button"
                onClick={() => setShowPwd(!showPwd)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <DialogFooter className="gap-2 flex-row-reverse">
            <Button type="submit" disabled={changePwdMutation.isPending} className="bg-amber-600 hover:bg-amber-700">
              {changePwdMutation.isPending ? "جاري التغيير..." : "تغيير كلمة المرور"}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>إلغاء</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function AdminUsers() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [changePwdUser, setChangePwdUser] = useState<{ id: number; name: string } | null>(null);
  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.admin.users.list.useQuery({ page, pageSize: 20 });

  const setStatus = trpc.admin.users.setStatus.useMutation({
    onSuccess: () => { utils.admin.users.list.invalidate(); toast.success("تم تحديث حالة المستخدم"); },
    onError: (e) => toast.error(e.message),
  });

  const setRole = trpc.admin.users.setRole.useMutation({
    onSuccess: () => { utils.admin.users.list.invalidate(); toast.success("تم تحديث صلاحية المستخدم"); },
    onError: (e) => toast.error(e.message),
  });

  const deleteUser = trpc.admin.users.delete.useMutation({
    onSuccess: () => { utils.admin.users.list.invalidate(); toast.success("تم تعطيل المستخدم"); },
    onError: (e) => toast.error(e.message),
  });

  const totalPages = data ? Math.ceil(data.total / 20) : 1;

  return (
    <AppLayout>
      <div className="p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Users size={20} className="text-primary" />
              إدارة المستخدمين
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {data?.total || 0} مستخدم مسجّل
            </p>
          </div>
          <Button
            onClick={() => setShowCreate(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
          >
            <UserPlus size={16} />
            إضافة مستخدم جديد
          </Button>
        </div>

        {/* Table */}
        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">المستخدم</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">اسم الدخول</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">البريد الإلكتروني</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">الصلاحية</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">الحالة</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">تاريخ الإنشاء</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-border">
                      {Array.from({ length: 7 }).map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 bg-secondary animate-pulse rounded w-24" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : data?.users.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-muted-foreground">
                      <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
                      <p>لا يوجد مستخدمون بعد</p>
                    </td>
                  </tr>
                ) : (
                  data?.users.map((u) => (
                    <tr key={u.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow-sm">
                            {u.name?.[0]?.toUpperCase() || "U"}
                          </div>
                          <span className="text-sm text-foreground font-medium">{u.name || "—"}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 font-mono">
                        {(u as any).username || <span className="text-slate-400 text-xs">OAuth</span>}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{u.email || "—"}</td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={u.role === "admin" ? "default" : "secondary"}
                          className={cn(
                            "text-xs font-medium cursor-pointer",
                            u.role === "admin"
                              ? "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
                              : "bg-muted text-muted-foreground hover:bg-slate-200"
                          )}
                          onClick={() => {
                            if (u.id !== user?.id) {
                              setRole.mutate({ userId: u.id, role: u.role === "admin" ? "user" : "admin" });
                            }
                          }}
                        >
                          {u.role === "admin" && <Shield size={10} className="mr-1" />}
                          {u.role === "admin" ? "مدير" : "مستخدم"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant="secondary"
                          className={cn(
                            "text-xs",
                            (u as any).isActive !== false
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-red-50 text-red-700 border-red-200"
                          )}
                        >
                          {(u as any).isActive !== false ? "نشط" : "معطّل"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {new Date(u.createdAt).toLocaleDateString("ar-SA")}
                      </td>
                      <td className="px-4 py-3">
                        {u.id !== user?.id && (
                          <div className="flex items-center gap-1">
                            {/* Toggle Status */}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-slate-500 hover:text-slate-700"
                              title={(u as any).isActive !== false ? "تعطيل الحساب" : "تفعيل الحساب"}
                              onClick={() => setStatus.mutate({ userId: u.id, isActive: (u as any).isActive === false })}
                            >
                              {(u as any).isActive !== false ? <UserX size={13} /> : <UserCheck size={13} />}
                            </Button>
                            {/* Change Password */}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-amber-500 hover:text-amber-700"
                              title="تغيير كلمة المرور"
                              onClick={() => setChangePwdUser({ id: u.id, name: u.name || "المستخدم" })}
                            >
                              <KeyRound size={13} />
                            </Button>
                            {/* Delete */}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-red-400 hover:text-red-600"
                              title="حذف المستخدم"
                              onClick={() => {
                                if (confirm(`هل تريد حذف المستخدم "${u.name}"؟`)) {
                                  deleteUser.mutate({ userId: u.id });
                                }
                              }}
                            >
                              <Trash2 size={13} />
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <span className="text-xs text-muted-foreground">
                صفحة {page} من {totalPages}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="h-7 border-border"
                >
                  <ChevronRight size={14} />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="h-7 border-border"
                >
                  <ChevronLeft size={14} />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Dialogs */}
      <CreateUserDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSuccess={() => utils.admin.users.list.invalidate()}
      />
      {changePwdUser && (
        <ChangePasswordDialog
          userId={changePwdUser.id}
          userName={changePwdUser.name}
          open={!!changePwdUser}
          onClose={() => setChangePwdUser(null)}
        />
      )}
    </AppLayout>
  );
}
