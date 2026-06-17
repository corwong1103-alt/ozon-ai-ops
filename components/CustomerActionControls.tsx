"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { generateCustomerReply, sendCustomerReply, syncMockCustomerMessages } from "@/app/customer/actions";
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

export function SyncCustomerMessagesButton() {
  const { pending, run } = useActionFeedback();
  return (
    <button className="btn-primary" disabled={pending} onClick={() => run(syncMockCustomerMessages)} type="button">
      {pending ? "生成中…" : "生成客服测试消息"}
    </button>
  );
}

export function CustomerMessageButtons({ messageId }: { messageId: string }) {
  const reply = useActionFeedback();
  const send = useActionFeedback();

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <button className="btn-secondary px-3 py-2 text-xs" disabled={reply.pending} onClick={() => reply.run(() => generateCustomerReply(messageId))} type="button">
        {reply.pending ? "生成中…" : "生成回复建议"}
      </button>
      <button className="btn-primary px-3 py-2 text-xs" disabled={send.pending} onClick={() => send.run(() => sendCustomerReply(messageId))} type="button">
        {send.pending ? "发送中…" : "模拟发送回复"}
      </button>
    </div>
  );
}
