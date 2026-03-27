"use client";

import { useState, useRef } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { isValidEmail } from "@/lib/validation";

const authProvider = process.env.NEXT_PUBLIC_AUTH_PROVIDER || "credentials";

type Step = "email" | "code" | "setup";

export default function ClaimPage() {
  const searchParams = useSearchParams();
  const initialEmail = searchParams.get("email") || "";

  const [step, setStep] = useState<Step>(initialEmail ? "code" : "email");
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState(Array(8).fill(""));
  const [claimToken, setClaimToken] = useState("");
  const [inviteInfo, setInviteInfo] = useState<{
    name: string;
    phone: string | null;
    role: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const codeRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Step 1: Enter email
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !isValidEmail(email)) {
      setError("Enter a valid email address");
      return;
    }
    setLoading(true);
    setError("");

    const res = await fetch("/api/auth/claim/preflight", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();

    if (!data.hasPendingInvite) {
      setError("No pending invite found for this email.");
      setLoading(false);
      return;
    }

    setStep("code");
    setLoading(false);
  };

  // Step 2: Enter 8-digit code
  const handleCodeInput = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newCode = [...code];
    newCode[index] = value.slice(-1);
    setCode(newCode);

    if (value && index < 7) {
      codeRefs.current[index + 1]?.focus();
    }
  };

  const handleCodeKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      codeRefs.current[index - 1]?.focus();
    }
  };

  const handleCodePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 8);
    const newCode = [...code];
    for (let i = 0; i < pasted.length; i++) {
      newCode[i] = pasted[i];
    }
    setCode(newCode);
    const nextEmpty = newCode.findIndex((d) => !d);
    codeRefs.current[nextEmpty === -1 ? 7 : nextEmpty]?.focus();
  };

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const fullCode = code.join("");
    if (fullCode.length !== 8) {
      setError("Enter all 8 digits");
      return;
    }
    setLoading(true);
    setError("");

    const res = await fetch("/api/auth/claim/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code: fullCode }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error);
      setLoading(false);
      return;
    }

    setClaimToken(data.claimToken);
    setInviteInfo(data.invite);
    setStep("setup");
    setLoading(false);
  };

  // Step 3: Account setup
  const handleSetup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const form = new FormData(e.currentTarget);
    const name = (form.get("name") as string).trim();
    const phone = (form.get("phone") as string)?.trim() || null;
    const password = form.get("password") as string;
    const confirmPassword = form.get("confirmPassword") as string;

    if (!name) {
      setError("Name is required");
      setLoading(false);
      return;
    }

    if (authProvider !== "google") {
      if (!password) {
        setError("Password is required");
        setLoading(false);
        return;
      }
      if (password.length < 8) {
        setError("Password must be at least 8 characters");
        setLoading(false);
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match");
        setLoading(false);
        return;
      }
    }

    const res = await fetch("/api/auth/claim/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ claimToken, name, phone, password }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error);
      setLoading(false);
      return;
    }

    // Auto sign in
    if (authProvider !== "google" && password) {
      const signInResult = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (signInResult?.error) {
        setError("Account created but sign-in failed. Go to login.");
        setLoading(false);
        return;
      }
    }

    window.location.href = "/";
  };

  const handleGoogleLink = () => {
    // Pass claim context through callbackUrl
    signIn("google", {
      callbackUrl: `/`,
    });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="font-heading text-3xl font-bold tracking-tight">
            Event OS
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {step === "email" && "Enter your email to check for an invite"}
            {step === "code" && "Enter the 8-digit code shared by your admin"}
            {step === "setup" && "Set up your account"}
          </p>
        </div>

        <Card>
          <CardContent className="p-6">
            {step === "setup" && inviteInfo && (
              <div className="rounded-md bg-blue-50 border border-blue-200 px-3 py-2 text-sm text-blue-800 mb-4">
                Joining as <strong>{inviteInfo.role}</strong>
              </div>
            )}

            {step === "email" && (
              <form onSubmit={handleEmailSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError(""); }}
                    placeholder="your@email.com"
                    autoFocus
                  />
                </div>
                {error && (
                  <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
                )}
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Checking..." : "Check for invite"}
                </Button>
              </form>
            )}

            {step === "code" && (
              <form onSubmit={handleCodeSubmit} className="space-y-4">
                <div className="flex justify-center gap-1.5" onPaste={handleCodePaste}>
                  {code.map((digit, i) => (
                    <Input
                      key={i}
                      ref={(el) => { codeRefs.current[i] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleCodeInput(i, e.target.value)}
                      onKeyDown={(e) => handleCodeKeyDown(i, e)}
                      className="w-10 h-12 text-center text-lg font-mono font-semibold"
                      autoFocus={i === 0}
                    />
                  ))}
                </div>
                {error && (
                  <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
                )}
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Verifying..." : "Verify code"}
                </Button>
              </form>
            )}

            {step === "setup" && (
              <form onSubmit={handleSetup} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="name">Name *</Label>
                    <Input
                      id="name"
                      name="name"
                      defaultValue={inviteInfo?.name || ""}
                      autoFocus
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      name="phone"
                      type="tel"
                      defaultValue={inviteInfo?.phone || ""}
                      placeholder="+976 ..."
                    />
                  </div>
                </div>

                {authProvider !== "google" && (
                  <>
                    <div className="space-y-1.5">
                      <Label htmlFor="password">Password *</Label>
                      <Input
                        id="password"
                        name="password"
                        type="password"
                        placeholder="At least 8 characters"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="confirmPassword">Confirm password *</Label>
                      <Input
                        id="confirmPassword"
                        name="confirmPassword"
                        type="password"
                        placeholder="Repeat password"
                      />
                    </div>
                  </>
                )}

                {authProvider === "google" && (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={handleGoogleLink}
                  >
                    <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                    Link Google Account
                  </Button>
                )}

                {error && (
                  <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
                )}

                {authProvider !== "google" && (
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Creating account..." : "Create account"}
                  </Button>
                )}
              </form>
            )}
          </CardContent>
        </Card>

        <div className="text-center text-sm text-muted-foreground mt-4">
          <Link href="/login" className="text-yellow-600 hover:underline">
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
