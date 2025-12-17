import { LoginForm } from "@/components/auth/login-form";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Login | Peekaboo Billing",
};

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6 border p-8 rounded-lg shadow-2xl bg-white sm:py-12 sm:px-10">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
          <p className="text-sm text-muted-foreground">Access your dashboard</p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
