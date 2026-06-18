"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type TaskStatus = "queued" | "processing" | "success" | "failed";

export function ResearchTaskPoller({ taskId, keyword }: { taskId: string; keyword: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<TaskStatus>("queued");
  const [errorMessage, setErrorMessage] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [retryCount, setRetryCount] = useState(0);
  const [retrying, setRetrying] = useState(false);
  const startTime = useRef(Date.now());
  const stopped = useRef(false);

  // Persist task info so polling state can be recovered on re-entry
  useEffect(() => {
    if (taskId && keyword) {
      sessionStorage.setItem("ozon_research_task", JSON.stringify({ taskId, keyword, startedAt: Date.now() }));
    }
  }, [taskId, keyword]);

  useEffect(() => {
    stopped.current = false;
    startTime.current = Date.now();
    setElapsed(0);
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      if (stopped.current) return;
      try {
        const r = await fetch(`/api/research/task/${taskId}`, { cache: "no-store" });
        if (!r.ok) {
          if (!stopped.current) timer = setTimeout(poll, 2000);
          return;
        }
        const data = await r.json();
        setStatus(data.status);
        setElapsed(Math.round((Date.now() - startTime.current) / 1000));
        if (data.status === "success") {
          stopped.current = true;
          router.refresh();
          return;
        }
        if (data.status === "failed") {
          setErrorMessage(data.errorMessage || "搜索失败，请重试。");
          stopped.current = true;
          return;
        }
      } catch {
        // 网络错误，继续轮询
      }
      if (!stopped.current) {
        timer = setTimeout(poll, 2000);
      }
    }
    poll();
    return () => {
      stopped.current = true;
      clearTimeout(timer);
    };
  }, [taskId, retryCount, router]);

  async function handleRetry() {
    setRetrying(true);
    setErrorMessage("");
    setStatus("queued");
    try {
      await fetch(`/api/research/task/${taskId}`, { method: "POST" });
    } catch {
      // ignore
    }
    setRetryCount((c) => c + 1);
    setRetrying(false);
  }

  if (status === "failed") {
    return (
      <section className="research-empty-market">
        <h3>调研失败</h3>
        <p>关键词：{keyword}</p>
        <p style={{ color: "#b91c1c", fontSize: 13, marginTop: 8 }}>
          {errorMessage}
        </p>
        <button
          className="btn-primary"
          onClick={handleRetry}
          disabled={retrying}
          style={{ marginTop: 12 }}
        >
          {retrying ? "重试中..." : "重试搜索"}
        </button>
      </section>
    );
  }

  const isProcessing = status === "processing";
  return (
    <section className="research-loading">
      <div className="research-loading-spinner" aria-label="加载中" />
      <h3>正在调研市场...</h3>
      <p>
        关键词：<strong>{keyword}</strong> · 已等待 {elapsed}s · 预计 15~30s
      </p>
      <p style={{ fontSize: 12, color: "#8b949e", marginTop: 6 }}>
        {isProcessing ? "后台正在调用 Apify Ozon Scraper 抓取真实商品。" : "任务已排队，等待执行..."}
        <br />
        页面不会卡顿，你可以继续浏览其他页面，完成后自动刷新结果。
      </p>
    </section>
  );
}
