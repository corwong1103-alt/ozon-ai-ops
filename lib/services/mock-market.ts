import "server-only";

type Source = "ozon" | "source_1688";

export type MockMarketProduct = {
  id: string;
  source: Source;
  title: string;
  description: string;
  price: number;
  sales: number;
  images: string[];
  tags: string[];
};

const products: MockMarketProduct[] = [
  {
    id: "ozon_bottle",
    source: "ozon",
    title: "Умная термобутылка с дисплеем температуры",
    description: "Ozon 热销智能温显保温杯，适合通勤、户外和礼品场景。",
    price: 1290,
    sales: 8420,
    images: ["https://example.com/ozon-bottle.jpg"],
    tags: ["hot-week", "gift", "bottle"]
  },
  {
    id: "ozon_led",
    source: "ozon",
    title: "Светодиодная RGB лента с пультом",
    description: "RGB 氛围灯带，适合家居装饰、游戏桌和短视频场景。",
    price: 799,
    sales: 15110,
    images: ["https://example.com/ozon-led.jpg"],
    tags: ["hot-month", "electronics", "led"]
  },
  {
    id: "ozon_storage",
    source: "ozon",
    title: "Органайзер для хранения одежды",
    description: "折叠衣物收纳箱，适合家庭整理与跨境家居品类。",
    price: 990,
    sales: 5640,
    images: ["https://example.com/ozon-storage.jpg"],
    tags: ["hot-week", "home", "storage"]
  },
  {
    id: "1688_bottle",
    source: "source_1688",
    title: "316 不锈钢智能温显保温杯",
    description: "带温度显示，礼盒包装，可做俄文详情页。",
    price: 29.8,
    sales: 18942,
    images: ["https://example.com/1688-bottle.jpg"],
    tags: ["hot-week", "gift", "bottle"]
  },
  {
    id: "1688_led",
    source: "source_1688",
    title: "RGB LED 灯带套装",
    description: "遥控调色，低客单价，高动销潜力。",
    price: 18.6,
    sales: 26310,
    images: ["https://example.com/1688-led.jpg"],
    tags: ["hot-month", "electronics", "led"]
  },
  {
    id: "1688_storage",
    source: "source_1688",
    title: "可折叠衣物收纳箱",
    description: "透明窗口，适合跨境家居收纳类目。",
    price: 13.5,
    sales: 11672,
    images: ["https://example.com/1688-storage.jpg"],
    tags: ["hot-week", "home", "storage"]
  }
];

export function searchMockProducts(options: {
  source: Source;
  keyword?: string;
  hot?: "week" | "month" | "";
  minPrice?: number;
  maxPrice?: number;
  sort?: "sales" | "price";
}) {
  const keyword = options.keyword?.trim().toLowerCase();

  return products
    .filter((product) => product.source === options.source)
    .filter((product) => {
      const text = `${product.title} ${product.description} ${product.tags.join(" ")}`.toLowerCase();
      const matchesKeyword = !keyword || text.includes(keyword);
      const matchesHot = !options.hot || product.tags.includes(`hot-${options.hot}`);
      const matchesMin = options.minPrice === undefined || product.price >= options.minPrice;
      const matchesMax = options.maxPrice === undefined || product.price <= options.maxPrice;
      return matchesKeyword && matchesHot && matchesMin && matchesMax;
    })
    .sort((a, b) => {
      if (options.sort === "price") return a.price - b.price;
      return b.sales - a.sales;
    })
    .slice(0, 20);
}

export function getMockProduct(id: string) {
  return products.find((product) => product.id === id);
}
