"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth/auth-provider";
import { Avatar } from "@/components/ui/avatar";

const baseNav = [
  { href: "/", label: "Dashboard", icon: "🏠" },
  { href: "/products", label: "Products", icon: "📦" },
  { href: "/customers", label: "Customers", icon: "👥" },
  { href: "/invoices", label: "Invoices", icon: "📄" },
  { href: "/reports", label: "Reports", icon: "�" },
] as const;

export function Sidebar() {
  const { role, user } = useAuth();
  const navItems = role === 'admin'
    ? [...baseNav, { href: "/settings", label: "Settings", icon: "⚙️" }]
    : baseNav;
  const pathname = usePathname();
  return (
    <aside className="hidden md:flex md:flex-col w-56 border-r bg-background">
      <div className="h-14 flex items-center px-4 font-semibold text-lg tracking-tight">
        <span className="flex items-center gap-2"><span className="text-primary">🧾</span> Billing Co.</span>
      </div>
      <nav className="flex-1 px-2 py-2 space-y-1">
        {navItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 flex items-center gap-3 border-t">
        <Avatar fallback={(user?.email?.[0] || 'U').toUpperCase()} />
        <div className="text-xs">
          <p className="font-medium">{user?.email || 'User'}</p>
          <p className="text-muted-foreground">{role || 'cashier'}</p>
        </div>
      </div>
    </aside>
  );
}
