import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import AppLayout from "@/components/AppLayout";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { BarChart3, Users, Building2, Search, Database, TrendingUp, Shield } from "lucide-react";

export default function AdminDashboard() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!loading && (!isAuthenticated || user?.role !== "admin")) {
      navigate("/search");
    }
  }, [loading, isAuthenticated, user]);

  const { data: stats, isLoading } = trpc.admin.stats.useQuery();

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">Admin Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">System overview and statistics</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Sanctioned Records", value: stats?.totalRecords?.toLocaleString() || "—", icon: <Database size={20} />, color: "text-blue-400" },
            { label: "Registered Users", value: stats?.totalUsers?.toLocaleString() || "—", icon: <Users size={20} />, color: "text-green-400" },
            { label: "Total Searches", value: stats?.totalSearches?.toLocaleString() || "—", icon: <Search size={20} />, color: "text-yellow-400" },
            { label: "Companies", value: stats?.totalCompanies?.toLocaleString() || "—", icon: <Building2 size={20} />, color: "text-purple-400" },
          ].map((stat) => (
            <div key={stat.label} className="bg-card border border-border rounded-xl p-5">
              <div className={`${stat.color} mb-3`}>{stat.icon}</div>
              <div className="text-2xl font-bold text-foreground">
                {isLoading ? <div className="h-7 w-16 bg-secondary animate-pulse rounded" /> : stat.value}
              </div>
              <div className="text-xs text-muted-foreground mt-1">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Quick Links */}
        <div className="grid md:grid-cols-3 gap-4">
          {[
            { title: "Manage Users", desc: "View, activate, and manage user accounts", href: "/admin/users", icon: <Users size={24} /> },
            { title: "Companies", desc: "Manage company accounts and permissions", href: "/admin/companies", icon: <Building2 size={24} /> },
            { title: "Audit Logs", desc: "Review all screening and export activities", href: "/admin/audit-logs", icon: <Shield size={24} /> },
          ].map((item) => (
            <div
              key={item.title}
              onClick={() => navigate(item.href)}
              className="bg-card border border-border rounded-xl p-5 cursor-pointer hover:border-primary/40 transition-colors group"
            >
              <div className="text-primary mb-3 group-hover:scale-110 transition-transform inline-block">{item.icon}</div>
              <h3 className="font-semibold text-foreground mb-1">{item.title}</h3>
              <p className="text-xs text-muted-foreground">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
