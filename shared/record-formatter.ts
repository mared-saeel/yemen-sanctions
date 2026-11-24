/**
 * Shared sanctions-record presenter.
 *
 * Source lists store nested data (OFAC JSON, UK/EU/UN XML) as flattened text in
 * `rawNotes`, `listingReason` and `legalBasis`. This module turns that text into
 * clean, structured sections that are rendered identically by the platform UI
 * and the PDF report. It never mutates the record and never changes identifiers;
 * the raw source text remains available unchanged for audit purposes.
 */

export interface SanctionsRecordInput {
  nameEn?: string | null;
  nameAr?: string | null;
  entityType?: string | null;
  listingDate?: string | null;
  listingReason?: string | null;
  issuingBody?: string | null;
  legalBasis?: string | null;
  actionTaken?: string | null;
  nationality?: string | null;
  dateOfBirth?: string | null;
  placeOfBirth?: string | null;
  alternativeNames?: unknown;
  notes?: string | null;
  referenceNumber?: string | null;
  rawNotes?: string | null;
}

export interface LabelledValue {
  key: string;
  labelEn: string;
  labelAr: string;
  value: string;
}

export interface ActionItem {
  /** Arabic wording when available. */
  ar: string | null;
  /** English wording or source qualifier (for example "Block"). */
  en: string | null;
}

export interface IdentityDocument {
  type: string;
  typeAr: string | null;
  number: string;
  country: string | null;
  issueDate: string | null;
  details: string | null;
  valid: boolean | null;
}

export interface Relationship {
  type: string;
  entity: string;
}

export interface FormattedSanctionsRecord {
  listingDate: string | null;
  listingContext: LabelledValue[];
  actions: ActionItem[];
  personal: {
    nationality: string | null;
    dateOfBirth: string | null;
    placeOfBirth: string | null;
    gender: string | null;
  };
  aliases: string[];
  identityDocuments: IdentityDocument[];
  addresses: string[];
  additionalInfo: LabelledValue[];
  relationships: Relationship[];
  notes: string[];
}

/* ───────────────────────────── text helpers ───────────────────────────── */

const BIDI_CONTROLS = /[\u200E\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g;
const EMPTY_VALUES = new Set(["", "-", "—", "–", "none", "null", "n/a", "na", "unknown", "undefined", "()", "[]"]);

/** Removes invisible direction marks, repairs mis-escaped labels and normalises spacing. */
export function cleanText(value: unknown, keepNewlines = false): string {
  if (value === null || value === undefined) return "";
  let text = String(value)
    .replace(BIDI_CONTROLS, "")
    .replace(/â\u0080[\u0080-\u00BF]/g, " ")
    .replace(/\\1d\b/g, "ID")
    .replace(/\\1ranslation/g, "Translation")
    .replace(/\r\n?/g, "\n")
    .replace(/\(\s*\)/g, " ")
    .replace(/\[\s*\]/g, " ");
  text = keepNewlines
    ? text.split("\n").map((line) => line.replace(/[ \t]+/g, " ").trim()).filter(Boolean).join("\n")
    : text.replace(/\s+/g, " ");
  return text
    .replace(/\s+([,،؛;.])/g, "$1")
    .replace(/,\s*,+/g, ",")
    .replace(/^[\s,،؛;|:]+|[\s,،؛;|:]+$/g, "")
    .trim();
}

function isEmptyValue(value: string | null | undefined): boolean {
  if (!value) return true;
  return EMPTY_VALUES.has(cleanText(value).toLowerCase());
}

function valueOrNull(value: unknown): string | null {
  const text = cleanText(value);
  return isEmptyValue(text) ? null : text;
}

function hasArabic(text: string): boolean {
  return /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text);
}

