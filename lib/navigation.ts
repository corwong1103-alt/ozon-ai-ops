import {
  BarChart3,
  Bot,
  Boxes,
  CheckCircle2,
  ClipboardList,
  Coins,
  Database,
  Factory,
  FileText,
  Gauge,
  KeyRound,
  Megaphone,
  PackageSearch,
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

// V5 Seller 菜单：围绕卖家工作流（选品→商品工厂→已发布）
export const sellerNavItems: NavItem[] = [
  { href: "/dashboard", label: "首页", icon: Gauge },
  { href: "/research", label: "选品中心", icon: Search },
  { href: "/factory", label: "商品工厂", icon: Factory },
  { href: "/published", label: "已发布商品", icon: CheckCircle2 },
  { href: "/stores", label: "店铺管理", icon: Store },
  { href: "/membership", label: "账户中心", icon: Coins }
];

// V4 Admin 后台菜单（7 项，不变）
export const adminNavItems: NavItem[] = [
  { href: "/admin", label: "控制台", icon: Gauge },
  { href: "/admin/customers", label: "客户管理", icon: Users },
  { href: "/admin/datasources", label: "数据源中心", icon: Database },
  { href: "/admin/ai", label: "AI 中心", icon: Bot },
  { href: "/integrations", label: "集成中心", icon: KeyRound },
  { href: "/tasks", label: "任务中心", icon: ClipboardList },
  { href: "/admin/settings", label: "系统设置", icon: Settings }
];

// 兼容旧引用
export const mainNavItems = sellerNavItems;
