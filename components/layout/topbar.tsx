"use client";
import { Avatar } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Bell } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { signOut } from "@/lib/auth";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function Topbar() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  function handleSignOut() {
    signOut().finally(() => {
      window.location.href = "/login";
    });
  }

  return (
    <header className="h-14 border-b flex items-center gap-4 px-4 bg-background relative">
      <div className="flex-1 flex items-center gap-4">
        <div className="relative max-w-sm w-full">
          <Input placeholder="Search..." className="pl-4" />
        </div>
      </div>
      <button className="relative rounded-full p-2 hover:bg-muted text-muted-foreground" aria-label="Notifications">
        <Bell className="h-5 w-5" />
      </button>
      <div className="relative">
        <button onClick={() => setOpen((v) => !v)} aria-haspopup="menu" aria-expanded={open} className="rounded-full">
          <Avatar fallback={(user?.email?.[0] || "").toUpperCase() || "U"} />
        </button>
        {open && (
          <div className="absolute right-0 mt-2 w-40 rounded-md border bg-popover text-popover-foreground shadow-md z-10">
            <div className="px-3 py-2 text-xs text-muted-foreground border-b">
              {user?.email || "Signed in"}
            </div>
            <div className="p-2">
              <Button variant="outline" className="w-full justify-start" onClick={handleSignOut}>Sign out</Button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
