"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../context/AuthContext";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export default function LoginPage() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password })
    });

    if (!res.ok) {
      setError("Invalid credentials");
      return;
    }

    await refresh();
    router.push("/");
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#ffffff_0%,_#f8f4ee_45%,_#efe6d8_100%)] px-6">
      <div className="mx-auto max-w-md pt-24">
        <h1 className="font-display text-3xl">Login</h1>
        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <input
            type="email"
            placeholder="Email"
            className="w-full rounded-2xl border border-mist px-4 py-3"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <input
            type="password"
            placeholder="Password"
            className="w-full rounded-2xl border border-mist px-4 py-3"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {error ? <p className="text-sm text-accent">{error}</p> : null}
          <button
            type="submit"
            className="w-full rounded-full bg-ink px-4 py-3 text-xs uppercase tracking-[0.2em] text-paper"
          >
            Sign in
          </button>
          <div className="mt-4 text-center">
            <Link href="/register" className="text-sm text-ink/70 hover:text-ink">
              Need an account? Register here
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