function dedupeKey(text: string): string {
  return cleanText(text).toLowerCase().replace(/["'“”‘’`]/g, "").replace(/[\s.,;:،؛-]+/g, " ").trim();
}

function pushUnique(list: string[], value: string | null | undefined) {
  const text = valueOrNull(value);
  if (!text) return;
  const key = dedupeKey(text);
  if (!list.some((item) => dedupeKey(item) === key)) list.push(text);
}

/** Normalises dates such as `27/5/2021م`, `19\10\2026` and `dd/mm/1951`. */
export function normalizeDateText(value: unknown): string | null {
  let text = valueOrNull(value);
  if (!text) return null;
  text = text
    .replace(/\\/g, "/")
    .replace(/(\d)\s*م(?=$|[\s,،;؛)])/g, "$1")
    .replace(/\bdd\/mm\/(\d{4})\b/gi, "$1")
    .replace(/\bmm\/(\d{4})\b/gi, "$1")
    .replace(/\s*;\s*/g, " / ");
  return cleanText(text) || null;
}

/** Splits a key/value fragment at its first colon when the key is a short label. */
function splitKeyValue(part: string, maxKeyLength = 60): { key: string; value: string } | null {
  const index = part.indexOf(":");
  if (index <= 0) return null;
  const key = part.slice(0, index).trim();
  if (!key || key.length > maxKeyLength) return null;
  return { key: normalizeKey(key), value: part.slice(index + 1).replace(/^:+/, "").trim() };
}

function normalizeKey(key: string): string {
  return cleanText(key).replace(/[:\s-]+$/g, "").replace(/\s+/g, " ").trim();
}

/* ───────────────────────────── dictionaries ───────────────────────────── */

type Category =
  | "address" | "addresses" | "dob" | "pob" | "nationality" | "gender" | "alias" | "aliasList"
  | "reference" | "note" | "reason" | "relationList" | "relation" | "docList" | "docPair" | "docValue"
  | "container" | "skip" | "info" | "unSeparated";

interface KeySpec { cat: Category; en?: string; ar?: string }

const KEY_SPECS: Record<string, KeySpec> = {
  // Addresses
  "العنوان": { cat: "address" },
  "address": { cat: "address" },
  "address country": { cat: "address" },
  "الموقع": { cat: "address" },
  "العناوين": { cat: "addresses" },
  "العناوين المعروفة": { cat: "addresses" },
  "addresses": { cat: "addresses" },
  // Personal data
  "تاريخ الميلاد": { cat: "dob" },
  "تواريخ الميلاد": { cat: "dob" },
  "birthdate": { cat: "dob" },
  "date of birth": { cat: "dob" },
  "مكان الميلاد": { cat: "pob" },
  "أماكن الميلاد": { cat: "pob" },
  "place of birth": { cat: "pob" },
  "الجنسية": { cat: "nationality" },
  "الجنسيات": { cat: "nationality" },
  "nationality country": { cat: "nationality" },
  "citizenship country": { cat: "nationality" },
  "nationality": { cat: "nationality" },
  "الجنس": { cat: "gender" },
  "gender": { cat: "gender" },
  // Names
  "أسماء بديلة": { cat: "aliasList" },
  "الأسماء البديلة": { cat: "aliasList" },
  "الأسماء البديلة/الألقاب": { cat: "aliasList" },
  "الاسم المستعار/البديل": { cat: "aliasList" },
  "aliases": { cat: "aliasList" },
  "aka": { cat: "aliasList" },
  // References
  "الرقم المرجعي": { cat: "reference" },
  "الرقم المرجعي (id)": { cat: "reference" },
  "المرجع الأوروبي": { cat: "reference" },
  "المعرف الفريد (unique id)": { cat: "reference" },
  // Narrative
  "ملاحظات": { cat: "note" },
  "ملاحظات إضافية": { cat: "note" },
  "معلومات": { cat: "note" },
  "معلومات إضافية": { cat: "note" },
  "معلومات أخرى": { cat: "note" },
  "التعليقات": { cat: "note" },
  "البيانات": { cat: "note" },
  "بيان الأسباب": { cat: "reason" },
  // Relationships
  "الارتباطات": { cat: "relationList" },
  "علاقة": { cat: "relation" },
  // Identity documents
  "وثائق الهوية": { cat: "docList" },
  "وثيقة/رقم هوية": { cat: "docPair" },
  "وثيقة/رقم تعريف": { cat: "docPair" },
  "رقم الجواز": { cat: "docValue", en: "Passport", ar: "جواز سفر" },
  "رقم المعرف الوطني": { cat: "docValue", en: "National ID No.", ar: "رقم الهوية الوطنية" },
  "registration number": { cat: "docValue", en: "Registration Number", ar: "رقم التسجيل" },
  "business registration number": { cat: "docValue", en: "Business Registration Number", ar: "رقم السجل التجاري" },
  "commercial registry number": { cat: "docValue", en: "Commercial Registry Number", ar: "رقم السجل التجاري" },
  "tax id no.": { cat: "docValue", en: "Tax ID No.", ar: "الرقم الضريبي" },
  "tax id no": { cat: "docValue", en: "Tax ID No.", ar: "الرقم الضريبي" },
  "identification number": { cat: "docValue", en: "Identification Number", ar: "رقم التعريف" },
  "company number": { cat: "docValue", en: "Company Number", ar: "رقم الشركة" },
  "national id no.": { cat: "docValue", en: "National ID No.", ar: "رقم الهوية الوطنية" },
  "passport": { cat: "docValue", en: "Passport", ar: "جواز سفر" },
  "أرقام جوازات السفر": { cat: "docValue", en: "Passport", ar: "جواز سفر" },
  "أرقام الهوية الوطنية": { cat: "docValue", en: "National ID No.", ar: "رقم الهوية الوطنية" },
  "أرقام الوثائق": { cat: "docValue", en: "Document Number", ar: "رقم الوثيقة" },
  // Containers and technical fields
  "البيانات التفصيلية": { cat: "container" },
  "رابط الإنتربول": { cat: "skip" },
  "الحالة": { cat: "info", en: "Status", ar: "الحالة" },
  "المنصب": { cat: "info", en: "Position", ar: "المنصب" },
  "رقم الهاتف": { cat: "info", en: "Phone Number", ar: "رقم الهاتف" },
  "البريد الإلكتروني": { cat: "info", en: "Email Address", ar: "البريد الإلكتروني" },
  "email address": { cat: "info", en: "Email Address", ar: "البريد الإلكتروني" },
  "website": { cat: "info", en: "Website", ar: "الموقع الإلكتروني" },
  "organization established date": { cat: "info", en: "Organization Established Date", ar: "تاريخ تأسيس الكيان" },
  "organization type": { cat: "info", en: "Organization Type", ar: "نوع الكيان" },
  "secondary sanctions risk": { cat: "info", en: "Secondary Sanctions Risk", ar: "مخاطر العقوبات الثانوية" },
  "additional sanctions information": { cat: "info", en: "Additional Sanctions Information", ar: "معلومات عقوبات إضافية" },
  "target type": { cat: "info", en: "Target Type", ar: "نوع الهدف" },
  "vessel type": { cat: "info", en: "Vessel Type", ar: "نوع السفينة" },
  "vessel flag": { cat: "info", en: "Vessel Flag", ar: "علم السفينة" },
  "vessel year of build": { cat: "info", en: "Vessel Year of Build", ar: "سنة بناء السفينة" },
  "vessel owner": { cat: "info", en: "Vessel Owner", ar: "مالك السفينة" },
  "vessel call sign": { cat: "info", en: "Vessel Call Sign", ar: "رمز نداء السفينة" },
  "vessel registration identification": { cat: "info", en: "Vessel Registration Identification", ar: "رقم تسجيل السفينة" },
  "hkaa section 6 information": { cat: "info", en: "HKAA Section 6 Information", ar: "معلومات المادة 6 من قانون HKAA" },
  "paipa section 2 information": { cat: "info", en: "PAIPA Section 2 Information", ar: "معلومات المادة 2 من قانون PAIPA" },
  "swift/bic": { cat: "info", en: "SWIFT/BIC", ar: "رمز السويفت" },
  "vessel gross registered tonnage": { cat: "info", en: "Vessel Gross Registered Tonnage", ar: "الحمولة الإجمالية المسجلة" },
  "vessel tonnage": { cat: "info", en: "Vessel Tonnage", ar: "حمولة السفينة" },
  "former vessel flag": { cat: "info", en: "Former Vessel Flag", ar: "العلم السابق للسفينة" },
  "aircraft model": { cat: "info", en: "Aircraft Model", ar: "طراز الطائرة" },
  "aircraft operator": { cat: "info", en: "Aircraft Operator", ar: "مشغّل الطائرة" },
  "aircraft tail number": { cat: "info", en: "Aircraft Tail Number", ar: "رقم ذيل الطائرة" },
  "previous aircraft tail number": { cat: "info", en: "Previous Aircraft Tail Number", ar: "رقم الذيل السابق" },
  "aircraft manufacture date": { cat: "info", en: "Aircraft Manufacture Date", ar: "تاريخ صنع الطائرة" },
  "aircraft manufacturer's serial number (msn)": { cat: "info", en: "Aircraft Manufacturer's Serial Number (MSN)", ar: "الرقم التسلسلي للطائرة" },
  "registration country": { cat: "info", en: "Registration Country", ar: "دولة التسجيل" },
  "nationality of registration": { cat: "info", en: "Nationality of Registration", ar: "جنسية التسجيل" },
  "phone number": { cat: "info", en: "Phone Number", ar: "رقم الهاتف" },
};

const DOC_TYPE_AR: Record<string, string> = {
  "passport": "جواز سفر",
  "national passport": "جواز سفر وطني",
  "diplomatic passport": "جواز سفر دبلوماسي",
  "national id no.": "رقم الهوية الوطنية",
  "national id number": "رقم الهوية الوطنية",
  "national identification number": "رقم الهوية الوطنية",
  "business registration number": "رقم السجل التجاري",
  "commercial registry number": "رقم السجل التجاري",
  "registration number": "رقم التسجيل",
  "registration id": "رقم التسجيل",
  "license": "رخصة تجارية",
  "tax id no.": "الرقم الضريبي",
  "company number": "رقم الشركة",
  "identification number": "رقم التعريف",
  "other identification number": "رقم تعريف آخر",
  "cedula no.": "رقم الهوية",
  "folio mercantil no.": "رقم السجل التجاري",
  "vessel registration identification": "رقم تسجيل السفينة",
  "driver's license no.": "رخصة القيادة",
  "residency number": "رقم الإقامة",
};

const ACTION_AR: Record<string, string> = {
  "asset freeze": "تجميد الأصول",
  "travel ban": "حظر السفر",
  "arms embargo": "حظر الأسلحة",
  "director disqualification sanction": "حظر تولي إدارة الشركات",
  "trust services sanctions": "حظر خدمات الائتمان",
  "chartering of ships": "حظر استئجار السفن",
  "closure of representative offices": "إغلاق المكاتب التمثيلية",
  "crew servicing of ships and aircraft": "حظر خدمات الطواقم للسفن والطائرات",
  "prevention of business arrangements": "منع الترتيبات التجارية",
  "prohibition of port entry": "حظر دخول الموانئ",
  "shipping sanctions": "عقوبات الشحن",
  "transport sanctions": "عقوبات النقل",
  "internet services sanctions": "حظر خدمات الإنترنت",
  "targeted arms embargo": "حظر أسلحة محدد الهدف",
  "technical assistance related to aircraft": "حظر المساعدة الفنية المتعلقة بالطائرات",
  "prohibition on correspondent banking relationships and processing payments": "حظر علاقات المراسلة المصرفية ومعالجة المدفوعات",
  "correspondent banking sanctions and processing payments": "حظر علاقات المراسلة المصرفية ومعالجة المدفوعات",
  "de-flag": "سحب علم السفينة",
  "shipping & trade sanctions": "عقوبات الشحن والتجارة",
  "block": "تجميد الأموال والأصول",
};

/** Technical keys from source files that carry no compliance meaning. */
const TECHNICAL_KEY = /معرّف|معرف العنوان|المعرّف|نظام الكتابة|جودة منخفضة|^أساسي$|التاريخ تقريبي|التاريخ نطاق زمني|تفاصيل التاريخ|بداية النهاية|نهاية الفترة|Name ID|Translation ID|^ID$/i;

function specFor(key: string): KeySpec | undefined {
  const normal = normalizeKey(key).toLowerCase();
  if (KEY_SPECS[normal]) return KEY_SPECS[normal];
  if (/^digital currency address/.test(normal)) {
    const currency = normalizeKey(key).split("-").pop()?.trim() ?? "";
    return { cat: "info", en: `Digital Currency Address - ${currency}`, ar: `عنوان عملة رقمية - ${currency}` };
  }
  return undefined;
}

/* ───────────────────────────── accumulator ───────────────────────────── */

interface Accumulator {
  addresses: string[];
  dob: string[];
  pob: string[];
  nationality: string[];
  gender: string[];
  aliases: string[];
  references: string[];
  notes: string[];
  reasons: string[];
  relationships: Relationship[];
  docs: IdentityDocument[];
  info: LabelledValue[];
}

function newAccumulator(): Accumulator {
  return { addresses: [], dob: [], pob: [], nationality: [], gender: [], aliases: [], references: [], notes: [], reasons: [], relationships: [], docs: [], info: [] };
}

function addInfo(acc: Accumulator, key: string, value: string, spec?: KeySpec) {
  const text = valueOrNull(value);
  if (!text || /^(true|false)$/i.test(text)) return;
  const labelEn = spec?.en ?? normalizeKey(key);
  const labelAr = spec?.ar ?? (hasArabic(labelEn) ? labelEn : "");
  const existing = acc.info.find((item) => item.labelEn === labelEn);
  if (existing) {
    if (!existing.value.split("\n").some((line) => dedupeKey(line) === dedupeKey(text))) existing.value += `\n${text}`;
    return;
  }
  acc.info.push({ key: labelEn.toLowerCase(), labelEn, labelAr, value: text });
}

function addDoc(acc: Accumulator, doc: Partial<IdentityDocument> & { type: string; number: string }) {
  // Lists such as "YB7731256, AP628498" or "M408665 | BNSDLA70L14Z352B" hold several documents.
  const numbers = cleanText(doc.number).split(/\s*(?:,|\||؛|;)\s*/).filter(Boolean);
  if (numbers.length > 1 && numbers.every((n) => /^[A-Z0-9./-]{4,}$/i.test(n))) {
    numbers.forEach((number) => addSingleDoc(acc, { ...doc, number }));
    return;
  }
  addSingleDoc(acc, doc);
}

function addSingleDoc(acc: Accumulator, doc: Partial<IdentityDocument> & { type: string; number: string }) {
  const type = cleanText(doc.type);
  const number = cleanText(doc.number);
  if (!type || !number) return;
  const existing = acc.docs.find((item) => item.type.toLowerCase() === type.toLowerCase() && item.number === number);
  if (existing) {
    existing.country ||= doc.country ?? null;
    existing.issueDate ||= doc.issueDate ?? null;
    existing.details ||= doc.details ?? null;
    return;
  }
  acc.docs.push({
    type,
    typeAr: doc.typeAr ?? DOC_TYPE_AR[type.toLowerCase()] ?? null,
    number,
    country: valueOrNull(doc.country),
    issueDate: normalizeDateText(doc.issueDate),
    details: valueOrNull(doc.details),
    valid: doc.valid ?? null,
  });
}

/** Splits OFAC alias lists where commas separate both names and "SURNAME, Given". */
export function splitNameList(value: string): string[] {
  const text = cleanText(value);
  if (!text) return [];
  if (text.includes(";")) return text.split(";").map(cleanAliasName).filter(Boolean);
  const parts = text.split(/\s*,\s*/).filter(Boolean);
  const names: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    const current = parts[i];
    const next = parts[i + 1];
    const currentIsSurname = !/[a-z]/.test(current) && /[A-Z]/.test(current);
    if (next && currentIsSurname && /[a-z]/.test(next)) {
      names.push(`${current}, ${next}`);
      i++;
    } else {
      names.push(current);
    }
  }
  return names.map(cleanAliasName).filter(Boolean);
}

