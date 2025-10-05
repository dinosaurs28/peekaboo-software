"use client";
import React, { useState } from "react";
import { signIn } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FirebaseError } from "firebase/app";

interface Props {
  redirectTo?: string;
}

export const LoginForm: React.FC<Props> = ({ redirectTo = "/dashboard" }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email || !password) {
      setError("Email and password required");
      return;
    }
    setLoading(true);
    try {
      await signIn(email, password);
      window.location.href = redirectTo;
    } catch (err) {
      let message = err instanceof Error ? err.message : "Login failed";
      if (err instanceof FirebaseError) {
        switch (err.code) {
          case "auth/configuration-not-found":
          case "auth/operation-not-allowed":
            message = "Email/Password sign-in is not enabled for this Firebase project. In Firebase Console → Authentication, click 'Get started' and enable Email/Password.";
            break;
          case "auth/user-not-found":
            message = "No account found for this email. Create a user in Firebase Console → Authentication → Users, then try again.";
            break;
          case "auth/wrong-password":
          case "auth/invalid-credential":
            message = "Incorrect email or password. Please try again.";
            break;
          case "auth/too-many-requests":
            message = "Too many attempts. Please wait a minute and try again.";
            break;
          case "auth/network-request-failed":
            message = "Network error. Check your connection and try again.";
            break;
        }
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 w-full max-w-sm">
      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="email">Email</label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="password">Password</label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Signing in..." : "Sign In"}
      </Button>
    </form>
  );
};
