"use client";
import React, { useState, useCallback } from "react";
import { signIn } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FirebaseError } from "firebase/app";
import { IoEyeOffSharp, IoEyeSharp } from "react-icons/io5";

interface Props {
  redirectTo?: string;
}

const EMAIL_REGEX = /\S+@\S+\.\S+/;
const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[!@#$%^&*]).{8,}$/;

const ERROR_MESSAGES: Record<string, string> = {
  "auth/configuration-not-found": "Email/Password sign-in is not enabled. Enable it in Firebase Console → Authentication.",
  "auth/operation-not-allowed": "Email/Password sign-in is not enabled. Enable it in Firebase Console → Authentication.",
  "auth/user-not-found": "No account found for this email !",
  "auth/wrong-password": "Incorrect email or password !",
  "auth/invalid-credential": "Incorrect email or password !",
  "auth/too-many-requests": "Too many attempts. Please wait a minute and try again.",
  "auth/network-request-failed": "Network error. Check your connection and try again.",
};

export const LoginForm: React.FC<Props> = ({ redirectTo = "/dashboard" }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passwordVisible, setPasswordVisible] = useState(false);

  const isEmailValid = useCallback((value: string) => EMAIL_REGEX.test(value), []);
  const isPasswordValid = useCallback((value: string) => PASSWORD_REGEX.test(value), []);
  const isFormValid = email && password;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isEmailValid(email)) {
      setError("Invalid email format");
      return;
    }

    if (!isPasswordValid(password)) {
      setError("Password must be 8+ characters with uppercase, lowercase, number, and special character.");
      return;
    }

    setLoading(true);
    try {
      await signIn(email, password);
      window.location.href = redirectTo;
    } catch (err) {
      const message = err instanceof FirebaseError
        ? ERROR_MESSAGES[err.code] || "Login failed"
        : err instanceof Error
        ? err.message
        : "Login failed";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="email">Email</label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          disabled={loading}
        />
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="password">Password</label>
        <div className="relative">
          <Input
            id="password"
            type={passwordVisible ? "text" : "password"}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            disabled={loading}
          />
          <button
            type="button"
            onClick={() => setPasswordVisible(!passwordVisible)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
            tabIndex={-1}
          >
            {passwordVisible ? <IoEyeOffSharp /> : <IoEyeSharp />}
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-destructive text-red-500">{error}</p>}

      <Button
        type="submit"
        disabled={loading || !isFormValid}
        className={`w-full
          ${loading || !isFormValid ? "opacity-50 cursor-not-allowed bg-gray-500" 
            : "bg-gray-600 hover:bg-gray-700 text-white"}
        `}
      >
        {loading ? "Signing in..." : "Sign In"}
      </Button>
    </form>
  );
};