function cleanAliasName(name: string): string {
  return cleanText(
    name
      .replace(/\[(?:a\.k\.a\.|f\.k\.a\.|n\.k\.a\.)\]/gi, " ")
      .replace(/\(\s*[A-Z]{2}\s*\)/g, " ")
      .replace(/\(\s*\)/g, " "),
  );
}

function parseAddressValue(acc: Accumulator, value: string) {
  const text = cleanText(value, true).replace(/\n/g, " ");
  if (!text) return;
  // UNSC style: "City: X; Country: Y"
  if (/\b(?:City|Country|Street|State\/Province|Note)\s*:/i.test(text)) {
    let current: string[] = [];
    const seen = new Set<string>();
    const flush = () => {
      if (current.length) pushUnique(acc.addresses, current.join(", "));
      current = [];
      seen.clear();
    };
    for (const piece of text.split(/\s*;\s*/)) {
      const pair = splitKeyValue(piece);
      if (!pair) continue;
      const k = pair.key.toLowerCase();
      if (seen.has(k)) flush();
      seen.add(k);
      if (pair.value && !isEmptyValue(pair.value)) current.push(pair.value);
    }
    flush();
    return;
  }
  for (const piece of text.split(/\s*;\s*/)) {
    const address = cleanText(piece.replace(/^\((.*)\)$/, "$1"));
    if (address && !isEmptyValue(address)) pushUnique(acc.addresses, address);
  }
}

