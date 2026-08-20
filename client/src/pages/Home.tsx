import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileText,
  Globe,
  Landmark,
  Lock,
  Mail,
  Newspaper,
  Scale,
  Search,
  ShieldCheck,
  Target,
  Users,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";

type Language = "ar" | "en";

const copy = {
  ar: {
    dir: "rtl" as const,
    languageToggle: "English",
    contact: "للتواصل",
    signIn: "تسجيل الدخول",
    badge: "منصة امتثال للقطاع المالي",
    aiBadge: "فحص العقوبات بالذكاء الاصطناعي",
    heroTitle: "منصة العقوبات اليمنية",
    heroAccent: "لفحص العقوبات والامتثال",
    heroDescription: "حل احترافي لفحص أسماء الأفراد والكيانات، ودعم إجراءات الامتثال للقطاعين المصرفي والخاص.",
    startScreening: "ابدأ الفحص",
    learnMore: "استكشف المنصة",
    stats: [
      { value: "+50,000", label: "كيان مُدرج" },
      { value: "+50", label: "جهة مُصدِرة" },
      { value: "<500ms", label: "سرعة البحث" },
      { value: "99.2%", label: "دقة المطابقة" },
    ],
    newsEyebrow: "المركز المصرفي",
    newsTitle: "أخبار وروابط مصرفية مهمة",
    newsDescription: "ملخصات منتقاة من مصادر رسمية، مع روابط مباشرة للمصدر الأصلي.",
    source: "المصدر",
    openSource: "عرض المصدر",
    previous: "السابق",
    next: "التالي",
    linksEyebrow: "خدمات وروابط",
    linksTitle: "دليل الخدمات المصرفية",
    linksDescription: "وصول مباشر إلى الخدمات والمواقع ذات الصلة بالقطاع المصرفي والتحويلات المالية في اليمن.",
    viewService: "فتح الخدمة",
    featuresEyebrow: "قدرات المنصة",
    featuresTitle: "امتثال مبني على الدقة",
    featuresDescription: "محرك فحص ثنائي اللغة مصمم لمساعدة المؤسسات على اتخاذ قرارات امتثال أكثر وضوحاً وسرعة.",
    features: [
      { title: "بحث ذكي متطور", desc: "مطابقة لغوية وصوتية تستوعب اختلاف التهجئات العربية والإنجليزية." },
      { title: "فحص معزز بالذكاء الاصطناعي", desc: "توسيع ذكي للاستعلامات للكشف عن التنويعات والتحويلات الصوتية." },
      { title: "سجل تدقيق شامل", desc: "توثيق عمليات الفحص ونتائجها للمراجعة التنظيمية." },
    ],
    aboutEyebrow: "عن المنصة",
    aboutTitle: "حل امتثال موثوق للقطاع المالي",
    aboutDescription: "تجمع منصة العقوبات اليمنية بين تقنيات البحث الذكي وإجراءات التدقيق لتقديم تجربة فحص واضحة للجهات المصرفية والقطاع الخاص.",
    values: [
      { title: "دقة قانونية", desc: "نتائج مدعومة ببيانات عقوبات موثقة ومصادر معتمدة." },
      { title: "سرية البيانات", desc: "تصميم يراعي خصوصية عمليات الفحص واحتياجات الامتثال." },
      { title: "تجربة ثنائية اللغة", desc: "واجهة عربية وإنجليزية مناسبة لبيئات العمل المصرفية." },
    ],
    ctaTitle: "هل أنت مستعد لتعزيز إجراءات الامتثال؟",
    ctaDescription: "ابدأ الفحص للوصول إلى أدوات المطابقة والتدقيق في المنصة.",
    footer: "© 2026 منصة العقوبات اليمنية. جميع الحقوق محفوظة.",
    loading: "جارٍ التحميل…",
  },
  en: {
    dir: "ltr" as const,
    languageToggle: "عربي",
    contact: "Contact",
    signIn: "Sign In",
    badge: "Compliance platform for the financial sector",
    aiBadge: "AI-powered sanctions screening",
    heroTitle: "Yemen Sanctions",
    heroAccent: "Screening & Compliance Platform",
    heroDescription: "A professional solution for screening individuals and organisations, supporting compliance procedures for banking and private-sector institutions.",
    startScreening: "Start Screening",
    learnMore: "Explore Platform",
    stats: [
      { value: "50,000+", label: "Listed entities" },
      { value: "50+", label: "Issuing bodies" },
      { value: "<500ms", label: "Search speed" },
      { value: "99.2%", label: "Match accuracy" },
    ],
    newsEyebrow: "Banking hub",
    newsTitle: "Important banking news & links",
    newsDescription: "Editor-reviewed summaries from official sources, with direct links to each original source.",
    source: "Source",
    openSource: "Open source",
    previous: "Previous",
    next: "Next",
    linksEyebrow: "Services & links",
    linksTitle: "Financial services directory",
    linksDescription: "Direct access to services and websites relevant to banking and money transfers in Yemen.",
    viewService: "Open service",
    featuresEyebrow: "Platform capabilities",
    featuresTitle: "Compliance built for precision",
    featuresDescription: "A bilingual screening engine designed to support clearer and faster compliance decisions.",
    features: [
      { title: "Intelligent fuzzy search", desc: "Linguistic and phonetic matching accommodates Arabic and English spelling variations." },
      { title: "AI-enhanced screening", desc: "Intelligent query expansion detects variants and transliterations." },
      { title: "Full audit trail", desc: "Screening operations and results are documented for regulatory review." },
    ],
    aboutEyebrow: "About the platform",
    aboutTitle: "Trusted compliance for financial institutions",
    aboutDescription: "Yemen Sanctions combines intelligent search technology and audit processes to provide a clear screening experience for banking and private-sector institutions.",
    values: [
      { title: "Legal precision", desc: "Results are supported by verified sanctions data and authoritative sources." },
      { title: "Data confidentiality", desc: "The design respects the privacy of screening workflows and compliance needs." },
      { title: "Bilingual experience", desc: "Arabic and English interfaces designed for banking work environments." },
    ],
    ctaTitle: "Ready to strengthen compliance?",
    ctaDescription: "Start screening to access the platform’s matching and audit tools.",
    footer: "© 2026 Yemen Sanctions Platform. All rights reserved.",
    loading: "Loading…",
  },
};

