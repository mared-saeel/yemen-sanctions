import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import AppLayout from "@/components/AppLayout";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { Users, Building2, Search, Database, Shield, ArrowRight, TrendingUp } from "lucide-react";

export default function AdminDashboard() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!loading && (!isAuthenticated || user?.role !== "admin")) {
      navigate("/search");
    }
  }, [loading, isAuthenticated, user]);

  const { data: stats, isLoading } = trpc.admin.stats.useQuery();

  const statCards = [
    {
      label: "Sanctioned Records",
      value: stats?.totalRecords?.toLocaleString() || "—",
      icon: <Database size={22} />,
      bgColor: "bg-blue-50",
      iconColor: "text-blue-600",
      borderColor: "border-blue-100",
      trend: "Total in database",
    },
    {
      label: "Registered Users",
      value: stats?.totalUsers?.toLocaleString() || "—",
      icon: <Users size={22} />,
      bgColor: "bg-emerald-50",
      iconColor: "text-emerald-600",
      borderColor: "border-emerald-100",
      trend: "Active accounts",
    },
    {
      label: "Total Searches",
      value: stats?.totalSearches?.toLocaleString() || "—",
      icon: <Search size={22} />,
      bgColor: "bg-violet-50",
      iconColor: "text-violet-600",
      borderColor: "border-violet-100",
      trend: "All time queries",
    },
    {
      label: "Companies",
      value: stats?.totalCompanies?.toLocaleString() || "—",
      icon: <Building2 size={22} />,
      bgColor: "bg-amber-50",
      iconColor: "text-amber-600",
      borderColor: "border-amber-100",
      trend: "Registered clients",
    },
  ];

  const quickLinks = [
    {
      title: "Manage Users",
      desc: "View, activate, and manage user accounts",
      href: "/admin/users",
      icon: <Users size={20} />,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      title: "Companies",
      desc: "Manage company accounts and permissions",
      href: "/admin/companies",
      icon: <Building2 size={20} />,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      title: "Audit Logs",
      desc: "Review all screening and export activities",
      href: "/admin/audit-logs",
      icon: <Shield size={20} />,
      color: "text-violet-600",
      bg: "bg-violet-50",
    },
  ];

  return (
    <AppLayout>
      <div className="p-6 max-w-6xl">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <TrendingUp size={16} className="text-white" />
            </div>
            <h1 className="text-xl font-bold text-foreground">Admin Dashboard</h1>
          </div>
          <p className="text-sm text-muted-foreground ml-11">System overview and statistics</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {statCards.map((stat) => (
            <div
              key={stat.label}
              className={`bg-card border ${stat.borderColor} rounded-2xl p-5 hover:shadow-md transition-shadow`}
            >
              <div className={`w-10 h-10 ${stat.bgColor} rounded-xl flex items-center justify-center mb-4`}>
                <span className={stat.iconColor}>{stat.icon}</span>
              </div>
              <div className="text-2xl font-bold text-foreground tracking-tight">
                {isLoading ? (
                  <div className="h-7 w-16 bg-muted animate-pulse rounded-lg" />
                ) : (
                  stat.value
                )}
              </div>
              <div className="text-sm font-medium text-foreground mt-1">{stat.label}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{stat.trend}</div>
            </div>
          ))}
        </div>

        {/* Quick Links */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            Quick Access
          </h2>
          <div className="grid md:grid-cols-3 gap-4">
            {quickLinks.map((item) => (
              <div
                key={item.title}
                onClick={() => navigate(item.href)}
                className="bg-card border border-border rounded-2xl p-5 cursor-pointer hover:border-primary/30 hover:shadow-md transition-all duration-200 group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-10 h-10 ${item.bg} rounded-xl flex items-center justify-center`}>
                    <span className={item.color}>{item.icon}</span>
                  </div>
                  <ArrowRight
                    size={16}
                    className="text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all"
                  />
                </div>
                <h3 className="font-semibold text-foreground mb-1">{item.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