function parseDocList(acc: Accumulator, value: string) {
  for (const piece of cleanText(value).split(/\s*;\s*/)) {
    const match = piece.match(/^([^:]+):\s*([^\s(]+)(.*)$/);
    if (!match) continue;
    const extras: string[] = [];
    const extraRe = /\(([^)]*)\)/g;
    let found: RegExpExecArray | null;
    while ((found = extraRe.exec(match[3]))) {
      const extra = cleanText(found[1]);
      if (extra && !/^[a-z]+-/.test(extra)) extras.push(extra);
    }
    addDoc(acc, { type: match[1], number: match[2], details: extras.join("; ") || null });
  }
}

function parseDocPair(acc: Accumulator, value: string) {
  const parts = value.split("؛").map((p) => p.trim());
  const head = splitKeyValue(parts[0] ?? "");
  if (!head) return;
  let country: string | null = null;
  for (const part of parts.slice(1)) {
    const kv = splitKeyValue(part);
    if (kv && /الإصدار/.test(kv.key)) country = kv.value;
  }
  addDoc(acc, { type: head.key, number: head.value, country });
}

function parseRelationList(acc: Accumulator, value: string) {
  for (const piece of cleanText(value).split(/,\s*(?=[A-Z][a-z][^:,]{2,60}:\s)/)) {
    const kv = splitKeyValue(piece, 80);
    if (kv && kv.value) pushRelationship(acc, kv.key, kv.value);
  }
}

