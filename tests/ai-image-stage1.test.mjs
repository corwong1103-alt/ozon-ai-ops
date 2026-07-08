import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function loadExtractTaskImageUrl() {
  const source = await readFile(new URL("../lib/ai/task-image-url.ts", import.meta.url), "utf8");
  const runnable = source
    .replace("export function extractTaskImageUrl(data: unknown)", "function extractTaskImageUrl(data)")
    .replaceAll(" as Record<string, unknown>", "");
  return Function(`${runnable}; return extractTaskImageUrl;`)();
}

test("product image prompts expose ecommerce scene presets with negative prompt", async () => {
  const promptSource = await readFile(new URL("../lib/ai/prompts.ts", import.meta.url), "utf8");

  assert.match(promptSource, /NEGATIVE_PROMPT/);
  assert.match(promptSource, /blurry/);
  assert.match(promptSource, /watermark/);
  assert.match(promptSource, /buildMainImagePrompt/);
  assert.match(promptSource, /strength:\s*0\.35/);
  assert.match(promptSource, /buildBackgroundImagePrompt/);
  assert.match(promptSource, /strength:\s*0\.4/);
  assert.match(promptSource, /buildModelImagePrompt/);
  assert.match(promptSource, /strength:\s*0\.55/);
  assert.match(promptSource, /buildSceneImagePrompt/);
});

test("provider uses DashScope image2image endpoint when reference image exists", async () => {
  const providerSource = await readFile(new URL("../lib/ai/provider.ts", import.meta.url), "utf8");

  assert.match(providerSource, /generateImageEdit/);
  assert.match(providerSource, /\/api\/v1\/services\/aigc\/image2image\/image-synthesis/);
  assert.match(providerSource, /base_image_url:\s*input\.referenceImage/);
  assert.doesNotMatch(providerSource, /ref_img:\s*input\.referenceImage/);
  assert.match(providerSource, /negative_prompt/);
  assert.match(providerSource, /task_id|task-id/);
});

test("task image url extraction supports DashScope result_urls and results formats", async () => {
  const extractTaskImageUrl = await loadExtractTaskImageUrl();

  assert.equal(
    extractTaskImageUrl({ output: { result_urls: ["https://example.com/result-url.png"] } }),
    "https://example.com/result-url.png"
  );
  assert.equal(
    extractTaskImageUrl({ output: { results: [{ url: "https://example.com/results-url.png" }] } }),
    "https://example.com/results-url.png"
  );
});

test("credit ai task and image api routes forward image edit controls", async () => {
  const serviceSource = await readFile(new URL("../lib/services/ai.ts", import.meta.url), "utf8");
  const productRouteSource = await readFile(new URL("../app/api/products/[id]/generate-image/route.ts", import.meta.url), "utf8");
  const aiRouteSource = await readFile(new URL("../app/api/ai/generate/route.ts", import.meta.url), "utf8");

  for (const source of [serviceSource, productRouteSource, aiRouteSource]) {
    assert.match(source, /referenceImage/);
    assert.match(source, /strength/);
    assert.match(source, /negativePrompt/);
  }
});

test("factory workbench sends reference image separately without prompt url prefix", async () => {
  const source = await readFile(new URL("../components/FactoryWorkbench.tsx", import.meta.url), "utf8");

  assert.doesNotMatch(source, /参考图片URL:/);
  assert.match(source, /strength/);
  assert.match(source, /negativePrompt/);
  assert.match(source, /referenceImage:\s*referenceImage/);
});

test("auth panel stores user id for persistent state isolation after login", async () => {
  const source = await readFile(new URL("../components/AuthPanel.tsx", import.meta.url), "utf8");

  assert.match(source, /data\.user\?\.id/);
  assert.match(source, /sessionStorage\.setItem\("ozon_user_id",\s*data\.user\.id\)/);
});
