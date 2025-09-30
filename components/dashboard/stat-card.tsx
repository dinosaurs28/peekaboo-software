import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import React from "react";

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  subtext?: string;
  className?: string;
}

export function StatCard({ label, value, icon, subtext, className }: StatCardProps) {
  return (
    <Card className={cn("p-4 flex flex-col gap-2", className)}>
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground leading-none">{label}</p>
          <h3 className="text-2xl font-semibold leading-tight">{value}</h3>
          {subtext && <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">{subtext}</p>}
        </div>
        {icon && (
          <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center">
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
}
