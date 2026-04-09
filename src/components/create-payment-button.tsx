"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Loader2 } from "lucide-react";

type Props = {
  amount: number;
  description: string;
  label?: string;
};

export function CreatePaymentButton({
  amount,
  description,
  label = "Pay",
}: Props) {
  const [loading, setLoading] = useState(false);

  const handlePay = async () => {
    try {
      setLoading(true);

      const res = await fetch("/api/payments/stripe/create-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ amount, description }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Payment failed");
      }

      const data = await res.json();
      window.location.href = data.url;

      if (!res.ok) {
        throw new Error(data.error || "Payment failed");
      }

      window.location.href = data.url;
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button onClick={handlePay} disabled={loading}>
      <Plus className="h-4 w-4 mr-1.5" />
      {loading ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Processing...
        </>
      ) : (
        label
      )}
    </Button>
  );
}
