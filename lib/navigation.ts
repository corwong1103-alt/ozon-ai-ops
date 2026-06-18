import {
  Bot,
  Boxes,
  ClipboardList,
  Coins,
  Database,
  Gauge,
  KeyRound,
  Megaphone,
  Search,
  Settings,
  Store,
  Users
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: typeof Gauge;
};

// V3 Seller 后台菜单（7 项）
export const sellerNavItems: NavItem[] = [
  { href: "/dashboard", label: "首页", icon: Gauge },
  { href: "/research/ozon", label: "市场研究", icon: Search },
  { href: "/products", label: "商品中心", icon: Boxes },
  { href: "/content", label: "内容中心", icon: Megaphone },
  { href: "/stores", label: "店铺中心", icon: Store },
  { href: "/membership", label: "会员中心", icon: Coins }
];

// V3 Admin 后台菜单（7 项）
export const adminNavItems: NavItem[] = [
  { href: "/admin", label: "控制台", icon: Gauge },
  { href: "/admin/customers", label: "客户管理", icon: Users },
  { href: "/admin/datasources", label: "数据源中心", icon: Database },
  { href: "/admin/ai", label: "AI 中心", icon: Bot },
  { href: "/integrations", label: "集成中心", icon: KeyRound },
  { href: "/tasks", label: "任务中心", icon: ClipboardList },
  { href: "/admin/settings", label: "系统设置", icon: Settings }
];

// 兼容旧引用（逐步迁移）
export const mainNavItems = sellerNavItems;