// Editorially curated cards: update only after reviewing the linked official source.
const financialNews = [
  {
    title: "البنك المركزي اليمني يعلن تغيير أختام فروعه",
    summary: "إعلان رسمي صادر عن البنك المركزي اليمني – المركز الرئيسي عدن ضمن أحدث مستجدات القطاع المصرفي.",
    source: "البنك المركزي اليمني",
    href: "https://cby-ye.com/",
    image: "/manus-storage/yemen-finance-central-bank_2d8621ef.jpg",
    category: "تنظيم مصرفي",
  },
  {
    title: "تعزيز الابتكار المالي في القطاع المصرفي",
    summary: "يتضمن الموقع الرسمي للبنك المركزي أخباراً عن مذكرات التفاهم والبرامج المرتبطة بالابتكار والخدمات المالية.",
    source: "البنك المركزي اليمني",
    href: "https://cby-ye.com/",
    image: "/manus-storage/yemen-finance-payments_4f08eabb.jpg",
    category: "ابتكار مالي",
  },
  {
    title: "أخبار البنوك اليمنية والخدمات المالية",
    summary: "متابعة أخبار البنوك والبرامج والخدمات المنشورة ضمن قسم بنوك يمنية، مع الرجوع دائماً إلى المصدر الأصلي للخبر.",
    source: "جمعية البنوك اليمنية",
    href: "https://yemen-yba.com/category/banksnews",
    image: "/manus-storage/yemen-finance-banking_9f0eb6a5.jpg",
    category: "قطاع البنوك",
  },
];

