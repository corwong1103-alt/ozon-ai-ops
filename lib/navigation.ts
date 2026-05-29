import {
  Bot,
  ClipboardList,
  Coins,
  Gauge,
  Images,
  Megaphone,
  Search,
  ShieldCheck,
  ShoppingBag,
  Store
} from "lucide-react";

export const mainNavItems = [
  { href: "/dashboard", label: "Dashboard", icon: Gauge },
  { href: "/stores", label: "Ozon 店铺", icon: Store },
  { href: "/research/ozon", label: "Ozon 调研", icon: Search },
  { href: "/collector", label: "1688 采集", icon: ShoppingBag },
  { href: "/products", label: "商品池", icon: Images },
  { href: "/credits", label: "AI额度", icon: Coins },
  { href: "/social", label: "社媒发布", icon: Megaphone },
  { href: "/customer", label: "客服助手", icon: Bot },
  { href: "/tasks", label: "任务记录", icon: ClipboardList },
  { href: "/admin", label: "管理后台", icon: ShieldCheck, adminOnly: true }
];
