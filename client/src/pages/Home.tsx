import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Search, Zap, Globe, Lock, ChevronRight, BarChart3, ArrowRight } from "lucide-react";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";

// ─── Translations ────────────────────────────────────────────────────────────
const t = {
  en: {
    dir: "ltr" as const,
    lang: "en",
    badge: "AI-Powered Sanctions Screening",
    heroTitle1: "Global Sanctions",
    heroTitle2: "Screening Platform",
    heroDesc: "Advanced compliance screening with AI-powered fuzzy matching across",
    heroDescBold: "39,710+ sanctioned entities",
    heroDescEnd: ". Built for financial institutions and exchange companies.",
    startScreening: "Start Screening",
    requestDemo: "Request Demo",
    signIn: "Sign In",
    toggleLang: "عربي",
    stats: [
      { label: "Sanctioned Entities", value: "39,710+" },
      { label: "Issuing Bodies", value: "50+" },
      { label: "Search Speed", value: "<500ms" },
      { label: "Match Accuracy", value: "99.2%" },
    ],
    featuresTitle: "Platform Features",
    featuresDesc: "Enterprise-grade compliance tools designed for speed, accuracy, and reliability.",
    features: [
      { title: "Smart Fuzzy Search", desc: "Levenshtein Distance + Fuse.js for typo-tolerant matching across Arabic and English names." },
      { title: "AI-Enhanced Screening", desc: "LLM-powered query expansion identifies name variations and transliterations automatically." },
      { title: "Audit & Compliance", desc: "Complete audit trail of all screening operations with timestamps and user tracking." },
      { title: "Multi-Language", desc: "Full support for Arabic and English names with intelligent normalization." },
      { title: "Advanced Filtering", desc: "Filter by entity type, nationality, issuing body, listing date and more." },
      { title: "Multi-Company", desc: "Role-based access control with company management and user administration." },
    ],
    footerText: "© 2026 Al-Mustashar Legal Consultancy. All rights reserved.",
    footerSub: "Designed for financial institutions and compliance professionals.",
    loading: "Loading...",
    poweredBy: "Powered by Al-Mustashar Legal Consultancy",
  },
  ar: {
    dir: "rtl" as const,
    lang: "ar",
    badge: "فحص العقوبات بالذكاء الاصطناعي",
    heroTitle1: "منصة فحص العقوبات",
    heroTitle2: "الدولية المتكاملة",
    heroDesc: "فحص امتثال متقدم بتقنية المطابقة الذكية عبر",
    heroDescBold: "أكثر من 39,710 كياناً مقيداً",
    heroDescEnd: ". مصممة للمؤسسات المالية وشركات الصرافة.",
    startScreening: "ابدأ الفحص",
    requestDemo: "طلب عرض تجريبي",
    signIn: "تسجيل الدخول",
    toggleLang: "English",
    stats: [
      { label: "كيان مقيد", value: "39,710+" },
      { label: "جهة مُصدِرة", value: "+50" },
      { label: "سرعة البحث", value: "<500ms" },
      { label: "دقة المطابقة", value: "99.2%" },
    ],
    featuresTitle: "مميزات المنصة",
    featuresDesc: "أدوات امتثال على مستوى المؤسسات مصممة للسرعة والدقة والموثوقية.",
    features: [
      { title: "بحث ذكي متسامح مع الأخطاء", desc: "تقنية Levenshtein Distance وFuse.js للمطابقة مع تحمل الأخطاء الإملائية في الأسماء العربية والإنجليزية." },
      { title: "فحص معزز بالذكاء الاصطناعي", desc: "توسيع الاستعلامات بالنماذج اللغوية الكبيرة للكشف عن التنويعات والتحويلات الصوتية تلقائياً." },
      { title: "سجل التدقيق والامتثال", desc: "سجل تدقيق كامل لجميع عمليات الفحص مع الطوابع الزمنية وتتبع المستخدمين." },
      { title: "دعم متعدد اللغات", desc: "دعم كامل للأسماء العربية والإنجليزية مع التطبيع الذكي للنصوص." },
      { title: "تصفية متقدمة", desc: "التصفية حسب نوع الكيان والجنسية والجهة المُصدِرة وتاريخ الإدراج وغيرها." },
      { title: "إدارة متعددة الشركات", desc: "تحكم في الوصول قائم على الأدوار مع إدارة الشركات والمستخدمين." },
    ],
    footerText: "© 2026 المستشار للاستشارات القانونية. جميع الحقوق محفوظة.",
    footerSub: "مصممة للمؤسسات المالية ومتخصصي الامتثال.",
    loading: "جارٍ التحميل...",
    poweredBy: "بدعم من المستشار للاستشارات القانونية",
  },
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function Home() {
  const { isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();
  const [lang, setLang] = useState<"en" | "ar">("ar");
  const tx = t[lang];

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
          <p className="text-muted-foreground text-sm">{tx.loading}</p>
        </div>
      </div>
    );
  }

  const featureIcons = [
    { icon: <Search size={22} />, color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-100" },
    { icon: <Zap size={22} />, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-100" },
    { icon: <Lock size={22} />, color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-100" },
    { icon: <Globe size={22} />, color: "text-violet-600", bg: "bg-violet-50", border: "border-violet-100" },
    { icon: <BarChart3 size={22} />, color: "text-rose-600", bg: "bg-rose-50", border: "border-rose-100" },
    { icon: <ShieldCheck size={22} />, color: "text-indigo-600", bg: "bg-indigo-50", border: "border-indigo-100" },
  ];

  const statIcons = [
    { icon: <Globe size={18} />, color: "text-blue-600", bg: "bg-blue-50" },
    { icon: <ShieldCheck size={18} />, color: "text-emerald-600", bg: "bg-emerald-50" },
    { icon: <Zap size={18} />, color: "text-amber-600", bg: "bg-amber-50" },
    { icon: <BarChart3 size={18} />, color: "text-violet-600", bg: "bg-violet-50" },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col" dir={tx.dir} lang={tx.lang}>

      {/* ── Header ── */}
      <header className="border-b border-border bg-card sticky top-0 z-10 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">

          {/* Logo */}
          <div className="flex items-center gap-3">
            <img
              src="/almustashar-logo.png"
              alt="Al-Mustashar"
              className="h-12 w-auto object-contain"
              style={{ filter: "brightness(0) invert(0)" }}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {/* Language toggle */}
            <button
              onClick={() => setLang(lang === "en" ? "ar" : "en")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-muted/50 text-sm font-semibold text-foreground transition-colors"
              title="Switch Language"
            >
              <Globe size={14} className="text-primary" />
              {tx.toggleLang}
            </button>

            {/* Sign In */}
            <Button
              onClick={() => window.location.href = "/login"}
              className="bg-primary hover:bg-primary/90 text-white font-semibold shadow-sm"
              size="sm"
            >
              {tx.signIn}
              {lang === "en"
                ? <ChevronRight size={14} className="ml-1" />
                : <ChevronRight size={14} className="mr-1 rotate-180" />
              }
            </Button>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <main className="flex-1">
        <div className="relative overflow-hidden bg-gradient-to-br from-slate-50 via-amber-50/30 to-orange-50/20 border-b border-border">
          <div
            className="absolute inset-0 opacity-30"
            style={{
              backgroundImage:
                "radial-gradient(circle at 20% 50%, oklch(0.80 0.10 60 / 0.25) 0%, transparent 50%), radial-gradient(circle at 80% 20%, oklch(0.80 0.12 50 / 0.2) 0%, transparent 40%)",
            }}
          />
          <div className="relative max-w-5xl mx-auto px-6 py-20 text-center">

            {/* Powered by badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/30 bg-white shadow-sm text-primary text-xs font-semibold mb-6">
              <img src="/almustashar-logo.png" alt="" className="h-5 w-auto" />
              {tx.poweredBy}
            </div>

            {/* AI badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/20 bg-primary/5 text-primary text-xs font-medium mb-8 mx-2">
              <Zap size={11} className="fill-current" />
              {tx.badge}
            </div>

            {/* Title */}
            <h1 className="text-4xl md:text-6xl font-extrabold text-foreground leading-tight mb-6 tracking-tight">
              {tx.heroTitle1}
              <span className="block text-primary">{tx.heroTitle2}</span>
            </h1>

            <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-10">
              {tx.heroDesc}{" "}
              <span className="text-foreground font-bold">{tx.heroDescBold}</span>
              {tx.heroDescEnd}
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
              <Button
                onClick={() => window.location.href = "/login"}
                size="lg"
                className="bg-primary hover:bg-primary/90 text-white px-10 py-3 text-base font-bold shadow-md hover:shadow-lg transition-all"
              >
                <ShieldCheck size={18} className={lang === "en" ? "mr-2" : "ml-2"} />
                {tx.startScreening}
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="border-border bg-white text-foreground hover:bg-muted/50 px-8 py-3 text-base font-medium shadow-sm"
                onClick={() => window.location.href = "/login"}
              >
                {tx.requestDemo}
                <ArrowRight size={16} className={lang === "en" ? "ml-2" : "mr-2 rotate-180"} />
              </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {tx.stats.map((stat, i) => (
                <div key={i} className="bg-white border border-border rounded-2xl p-5 text-center shadow-sm hover:shadow-md transition-shadow">
                  <div className={`w-9 h-9 ${statIcons[i].bg} rounded-xl flex items-center justify-center mx-auto mb-3`}>
                    <span className={statIcons[i].color}>{statIcons[i].icon}</span>
                  </div>
                  <div className="text-2xl font-extrabold text-foreground tracking-tight">{stat.value}</div>
                  <div className="text-xs text-muted-foreground mt-1 font-medium">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Features ── */}
        <section className="py-20 px-6 bg-background">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-foreground tracking-tight mb-3">{tx.featuresTitle}</h2>
              <p className="text-muted-foreground max-w-xl mx-auto">{tx.featuresDesc}</p>
            </div>
            <div className="grid md:grid-cols-3 gap-5">
              {tx.features.map((f, i) => (
                <div
                  key={i}
                  className={`bg-white border ${featureIcons[i].border} rounded-2xl p-6 hover:shadow-md transition-all duration-200 group`}
                >
                  <div className={`w-11 h-11 ${featureIcons[i].bg} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                    <span className={featureIcons[i].color}>{featureIcons[i].icon}</span>
                  </div>
                  <h3 className="font-bold text-foreground mb-2 text-[15px]">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-border py-8 px-6 bg-card">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <img src="/almustashar-logo.png" alt="Al-Mustashar" className="h-10 w-auto object-contain" />
          <div className="text-center">
            <p className="text-xs text-muted-foreground">{tx.footerText}</p>
            <p className="text-xs text-muted-foreground mt-1">{tx.footerSub}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
