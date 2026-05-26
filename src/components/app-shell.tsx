"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, BarChart3, FileText, MessageCircle, MessageSquareText, Package, Settings, UploadCloud } from "lucide-react";
import clsx from "clsx";
import type { ReactNode } from "react";

const nav = [
  { href: "/products", label: "Товары", icon: Package },
  { href: "/products/new", label: "Новый товар", icon: UploadCloud },
  { href: "/publications", label: "Публикации", icon: BarChart3 },
  { href: "/reviews", label: "Отзывы", icon: MessageSquareText },
  { href: "/messages", label: "Сообщения", icon: MessageCircle },
  { href: "/message-rules", label: "Правила чата", icon: FileText },
  { href: "/templates", label: "Шаблоны отзывов", icon: FileText },
  { href: "/automation", label: "Автоматизация", icon: Activity },
  { href: "/settings", label: "Настройки", icon: Settings },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-line bg-white lg:flex lg:flex-col">
        <div className="border-b border-line px-5 py-5">
          <p className="text-xs font-semibold uppercase text-sea">Avito Manager</p>
          <h2 className="mt-1 text-xl font-semibold">SEB0G1SHOPCHIK</h2>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {nav.map((item) => {
            const Icon = item.icon;
            const active =
              item.href === "/products"
                ? pathname === "/products"
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                className={clsx(
                  "flex h-11 items-center gap-3 rounded-md px-3 text-sm font-semibold transition",
                  active ? "bg-teal-50 text-sea" : "text-zinc-700 hover:bg-canvas hover:text-ink",
                )}
                href={item.href}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="lg:pl-64">
        <div className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-line bg-white px-4 lg:hidden">
          <Link className="font-semibold" href="/products">
            SEB0G1SHOPCHIK
          </Link>
          <Link className="text-sm font-semibold text-sea" href="/settings">
            Настройки
          </Link>
        </div>
        {children}
      </div>
    </div>
  );
}
