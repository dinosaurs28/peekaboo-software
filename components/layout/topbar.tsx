"use client";
import { Avatar } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Bell } from "lucide-react";

export function Topbar() {
  return (
    <header className="h-14 border-b flex items-center gap-4 px-4 bg-background">
      <div className="flex-1 flex items-center gap-4">
        <div className="relative max-w-sm w-full">
          <Input placeholder="Search..." className="pl-4" />
        </div>
      </div>
      <button className="relative rounded-full p-2 hover:bg-muted text-muted-foreground" aria-label="Notifications">
        <Bell className="h-5 w-5" />
      </button>
      <Avatar fallback="A" />
    </header>
  );
}
