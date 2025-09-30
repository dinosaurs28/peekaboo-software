"use client";
import { useEffect } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth";

export default function DashboardPage() {
  const { user, role, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      window.location.href = "/(auth)/login";
    }
  }, [user, loading]);

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  if (!user) return null; // Redirect in progress

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">Dashboard</h1>
      <p className="text-sm text-muted-foreground">
        Signed in as <span className="font-medium">{user.email}</span> ({role})
      </p>
      <div className="flex gap-2">
        <Button onClick={() => signOut().then(() => (window.location.href = "/(auth)/login"))} variant="outline">Sign out</Button>
        {role === "admin" && (
          <Button variant="secondary">Admin Action Placeholder</Button>
        )}
      </div>
    </div>
  );
}
