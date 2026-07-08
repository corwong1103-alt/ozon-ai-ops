import {
  Bot,
  CheckCircle2,
  ClipboardList,
  Coins,
  Database,
  Gauge,
  KeyRound,
  HelpCircle,
  PackageSearch,
  PenLine,
  Rocket,
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

// V6 Seller 菜单：只暴露卖家能理解的工作流语言。
export const sellerNavItems: NavItem[] = [
  { href: "/dashboard", label: "首页", icon: Gauge },
  { href: "/research", label: "发现商品", icon: Search },
  { href: "/factory", label: "商品制作", icon: PenLine },
  { href: "/factory/drafts", label: "待发布", icon: Rocket },
  { href: "/published", label: "已发布", icon: CheckCircle2 },
  { href: "/stores", label: "店铺管理", icon: Store },
  { href: "/membership", label: "账户中心", icon: Coins },
  { href: "/settings", label: "设置", icon: Settings },
  { href: "/help", label: "帮助中心", icon: HelpCircle }
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