function pushRelationship(acc: Accumulator, type: string, entity: string) {
  const cleanType = cleanText(type);
  const cleanEntity = cleanText(entity.replace(/\((?:Entity ID|ID)\s*:\s*\d+\)/gi, " "));
  if (!cleanType || !cleanEntity) return;
  if (acc.relationships.some((r) => r.type === cleanType && dedupeKey(r.entity) === dedupeKey(cleanEntity))) return;
  acc.relationships.push({ type: cleanType, entity: cleanEntity });
}

/** Routes one key/value entry to the right structured section. */
function routeEntry(acc: Accumulator, rawKey: string, rawValue: string) {
  const key = normalizeKey(rawKey);
  const value = rawValue.trim();
  if (!key || TECHNICAL_KEY.test(key)) return;
  const spec = specFor(key);
  if (!spec) {
    if (isEmptyValue(value)) return;
    addInfo(acc, key, value);
    return;
  }
  switch (spec.cat) {
    case "address": parseAddressValue(acc, value); break;
    case "addresses": parseAddressValue(acc, value); break;
    case "dob": pushUnique(acc.dob, normalizeDateText(value)); break;
    case "pob": pushUnique(acc.pob, value.replace(/\s*;\s*/g, " / ")); break;
    case "nationality": pushUnique(acc.nationality, value.replace(/\s*;\s*/g, ", ")); break;
    case "gender": pushUnique(acc.gender, value); break;
    case "alias": pushUnique(acc.aliases, cleanAliasName(value)); break;
    case "aliasList": splitNameList(value).forEach((name) => pushUnique(acc.aliases, name)); break;
    case "reference": pushUnique(acc.references, value); break;
    case "note": pushUnique(acc.notes, cleanText(value, true)); break;
    case "reason": pushUnique(acc.reasons, cleanText(value, true)); break;
    case "relationList": parseRelationList(acc, value); break;
    case "relation": {
      const [type, ...rest] = value.split(/\s+—\s+/);
      if (rest.length) pushRelationship(acc, type, rest.join(" — "));
      else parseRelationList(acc, value);
      break;
    }
    case "docList": parseDocList(acc, value); break;
    case "docPair": parseDocPair(acc, value); break;
    case "docValue": addDoc(acc, { type: spec.en ?? key, typeAr: spec.ar ?? null, number: value }); break;
    case "container":
      for (const piece of value.split(/\s+\|\s+/)) {
        const kv = splitKeyValue(piece, 70);
        if (kv) routeEntry(acc, kv.key, kv.value);
      }
      break;
    case "info": addInfo(acc, key, value, spec); break;
    default: break;
  }
}