const importantLinks = [
  {
    title: "تتبع الحوالة",
    description: "الاستعلام عن حالة الحوالات عبر صفحة الشبكة الموحدة للأموال الرسمية.",
    href: "https://unmoneye.com/ar/remittance-tracker",
    icon: Search,
    accent: "bg-amber-50 text-amber-700 border-amber-100",
    featured: true,
  },
  {
    title: "الشبكة الموحدة للأموال",
    description: "معلومات وخدمات التحويلات المالية والمدفوعات الرقمية.",
    href: "https://unmoneye.com/ar",
    icon: Landmark,
    accent: "bg-sky-50 text-sky-700 border-sky-100",
  },
  {
    title: "البنك المركزي اليمني",
    description: "الأخبار والقرارات والروابط الرسمية للقطاع المصرفي.",
    href: "https://cby-ye.com/",
    icon: FileText,
    accent: "bg-emerald-50 text-emerald-700 border-emerald-100",
  },
  {
    title: "جمعية البنوك اليمنية",
    description: "الموارد والأخبار والتحديثات المرتبطة بالبنوك اليمنية.",
    href: "https://yba.org.ye/index.php/ar/",
    icon: Users,
    accent: "bg-violet-50 text-violet-700 border-violet-100",
  },
];

export default function Home() {
  const { isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();
  const [lang, setLang] = useState<Language>("ar");
  const [activeNews, setActiveNews] = useState(0);
  const tx = copy[lang];
  const activeItem = financialNews[activeNews];

  useEffect(() => {
    if (!loading && isAuthenticated) navigate("/search");
  }, [isAuthenticated, loading, navigate]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveNews((current) => (current + 1) % financialNews.length);
    }, 6500);
    return () => window.clearInterval(timer);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center" dir={tx.dir}>
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <div className="w-10 h-10 rounded-full border-2 border-amber-600 border-t-transparent animate-spin" />
          <p className="text-sm">{tx.loading}</p>
        </div>
      </div>
    );
  }

  const featureIcons = [Search, Zap, FileText];
  const valueIcons = [Scale, Lock, Globe];
  const directionIcon = lang === "ar" ? ArrowLeft : ArrowRight;
  const DirectionIcon = directionIcon;

  return (
    <main className="min-h-screen bg-white text-slate-900" dir={tx.dir} lang={lang}>
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-3 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <a href="mailto:info@yemen-sanctions.com" className="flex items-center justify-center gap-2 text-sm font-medium text-slate-600 transition-colors hover:text-amber-700 sm:justify-start">
            <Mail size={15} className="text-amber-600" />
            <span>{tx.contact}:</span>
            <span dir="ltr">info@yemen-sanctions.com</span>
          </a>

          <div className="flex items-center justify-between gap-3 sm:justify-end">
            <img src="/almustashar-logo.png" alt="Al-Mustashar" className="h-11 w-auto object-contain" />
            <div className="flex items-center gap-2">
              <button
                onClick={() => setLang(lang === "ar" ? "en" : "ar")}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition-colors hover:border-amber-300 hover:bg-amber-50"
              >
                <Globe size={14} className="text-amber-600" />
                {tx.languageToggle}
              </button>
              <Button onClick={() => (window.location.href = "/login")} size="sm" className="bg-amber-600 px-4 font-bold text-white hover:bg-amber-700">
                {tx.signIn}
                <ChevronRight size={14} className={lang === "ar" ? "mr-1 rotate-180" : "ml-1"} />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden border-b border-slate-100 bg-gradient-to-br from-white via-amber-50/60 to-sky-50/60">
        <div className="absolute inset-0 opacity-50" style={{ backgroundImage: "radial-gradient(circle at 12% 20%, rgba(217, 145, 10, 0.13), transparent 26%), radial-gradient(circle at 86% 16%, rgba(14, 116, 144, 0.11), transparent 22%)" }} />
        <div className="relative mx-auto max-w-6xl px-6 py-20 text-center lg:py-24">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-white px-4 py-1.5 text-xs font-bold text-amber-800 shadow-sm">
            <Scale size={13} />
            {tx.badge}
          </div>
          <div className="mb-7">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
              <Zap size={12} className="fill-current" />
              {tx.aiBadge}
            </span>
          </div>
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-slate-950 md:text-6xl">
            {tx.heroTitle}
            <span className="mt-2 block text-amber-700">{tx.heroAccent}</span>
          </h1>
          <div className="mx-auto my-7 h-1 w-16 rounded-full bg-amber-600" />
          <p className="mx-auto max-w-2xl text-base leading-8 text-slate-600 md:text-lg">{tx.heroDescription}</p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button onClick={() => (window.location.href = "/login")} size="lg" className="bg-amber-600 px-9 font-bold text-white shadow-md shadow-amber-200 hover:bg-amber-700">
              <ShieldCheck size={18} className={lang === "ar" ? "ml-2" : "mr-2"} />
              {tx.startScreening}
            </Button>
            <Button asChild variant="outline" size="lg" className="border-slate-300 bg-white px-8 font-semibold text-slate-700 hover:bg-slate-50">
              <a href="#financial-news">
                {tx.learnMore}
                <DirectionIcon size={16} className={lang === "ar" ? "mr-2" : "ml-2"} />
              </a>
            </Button>
          </div>
          <div className="mt-14 grid grid-cols-2 gap-3 text-center md:grid-cols-4 md:gap-4">
            {tx.stats.map((stat, index) => (
              <div key={stat.label} className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm md:p-5">
                <div className="mb-2 flex justify-center text-amber-600">
                  {index === 0 ? <Globe size={16} /> : index === 1 ? <ShieldCheck size={16} /> : index === 2 ? <Zap size={16} /> : <BarChart3 size={16} />}
                </div>
                <div className="text-xl font-extrabold text-slate-900 md:text-2xl">{stat.value}</div>
                <div className="mt-1 text-xs font-medium text-slate-500">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="financial-news" className="bg-white px-6 py-20 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-10 flex flex-col gap-4 text-center md:mx-auto md:max-w-2xl">
            <div className="inline-flex items-center justify-center gap-2 self-center rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800">
              <Newspaper size={13} />
              {tx.newsEyebrow}
            </div>
            <h2 className="text-3xl font-extrabold tracking-tight text-slate-950 md:text-4xl">{tx.newsTitle}</h2>
            <p className="leading-7 text-slate-600">{tx.newsDescription}</p>
          </div>

          <article className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-50 shadow-sm">
            <div className="grid min-h-[420px] md:grid-cols-2">
              <div className="relative order-2 overflow-hidden md:order-1">
                <img key={activeItem.image} src={activeItem.image} alt="" className="absolute inset-0 h-full w-full object-cover transition-opacity duration-700" />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/25 via-transparent to-transparent" />
                <div className="absolute bottom-5 left-5 rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-slate-700 shadow-sm">{activeItem.category}</div>
              </div>
              <div className="order-1 flex flex-col justify-center p-8 md:order-2 md:p-12">
                <p className="mb-4 text-xs font-bold uppercase tracking-[0.16em] text-amber-700">{tx.source}: {activeItem.source}</p>
                <h3 className="text-2xl font-extrabold leading-snug text-slate-950 md:text-3xl">{activeItem.title}</h3>
                <p className="mt-5 leading-8 text-slate-600">{activeItem.summary}</p>
                <a href={activeItem.href} target="_blank" rel="noreferrer" className="mt-7 inline-flex w-fit items-center gap-2 font-bold text-amber-700 transition-colors hover:text-amber-900">
                  {tx.openSource}
                  <ExternalLink size={16} />
                </a>
                <div className="mt-9 flex items-center justify-between border-t border-slate-200 pt-5">
                  <div className="flex gap-2">
                    {financialNews.map((item, index) => (
                      <button key={item.title} aria-label={`news-${index + 1}`} onClick={() => setActiveNews(index)} className={`h-2.5 rounded-full transition-all ${index === activeNews ? "w-7 bg-amber-600" : "w-2.5 bg-slate-300 hover:bg-slate-400"}`} />
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button aria-label={tx.previous} onClick={() => setActiveNews((activeNews - 1 + financialNews.length) % financialNews.length)} className="rounded-lg border border-slate-200 bg-white p-2 text-slate-700 hover:border-amber-300 hover:text-amber-700">
                      {lang === "ar" ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}
                    </button>
                    <button aria-label={tx.next} onClick={() => setActiveNews((activeNews + 1) % financialNews.length)} className="rounded-lg border border-slate-200 bg-white p-2 text-slate-700 hover:border-amber-300 hover:text-amber-700">
                      {lang === "ar" ? <ChevronLeft size={17} /> : <ChevronRight size={17} />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </article>
        </div>
      </section>

      <section className="border-y border-slate-100 bg-slate-50 px-6 py-20 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-10 text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-sky-50 px-3 py-1 text-xs font-bold text-sky-800"><Landmark size={13} />{tx.linksEyebrow}</div>
            <h2 className="text-3xl font-extrabold text-slate-950 md:text-4xl">{tx.linksTitle}</h2>
            <p className="mx-auto mt-4 max-w-2xl leading-7 text-slate-600">{tx.linksDescription}</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {importantLinks.map((item) => {
              const Icon = item.icon;
              return (
                <a key={item.title} href={item.href} target="_blank" rel="noreferrer" className={`group flex items-start gap-4 rounded-2xl border bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${item.featured ? "border-amber-200 ring-1 ring-amber-100" : "border-slate-200"}`}>
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${item.accent}`}><Icon size={20} /></div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-extrabold text-slate-900">{item.title}</h3>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{item.description}</p>
                    <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-amber-700">{tx.viewService}<ExternalLink size={14} /></span>
                  </div>
                </a>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-white px-6 py-20 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800"><ShieldCheck size={13} />{tx.featuresEyebrow}</div>
            <h2 className="text-3xl font-extrabold text-slate-950 md:text-4xl">{tx.featuresTitle}</h2>
            <p className="mx-auto mt-4 max-w-2xl leading-7 text-slate-600">{tx.featuresDescription}</p>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {tx.features.map((feature, index) => {
              const Icon = featureIcons[index];
              return (
                <div key={feature.title} className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm transition-shadow hover:shadow-md">
                  <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-700"><Icon size={21} /></div>
                  <h3 className="text-lg font-extrabold text-slate-900">{feature.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-slate-600">{feature.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border-y border-slate-100 bg-amber-50/55 px-6 py-20 lg:px-8">
        <div className="mx-auto grid max-w-6xl items-center gap-12 md:grid-cols-2">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-bold text-amber-800 shadow-sm"><Scale size={13} />{tx.aboutEyebrow}</div>
            <h2 className="text-3xl font-extrabold leading-snug text-slate-950 md:text-4xl">{tx.aboutTitle}</h2>
            <p className="mt-5 leading-8 text-slate-600">{tx.aboutDescription}</p>
          </div>
          <div className="grid gap-4">
            {tx.values.map((value, index) => {
              const Icon = valueIcons[index];
              return (
                <div key={value.title} className="flex gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-amber-700"><Icon size={19} /></div>
                  <div><h3 className="font-extrabold text-slate-900">{value.title}</h3><p className="mt-1 text-sm leading-6 text-slate-600">{value.desc}</p></div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-white px-6 py-20 text-center lg:px-8">
        <div className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-slate-50 px-7 py-12 shadow-sm">
          <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700"><ShieldCheck size={24} /></div>
          <h2 className="text-2xl font-extrabold text-slate-950 md:text-3xl">{tx.ctaTitle}</h2>
          <p className="mt-4 leading-7 text-slate-600">{tx.ctaDescription}</p>
          <Button onClick={() => (window.location.href = "/login")} size="lg" className="mt-8 bg-amber-600 px-9 font-bold text-white hover:bg-amber-700">
            <ShieldCheck size={18} className={lang === "ar" ? "ml-2" : "mr-2"} />{tx.startScreening}
          </Button>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white px-6 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-5 md:flex-row">
          <img src="/almustashar-logo.png" alt="Al-Mustashar" className="h-10 w-auto object-contain opacity-80" />
          <p className="text-center text-xs text-slate-500">{tx.footer}</p>
          <a href="mailto:info@yemen-sanctions.com" className="inline-flex items-center gap-2 text-sm font-bold text-amber-700 hover:text-amber-900"><Mail size={15} />info@yemen-sanctions.com</a>
        </div>
      </footer>
    </main>
  );
}
