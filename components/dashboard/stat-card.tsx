import { Card } from "@/components/ui/card";
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
    <Card className={cn("p-6 flex flex-col gap-1 shadow-sm", className)}>
      <p className="text-sm text-gray-500 font-normal">{label}</p>
      <h3 className="text-3xl font-bold text-gray-900 mt-1">{value}</h3>
      {subtext && <p className="text-xs text-gray-400 mt-1">{subtext}</p>}
    </Card>
  );
}
