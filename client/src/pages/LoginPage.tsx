import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Eye, EyeOff, Shield, Lock, User } from "lucide-react";

const LOGO_URL =
  "https://private-us-east-1.manuscdn.com/user_upload_by_module/session_file/310519663202837783/VEZYpFzPPlUnNXXB.png?Expires=1803987046&Signature=dSkdEkym0CnCrZ~xvHutowDJvaXvfh1IYw0fGrbQwWaAjL5vmswDwRF9-TfTOh4xH2P2YcrXfjAFiQEXpzpyJ2mqD~wqvBlPtta~nzxh~YHN1GaX33XlFKB-QK6Itc1~EgF3UTZlpRjoh7HmuR63-HoVVdbNXHhjMKtREACYojEsDOCBjCNg3EXLc2CmNt6~EztnE0p9uCZUuJ~JbxGil38c-4Y7yMm7sR3PqqnZKS5LoBot0KoQhuy1r63lSwudqL-6fHPYJBZfN3I9OHLYH5ez7NVfKDC26lKQ-z5kcKIB-LbwVUzb57AKcXIopP8YdmPNF4kmrI1jt1qTN21iKw__&Key-Pair-Id=K2HSFNDJXOU9YS";

export default function LoginPage() {
  const [, navigate] = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const loginMutation = trpc.auth.loginWithPassword.useMutation({
    onSuccess: () => {
      toast.success("تم تسجيل الدخول بنجاح");
      // Reload to refresh auth state
      window.location.href = "/search";
    },
    onError: (err) => {
      if (err.data?.code === "UNAUTHORIZED") {
        toast.error("اسم المستخدم أو كلمة المرور غير صحيحة");
      } else if (err.data?.code === "FORBIDDEN") {
        toast.error("الحساب معطّل. تواصل مع المدير");
      } else {
        toast.error("حدث خطأ أثناء تسجيل الدخول");
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      toast.error("يرجى إدخال اسم المستخدم وكلمة المرور");
      return;
    }
    loginMutation.mutate({ username: username.trim(), password });
  };

  return (
    <div className="min-h-screen flex" style={{ background: "linear-gradient(135deg, #fdf8f0 0%, #f5e6d0 100%)" }}>
      {/* Left Panel - Branding */}
      <div
        className="hidden lg:flex flex-col justify-between w-1/2 p-12 text-white"
        style={{ background: "linear-gradient(160deg, #1a0f00 0%, #3d2000 50%, #7a4a10 100%)" }}
      >
        <div>
          <div className="w-48 bg-white rounded-xl p-3 mb-12">
            <img src={LOGO_URL} alt="المستشار" className="w-full h-auto object-contain" />
          </div>
          <h1 className="text-4xl font-bold mb-4 leading-tight">
            منصة فحص العقوبات
            <br />
            <span style={{ color: "#C17F3E" }}>الدولية</span>
          </h1>
          <p className="text-amber-100 text-lg leading-relaxed">
            نظام بحث ذكي متكامل لفحص الأسماء والكيانات مقابل قوائم العقوبات الدولية مع دعم الذكاء الصناعي ومعالجة الأخطاء الإملائية.
          </p>
        </div>

        <div className="space-y-4">
          {[
            { icon: Shield, text: "39,710+ سجل في قاعدة البيانات" },
            { icon: Lock, text: "بحث ذكي مع معالجة الأخطاء الإملائية" },
            { icon: User, text: "سجل تدقيق شامل لجميع العمليات" },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-3 text-amber-100">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "rgba(193,127,62,0.25)" }}>
                <Icon className="w-4 h-4" style={{ color: "#C17F3E" }} />
              </div>
              <span className="text-sm">{text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden flex justify-center mb-8">
            <div className="w-36 bg-white rounded-xl p-3 shadow-md">
              <img src={LOGO_URL} alt="المستشار" className="w-full h-auto object-contain" />
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-xl border p-8" style={{ borderColor: "#e8d5b7" }}>
            <div className="mb-8">
              <h2 className="text-2xl font-bold mb-1" style={{ color: "#3d2000" }}>تسجيل الدخول</h2>
              <p className="text-slate-500 text-sm">أدخل بيانات حسابك للوصول إلى المنصة</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5" dir="rtl">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-slate-700 font-medium">
                  اسم المستخدم
                </Label>
                <div className="relative">
                  <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    id="username"
                    type="text"
                    placeholder="أدخل اسم المستخدم"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="pr-10 text-right"
                    style={{ borderColor: "#e8d5b7" }}
                    autoComplete="username"
                    disabled={loginMutation.isPending}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-700 font-medium">
                  كلمة المرور
                </Label>
                <div className="relative">
                  <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="أدخل كلمة المرور"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pr-10 pl-10 text-right"
                    style={{ borderColor: "#e8d5b7" }}
                    autoComplete="current-password"
                    disabled={loginMutation.isPending}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-11 text-base font-semibold text-white"
                style={{ background: "linear-gradient(135deg, #C17F3E, #a06830)" }}
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    جاري تسجيل الدخول...
                  </span>
                ) : (
                  "تسجيل الدخول"
                )}
              </Button>
            </form>

            <div className="mt-6 pt-6 border-t text-center" style={{ borderColor: "#f0e0c8" }}>
              <p className="text-xs text-slate-400">
                المستشار للاستشارات القانونية &copy; {new Date().getFullYear()}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                منصة فحص العقوبات الدولية
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
