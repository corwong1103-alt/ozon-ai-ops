import "server-only";

type ProductInput = {
  title: string;
  description: string;
  price?: string | number;
};

export function buildProductTranslationPrompt(product: ProductInput) {
  return [
    "你是服务 Ozon 俄罗斯跨境电商卖家的商品本地化助手。",
    "请把下面商品标题和描述翻译成自然、适合 Ozon 上架的俄语。",
    "要求：保留核心卖点，不夸大功效，输出 JSON，字段为 titleRu、descriptionRu。",
    "",
    `标题：${product.title}`,
    `描述：${product.description}`,
    product.price ? `价格：${product.price}` : ""
  ].filter(Boolean).join("\n");
}

export function buildImageTextTranslationPrompt(product: ProductInput) {
  return [
    "你是商品图片文字本地化助手。",
    "请根据商品信息，生成适合商品图使用的俄语短文案。",
    "要求：每条不超过 18 个俄语词，输出 JSON 数组，字段 textRu、usage。",
    "",
    `商品：${product.title}`,
    `描述：${product.description}`
  ].join("\n");
}

export function buildCustomerReplyPrompt(input: {
  customerName: string;
  message: string;
  category: string;
}) {
  return [
    "你是 Ozon 跨境店铺客服助手，服务新疆跨境商家。",
    "请根据客户消息生成一条中文客服回复建议。",
    "要求：语气稳妥、可执行，不承诺无法保证的时效；如涉及退款、物流、差评，要先安抚再说明下一步。",
    "",
    `客户：${input.customerName}`,
    `分类：${input.category}`,
    `消息：${input.message}`
  ].join("\n");
}

export function buildSocialCopyPrompt(input: {
  platform: string;
  product: ProductInput;
}) {
  return [
    "你是跨境电商社媒文案助手。",
    "请为商品生成适合社媒发布的内容，面向俄罗斯消费者。",
    "输出 JSON，字段为 title、copy、hashtags。hashtags 为字符串数组。",
    "",
    `平台：${input.platform}`,
    `商品：${input.product.title}`,
    `描述：${input.product.description}`,
    input.product.price ? `价格：${input.product.price}` : ""
  ].filter(Boolean).join("\n");
}

export function buildProductImagePrompt(product: ProductInput) {
  return [
    "生成一张 Ozon 跨境电商商品主图。",
    "风格：干净真实的电商摄影，浅色背景，商品清晰居中，有轻微阴影，避免夸张文字和水印。",
    `商品：${product.title}`,
    `描述：${product.description}`
  ].join("\n");
}

export function buildProductVideoPrompt(product: ProductInput) {
  return [
    "生成一段 6-8 秒商品展示短视频，用于跨境电商社媒发布。",
    "画面：商品从包装到使用场景，节奏简洁，适合 Ozon 卖家展示。",
    `商品：${product.title}`,
    `描述：${product.description}`
  ].join("\n");
}

export type OzonListingInput = {
  title: string;
  description: string;
  price?: string | number;
  supplier?: string;
  sourceImages?: string[];
  extraContext?: string;
};

/**
 * 基于 1688 源商品生成完整 Ozon 上架资料：
 * 俄文标题、俄文描述、商品属性键值对、SEO 关键词。
 * 输出严格 JSON，供 1688 导入后一键生成 Listing。
 */
export function buildOzonListingPrompt(input: OzonListingInput) {
  return [
    "你是 Ozon 俄罗斯跨境电商上架运营专家。",
    "请基于中国 1688 源商品信息，生成一份可直接用于 Ozon 上架的俄语商品资料。",
    "要求：",
    "- 标题俄语自然、含核心卖点关键词，不超过 200 字符",
    "- 描述俄语详细、结构化（卖点、规格、适用场景），不夸大功效",
    "- 属性：提取 3-8 个商品属性键值对（俄语 key + value），如材质、尺寸、颜色、容量等",
    "- seoKeywords：5-10 个俄语 SEO 关键词，用于 Ozon 搜索优化",
    "严格输出 JSON，字段：titleRu、descriptionRu、attributes（数组，每项 {key, value}）、seoKeywords（字符串数组）。",
    "不要输出 JSON 以外的内容，不要用 markdown 代码块包裹。",
    "",
    `源商品标题：${input.title}`,
    input.description ? `源商品描述：${input.description}` : "",
    input.price ? `源商品价格（人民币）：${input.price}` : "",
    input.supplier ? `供应商：${input.supplier}` : "",
    input.extraContext ? `补充说明：${input.extraContext}` : ""
  ].filter(Boolean).join("\n");
}

export type OzonListing = {
  titleRu: string;
  descriptionRu: string;
  attributes: Array<{ key: string; value: string }>;
  seoKeywords: string[];
};

/**
 * 容错解析 AI 返回的 Listing JSON。
 * 模型可能输出 markdown 代码块或多余文本，这里只提取首个 JSON 对象。
 */
export function parseOzonListing(raw: string): OzonListing {
  const fallback: OzonListing = { titleRu: "", descriptionRu: "", attributes: [], seoKeywords: [] };
  if (!raw) return fallback;

  // 去掉 ```json ... ``` 包裹
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

  // 尝试直接解析
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // 提取第一个 { ... } 块
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        parsed = JSON.parse(match[0]);
      } catch {
        parsed = null;
      }
    }
  }

  if (!parsed || typeof parsed !== "object") return fallback;
  const obj = parsed as Record<string, unknown>;

  const titleRu = typeof obj.titleRu === "string" ? obj.titleRu.trim() : "";
  const descriptionRu = typeof obj.descriptionRu === "string" ? obj.descriptionRu.trim() : "";
  const attributes = Array.isArray(obj.attributes)
    ? obj.attributes
        .filter((item) => item && typeof item === "object")
        .map((item) => {
          const record = item as Record<string, unknown>;
          return {
            key: String(record.key || "").trim(),
            value: String(record.value || "").trim()
          };
        })
        .filter((item) => item.key || item.value)
    : [];
  const seoKeywords = Array.isArray(obj.seoKeywords)
    ? obj.seoKeywords.filter((item) => typeof item === "string").map((item) => String(item).trim()).filter(Boolean)
    : [];

  return { titleRu, descriptionRu, attributes, seoKeywords };
}
