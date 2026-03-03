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
  ChevronLeft,
  ChevronRight,
  Bell,
  Menu,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  adminOnly?: boolean;
  group?: string;
}

const navItems: NavItem[] = [
  { label: "Screening", href: "/search", icon: <Search size={16} /> },
  { label: "Admin Dashboard", href: "/admin", icon: <LayoutDashboard size={16} />, adminOnly: true, group: "Administration" },
  { label: "Users", href: "/admin/users", icon: <Users size={16} />, adminOnly: true, group: "Administration" },
  { label: "Companies", href: "/admin/companies", icon: <Building2 size={16} />, adminOnly: true, group: "Administration" },
  { label: "Audit Logs", href: "/admin/audit-logs", icon: <FileText size={16} />, adminOnly: true, group: "Administration" },
  { label: "Import Data", href: "/admin/import-data", icon: <Upload size={16} />, adminOnly: true, group: "Administration" },
];

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const [location] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const logout = trpc.auth.logout.useMutation({
    onSuccess: () => { window.location.href = "/"; },
  });

  const isAdmin = user?.role === "admin";
  const visibleNav = navItems.filter((item) => !item.adminOnly || isAdmin);

  // Group nav items
  const mainNav = visibleNav.filter(i => !i.group);
  const adminNav = visibleNav.filter(i => i.group === "Administration");

  const currentPage = navItems.find((n) => {
    if (n.href === "/search") return location === "/search" || location === "/";
    return location.startsWith(n.href);
  });

  const NavLink = ({ item }: { item: NavItem }) => {
    const isActive = item.href === "/search"
      ? location === "/search" || location === "/"
      : location === item.href || (item.href !== "/admin" && location.startsWith(item.href + "/"));

    return (
      <Link href={item.href}>
        <div
          onClick={() => setMobileOpen(false)}
          className={cn(
            "nav-item",
            isActive && "active",
            collapsed && "justify-center px-2"
          )}
          title={collapsed ? item.label : undefined}
        >
          <span className="flex-shrink-0">{item.icon}</span>
          {!collapsed && <span className="truncate">{item.label}</span>}
        </div>
      </Link>
    );
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
        <div className={cn(
        "flex items-center gap-2 px-4 py-4 border-b border-sidebar-border",
        collapsed && "justify-center px-2"
      )}>
        {!collapsed ? (
          <div className="flex items-center justify-center w-full py-1">
            <img
              src="https://private-us-east-1.manuscdn.com/user_upload_by_module/session_file/310519663202837783/VEZYpFzPPlUnNXXB.png?Expires=1803987046&Signature=dSkdEkym0CnCrZ~xvHutowDJvaXvfh1IYw0fGrbQwWaAjL5vmswDwRF9-TfTOh4xH2P2YcrXfjAFiQEXpzpyJ2mqD~wqvBlPtta~nzxh~YHN1GaX33XlFKB-QK6Itc1~EgF3UTZlpRjoh7HmuR63-HoVVdbNXHhjMKtREACYojEsDOCBjCNg3EXLc2CmNt6~EztnE0p9uCZUuJ~JbxGil38c-4Y7yMm7sR3PqqnZKS5LoBot0KoQhuy1r63lSwudqL-6fHPYJBZfN3I9OHLYH5ez7NVfKDC26lKQ-z5kcKIB-LbwVUzb57AKcXIopP8YdmPNF4kmrI1jt1qTN21iKw__&Key-Pair-Id=K2HSFNDJXOU9YS"
              alt="المستشار للاستشارات القانونية"
              className="w-full max-w-[160px] h-auto object-contain"
            />
          </div>
        ) : (
          <div className="w-9 h-9 rounded-lg overflow-hidden border border-border flex items-center justify-center bg-white">
            <img
              src="https://private-us-east-1.manuscdn.com/user_upload_by_module/session_file/310519663202837783/VEZYpFzPPlUnNXXB.png?Expires=1803987046&Signature=dSkdEkym0CnCrZ~xvHutowDJvaXvfh1IYw0fGrbQwWaAjL5vmswDwRF9-TfTOh4xH2P2YcrXfjAFiQEXpzpyJ2mqD~wqvBlPtta~nzxh~YHN1GaX33XlFKB-QK6Itc1~EgF3UTZlpRjoh7HmuR63-HoVVdbNXHhjMKtREACYojEsDOCBjCNg3EXLc2CmNt6~EztnE0p9uCZUuJ~JbxGil38c-4Y7yMm7sR3PqqnZKS5LoBot0KoQhuy1r63lSwudqL-6fHPYJBZfN3I9OHLYH5ez7NVfKDC26lKQ-z5kcKIB-LbwVUzb57AKcXIopP8YdmPNF4kmrI1jt1qTN21iKw__&Key-Pair-Id=K2HSFNDJXOU9YS"
              alt="Logo"
              className="w-full h-full object-contain p-0.5"
            />
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {/* Main nav */}
        {mainNav.map((item) => <NavLink key={item.href} item={item} />)}

        {/* Admin section */}
        {adminNav.length > 0 && (
          <>
            {!collapsed && (
              <div className="pt-4 pb-1 px-3">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                  Administration
                </span>
              </div>
            )}
            {collapsed && <div className="my-2 border-t border-sidebar-border" />}
            {adminNav.map((item) => <NavLink key={item.href} item={item} />)}
          </>
        )}
      </nav>

      {/* User info */}
      <div className={cn(
        "border-t border-sidebar-border p-3",
        collapsed && "flex justify-center"
      )}>
        {!collapsed ? (
          <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-accent/50 transition-colors cursor-pointer"
            onClick={() => setUserMenuOpen(!userMenuOpen)}>
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-sm font-bold flex-shrink-0 shadow-sm">
              {user?.name?.[0]?.toUpperCase() || "U"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-foreground truncate">{user?.name || "User"}</div>
              <div className="text-[10px] text-muted-foreground capitalize font-medium">{user?.role || "user"}</div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex-shrink-0"
              onClick={(e) => { e.stopPropagation(); logout.mutate(); }}
              title="Sign out"
            >
              <LogOut size={13} />
            </Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            onClick={() => logout.mutate()}
            title="Sign out"
          >
            <LogOut size={15} />
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "hidden md:flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-300 flex-shrink-0 relative",
          collapsed ? "w-[60px]" : "w-[220px]"
        )}
      >
        <SidebarContent />
        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-[72px] z-20 bg-card border border-border rounded-full p-1 text-muted-foreground hover:text-primary hover:border-primary/30 transition-all shadow-sm"
        >
          {collapsed ? <ChevronRight size={11} /> : <ChevronLeft size={11} />}
        </button>
      </aside>

      {/* Mobile Sidebar Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-[220px] bg-sidebar border-r border-sidebar-border shadow-xl">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Bar */}
        <header className="flex items-center justify-between px-5 py-3 border-b border-border bg-card/80 backdrop-blur-sm flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              className="md:hidden text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-secondary transition-colors"
              onClick={() => setMobileOpen(true)}
            >
              <Menu size={18} />
            </button>
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground font-medium">SanctionCheck</span>
              {currentPage && (
                <>
                  <span className="text-border">/</span>
                  <span className="font-semibold text-foreground">{currentPage.label}</span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg">
              <Bell size={15} />
            </Button>
            {isAuthenticated && user && (
              <div className="flex items-center gap-2 pl-2 ml-1 border-l border-border">
                <div className="hidden sm:block text-right">
                  <div className="text-xs font-semibold text-foreground leading-tight">{user.name}</div>
                  <div className="text-[10px] text-muted-foreground capitalize">{user.role}</div>
                </div>
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold shadow-sm">
                  {user.name?.[0]?.toUpperCase() || "U"}
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
