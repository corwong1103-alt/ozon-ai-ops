"use server";

import { revalidatePath } from "next/cache";
import { requireApprovedUser } from "@/lib/auth";
import { generateText, generateImage } from "@/lib/ai/provider";
import { runBaseTranslationTask } from "@/lib/services/ai";
import { prisma } from "@/lib/prisma";

export type AiResult = {
  ok: boolean;
  message: string;
  content?: string;
  imageUrl?: string;
};

// ── 商品 AI：标题/卖点/描述/FAQ/SEO ──
export async function generateProductAi(formData: FormData): Promise<AiResult> {
  const user = await requireApprovedUser();
  const productId = String(formData.get("productId") || "");
  const kind = String(formData.get("kind") || "title");

  const product = await prisma.product.findFirst({ where: { id: productId, userId: user.id } });
  if (!product) return { ok: false, message: "未找到商品，请先在商品中心选择。" };

  const prompts: Record<string, string> = {
    title: `为这个 Ozon 商品生成俄语商品标题（简洁、含核心卖点、≤80字符）。\n商品：${product.title}\n描述：${product.description}\n价格：${product.price}`,
    sellingPoints: `为这个 Ozon 商品生成 3-5 条俄语卖点（每条一行，突出功能/场景/优势）。\n商品：${product.title}\n描述：${product.description}`,
    description: `为这个 Ozon 商品生成俄语商品详情描述（200-400字，含使用场景、材质、规格）。\n商品：${product.title}\n描述：${product.description}`,
    faq: `为这个 Ozon 商品生成 5 条俄语常见问题 FAQ（问题+答案）。\n商品：${product.title}\n描述：${product.description}`,
    seo: `为这个 Ozon 商品生成俄语 SEO 关键词（10-15个，逗号分隔）。\n商品：${product.title}\n描述：${product.description}`
  };

  try {
    const content = await generateText({
      userId: user.id,
      messages: [
        { role: "system", content: "你是 Ozon 跨境电商文案专家，输出专业俄语商品文案。" },
        { role: "user", content: prompts[kind] || prompts.title }
      ],
      temperature: 0.6
    });
    await runBaseTranslationTask({ userId: user.id, productId, message: `商品AI生成 ${kind}：${product.title}` });
    return { ok: true, message: `${kind} 生成成功`, content };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "生成失败" };
  }
}

// ── 素材 AI：生成任意营销素材图 ──
export async function generateAssetAi(formData: FormData): Promise<AiResult> {
  const user = await requireApprovedUser();
  const prompt = String(formData.get("prompt") || "").trim();
  const assetType = String(formData.get("assetType") || "主图");

  if (!prompt) return { ok: false, message: "请输入素材生成需求。" };

  const credits = await prisma.aiCredits.findUnique({ where: { userId: user.id } });
  if (!credits || credits.imageCredits <= 0) {
    return { ok: false, message: "图片额度不足，请联系管理员充值。" };
  }

  const fullPrompt = `${assetType}：${prompt}。商品营销素材，高质量，专业摄影风格，适合电商展示。`;

  try {
    const result = await generateImage({ userId: user.id, prompt: fullPrompt });
    if (!result.url) {
      return { ok: false, message: "AI 未返回图片，请检查模型配置或稍后重试。" };
    }
    await prisma.aiCredits.update({
      where: { userId: user.id },
      data: { imageCredits: { decrement: 1 } }
    });
    await prisma.taskLog.create({
      data: {
        userId: user.id,
        type: "image",
        status: "success",
        creditCost: 1,
        message: `素材AI生成 ${assetType}`,
        metadata: { prompt: fullPrompt, imageUrl: result.url, provider: result.provider } as object
      }
    });
    revalidatePath("/ai-studio");
    return { ok: true, message: `${assetType} 生成成功`, imageUrl: result.url };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "素材生成失败" };
  }
}

// ── 社媒 AI：VK/Wibes 标题/文案/标签 ──
export async function generateSocialAi(formData: FormData): Promise<AiResult> {
  const user = await requireApprovedUser();
  const platform = String(formData.get("platform") || "vk");
  const kind = String(formData.get("kind") || "caption");
  const productId = String(formData.get("productId") || "");
  const topic = String(formData.get("topic") || "").trim();

  let context = topic;
  if (productId) {
    const product = await prisma.product.findFirst({ where: { id: productId, userId: user.id } });
    if (product) context = `商品：${product.title}。${product.description}`;
  }
  if (!context) return { ok: false, message: "请选择商品或输入推广主题。" };

  const platformName = platform === "vk" ? "VK" : "Wibes";
  const prompts: Record<string, string> = {
    title: `为 ${platformName} 生成俄语推广标题（吸睛、≤50字符）：${context}`,
    caption: `为 ${platformName} 生成俄语推广文案（150-300字，含表情符号、号召行动）：${context}`,
    tags: `为 ${platformName} 生成 8-12 个俄语推广标签（#开头，空格分隔）：${context}`
  };

  try {
    const content = await generateText({
      userId: user.id,
      messages: [
        { role: "system", content: `你是 ${platformName} 社媒营销专家，输出适合俄罗斯市场的俄语内容。` },
        { role: "user", content: prompts[kind] || prompts.caption }
      ],
      temperature: 0.7
    });
    await runBaseTranslationTask({ userId: user.id, productId: productId || undefined, message: `社媒AI生成 ${platformName} ${kind}` });
    return { ok: true, message: `${platformName} ${kind} 生成成功`, content };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "生成失败" };
  }
}
