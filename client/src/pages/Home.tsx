import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  ShieldCheck, Search, Zap, Globe, Lock,
  ChevronRight, BarChart3, ArrowRight, Scale,
  Eye, Target, Award, Users, FileText
} from "lucide-react";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";

// ─── Translations ────────────────────────────────────────────────────────────
const t = {
  en: {
    dir: "ltr" as const,
    lang: "en",
    badge: "AI-Powered Sanctions Screening",
    tagline: "Al-Mustashar for Legal Consultancy",
    heroTitle1: "International Sanctions",
    heroTitle2: "Compliance Platform",
    heroDesc: "Advanced compliance screening powered by AI-driven fuzzy matching across",
    heroDescBold: "thousands of sanctioned entities and individuals",
    heroDescEnd: ". Purpose-built for the private and banking sectors.",
    startScreening: "Start Screening",
    requestDemo: "Request a Demo",
    signIn: "Sign In",
    toggleLang: "عربي",
    stats: [
      { label: "Sanctioned Entities", value: "39,710+" },
      { label: "Issuing Bodies", value: "50+" },
      { label: "Search Speed", value: "<500ms" },
      { label: "Match Accuracy", value: "99.2%" },
    ],
    featuresTitle: "Platform Capabilities",
    featuresDesc: "Enterprise-grade compliance infrastructure engineered for precision, speed, and regulatory confidence.",
    features: [
      { title: "Intelligent Fuzzy Search", desc: "Advanced phonetic and linguistic matching tolerates spelling variations across Arabic and English names." },
      { title: "AI-Enhanced Screening", desc: "Large language models expand queries to detect name variants and transliterations automatically." },
      { title: "Full Audit Trail", desc: "Every screening operation is logged with timestamps, user identity, and result details for regulatory review." },
      { title: "Bilingual Support", desc: "Seamless screening in Arabic and English with intelligent text normalization and diacritics handling." },
      { title: "Advanced Filtering", desc: "Refine results by entity type, nationality, issuing authority, listing date, and sanction program." },
      { title: "Multi-User Management", desc: "Role-based access control with company-level administration and user activity monitoring." },
    ],
    aboutTitle: "About Al-Mustashar",
    aboutDesc: "Al-Mustashar for Legal Consultancy is a specialized legal advisory firm dedicated to supporting institutions in navigating complex compliance and regulatory frameworks. Our platform reflects our commitment to delivering precise, reliable, and legally sound compliance solutions tailored to the needs of the private and banking sectors.",
    visionTitle: "Our Vision",
    visionDesc: "To be the leading compliance intelligence partner in the Arab region, empowering institutions to operate with confidence within international legal frameworks.",
    missionTitle: "Our Mission",
    missionDesc: "To provide advanced, technology-driven compliance tools that enable institutions to identify, assess, and mitigate sanctions risks with speed, accuracy, and full regulatory alignment.",
    valuesTitle: "Our Values",
    values: [
      { title: "Legal Precision", desc: "Every result is grounded in verified, up-to-date sanctions data from authoritative international sources." },
      { title: "Confidentiality", desc: "All screening operations are conducted with the highest standards of data security and client confidentiality." },
      { title: "Innovation", desc: "We continuously integrate cutting-edge AI capabilities to stay ahead of evolving compliance requirements." },
    ],
    ctaTitle: "Ready to Strengthen Your Compliance?",
    ctaDesc: "Join institutions that trust Al-Mustashar to safeguard their operations against sanctions risk.",
    ctaBtn: "Get Started Now",
    footerText: "© 2026 Al-Mustashar for Legal Consultancy. All rights reserved.",
    footerSub: "Committed to compliance excellence across the Arab region.",
    loading: "Loading...",
  },
  ar: {
    dir: "rtl" as const,
    lang: "ar",
    badge: "فحص العقوبات بالذكاء الاصطناعي",
    tagline: "المستشار للاستشارات القانونية",
    heroTitle1: "منصة الامتثال للعقوبات",
    heroTitle2: "الدولية المتكاملة",
    heroDesc: "فحص امتثال متقدم بتقنية المطابقة الذكية عبر",
    heroDescBold: "آلاف الكيانات والأفراد المدرجين دولياً",
    heroDescEnd: ". مُصمَّمة للقطاع الخاص والمصرفي.",
    startScreening: "ابدأ الفحص",
    requestDemo: "طلب عرض تجريبي",
    signIn: "تسجيل الدخول",
    toggleLang: "English",
    stats: [
      { label: "كيان مُدرَج", value: "+39,710" },
      { label: "جهة مُصدِرة", value: "+50" },
      { label: "سرعة البحث", value: "500ms<" },
      { label: "دقة المطابقة", value: "99.2%" },
    ],
    featuresTitle: "قدرات المنصة",
    featuresDesc: "بنية تحتية للامتثال على مستوى المؤسسات، مُهندَسة للدقة والسرعة والثقة التنظيمية.",
    features: [
      { title: "بحث ذكي متطور", desc: "مطابقة صوتية ولغوية متقدمة تتسامح مع الاختلافات الإملائية في الأسماء العربية والإنجليزية." },
      { title: "فحص معزز بالذكاء الاصطناعي", desc: "نماذج لغوية كبيرة توسّع نطاق البحث للكشف عن التنويعات والتحويلات الصوتية للأسماء تلقائياً." },
      { title: "سجل تدقيق شامل", desc: "توثيق كامل لكل عملية فحص مع الطوابع الزمنية وهوية المستخدم والنتائج التفصيلية للمراجعة التنظيمية." },
      { title: "دعم ثنائي اللغة", desc: "فحص سلس بالعربية والإنجليزية مع تطبيع ذكي للنصوص ومعالجة التشكيل." },
      { title: "تصفية متقدمة", desc: "تضييق النتائج حسب نوع الكيان والجنسية والجهة المُصدِرة وتاريخ الإدراج والبرنامج العقابي." },
      { title: "إدارة متعددة المستخدمين", desc: "تحكم في الوصول قائم على الأدوار مع إدارة على مستوى الشركة ومراقبة نشاط المستخدمين." },
    ],
    aboutTitle: "عن المستشار",
    aboutDesc: "المستشار للاستشارات القانونية شركة استشارية قانونية متخصصة، تُعنى بمساعدة المؤسسات على التعامل مع الأطر التنظيمية والامتثالية المعقدة. تجسّد منصتنا التزامنا بتقديم حلول امتثال دقيقة وموثوقة ومتوافقة قانونياً، مُصمَّمة خصيصاً لاحتياجات القطاع الخاص والمصرفي.",
    visionTitle: "رؤيتنا",
    visionDesc: "أن نكون الشريك الاستراتيجي الرائد في مجال ذكاء الامتثال على مستوى المنطقة العربية، نُمكّن المؤسسات من العمل بثقة ضمن الأطر القانونية الدولية.",
    missionTitle: "رسالتنا",
    missionDesc: "تقديم أدوات امتثال متقدمة مدعومة بالتكنولوجيا، تُمكّن المؤسسات من تحديد مخاطر العقوبات وتقييمها والحدّ منها بسرعة ودقة وتوافق تنظيمي كامل.",
    valuesTitle: "قيمنا",
    values: [
      { title: "الدقة القانونية", desc: "كل نتيجة مستندة إلى بيانات عقوبات موثّقة ومحدَّثة من مصادر دولية معتمدة." },
      { title: "السرية التامة", desc: "تُجرى جميع عمليات الفحص وفق أعلى معايير أمن البيانات وسرية العملاء." },
      { title: "الابتكار المستمر", desc: "نُدمج باستمرار أحدث قدرات الذكاء الاصطناعي للبقاء في طليعة متطلبات الامتثال المتطورة." },
    ],
    ctaTitle: "هل أنت مستعد لتعزيز امتثالك؟",
    ctaDesc: "انضم إلى المؤسسات التي تثق بالمستشار لحماية عملياتها من مخاطر العقوبات.",
    ctaBtn: "ابدأ الآن",
    footerText: "© 2026 المستشار للاستشارات القانونية. جميع الحقوق محفوظة.",
    footerSub: "ملتزمون بالتميز في الامتثال عبر المنطقة العربية.",
    loading: "جارٍ التحميل...",
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
      <div className="min-h-screen bg-[#0f1923] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
          <p className="text-slate-400 text-sm">{tx.loading}</p>
        </div>
      </div>
    );
  }

  const featureIcons = [
    { icon: <Search size={20} />, color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-100" },
    { icon: <Zap size={20} />, color: "text-blue-700", bg: "bg-blue-50", border: "border-blue-100" },
    { icon: <FileText size={20} />, color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-100" },
    { icon: <Globe size={20} />, color: "text-violet-700", bg: "bg-violet-50", border: "border-violet-100" },
    { icon: <BarChart3 size={20} />, color: "text-rose-700", bg: "bg-rose-50", border: "border-rose-100" },
    { icon: <Users size={20} />, color: "text-indigo-700", bg: "bg-indigo-50", border: "border-indigo-100" },
  ];

  const statIcons = [
    { icon: <Globe size={16} />, color: "text-amber-600" },
    { icon: <ShieldCheck size={16} />, color: "text-amber-600" },
    { icon: <Zap size={16} />, color: "text-amber-600" },
    { icon: <BarChart3 size={16} />, color: "text-amber-600" },
  ];

  const valueIcons = [
    <Scale size={22} className="text-amber-600" />,
    <Lock size={22} className="text-amber-600" />,
    <Zap size={22} className="text-amber-600" />,
  ];

  return (
    <div className="min-h-screen bg-white text-[#1a1a2e] flex flex-col" dir={tx.dir} lang={tx.lang}>

      {/* ── Header ── */}
      <header className="bg-[#0f1923] sticky top-0 z-10 shadow-lg border-b border-amber-900/30">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">

          {/* Logo */}
          <div className="flex items-center gap-3">
            <img
              src="/almustashar-logo.png"
              alt="Al-Mustashar"
              className="h-12 w-auto object-contain brightness-0 invert"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setLang(lang === "en" ? "ar" : "en")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-700/50 bg-transparent hover:bg-amber-900/30 text-sm font-semibold text-amber-400 transition-colors"
            >
              <Globe size={13} />
              {tx.toggleLang}
            </button>

            <Button
              onClick={() => window.location.href = "/login"}
              className="bg-amber-600 hover:bg-amber-500 text-white font-semibold shadow-sm px-5"
              size="sm"
            >
              {tx.signIn}
              <ChevronRight size={14} className={lang === "en" ? "ml-1" : "mr-1 rotate-180"} />
            </Button>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-[#0f1923]">
        {/* Decorative background */}
        <div className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: "radial-gradient(ellipse at 20% 60%, oklch(0.65 0.18 60 / 0.4) 0%, transparent 55%), radial-gradient(ellipse at 80% 30%, oklch(0.55 0.12 250 / 0.3) 0%, transparent 50%)",
          }}
        />
        {/* Subtle grid pattern */}
        <div className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />

        <div className="relative max-w-5xl mx-auto px-6 py-24 text-center">

          {/* Tagline badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-amber-600/40 bg-amber-900/20 text-amber-400 text-xs font-semibold mb-5 tracking-wide uppercase">
            <img src="/almustashar-logo.png" alt="" className="h-4 w-auto brightness-0 invert opacity-80" />
            {tx.tagline}
          </div>

          {/* AI badge */}
          <div className="block mb-8">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-900/30 border border-blue-700/30 text-blue-300 text-xs font-medium">
              <Zap size={10} className="fill-current" />
              {tx.badge}
            </span>
          </div>

          {/* Title */}
          <h1 className="text-4xl md:text-6xl font-extrabold text-white leading-tight mb-6 tracking-tight">
            {tx.heroTitle1}
            <span className="block text-amber-500 mt-1">{tx.heroTitle2}</span>
          </h1>

          {/* Divider line */}
          <div className="w-16 h-0.5 bg-amber-600 mx-auto mb-8 rounded-full" />

          <p className="text-base md:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed mb-10">
            {tx.heroDesc}{" "}
            <span className="text-amber-400 font-bold">{tx.heroDescBold}</span>
            {tx.heroDescEnd}
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Button
              onClick={() => window.location.href = "/login"}
              size="lg"
              className="bg-amber-600 hover:bg-amber-500 text-white px-10 py-3 text-base font-bold shadow-lg hover:shadow-amber-900/40 transition-all"
            >
              <ShieldCheck size={18} className={lang === "en" ? "mr-2" : "ml-2"} />
              {tx.startScreening}
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="border-slate-600 bg-transparent text-slate-200 hover:bg-slate-800 px-8 py-3 text-base font-medium"
              onClick={() => window.location.href = "/login"}
            >
              {tx.requestDemo}
              <ArrowRight size={16} className={lang === "en" ? "ml-2" : "mr-2 rotate-180"} />
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {tx.stats.map((stat, i) => (
              <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-5 text-center backdrop-blur-sm hover:bg-white/8 transition-colors">
                <div className="flex items-center justify-center mb-2">
                  <span className={statIcons[i].color}>{statIcons[i].icon}</span>
                </div>
                <div className="text-2xl font-extrabold text-white tracking-tight">{stat.value}</div>
                <div className="text-xs text-slate-400 mt-1 font-medium">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="py-20 px-6 bg-slate-50 border-t border-slate-100">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold mb-4 uppercase tracking-wide">
              <Award size={12} />
              {lang === "ar" ? "قدرات متقدمة" : "Advanced Capabilities"}
            </div>
            <h2 className="text-3xl font-bold text-[#0f1923] tracking-tight mb-3">{tx.featuresTitle}</h2>
            <p className="text-slate-500 max-w-xl mx-auto text-sm leading-relaxed">{tx.featuresDesc}</p>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {tx.features.map((f, i) => (
              <div
                key={i}
                className={`bg-white border ${featureIcons[i].border} rounded-2xl p-6 hover:shadow-md transition-all duration-200 group`}
              >
                <div className={`w-10 h-10 ${featureIcons[i].bg} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <span className={featureIcons[i].color}>{featureIcons[i].icon}</span>
                </div>
                <h3 className="font-bold text-[#0f1923] mb-2 text-[15px]">{f.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── About Us ── */}
      <section className="py-20 px-6 bg-white border-t border-slate-100">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            {/* Text */}
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0f1923] text-amber-400 text-xs font-semibold mb-5 uppercase tracking-wide">
                <Scale size={12} />
                {tx.aboutTitle}
              </div>
              <h2 className="text-3xl font-bold text-[#0f1923] mb-5 leading-snug">
                {lang === "ar"
                  ? "خبرة قانونية راسخة في خدمة الامتثال"
                  : "Deep Legal Expertise in Service of Compliance"
                }
              </h2>
              <p className="text-slate-600 leading-relaxed text-[15px]">{tx.aboutDesc}</p>
            </div>

            {/* Vision & Mission cards */}
            <div className="flex flex-col gap-4">
              <div className="bg-[#0f1923] rounded-2xl p-6 text-white">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 bg-amber-600/20 rounded-xl flex items-center justify-center">
                    <Eye size={18} className="text-amber-400" />
                  </div>
                  <h3 className="font-bold text-amber-400 text-sm uppercase tracking-wide">{tx.visionTitle}</h3>
                </div>
                <p className="text-slate-300 text-sm leading-relaxed">{tx.visionDesc}</p>
              </div>

              <div className="bg-amber-600 rounded-2xl p-6 text-white">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
                    <Target size={18} className="text-white" />
                  </div>
                  <h3 className="font-bold text-white text-sm uppercase tracking-wide">{tx.missionTitle}</h3>
                </div>
                <p className="text-amber-100 text-sm leading-relaxed">{tx.missionDesc}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Values ── */}
      <section className="py-16 px-6 bg-slate-50 border-t border-slate-100">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-bold text-[#0f1923] mb-2">{tx.valuesTitle}</h2>
            <div className="w-10 h-0.5 bg-amber-600 mx-auto rounded-full" />
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {tx.values.map((v, i) => (
              <div key={i} className="text-center p-6 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="w-12 h-12 bg-amber-50 border border-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  {valueIcons[i]}
                </div>
                <h3 className="font-bold text-[#0f1923] mb-2 text-[15px]">{v.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section className="py-16 px-6 bg-[#0f1923]">
        <div className="max-w-3xl mx-auto text-center">
          <div className="w-12 h-12 bg-amber-600/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <ShieldCheck size={24} className="text-amber-500" />
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">{tx.ctaTitle}</h2>
          <p className="text-slate-400 mb-8 text-[15px] leading-relaxed">{tx.ctaDesc}</p>
          <Button
            onClick={() => window.location.href = "/login"}
            size="lg"
            className="bg-amber-600 hover:bg-amber-500 text-white px-10 font-bold shadow-lg"
          >
            <ShieldCheck size={18} className={lang === "en" ? "mr-2" : "ml-2"} />
            {tx.ctaBtn}
          </Button>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-[#080e15] border-t border-white/5 py-8 px-6">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <img
            src="/almustashar-logo.png"
            alt="Al-Mustashar"
            className="h-10 w-auto object-contain brightness-0 invert opacity-70"
          />
          <div className="text-center">
            <p className="text-xs text-slate-500">{tx.footerText}</p>
            <p className="text-xs text-slate-600 mt-1">{tx.footerSub}</p>
          </div>
        </div>
      </footer>

    </div>
  );
}
