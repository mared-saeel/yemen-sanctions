/**
 * كشف لغة النص (عربي أم إنجليزي)
 */

/**
 * كشف ما إذا كان النص يحتوي على أحرف عربية
 */
export function isArabic(text: string): boolean {
  const arabicRegex = /[\u0600-\u06FF]/g;
  return arabicRegex.test(text);
}

/**
 * كشف ما إذا كان النص يحتوي على أحرف إنجليزية
 */
export function isEnglish(text: string): boolean {
  const englishRegex = /[a-zA-Z]/g;
  return englishRegex.test(text);
}

/**
 * تحديد لغة الاستعلام الرئيسية
 * يعود "ar" إذا كان النص عربياً بشكل أساسي
 * يعود "en" إذا كان النص إنجليزياً بشكل أساسي
 * يعود "mixed" إذا كان النص يحتوي على كلا اللغتين
 */
export function detectLanguage(text: string): "ar" | "en" | "mixed" {
  const cleanText = text.trim();
  
  const hasArabic = isArabic(cleanText);
  const hasEnglish = isEnglish(cleanText);
  
  if (hasArabic && hasEnglish) {
    return "mixed";
  } else if (hasArabic) {
    return "ar";
  } else if (hasEnglish) {
    return "en";
  }
  
  // إذا لم يكن هناك أحرف عربية أو إنجليزية، افترض إنجليزي
  return "en";
}

/**
 * حساب نسبة الأحرف العربية في النص
 */
export function getArabicPercentage(text: string): number {
  const arabicChars = (text.match(/[\u0600-\u06FF]/g) || []).length;
  const totalChars = text.replace(/\s/g, "").length;
  
  if (totalChars === 0) return 0;
  return (arabicChars / totalChars) * 100;
}

/**
 * حساب نسبة الأحرف الإنجليزية في النص
 */
export function getEnglishPercentage(text: string): number {
  const englishChars = (text.match(/[a-zA-Z]/g) || []).length;
  const totalChars = text.replace(/\s/g, "").length;
  
  if (totalChars === 0) return 0;
  return (englishChars / totalChars) * 100;
}
