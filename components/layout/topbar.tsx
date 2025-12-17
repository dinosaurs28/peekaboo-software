"use client";
import { Avatar } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Bell } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { signOut } from "@/lib/auth";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { DropdownPanel } from "@/components/ui/dropdown-panel";
import { observeLowStockProducts } from "@/lib/products";
import type { ProductDoc } from "@/lib/models";
import Link from "next/link";

export function Topbar() {
  const { user, role } = useAuth();
  const [open, setOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [lowItems, setLowItems] = useState<ProductDoc[]>([]);
  const notifRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const lowCount = lowItems.length;
  const isAdmin = role === "admin";

  useEffect(() => {
    const unsub = observeLowStockProducts(setLowItems);
    return () => unsub?.();
  }, []);

  const handleClickOutside = useCallback(
    (e: MouseEvent, ref: React.RefObject<HTMLDivElement | null>, setter: (v: boolean) => void) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setter(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!notifOpen) return;
    const handler = (e: MouseEvent) => handleClickOutside(e, notifRef, setNotifOpen);
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [notifOpen, handleClickOutside]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => handleClickOutside(e, menuRef, setOpen);
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, handleClickOutside]);

  const handleSignOut = useCallback(() => {
    signOut().finally(() => {
      window.location.href = "/login";
    });
  }, []);

  return (
    <header className="h-14 border-b flex items-center gap-4 px-4 bg-background relative">
      <div className="flex-1 flex justify-center">
        <div className="relative max-w-sm w-full">
          <Input placeholder="Search..." 
          className="pl-4 rounded-4xl shadow-sm outline-none 
          focus:ring focus:ring-ring placeholder:focus:outline-none" />
        </div>
      </div>

      {/* Notifications */}
      <div className="relative" ref={notifRef}>
        <button
          className="relative rounded-full p-2 hover:bg-muted text-muted-foreground"
          aria-label="Notifications"
          onClick={() => setNotifOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={notifOpen}
        >
          <Bell className="h-5 w-5" />
          {isAdmin && lowCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] leading-4 text-center">
              {lowCount}
            </span>
          )}
        </button>

        {notifOpen && (
          <DropdownPanel className="absolute right-0 w-80">
            <div className="px-3 py-2 border-b text-sm font-medium">Notifications</div>
            <div className="max-h-72 overflow-auto p-2">
              {lowItems.length === 0 ? (
                <div className="text-xs text-muted-foreground px-2 py-4">No low stock items.</div>
              ) : (
                <ul className="space-y-2">
                  {lowItems.map((product) => (
                    <li key={product.id} className="flex items-start justify-between gap-2 text-sm">
                      <div className="min-w-0">
                        <div className="font-medium truncate">Low Stock</div>
                        <div className="text-xs text-muted-foreground truncate">{product.name}</div>
                      </div>
                      <Link href={isAdmin ? `/products/${product.id}` : "/products"}>
                        <Button size="sm" variant="outline">View</Button>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="p-2 border-t text-right">
              <Link href="/products">
                <Button size="sm" variant="ghost">View all</Button>
              </Link>
            </div>
          </DropdownPanel>
        )}
      </div>

      {/* User Menu */}
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={open}
          className="rounded-full"
        >
          <Avatar fallback={(user?.email?.[0] || "U").toUpperCase()} />
        </button>
        {open && (
          <DropdownPanel className="absolute right-0 w-40">
            <div className="px-3 py-2 text-xs text-muted-foreground border-b">
              {user?.email || "Signed in"}
            </div>
            <div className="p-2">
              <Button variant="outline" className="w-full justify-start" onClick={handleSignOut}>
                Sign out
              </Button>
            </div>
          </DropdownPanel>
        )}
      </div>
    </header>
  );
}
