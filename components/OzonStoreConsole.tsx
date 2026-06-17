"use client";

import { useState } from "react";
import { Activity, ArrowRight, Boxes, ClipboardCheck, DatabaseZap, KeyRound, PackageSearch, Plus, RefreshCw, ShoppingBag, Warehouse } from "lucide-react";
import Link from "next/link";

type StoreConsoleItem = {
  id: string;
  name: string;
  ozonStoreId: string;
  ozonClientId: string;
  apiKeyState: string;
  createdAt: string;
};

type ProbeResource = "roles" | "warehouses" | "products" | "orders";

type ProbeResult = {
  ok: boolean;
  resource: ProbeResource;
  label: string;
  endpoint: string;
  status?: number;
  count?: number;
  summary: string;
  preview?: Array<Record<string, unknown>>;
  message?: string;
};

type SyncResult = {
  ok: boolean;
  mode: "products" | "orders";
  total: number;
  created: number;
  updated: number;
  summary: string;
};

const probes: Array<{ resource: ProbeResource; label: string; icon: typeof KeyRound }> = [
  { resource: "roles", label: "权限", icon: KeyRound },
  { resource: "warehouses", label: "仓库", icon: Warehouse },
  { resource: "products", label: "商品", icon: PackageSearch },
  { resource: "orders", label: "订单", icon: ShoppingBag }
];

function resultKey(storeId: string, resource: ProbeResource) {
  return `${storeId}:${resource}`;
}

function formatJson(value: unknown) {
  if (value === undefined) return "";
  return JSON.stringify(value, null, 2);
}

