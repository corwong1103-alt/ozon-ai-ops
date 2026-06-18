# TRANSLATE_API_FIX_REPORT — 翻译 API mock→真实修复

> 修复时间：2026-06-19 | 服务器：47.239.96.230

---

## 修复前

```typescript
// app/api/products/[id]/translate/route.ts (旧)
import { runBaseTranslationTask } from "@/lib/services/ai";

export async function POST() {
  const task = await runBaseTranslationTask({...}); // 只写 TaskLog，不调 AI
  await prisma.product.update({ data: { status: "optimizing" } }); // 假更新
  return NextResponse.json({ task }); // 假成功
}
```

**问题**：
- 不调用 `generateText`
- 不调用 DashScope
- 不更新 title/description
- 只写一个 TaskLog + 改 status 为 optimizing
- 客户端收到 HTTP 200 + "success" — 但翻译从未发生

---

## 修复后

```typescript
// app/api/products/[id]/translate/route.ts (新)
import { generateText } from "@/lib/ai/provider";
import { buildProductTranslationPrompt } from "@/lib/ai/prompts";

export async function POST() {
  // 1. 读商品
  // 2. 调 generateText → dashscopeFetch → 实时 AI 翻译
  // 3. parseTranslation 容错解析 JSON {titleRu, descriptionRu}
  // 4. 更新 product.title / product.description
  // 5. 写 TaskLog 含真实元数据
  // 6. 返回 {ok, titleBefore, titleAfter, task}
}
```

---

## 实证验证

```
Product ID: cmqj6gfe0001e25v70j927m7b
User: operator@demo.com

=== 翻译前 ===
Title:  Guitar Combo Amplifier
Status: discovered

=== API 调用 ===
POST /api/products/cmqj6gfe0001e25v70j927m7b/translate
Response: HTTP 200
{
  "ok": true,
  "titleBefore": "Guitar Combo Amplifier",
  "titleAfter": "Гитарный комбоусилитель",
  "message": "标题/描述俄文翻译已生成。"
}

=== 翻译后 ===
Title:  Гитарный комбоусилитель  ← DashScope 真实翻译
Status: optimizing

=== TaskLog ===
type: translate | status: success
message: 百炼翻译完成：Гитарный комбоусилитель
metadata: {
  "titleRu": "Гитарный комбоусилитель",
  "descriptionRu": "Артикул Ozon: 4784545883\n..."
}
```

---

## 构建与测试

| 步骤 | 结果 |
|------|------|
| `npm run build` | ✅ 通过 |
| `npm run test:unit` | ✅ 23/23 pass |
| Docker 重建 | ✅ 45s build + 启动 |
| 线上 API 实测 | ✅ DashScope qwen-plus 返回俄语 |

---

## 修改文件

| 文件 | 改动 |
|------|------|
| `app/api/products/[id]/translate/route.ts` | 完整重写：mock→真实 AI |

---

## 当前 OzonAI AI 能力全貌

| 功能 | 类型 | 状态 |
|------|------|------|
| 标题/描述翻译 | Server Action + REST API | ✅ 真实 DashScope |
| AI 商品优化 | Server Action | ✅ 真实 DashScope |
| 图片文字翻译 | Server Action | ✅ 真实 DashScope |
| AI 商品图生成 | Server Action | ✅ 真实 DashScope |
| 推广文案生成 | Server Action | ✅ 真实 DashScope |
| 反推生图提示词 | Server Action | ✅ 真实 DashScope |
| 1688→Ozon Listing | Server Action | ✅ 真实 DashScope |
| 客服回复生成 | Server Action | ✅ 真实 DashScope |
| AI 视频 | Server Action | ⏳ 暂停 |

---

> **结论**：最后一个 mock 遗留已清除。OzonAI 线上全部 AI 能力均通过真实 DashScope API 调用，不再有任何虚假响应。
