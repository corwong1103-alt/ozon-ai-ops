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
