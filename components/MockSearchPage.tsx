import { AppShell } from "@/components/AppShell";
import { searchMockProducts } from "@/lib/services/mock-market";
import { addMockProductToPool } from "@/app/research/actions";

type UserForShell = {
  email: string;
  role: "user" | "admin";
  status: string;
  plan: string;
};

export function MockSearchPage({
  user,
  source,
  title,
  eyebrow,
  description,
  searchParams
}: {
  user: UserForShell;
  source: "ozon" | "source_1688";
  title: string;
  eyebrow: string;
  description: string;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const keyword = typeof searchParams.keyword === "string" ? searchParams.keyword : "";
  const hot = searchParams.hot === "week" || searchParams.hot === "month" ? searchParams.hot : "";
  const sort = searchParams.sort === "price" ? "price" : "sales";
  const minPrice = typeof searchParams.minPrice === "string" && searchParams.minPrice ? Number(searchParams.minPrice) : undefined;
  const maxPrice = typeof searchParams.maxPrice === "string" && searchParams.maxPrice ? Number(searchParams.maxPrice) : undefined;
  const products = searchMockProducts({ source, keyword, hot, sort, minPrice, maxPrice });

  return (
    <AppShell title={title} eyebrow={eyebrow} user={user}>
      <form className="ledger-card grid gap-3 p-4 md:grid-cols-[1.4fr_0.7fr_0.7fr_0.8fr_0.8fr_auto]">
        <label className="block">
          <span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-steel">关键词</span>
          <input className="field" name="keyword" defaultValue={keyword} placeholder="bottle, led, storage" />
        </label>
        <label className="block">
          <span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-steel">最低价</span>
          <input className="field" name="minPrice" type="number" min="0" step="0.1" defaultValue={minPrice} />
        </label>
        <label className="block">
          <span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-steel">最高价</span>
          <input className="field" name="maxPrice" type="number" min="0" step="0.1" defaultValue={maxPrice} />
        </label>
        <label className="block">
          <span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-steel">榜单</span>
          <select className="field" name="hot" defaultValue={hot}>
            <option value="">全部</option>
            <option value="week">周热销前20</option>
            <option value="month">月热销前20</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-steel">排序</span>
          <select className="field" name="sort" defaultValue={sort}>
            <option value="sales">销量排序</option>
            <option value="price">价格升序</option>
          </select>
        </label>
        <button className="btn-primary mt-6 h-[46px]">搜索</button>
      </form>

      <div className="mt-5 flex items-center justify-between">
        <p className="max-w-3xl text-sm leading-6 text-steel">{description}</p>
        <span className="text-sm font-bold text-accent">mock {products.length} items</span>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {products.map((product) => (
          <article key={product.id} className="ledger-card p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-accent">{product.source === "ozon" ? "Ozon" : "1688"}</p>
                <h3 className="mt-2 font-display text-2xl leading-7">{product.title}</h3>
              </div>
              <strong className="text-mint">{product.sales.toLocaleString()}</strong>
            </div>
            <p className="mt-3 min-h-12 text-sm leading-6 text-steel">{product.description}</p>
            <div className="mt-4 flex items-end justify-between">
              <div>
                <p className="text-xs text-steel">价格</p>
                <p className="font-display text-3xl">{product.source === "ozon" ? "₽" : "¥"}{product.price}</p>
              </div>
              <form action={addMockProductToPool.bind(null, product.id)}>
                <button className="btn-primary">加入商品池</button>
              </form>
            </div>
          </article>
        ))}
      </div>
    </AppShell>
  );
}