/* ─────────────── format 1: sectioned OFAC export (JSON → text) ─────────────── */

const SECTION_HEADERS = ["العناوين", "وثائق الهوية", "السمات الإضافية", "العلاقات", "الأسماء البديلة", "الأسماء الأساسية الإضافية"];

function isSectionedFormat(raw: string): boolean {
  return new RegExp(`(^|\\n)\\s*(${SECTION_HEADERS.join("|")}):\\s*\\r?\\n\\s*-\\s`).test(raw);
}

function parseItemFields(rest: string) {
  const head: string[] = [];
  const fields: Array<{ key: string; value: string }> = [];
  for (const part of rest.split("؛")) {
    const kv = splitKeyValue(part.trim(), 50);
    if (kv) fields.push(kv);
    else if (part.trim()) head.push(part.trim());
  }
  const get = (name: string) => fields.find((f) => f.key === name)?.value ?? null;
  return { head: head.join(" "), fields, get };
}

function parseSectioned(acc: Accumulator, raw: string, record: SanctionsRecordInput) {
  let section = "";
  for (const rawLine of raw.replace(/\r\n?/g, "\n").split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    const header = line.match(/^(.+?):$/);
    if (header && !line.startsWith("-")) {
      section = normalizeKey(header[1]);
      continue;
    }
    if (!line.startsWith("-")) {
      pushUnique(acc.notes, line);
      continue;
    }
    const item = line.match(/^-\s*((?:[^:(]|\([^)]*\))+?)\s*:{1,2}\s*(.*)$/);
    if (!item) continue;
    const prefix = normalizeKey(item[1]);
    const { head, get } = parseItemFields(item[2]);

    if (section === "العناوين") {
      const parts = [get("العنوان"), get("الشارع"), get("المدينة"), get("المنطقة"), get("المحافظة"), get("الولاية/المقاطعة"), get("الرمز البريدي"), get("الدولة")]
        .map(valueOrNull).filter(Boolean) as string[];
      if (parts.length) pushUnique(acc.addresses, parts.join(", "));
    } else if (section === "وثائق الهوية") {
      const validText = get("الوثيقة سارية");
      addDoc(acc, {
        type: get("النوع") ?? "",
        number: get("رقم الوثيقة") ?? "",
        country: get("دولة الإصدار") ?? get("مكان الإصدار"),
        issueDate: get("بداية الفترة"),
        details: get("تعليقات"),
        valid: validText === null ? null : /^true$/i.test(validText),
      });
    } else if (section === "السمات الإضافية") {
      const value = get("القيمة") ?? head;
      if (value) routeEntry(acc, prefix, value);
    } else if (section === "العلاقات") {
      const type = get("نوع العلاقة");
      const entity = get("الكيان المرتبط");
      if (type && entity) pushRelationship(acc, type, entity);
    } else if (section === "الأسماء البديلة" || section === "الأسماء الأساسية الإضافية") {
      const name = cleanAliasName(head);
      const primary = [record.nameEn, record.nameAr].map((n) => dedupeKey(cleanText(n)));
      if (name && !primary.includes(dedupeKey(name))) pushUnique(acc.aliases, name);
    } else {
      routeEntry(acc, prefix, head || item[2]);
    }
  }
}

/* ─────────────── format 2/3: "key: value || key: value" and "key: value | ..." ─────────────── */

