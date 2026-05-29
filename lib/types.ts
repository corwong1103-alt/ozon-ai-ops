export type UserRole = "user" | "admin";
export type UserStatus = "pending" | "approved" | "expired" | "suspended";
export type UserPlan = "starter" | "pro" | "vip";

export type TaskType =
  | "collect"
  | "research"
  | "translate"
  | "image"
  | "video"
  | "upload"
  | "social_post"
  | "social_video"
  | "social_publish"
  | "customer_message"
  | "auto_reply"
  | "alert";

export type TaskStatus = "queued" | "processing" | "success" | "failed";

export interface Store {
  id: string;
  name: string;
  ozonStoreId: string;
  ozonClientId: string;
  createdAt: string;
}

export interface Product {
  id: string;
  title: string;
  description: string;
  price: number;
  source: "ozon" | "source_1688" | "manual";
  status: "draft" | "translated" | "image_generated" | "video_generated" | "uploaded";
  images: string[];
  createdAt: string;
}

export interface TaskLog {
  id: string;
  type: TaskType;
  status: TaskStatus;
  creditCost: number;
  message: string;
  createdAt: string;
}
