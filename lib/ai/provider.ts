import "server-only";

import { getDashscopeRuntimeConfig } from "@/lib/integrations";

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type GenerateTextInput = {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  userId?: string;
};

type MediaInput = {
  prompt: string;
  model?: string;
  userId?: string;
};

type AiProvider = "mock" | "dashscope";

function provider(): AiProvider {
  return process.env.AI_PROVIDER === "dashscope" ? "dashscope" : "mock";
}

function shouldUseDashscope(config: Awaited<ReturnType<typeof getDashscopeRuntimeConfig>>) {
  return provider() === "dashscope" || config.enabled;
}

function ensureDashscopeKey(apiKey: string) {
  if (!apiKey) {
    throw new Error("请先在 API 接入页填写百炼 DashScope API Key。");
  }
  return apiKey;
}

async function dashscopeFetch(config: Awaited<ReturnType<typeof getDashscopeRuntimeConfig>>, path: string, body: unknown) {
  const response = await fetch(`${config.baseUrl.replace(/\/$/, "")}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ensureDashscopeKey(config.apiKey)}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`DashScope request failed: ${response.status} ${text}`);
  }

  return response.json();
}

function dashscopeNativeBaseUrl(baseUrl: string) {
  const value = baseUrl.replace(/\/$/, "");
  if (value.includes("dashscope-intl.aliyuncs.com")) return "https://dashscope-intl.aliyuncs.com";
  return "https://dashscope.aliyuncs.com";
}

function normalizeImageSize(size: string) {
  return size.includes("x") ? size.replace("x", "*") : size;
}

async function dashscopeNativeFetch(config: Awaited<ReturnType<typeof getDashscopeRuntimeConfig>>, path: string, body: unknown) {
  const response = await fetch(`${dashscopeNativeBaseUrl(config.baseUrl)}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ensureDashscopeKey(config.apiKey)}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  const text = await response.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    throw new Error(`DashScope native request failed: ${response.status} ${typeof data === "string" ? data : JSON.stringify(data)}`);
  }

  return data;
}

function extractNativeImageUrl(data: unknown) {
  if (!data || typeof data !== "object") return "";
  const output = (data as Record<string, unknown>).output;
  if (!output || typeof output !== "object") return "";
  const choices = (output as Record<string, unknown>).choices;
  if (!Array.isArray(choices)) return "";
  const first = choices[0];
  if (!first || typeof first !== "object") return "";
  const message = (first as Record<string, unknown>).message;
  if (!message || typeof message !== "object") return "";
  const content = (message as Record<string, unknown>).content;
  if (!Array.isArray(content)) return "";
  for (const item of content) {
    if (item && typeof item === "object") {
      const image = (item as Record<string, unknown>).image;
      if (typeof image === "string") return image;
    }
  }
  return "";
}

export async function generateText(input: GenerateTextInput) {
  const config = await getDashscopeRuntimeConfig(input.userId);
  if (!shouldUseDashscope(config)) {
    const last = input.messages[input.messages.length - 1]?.content || "";
    return `mock AI：${last.slice(0, 180)}`;
  }

  const payload = {
    model: input.model || config.textModel,
    messages: input.messages,
    temperature: input.temperature ?? 0.4
  };
  const data = await dashscopeFetch(config, "/chat/completions", payload) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("DashScope text response did not include content");
  return content;
}

export async function generateImage(input: MediaInput) {
  const config = await getDashscopeRuntimeConfig(input.userId);
  if (!shouldUseDashscope(config)) {
    return {
      url: "",
      provider: "mock",
      prompt: input.prompt
    };
  }

  const data = await dashscopeNativeFetch(config, "/api/v1/services/aigc/multimodal-generation/generation", {
    model: input.model || config.imageModel,
    input: {
      messages: [
        {
          role: "user",
          content: [{ text: input.prompt }]
        }
      ]
    },
    parameters: {
      n: 1,
      size: normalizeImageSize(config.imageSize),
      prompt_extend: true,
      watermark: false
    }
  });

  return {
    url: extractNativeImageUrl(data),
    provider: "dashscope",
    prompt: input.prompt,
    raw: data
  };
}

export async function generateVideo(input: MediaInput) {
  const config = await getDashscopeRuntimeConfig(input.userId);
  if (!shouldUseDashscope(config)) {
    return {
      url: "",
      provider: "mock",
      prompt: input.prompt
    };
  }

  if (!config.videoEndpoint) {
    return {
      url: "",
      provider: "dashscope",
      prompt: input.prompt,
      note: "Set DASHSCOPE_VIDEO_ENDPOINT after enabling the selected video model in Bailian."
    };
  }

  const data = await dashscopeFetch(config, config.videoEndpoint, {
    model: input.model || config.videoModel,
    prompt: input.prompt
  }) as unknown;

  return {
    url: "",
    provider: "dashscope",
    prompt: input.prompt,
    raw: data
  };
}
