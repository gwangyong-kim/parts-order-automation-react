"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Layers, Loader2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const result = await signIn("credentials", {
        username,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("아이디 또는 비밀번호가 올바르지 않습니다.");
      } else {
        router.push(callbackUrl);
        router.refresh();
      }
    } catch {
      setError("로그인 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="w-full max-w-md px-4">
        <div className="login-card">
          {/* Logo */}
          <div className="login-logo">
            <Layers className="w-8 h-8 text-white" />
          </div>

          {/* Title */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-white tracking-tight">PartSync</h1>
            <p className="text-white/50 text-sm mt-1">MRP 시스템에 로그인하세요</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-[var(--danger-500)]/10 border border-[var(--danger-500)]/30 text-[var(--danger-500)] px-4 py-3 rounded-xl text-sm animate-slide-up">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="username" className="block text-sm font-medium text-white/70 mb-2">
                아이디
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="login-input w-full px-4 py-3 rounded-xl text-sm"
                placeholder="아이디를 입력하세요"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-white/70 mb-2">
                비밀번호
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="login-input w-full px-4 py-3 rounded-xl text-sm"
                placeholder="비밀번호를 입력하세요"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="login-button w-full py-3.5 px-4 text-white font-medium rounded-xl transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  로그인 중...
                </>
              ) : (
                "로그인"
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-white/10 text-center">
            <p className="text-white/30 text-xs">
              기본 계정: <span className="text-white/50">admin</span> / <span className="text-white/50">admin123</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
