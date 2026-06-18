import "server-only";

import { generateText } from "@/lib/ai/provider";

export type ExpandedKeyword = {
  keyword: string;
  language: "zh" | "en" | "ru" | "other";
  source: "original" | "translated" | "expanded";
};

export type KeywordExpansionResult = {
  original: string;
  detectedLanguage: "zh" | "en" | "ru" | "other";
  translatedRu: string;
  keywords: ExpandedKeyword[];
  rawAiResponse?: string;
};

const LANG_HINT = {
  zh: /[一-鿿]/,
  ru: /[Ѐ-ӿ]/
};

// 内存缓存：同词 1h 内不重复调 Qwen（线上 Docker 长驻进程有效）
const expansionCache = new Map<string, { result: KeywordExpansionResult; expiresAt: number }>();
const EXPANSION_CACHE_TTL = 60 * 60 * 1000;

export function detectLanguage(text: string): "zh" | "en" | "ru" | "other" {
  if (LANG_HINT.zh.test(text)) return "zh";
  if (LANG_HINT.ru.test(text)) return "ru";
  if (/^[a-zA-Z\s]/.test(text.trim())) return "en";
  return "other";
}

const STATIC_RU: Record<string, string> = {
  "裤子": "брюки",
  "裤": "брюки",
  "牛仔裤": "джинсы",
  backpack: "рюкзак",
  "phone case": "чехол для телефона",
  "pet toy": "игрушка для животных",
  "power bank": "повербанк",
  earbuds: "наушники",
  serum: "сыворотка",
  "led lamp": "лед лампа",
  "dog toy": "игрушка для собак",
  "hair serum": "сыворотка для волос"
};

const STATIC_EXPANDED_RU: Record<string, string[]> = {
  "裤子": ["брюки", "штаны", "джинсы"],
  "裤": ["брюки", "штаны", "джинсы"],
  "牛仔裤": ["джинсы", "брюки", "штаны"]
};

export function fallbackExpandedKeywords(keyword: string): ExpandedKeyword[] {
  const original = keyword.trim();
  const detected = detectLanguage(original);
  const translated = STATIC_RU[original.toLowerCase()] || (detected === "ru" ? original : "");
  const expanded = STATIC_EXPANDED_RU[original] || STATIC_EXPANDED_RU[original.toLowerCase()] || [];
  const keywords: ExpandedKeyword[] = [{ keyword: original, language: detected, source: "original" }];
  if (translated && translated !== original) {
    keywords.push({ keyword: translated, language: "ru", source: "translated" });
  }
  for (const item of expanded) {
    if (!keywords.some((existing) => existing.keyword.toLowerCase() === item.toLowerCase())) {
      keywords.push({ keyword: item, language: "ru", source: "expanded" });
    }
  }
  return keywords;
}

function parseExpansionJson(content: string): { detectedLanguage?: string; translatedRu?: string; expanded?: string[] } | null {
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    const raw = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    return {
      detectedLanguage: typeof raw.detectedLanguage === "string" ? raw.detectedLanguage : undefined,
      translatedRu: typeof raw.translatedRu === "string" ? raw.translatedRu.trim() : undefined,
      expanded: Array.isArray(raw.expanded) ? raw.expanded.filter((x): x is string => typeof x === "string").map((s) => s.trim()) : []
    };
  } catch {
    return null;
  }
}

/**
 * AI 关键词扩展：用户输入 → Qwen 识别语种 → 翻译成俄语 → 扩展 3-5 个相关搜索词。
 * 失败时降级为静态映射 + 原词。内存缓存 1h 避免重复调用 Qwen。
 */
export async function expandKeyword(input: {
  userId: string;
  keyword: string;
  categoryId?: string;
}): Promise<KeywordExpansionResult> {
  const original = input.keyword.trim();
  const detected = detectLanguage(original);
  const fallbackRu = STATIC_RU[original.toLowerCase()] || (detected === "ru" ? original : "");

  const cacheKey = `${input.userId}:${original}:${input.categoryId || ""}`;
  const cached = expansionCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.result;
  }

  const systemPrompt = `你是 Ozon 跨境电商搜索关键词专家。用户输入一个商品关键词（可能中文/英文/俄文），你需要：
1. 识别语种
2. 翻译成俄语（Ozon 是俄罗斯平台，俄语搜索最准）
3. 扩展 3-5 个俄语相关搜索词（同义词、长尾词、热门变体）

严格返回 JSON，格式：
{"detectedLanguage":"zh|en|ru|other","translatedRu":"俄语主词","expanded":["扩展词1","扩展词2","扩展词3"]}

注意：
- expanded 数组不含主词本身，只含相关变体
- 所有扩展词必须是俄语
- 词要符合 Ozon 真实搜索习惯（简短、商品名为主）`;

  try {
    const content = await generateText({
      userId: input.userId,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `关键词："${original}"${input.categoryId ? `\n类目提示：${input.categoryId}` : ""}` }
      ],
      temperature: 0.3
    });

    const parsed = parseExpansionJson(content);
    if (parsed) {
      const keywords: ExpandedKeyword[] = [{ keyword: original, language: detected, source: "original" }];
      if (parsed.translatedRu && parsed.translatedRu !== original) {
        keywords.push({ keyword: parsed.translatedRu, language: "ru", source: "translated" });
      }
      for (const kw of (parsed.expanded || [])) {
        if (kw && !keywords.some((k) => k.keyword.toLowerCase() === kw.toLowerCase())) {
          keywords.push({ keyword: kw, language: "ru", source: "expanded" });
        }
      }
      const result: KeywordExpansionResult = {
        original,
        detectedLanguage: (parsed.detectedLanguage === "zh" || parsed.detectedLanguage === "en" || parsed.detectedLanguage === "ru" || parsed.detectedLanguage === "other") ? parsed.detectedLanguage : detected,
        translatedRu: parsed.translatedRu || fallbackRu,
        keywords,
        rawAiResponse: content.slice(0, 200)
      };
      expansionCache.set(cacheKey, { result, expiresAt: Date.now() + EXPANSION_CACHE_TTL });
      return result;
    }
  } catch (error) {
    console.info("[keyword_expand_error]", JSON.stringify({ keyword: original, error: error instanceof Error ? error.message.slice(0, 100) : "" }));
  }

  const fallbackKeywords = fallbackExpandedKeywords(original);
  const fallbackResult: KeywordExpansionResult = {
    original,
    detectedLanguage: detected,
    translatedRu: fallbackRu,
    keywords: fallbackKeywords,
    rawAiResponse: undefined
  };
  expansionCache.set(cacheKey, { result: fallbackResult, expiresAt: Date.now() + EXPANSION_CACHE_TTL });
  return fallbackResult;
}
