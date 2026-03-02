import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Search, Zap, Globe, Lock, ChevronRight, BarChart3, ArrowRight } from "lucide-react";
import { useLocation } from "wouter";
import { useEffect } from "react";

export default function Home() {
  const { user, isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!loading && isAuthenticated) {
      navigate("/search");
    }
  }, [isAuthenticated, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-muted-foreground text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-10 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shadow-sm">
              <ShieldCheck size={18} className="text-white" />
            </div>
            <div>
              <div className="text-base font-bold text-foreground tracking-tight">SanctionCheck</div>
              <div className="text-[10px] text-muted-foreground tracking-widest uppercase font-medium">Compliance Platform</div>
            </div>
          </div>
          <Button
            onClick={() => window.location.href = getLoginUrl()}
            className="bg-primary hover:bg-primary/90 text-white font-semibold shadow-sm"
            size="sm"
          >
            Sign In
            <ChevronRight size={14} className="ml-1" />
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        {/* Top gradient band */}
        <div className="relative overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50/40 to-indigo-50/30 border-b border-border">
          <div className="absolute inset-0 opacity-30"
            style={{
              backgroundImage: "radial-gradient(circle at 20% 50%, oklch(0.80 0.10 255 / 0.3) 0%, transparent 50%), radial-gradient(circle at 80% 20%, oklch(0.80 0.12 220 / 0.2) 0%, transparent 40%)"
            }}
          />
          <div className="relative max-w-5xl mx-auto px-6 py-24 text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/25 bg-white shadow-sm text-primary text-xs font-semibold mb-8">
              <Zap size={11} className="fill-current" />
              AI-Powered Sanctions Screening
            </div>

            {/* Title */}
            <h1 className="text-4xl md:text-6xl font-extrabold text-foreground leading-tight mb-6 tracking-tight">
              Global Sanctions
              <span className="block" style={{ color: "oklch(0.38 0.16 255)" }}>
                Screening Platform
              </span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-10">
              Advanced compliance screening with AI-powered fuzzy matching across{" "}
              <span className="text-foreground font-bold">39,710+ sanctioned entities</span>.
              Built for financial institutions and exchange companies.
            </p>

            {/* CTA */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
              <Button
                onClick={() => window.location.href = getLoginUrl()}
                size="lg"
                className="bg-primary hover:bg-primary/90 text-white px-10 py-3 text-base font-bold shadow-md hover:shadow-lg transition-all"
              >
                <ShieldCheck size={18} className="mr-2" />
                Start Screening
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="border-border bg-white text-foreground hover:bg-muted/50 px-8 py-3 text-base font-medium shadow-sm"
                onClick={() => window.location.href = getLoginUrl()}
              >
                Request Demo
                <ArrowRight size={16} className="ml-2" />
              </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Sanctioned Entities", value: "39,710+", icon: <Globe size={18} />, color: "text-blue-600", bg: "bg-blue-50" },
                { label: "Issuing Bodies", value: "50+", icon: <ShieldCheck size={18} />, color: "text-emerald-600", bg: "bg-emerald-50" },
                { label: "Search Speed", value: "<500ms", icon: <Zap size={18} />, color: "text-amber-600", bg: "bg-amber-50" },
                { label: "Match Accuracy", value: "99.2%", icon: <BarChart3 size={18} />, color: "text-violet-600", bg: "bg-violet-50" },
              ].map((stat) => (
                <div key={stat.label} className="bg-white border border-border rounded-2xl p-5 text-center shadow-sm hover:shadow-md transition-shadow">
                  <div className={`w-9 h-9 ${stat.bg} rounded-xl flex items-center justify-center mx-auto mb-3`}>
                    <span className={stat.color}>{stat.icon}</span>
                  </div>
                  <div className="text-2xl font-extrabold text-foreground tracking-tight">{stat.value}</div>
                  <div className="text-xs text-muted-foreground mt-1 font-medium">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Features */}
        <section className="py-20 px-6 bg-background">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-foreground tracking-tight mb-3">Platform Features</h2>
              <p className="text-muted-foreground max-w-xl mx-auto">
                Enterprise-grade compliance tools designed for speed, accuracy, and reliability.
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-5">
              {[
                {
                  icon: <Search size={22} />,
                  title: "Smart Fuzzy Search",
                  desc: "Levenshtein Distance + Fuse.js for typo-tolerant matching across Arabic and English names.",
                  color: "text-blue-600",
                  bg: "bg-blue-50",
                  border: "border-blue-100",
                },
                {
                  icon: <Zap size={22} />,
                  title: "AI-Enhanced Screening",
                  desc: "LLM-powered query expansion identifies name variations and transliterations automatically.",
                  color: "text-amber-600",
                  bg: "bg-amber-50",
                  border: "border-amber-100",
                },
                {
                  icon: <Lock size={22} />,
                  title: "Audit & Compliance",
                  desc: "Complete audit trail of all screening operations with timestamps and user tracking.",
                  color: "text-emerald-600",
                  bg: "bg-emerald-50",
                  border: "border-emerald-100",
                },
                {
                  icon: <Globe size={22} />,
                  title: "Multi-Language",
                  desc: "Full support for Arabic and English names with intelligent normalization.",
                  color: "text-violet-600",
                  bg: "bg-violet-50",
                  border: "border-violet-100",
                },
                {
                  icon: <BarChart3 size={22} />,
                  title: "Advanced Filtering",
                  desc: "Filter by entity type, nationality, issuing body, listing date and more.",
                  color: "text-rose-600",
                  bg: "bg-rose-50",
                  border: "border-rose-100",
                },
                {
                  icon: <ShieldCheck size={22} />,
                  title: "Multi-Company",
                  desc: "Role-based access control with company management and user administration.",
                  color: "text-indigo-600",
                  bg: "bg-indigo-50",
                  border: "border-indigo-100",
                },
              ].map((f) => (
                <div
                  key={f.title}
                  className={`bg-white border ${f.border} rounded-2xl p-6 hover:shadow-md transition-all duration-200 group`}
                >
                  <div className={`w-11 h-11 ${f.bg} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                    <span className={f.color}>{f.icon}</span>
                  </div>
                  <h3 className="font-bold text-foreground mb-2 text-[15px]">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-6 bg-card">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <ShieldCheck size={14} className="text-white" />
            </div>
            <span className="text-sm font-semibold text-foreground">SanctionCheck</span>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            © 2026 SanctionCheck Compliance Platform. All rights reserved.
            Designed for financial institutions and compliance professionals.
          </p>
        </div>
      </footer>
    </div>
  );
}