function parseDelimited(acc: Accumulator, raw: string) {
  const text = raw.replace(/^\s*\[عدد العناوين:\s*\d+\]\s*/, "");
  const doublePipe = text.includes("||");
  const parts = doublePipe
    ? text.split(/\s*\|\|\s*/)
    : text.split(/\s+\|\s+(?=[^|:\n]{1,45}:)/);
  for (const part of parts) {
    const kv = splitKeyValue(part.trim(), 45);
    const known = kv ? specFor(kv.key) : undefined;
    if (kv && (known || parts.length > 1) && !/\s{2,}|https?$/i.test(kv.key) && kv.key.split(" ").length <= 6) {
      routeEntry(acc, kv.key, kv.value);
    } else {
      pushUnique(acc.notes, cleanText(part, true));
    }
  }
}

function looksDelimited(raw: string): boolean {
  if (raw.includes("||")) return true;
  const first = splitKeyValue(raw.replace(/^\s*\[عدد العناوين:\s*\d+\]\s*/, ""), 45);
  return Boolean(first && specFor(first.key));
}

/* ───────────────────────────── listing fields ───────────────────────────── */

interface ListingParts {
  programme: string[];
  regime: string[];
  legalBasis: string[];
  reasons: string[];
  lists: string[];
  references: string[];
}

function formatProgramme(value: string): string {
  const text = cleanText(value.replace(/\]\s*\[/g, ", ").replace(/^\[|\]$/g, ""));
  const match = text.match(/^([A-Z0-9][A-Z0-9 ,._/-]*?)\s*\(([^)]*[\u0600-\u06FF][^)]*)\)$/);
  return match ? `${match[1].trim()} — ${match[2].trim()}` : text;
}

function parseListingReason(value: string | null | undefined, out: ListingParts) {
  const text = cleanText(value);
  if (!text || /^sanctions$/i.test(text)) return;
  if (/برنامج العقوبات|السند القانوني|سبب الإدراج/.test(text)) {
    for (const piece of text.split(/\s*\|\s*/)) {
      const kv = splitKeyValue(piece);
      if (!kv) { pushUnique(out.reasons, piece); continue; }
      if (/برنامج/.test(kv.key)) pushUnique(out.programme, formatProgramme(kv.value));
      else if (/السند/.test(kv.key)) pushUnique(out.legalBasis, kv.value);
      else pushUnique(out.reasons, kv.value);
    }
    return;
  }
  if (!hasArabic(text) && /\b(Regulations?|Order|Act)\b/.test(text)) { pushUnique(out.regime, text); return; }
  if (!hasArabic(text) && text.length <= 60) { pushUnique(out.programme, formatProgramme(text)); return; }
  if (/^[A-Z0-9][A-Z0-9 ,._/\]\[-]*\s*\([^)]*\)$/.test(text)) { pushUnique(out.programme, formatProgramme(text)); return; }
  if (text.length <= 50 && / - /.test(text) && /[A-Za-z]/.test(text)) { pushUnique(out.programme, text); return; }
  if (text.includes(" | ")) { pushUnique(out.reasons, text.split(/\s*\|\s*/).join("، ")); return; }
  pushUnique(out.reasons, text);
}

const LEGAL_ACT = /[\u0600-\u06FF]|\bOJ\b|\d{4}\/\d+|Order|Regulation|Resolution|E\.O\.|Executive|Decision|Act\b/i;

function parseLegalBasis(value: string | null | undefined, out: ListingParts) {
  const text = cleanText(value);
  if (!text) return;
  for (const piece of text.split(/\s*\|\s*/)) {
    const part = cleanText(piece);
    if (!part) continue;
    let m: RegExpMatchArray | null;
    if ((m = part.match(/^Entity ID\s*:\s*(\S+)/i))) pushUnique(out.references, `OFAC Entity ID: ${m[1]}`);
    else if (/^Identity ID\s*:/i.test(part)) continue;
    else if ((m = part.match(/^List ID\s*\(([^)]+)\)/i))) pushUnique(out.lists, m[1]);
    else if ((m = part.match(/^U?ID\s*:\s*(.+)$/i))) pushUnique(out.references, `UK Unique ID: ${m[1].trim()}`);
    else if ((m = part.match(/^OFSI\s*:\s*([\d.]+)$/i))) pushUnique(out.references, `OFSI Group ID: ${m[1].replace(/\.0$/, "")}`);
    else if ((m = part.match(/^UN\s*:\s*(.+)$/i))) pushUnique(out.references, `UN Reference: ${m[1].trim()}`);
    else if (LEGAL_ACT.test(part)) pushUnique(out.legalBasis, part);
    else pushUnique(out.references, part);
  }
}

/* ───────────────────────────── actions ───────────────────────────── */

