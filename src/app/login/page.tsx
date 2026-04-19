"use client";

import { useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { isValidEmail } from "@/lib/validation";

const authProvider = process.env.NEXT_PUBLIC_AUTH_PROVIDER || "credentials";
const showCredentials = authProvider !== "google";
const showGoogle = authProvider !== "credentials";

export default function LoginPage() {
  const t = useTranslations("Auth");
  const hydrated = useSyncExternalStore(() => () => {}, () => true, () => false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";

  const handleCredentialsSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const form = new FormData(e.currentTarget);
    const email = (form.get("email") as string).trim();
    const password = form.get("password") as string;

    const newErrors: Record<string, string> = {};
    if (!email) newErrors.email = t("emailRequired");
    else if (!isValidEmail(email)) newErrors.email = t("invalidCredentials");
    if (!password) newErrors.password = t("passwordRequired");

    if (Object.keys(newErrors).length > 0) {
      setFieldErrors(newErrors);
      setLoading(false);
      return;
    }
    setFieldErrors({});

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      // Check if user has a pending invite
      try {
        const preflight = await fetch("/api/auth/claim/preflight", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        const data = await preflight.json();
        if (data.hasPendingInvite) {
          window.location.href = `/claim?email=${encodeURIComponent(email)}`;
          return;
        }
      } catch {
        // Preflight check failed, show generic error
      }

      setError(t("invalidCredentials"));
      setLoading(false);
      return;
    }

    try {
      const passwordStatusRes = await fetch("/api/auth/password-status", {
        cache: "no-store",
      });
      const passwordStatus = await passwordStatusRes.json();
      if (passwordStatus.data?.forcePasswordChange) {
        window.location.href = `/change-password?callbackUrl=${encodeURIComponent(callbackUrl)}`;
        return;
      }
    } catch {
      // If the password status check fails, fall through to the normal redirect.
    }

    window.location.href = callbackUrl;
  };

  const handleGoogleSignIn = () => {
    setLoading(true);
    signIn("google", { callbackUrl });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="font-heading text-3xl font-bold tracking-tight">
            Event OS
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("signInTagline")}
          </p>
        </div>

        <Card>
          <CardContent className="p-6 space-y-4">
            {showGoogle && (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={!hydrated || loading}
                onClick={handleGoogleSignIn}
              >
                <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                {t("continueWithGoogle")}
              </Button>
            )}

            {showGoogle && showCredentials && (
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">{t("or")}</span>
                </div>
              </div>
            )}

            {showCredentials && (
              <form method="post" onSubmit={handleCredentialsSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email">{t("email")}</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="admin@devsummit.mn"
                    defaultValue={searchParams.get("email") || ""}
                    aria-invalid={!!fieldErrors.email}
                    onChange={() =>
                      setFieldErrors((prev) => {
                        const next = { ...prev };
                        delete next.email;
                        return next;
                      })
                    }
                  />
                  {fieldErrors.email && <p className="text-xs text-destructive">{fieldErrors.email}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">{t("password")}</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    placeholder={t("passwordMinLength")}
                    aria-invalid={!!fieldErrors.password}
                    onChange={() =>
                      setFieldErrors((prev) => {
                        const next = { ...prev };
                        delete next.password;
                        return next;
                      })
                    }
                  />
                  {fieldErrors.password && <p className="text-xs text-destructive">{fieldErrors.password}</p>}
                </div>
                {error && (
                  <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                    {error}
                  </div>
                )}
                <Button type="submit" className="w-full" disabled={!hydrated || loading}>
                  {!hydrated ? t("signingIn") : loading ? t("signingIn") : t("signIn")}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <div className="text-center text-sm text-muted-foreground mt-4 space-y-2">
          <p>
            <Link href="/claim" className="text-yellow-600 hover:underline">
              {t("haveInviteCode")}
            </Link>
          </p>
          <p>
            {t("noWorkspace")}{" "}
            <Link href="/onboarding" className="text-yellow-600 hover:underline">
              {t("createOne")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