export function OzonStoreConsole({ stores }: { stores: StoreConsoleItem[] }) {
  const [results, setResults] = useState<Record<string, ProbeResult>>({});
  const [syncResults, setSyncResults] = useState<Record<string, SyncResult>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  async function runProbe(storeId: string, resource: ProbeResource) {
    const key = resultKey(storeId, resource);
    setLoading((current) => ({ ...current, [key]: true }));

    try {
      const response = await fetch(`/api/stores/${storeId}/ozon-probe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resource })
      });
      const data = await response.json();
      setResults((current) => ({
        ...current,
        [key]: data.result || {
          ok: false,
          resource,
          label: resource,
          endpoint: "",
          summary: data.error || "测试失败。"
        }
      }));
    } finally {
      setLoading((current) => ({ ...current, [key]: false }));
    }
  }

  async function runAllProbes(storeId: string) {
    for (const probe of probes) {
      await runProbe(storeId, probe.resource);
    }
  }

  async function runSync(storeId: string, mode: "products" | "orders") {
    const key = `${storeId}:sync:${mode}`;
    setLoading((current) => ({ ...current, [key]: true }));

    try {
      const response = await fetch(`/api/stores/${storeId}/ozon-sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode })
      });
      const data = await response.json();
      setSyncResults((current) => ({
        ...current,
        [key]: data.result || {
          ok: false,
          mode,
          total: 0,
          created: 0,
          updated: 0,
          summary: data.error || "同步失败。"
        }
      }));
    } finally {
      setLoading((current) => ({ ...current, [key]: false }));
    }
  }

  const latestStore = stores[0];
  const successfulChecks = Object.values(results).filter((result) => result.ok).length;
  const totalChecks = stores.length * probes.length;

  return (
    <div className="store-console">
      <section className="store-console-head">
        <div>
          <p className="section-kicker">Ozon Seller API</p>
          <h3>店铺接口健康度。</h3>
          <p>先读权限、仓库、商品和订单。写入类动作保留到真实数据确认后再打开。</p>
        </div>
        <div className="store-summary-strip">
          <div>
            <span>已绑定</span>
            <strong>{stores.length}</strong>
          </div>
          <div>
            <span>通过</span>
            <strong>{successfulChecks}</strong>
          </div>
          <div>
            <span>总检查</span>
            <strong>{totalChecks}</strong>
          </div>
        </div>
      </section>

      <section className="store-action-bar">
        <div>
          <Activity size={16} />
          <span>{latestStore ? `建议先检测 ${latestStore.name} 的 4 个只读接口。` : "先绑定一个 Ozon 店铺，再开始接口检测。"}</span>
        </div>
        <div className="store-action-buttons">
          <Link href="/stores/new" className="btn-primary">
            <Plus size={15} />
            绑定店铺
          </Link>
          {latestStore && (
            <button className="btn-secondary" onClick={() => runAllProbes(latestStore.id)}>
              <RefreshCw size={15} />
              一键检测
            </button>
          )}
        </div>
      </section>

      {stores.length === 0 ? (
        <section className="store-empty">
          <Boxes className="mx-auto text-steel" size={28} />
          <p className="mt-3 text-sm text-steel">暂无绑定店铺。先生成 Ozon Seller API Key，再绑定到这里。</p>
        </section>
      ) : (
        <section className="store-card-list">
          {stores.map((store) => (
            <div key={store.id} className="store-card">
              <div className="store-card-top">
                <div>
                  <div className="store-title-line">
                    <h4>{store.name}</h4>
                    <span className="status-chip">Client ID {store.ozonClientId}</span>
                    <span className="status-chip">{store.apiKeyState}</span>
                  </div>
                  <p>
                    店铺标识：{store.ozonStoreId} · 接入时间：{store.createdAt}
                  </p>
                </div>
                <div className="store-probe-buttons">
                  {probes.map((probe) => {
                    const Icon = probe.icon;
                    const key = resultKey(store.id, probe.resource);
                    return (
                      <button
                        key={probe.resource}
                        className="btn-secondary"
                        disabled={Boolean(loading[key])}
                        onClick={() => runProbe(store.id, probe.resource)}
                      >
                        {loading[key] ? <RefreshCw size={16} className="animate-spin" /> : <Icon size={16} />}
                        {probe.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="store-probe-grid">
                {probes.map((probe) => {
                  const key = resultKey(store.id, probe.resource);
                  const result = results[key];
                  return (
                    <div key={probe.resource} className="store-probe-cell">
                      <div className="store-probe-title">
                        <p>{probe.label}</p>
                        {result ? (
                          <span className={result.ok ? "text-xs font-bold text-mint" : "text-xs font-bold text-rust"}>
                            {result.status || "ERR"}
                          </span>
                        ) : (
                          <span className="text-xs text-steel/70">未测试</span>
                        )}
                      </div>
                      {result ? (
                        <div className="mt-3">
                          <p className="store-probe-summary">{result.summary}</p>
                          <p className="store-probe-endpoint">{result.endpoint}</p>
                          {typeof result.count === "number" && <p className="store-probe-count">{result.count}</p>}
                          {result.message && <p className="mt-3 text-xs leading-5 text-rust">{result.message}</p>}
                          {Array.isArray(result.preview) && result.preview.length > 0 && (
                            <div className="store-preview-table">
                              <table className="w-full min-w-72 text-left text-xs">
                                <thead className="bg-rail/70 text-steel">
                                  <tr>
                                    {Object.keys(result.preview[0]).map((field) => (
                                      <th key={field} className="border-b border-line px-2 py-2 font-bold">{field}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {result.preview.map((row, index) => (
                                    <tr key={index} className="border-b border-line last:border-b-0">
                                      {Object.values(row).map((value, valueIndex) => (
                                        <td key={valueIndex} className="max-w-52 truncate px-2 py-2 text-steel" title={typeof value === "string" ? value : formatJson(value)}>
                                          {Array.isArray(value) ? value.length : String(value ?? "")}
                                        </td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="mt-8 flex items-center gap-2 text-sm text-steel">
                          <ClipboardCheck size={16} />
                          等待点击测试
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="store-sync-row">
                <button
                  className="btn-primary"
                  disabled={Boolean(loading[`${store.id}:sync:products`])}
                  onClick={() => runSync(store.id, "products")}
                >
                  {loading[`${store.id}:sync:products`] ? <RefreshCw size={17} className="animate-spin" /> : <DatabaseZap size={17} />}
                  同步真实商品到商品池
                </button>
                <button
                  className="btn-secondary"
                  disabled={Boolean(loading[`${store.id}:sync:orders`])}
                  onClick={() => runSync(store.id, "orders")}
                >
                  {loading[`${store.id}:sync:orders`] ? <RefreshCw size={17} className="animate-spin" /> : <ShoppingBag size={17} />}
                  同步订单到任务记录
                </button>
                <div className="store-path-card">
                  <p>完整测试路径</p>
                  <p>同步商品后去商品池处理标题、描述、图片；同步订单后去任务记录确认链路。AI 生图/视频最后再测。</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Link href="/products">
                      去商品池 <ArrowRight size={13} />
                    </Link>
                    <Link href="/tasks">
                      去任务记录 <ArrowRight size={13} />
                    </Link>
                  </div>
                </div>
                {(syncResults[`${store.id}:sync:products`] || syncResults[`${store.id}:sync:orders`]) && (
                  <div className="store-sync-result-grid">
                    {(["products", "orders"] as const).map((mode) => {
                      const result = syncResults[`${store.id}:sync:${mode}`];
                      if (!result) return null;
                      return (
                        <div key={mode} className="border border-line bg-cotton p-3">
                          <p className="text-xs font-bold uppercase text-accent">{mode === "products" ? "商品同步" : "订单同步"}</p>
                          <p className="mt-1 text-sm font-semibold">{result.summary}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
