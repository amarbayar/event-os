"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function PaymentCancelPage() {
  return (
    <div className="max-w-2xl mx-auto py-10 space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight">
          Payment Cancelled
        </h1>
        <p className="text-sm text-muted-foreground">
          Your payment was not completed.
        </p>
      </div>

      <div className="rounded-md border px-5 py-5 flex items-start gap-4 bg-red-50/50 border-red-200">
        <div className="mt-1">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500/10">
            <X className="h-4 w-4 text-red-600" />
          </span>
        </div>

        <div className="flex-1 space-y-1">
          <p className="text-sm font-medium">Payment was cancelled</p>

          <p className="text-xs text-muted-foreground">
            No charges were made. You can try again anytime.
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <Button size="sm">
          <Link href="/">Back to dashboard</Link>
        </Button>

        <Button
          size="sm"
          variant="outline"
          onClick={() => window.history.back()}
        >
          Try again
        </Button>
      </div>
    </div>
  );
}
