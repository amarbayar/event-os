"use client";

import { Check } from "lucide-react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function PaymentSuccessPage() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");

  return (
    <div className="max-w-2xl mx-auto py-10 space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight">
          Payment Successful
        </h1>
        <p className="text-sm text-muted-foreground">
          Your payment has been completed successfully.
        </p>
      </div>

      <div className="rounded-md border px-5 py-5 flex items-start gap-4 bg-green-50/50 border-green-200">
        <div className="mt-1">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500/10">
            <Check className="h-4 w-4 text-green-600" />
          </span>
        </div>

        <div className="flex-1 space-y-1">
          <p className="text-sm font-medium">Payment confirmed</p>

          <p className="text-xs text-muted-foreground">
            You will receive confirmation shortly. You can safely close this
            page.
          </p>

          {sessionId && (
            <p className="text-[10px] text-muted-foreground mt-1 break-all">
              Session: {sessionId}
            </p>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        <Button size="sm">
          <Link href="/">Go to dashboard</Link>
        </Button>

        <Button
          size="sm"
          variant="outline"
          onClick={() => window.location.reload()}
        >
          Refresh status
        </Button>
      </div>
    </div>
  );
}
