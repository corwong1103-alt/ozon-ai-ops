"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSocialCopy, publishSocialImage, toggleSocialAccount } from "@/app/social/actions";
import { useToast } from "@/components/Toast";

function useActionFeedback() {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<{ ok: boolean; message: string } | undefined>) {
    startTransition(async () => {
      try {
        const result = await action();
        if (result?.ok) {
          toast("success", result.message);
          router.refresh();
          return;
        }
        toast("error", result?.message || "操作失败，请稍后再试。");
      } catch (error) {
        toast("error", error instanceof Error ? error.message : "操作失败，请稍后再试。");
      }
    });
  }

  return { pending, run };
}

export function SocialAccountButton({
  platform,
  connected
}: {
  platform: "vk" | "wibus";
  connected: boolean;
}) {
  const { pending, run } = useActionFeedback();

  return (
    <button className="btn-secondary w-full text-sm" disabled={pending} onClick={() => run(() => toggleSocialAccount(platform))} type="button">
      {pending ? "处理中…" : connected ? "断开授权" : "模拟授权"}
    </button>
  );
}

export function SocialPostButtons({
  productId,
  platform
}: {
  productId: string;
  platform: "vk" | "wibus";
}) {
  const copy = useActionFeedback();
  const publish = useActionFeedback();

  function formData() {
    const data = new FormData();
    data.set("productId", productId);
    data.set("platform", platform);
    return data;
  }

  return (
    <div className="grid gap-2 md:grid-cols-3">
      <button className="btn-secondary w-full px-2 py-2 text-xs" disabled={copy.pending} onClick={() => copy.run(() => createSocialCopy(formData()))} type="button">
        {copy.pending ? "生成中…" : `${platform.toUpperCase()} 草稿`}
      </button>
      <button className="btn-secondary w-full px-2 py-2 text-xs" disabled={publish.pending} onClick={() => publish.run(() => publishSocialImage(formData()))} type="button">
        {publish.pending ? "发布中…" : "模拟图文"}
      </button>
      <button className="btn-primary w-full px-2 py-2 text-xs opacity-60" disabled type="button" title="本轮先不测试视频">
        AI视频暂停
      </button>
    </div>
  );
}
