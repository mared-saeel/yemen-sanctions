import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Shield, Search, Zap, Globe, Lock, ChevronRight, BarChart3 } from "lucide-react";
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
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
              <Shield size={18} className="text-primary-foreground" />
            </div>
            <div>
              <div className="text-base font-bold text-foreground">SanctionCheck</div>
              <div className="text-[10px] text-muted-foreground tracking-wider uppercase">Compliance Platform</div>
            </div>
          </div>
          <Button
            onClick={() => window.location.href = getLoginUrl()}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
            size="sm"
          >
            Sign In
            <ChevronRight size={14} className="ml-1" />
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-20">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-medium">
            <Zap size={12} />
            AI-Powered Sanctions Screening
          </div>

          {/* Title */}
          <div className="space-y-4">
            <h1 className="text-4xl md:text-6xl font-bold text-foreground leading-tight">
              Global Sanctions
              <span className="block text-primary">Screening Platform</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Advanced compliance screening with AI-powered fuzzy matching across{" "}
              <span className="text-foreground font-semibold">39,710+ sanctioned entities</span>.
              Built for financial institutions and exchange companies.
            </p>
          </div>

          {/* CTA */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              onClick={() => window.location.href = getLoginUrl()}
              size="lg"
              className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-3 text-base font-semibold"
            >
              <Shield size={18} className="mr-2" />
              Start Screening
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="border-border text-foreground hover:bg-secondary px-8 py-3 text-base"
              onClick={() => window.location.href = getLoginUrl()}
            >
              Request Demo
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-8">
            {[
              { label: "Sanctioned Entities", value: "39,710+", icon: <Globe size={20} /> },
              { label: "Issuing Bodies", value: "50+", icon: <Shield size={20} /> },
              { label: "Search Speed", value: "<500ms", icon: <Zap size={20} /> },
              { label: "Match Accuracy", value: "99.2%", icon: <BarChart3 size={20} /> },
            ].map((stat) => (
              <div key={stat.label} className="bg-card border border-border rounded-lg p-4 text-center">
                <div className="text-primary flex justify-center mb-2">{stat.icon}</div>
                <div className="text-xl font-bold text-foreground">{stat.value}</div>
                <div className="text-xs text-muted-foreground mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Features */}
      <section className="border-t border-border bg-card/30 py-16 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-center text-foreground mb-10">Platform Features</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: <Search size={24} />,
                title: "Smart Fuzzy Search",
                desc: "Levenshtein Distance + Fuse.js for typo-tolerant matching across Arabic and English names.",
              },
              {
                icon: <Zap size={24} />,
                title: "AI-Enhanced Screening",
                desc: "LLM-powered query expansion identifies name variations and transliterations automatically.",
              },
              {
                icon: <Lock size={24} />,
                title: "Audit & Compliance",
                desc: "Complete audit trail of all screening operations with timestamps and user tracking.",
              },
              {
                icon: <Globe size={24} />,
                title: "Multi-Language",
                desc: "Full support for Arabic and English names with intelligent normalization.",
              },
              {
                icon: <BarChart3 size={24} />,
                title: "Advanced Filtering",
                desc: "Filter by entity type, nationality, issuing body, listing date and more.",
              },
              {
                icon: <Shield size={24} />,
                title: "Multi-Company",
                desc: "Role-based access control with company management and user administration.",
              },
            ].map((f) => (
              <div key={f.title} className="bg-card border border-border rounded-lg p-5 hover:border-primary/40 transition-colors">
                <div className="text-primary mb-3">{f.icon}</div>
                <h3 className="font-semibold text-foreground mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-6 px-6 text-center text-xs text-muted-foreground">
        <p>© 2026 SanctionCheck Compliance Platform. All rights reserved.</p>
        <p className="mt-1">Designed for financial institutions and compliance professionals.</p>
      </footer>
    </div>
  );
}
