import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Search,
  LayoutDashboard,
  Users,
  Building2,
  FileText,
  LogOut,
  Bell,
  Menu,
  Upload,
  FileSpreadsheet,
  Settings,
  ShieldCheck,
  Ship,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  adminOnly?: boolean;
  group?: string;
}

const navItems: NavItem[] = [
  { label: "البحث في العقوبات", href: "/search", icon: <Search size={16} /> },
  { label: "فحص الدفعات", href: "/batch", icon: <FileSpreadsheet size={16} /> },
  { label: "لوحة الإدارة", href: "/admin", icon: <LayoutDashboard size={16} />, adminOnly: true, group: "الإدارة" },
  { label: "المستخدمون", href: "/admin/users", icon: <Users size={16} />, adminOnly: true, group: "الإدارة" },
  { label: "الشركات", href: "/admin/companies", icon: <Building2 size={16} />, adminOnly: true, group: "الإدارة" },
  { label: "سجل التدقيق", href: "/admin/audit-logs", icon: <FileText size={16} />, adminOnly: true, group: "الإدارة" },
  { label: "البيانات المستوردة", href: "/admin/import-data", icon: <Upload size={16} />, adminOnly: true, group: "الإدارة" },
];

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const [location] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const logout = trpc.auth.logout.useMutation({ onSuccess: () => { window.location.href = "/"; } });
  const isAdmin = user?.role === "admin";
  const mainNav = navItems.filter((item) => !item.group && (!item.adminOnly || isAdmin));
  const adminNav = navItems.filter((item) => item.group === "الإدارة" && (!item.adminOnly || isAdmin));

  const isActive = (href: string) => href === "/search"
    ? location === "/search" || location === "/"
    : location === href || (href !== "/admin" && location.startsWith(`${href}/`));

  const Navigation = () => (
    <div className="flex h-full flex-col" dir="rtl">
      <div className="border-b border-border px-5 py-5">
        <div className="flex items-center gap-3">
          <img
            src="https://private-us-east-1.manuscdn.com/user_upload_by_module/session_file/310519663202837783/VEZYpFzPPlUnNXXB.png?Expires=1803987046&Signature=dSkdEkym0CnCrZ~xvHutowDJvaXvfh1IYw0fGrbQwWaAjL5vmswDwRF9-TfTOh4xH2P2YcrXfjAFiQEXpzpyJ2mqD~wqvBlPtta~nzxh~YHN1GaX33XlFKB-QK6Itc1~EgF3UTZlpRjoh7HmuR63-HoVVdbNXHhjMKtREACYojEsDOCBjCNg3EXLc2CmNt6~EztnE0p9uCZUuJ~JbxGil38c-4Y7yMm7sR3PqqnZKS5LoBot0KoQhuy1r63lSwudqL-6fHPYJBZfN3I9OHLYH5ez7NVfKDC26lKQ-z5kcKIB-LbwVUzb57AKcXIopP8YdmPNF4kmrI1jt1qTN21iKw__&Key-Pair-Id=K2HSFNDJXOU9YS"
            alt="منصة العقوبات اليمنية"
            className="h-10 w-10 object-contain"
          />
          <div className="min-w-0 leading-tight">
            <div className="text-[11px] font-bold tracking-[0.08em] text-foreground">YEMEN SANCTIONS</div>
            <div className="mt-1 text-[10px] text-muted-foreground">منصة العقوبات اليمنية</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-5">
        {mainNav.map((item) => (
          <Link href={item.href} key={item.href}>
            <div onClick={() => setMobileOpen(false)} className={cn("flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground", isActive(item.href) && "bg-primary text-primary-foreground shadow-sm") }>
              {item.icon}<span>{item.label}</span>
            </div>
          </Link>
        ))}
        {adminNav.length > 0 && <div className="mt-6 border-t border-border pt-4">
          <div className="mb-2 px-3 text-[10px] font-bold tracking-[0.12em] text-muted-foreground">الإدارة</div>
          {adminNav.map((item) => (
            <Link href={item.href} key={item.href}>
              <div onClick={() => setMobileOpen(false)} className={cn("flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground", isActive(item.href) && "bg-primary text-primary-foreground shadow-sm") }>{item.icon}<span>{item.label}</span></div>
            </Link>
          ))}
        </div>}
      </nav>

      <div className="border-t border-border px-3 py-3">
        <div className="flex items-center gap-2.5 px-2 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground text-xs font-bold text-background">{user?.name?.[0]?.toUpperCase() || "U"}</div>
          <div className="min-w-0 flex-1"><div className="truncate text-xs font-semibold text-foreground">{user?.name || "مستخدم النظام"}</div><div className="mt-0.5 text-[10px] text-muted-foreground">{isAdmin ? "مدير النظام" : "مستخدم"}</div></div>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => logout.mutate()} title="تسجيل الخروج"><LogOut size={14} /></Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-[#fafaf8]" dir="rtl">
      <aside className="hidden w-[238px] flex-shrink-0 border-l border-border bg-sidebar md:flex"><Navigation /></aside>
      {mobileOpen && <div className="fixed inset-0 z-50 md:hidden"><button aria-label="إغلاق القائمة" className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} /><aside className="absolute right-0 top-0 h-full w-[260px] border-l border-border bg-sidebar shadow-xl"><Navigation /></aside></div>}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex flex-shrink-0 items-center justify-between border-b border-border bg-card px-5 py-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileOpen(true)}><Menu size={19} /></Button>
            <div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex"><ShieldCheck size={14} className="text-primary" /><span>نظام فحص العقوبات والامتثال</span></div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground"><Bell size={16} /></Button>
            {isAuthenticated && user && <div className="flex items-center gap-2 border-r border-border pr-3"><div className="text-right"><div className="text-xs font-semibold text-foreground">{user.name}</div><div className="text-[10px] text-muted-foreground">{isAdmin ? "مدير النظام" : "مستخدم"}</div></div><div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">{user.name?.[0]?.toUpperCase() || "U"}</div></div>}
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
