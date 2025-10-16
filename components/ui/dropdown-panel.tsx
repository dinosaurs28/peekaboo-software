"use client";
import React from "react";
import { cn } from "@/lib/utils";

type Props = React.PropsWithChildren<{
  className?: string;
}>;

// Opaque dropdown/popover surface with consistent styling across app
// Usage: position with parent (e.g., absolute right-0), pass width via className
export function DropdownPanel({ className, children }: Props) {
  return (
    <div
      className={cn(
        "mt-2 rounded-md border shadow-lg",
        "bg-background text-foreground",
        "bg-white dark:bg-neutral-900 backdrop-blur-0",
        "z-20",
        className
      )}
    >
      {children}
    </div>
  );
}
