"use client";

import { LogOut } from "lucide-react";

type LogoutFormProps = {
  className?: string;
  buttonClassName?: string;
  showIcon?: boolean;
  label?: string;
};

function clearOzonSessionStorage() {
  try {
    for (let index = sessionStorage.length - 1; index >= 0; index -= 1) {
      const key = sessionStorage.key(index);
      if (key && (key.startsWith("ozon_") || key.startsWith("rc_"))) {
        sessionStorage.removeItem(key);
      }
    }
  } catch {
    // Logout must continue even if browser storage is unavailable.
  }
}

export function LogoutForm({
  className,
  buttonClassName = "btn-primary",
  showIcon = false,
  label = "退出登录"
}: LogoutFormProps) {
  return (
    <form action="/api/auth/logout" method="post" className={className} onSubmit={clearOzonSessionStorage}>
      <button className={buttonClassName}>
        {showIcon && <LogOut size={13} />}
        {label}
      </button>
    </form>
  );
}