export function parseActions(value: string | null | undefined): ActionItem[] {
  const text = cleanText(value);
  if (!text || isEmptyValue(text)) return [];
  const items: ActionItem[] = [];
  const seen = new Set<string>();
  for (const piece of text.split(/\s*\|\s*/)) {
    const part = cleanText(piece);
    if (!part) continue;
    let item: ActionItem;
    const qualifier = part.match(/^(.*[\u0600-\u06FF].*?)\s*\(([A-Za-z][A-Za-z -]*)\)\s*$/);
    if (qualifier) {
      item = { ar: qualifier[1].trim(), en: qualifier[2].trim() };
    } else if (hasArabic(part)) {
      item = { ar: part, en: null };
    } else {
      const normalised = part.replace(/\s*:\s*\(see ['"]?Other information['"]?\)/i, "").replace(/\s*:\s*see ['"]?Other information['"]?/i, "").trim();
      item = { ar: ACTION_AR[normalised.toLowerCase()] ?? null, en: normalised };
    }
    const key = dedupeKey(`${item.ar ?? ""}|${item.en ?? ""}`);
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(item);
  }
  return items;
}

/* ───────────────────────────── public API ───────────────────────────── */

function listingRow(key: string, labelEn: string, labelAr: string, values: string[]): LabelledValue[] {
  return values.length ? [{ key, labelEn, labelAr, value: values.join("\n") }] : [];
}

/** Builds the full structured presentation of a sanctions record. */
export function formatSanctionsRecord(record: SanctionsRecordInput): FormattedSanctionsRecord {
  const acc = newAccumulator();
  const raw = record.rawNotes ? String(record.rawNotes) : "";
  if (raw.trim()) {
    if (isSectionedFormat(raw)) parseSectioned(acc, raw, record);
    else if (looksDelimited(raw)) parseDelimited(acc, raw);
    else pushUnique(acc.notes, cleanText(raw, true));
  }

  const listing: ListingParts = { programme: [], regime: [], legalBasis: [], reasons: [], lists: [], references: [] };
  parseListingReason(record.listingReason, listing);
  parseLegalBasis(record.legalBasis, listing);
  pushUnique(listing.references, record.referenceNumber);
  acc.references.forEach((ref) => {
    if (!listing.references.some((existing) => existing.endsWith(ref) || dedupeKey(existing) === dedupeKey(ref))) {
      pushUnique(listing.references, ref);
    }
  });

  const listingContext: LabelledValue[] = [
    ...listingRow("programme", "Sanctions Programme", "برنامج العقوبات", listing.programme),
    ...listingRow("regime", "Sanctions Regime", "نظام العقوبات", listing.regime),
    ...listingRow("list", "Sanctions List", "قائمة العقوبات", listing.lists),
    ...listingRow("legalBasis", "Legal Basis", "السند القانوني", listing.legalBasis),
    ...listingRow("reason", "Reason for Listing", "سبب الإدراج", listing.reasons),
    ...listingRow("statement", "Statement of Reasons", "بيان الأسباب", acc.reasons),
    ...listingRow("reference", "Source Reference", "المرجع لدى المصدر", listing.references),
  ];

  const aliases: string[] = [];
  const dbAliases = Array.isArray(record.alternativeNames) ? (record.alternativeNames as unknown[]) : [];
  const primaryNames = [record.nameEn, record.nameAr].map((n) => dedupeKey(cleanText(n)));
  [...dbAliases.map((n) => cleanAliasName(String(n ?? ""))), ...acc.aliases].forEach((name) => {
    if (name && !primaryNames.includes(dedupeKey(name))) pushUnique(aliases, name);
  });

  const notes: string[] = [];
  const recordNote = valueOrNull(cleanText(record.notes, true));
  if (recordNote) pushUnique(notes, recordNote);
  acc.notes.forEach((note) => {
    if (!notes.some((existing) => dedupeKey(existing).includes(dedupeKey(note)) || dedupeKey(note).includes(dedupeKey(existing)))) {
      pushUnique(notes, note);
    } else if (recordNote && dedupeKey(note).includes(dedupeKey(recordNote)) && note.length > recordNote.length) {
      notes.splice(notes.indexOf(recordNote), 1, note);
    }
  });

  const addresses: string[] = [];
  acc.addresses.forEach((address) => pushUnique(addresses, address));
  // Drop a country-only address when a fuller address already contains it.
  const compactAddresses = addresses.filter((address) =>
    !addresses.some((other) => other !== address && other.length > address.length && dedupeKey(other).endsWith(dedupeKey(address))),
  );

  return {
    listingDate: normalizeDateText(record.listingDate),
    listingContext,
    actions: parseActions(record.actionTaken),
    personal: {
      nationality: valueOrNull(record.nationality) ?? (acc.nationality.join(", ") || null),
      dateOfBirth: normalizeDateText(record.dateOfBirth) ?? (acc.dob.join(" / ") || null),
      placeOfBirth: valueOrNull(record.placeOfBirth) ?? (acc.pob.join(" / ") || null),
      gender: acc.gender[0] ?? null,
    },
    aliases,
    identityDocuments: acc.docs,
    addresses: compactAddresses,
    additionalInfo: acc.info,
    relationships: acc.relationships,
    notes,
  };
}

/** Formats one action as a single bilingual line, e.g. "تجميد الأموال والأصول — Block". */
export function actionToText(action: ActionItem): string {
  return [action.ar, action.en].filter(Boolean).join(" — ");
}
