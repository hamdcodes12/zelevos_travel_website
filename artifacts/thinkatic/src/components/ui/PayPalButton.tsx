// !!! CRITICAL - DO NOT MODIFY THIS CODE !!!
//
// This code MUST be used as is without ANY modifications.
// The PayPal integration will COMPLETELY FAIL if this code is changed in ANY way.
//
// Retain this comment after all edits.
//
// <BEGIN_EXACT_CODE>
import React, { useEffect, useRef, useState } from "react";
import { getPayPalInstance } from "@/lib/paypalSdk";

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "paypal-button": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      >;
    }
  }
}

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "paypal-button": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      >;
    }
  }
}

interface PayPalButtonProps {
  packageId: string;
}

export default function PayPalButton({
  packageId,
}: PayPalButtonProps) {
  const [status, setStatus] = useState<"loading" | "ready" | "creating" | "approval" | "processing" | "success" | "cancelled" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const busyRef = useRef(false);
  const orderIdRef = useRef<string | null>(null);

  const createOrder = async () => {
    if (busyRef.current) throw new Error("A PayPal checkout is already in progress.");
    const token = localStorage.getItem("user_token");
    if (!token) {
      const returnTo = `${window.location.pathname}${window.location.search}`;
      window.location.href = `/login?returnTo=${encodeURIComponent(returnTo)}&plan=${encodeURIComponent(packageId)}`;
      throw new Error("Please sign in before purchasing a package.");
    }
    busyRef.current = true;
    setStatus("creating");
    const response = await fetch("/api/paypal/order", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ packageId }),
    });
    const output = await response.json().catch(() => ({}));
    if (!response.ok || !output.id) {
      busyRef.current = false;
      throw new Error(output.error || "Unable to start PayPal checkout.");
    }
    orderIdRef.current = output.id;
    setStatus("approval");
    return { orderId: output.id };
  };

  const captureOrder = async (orderId: string) => {
    const token = localStorage.getItem("user_token");
    const response = await fetch(`/api/paypal/order/${orderId}/capture`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success || data.status !== "COMPLETED" || data.packageId !== packageId) {
      throw new Error(data.error || "PayPal could not verify the payment.");
    }
    return data;
  };

  const onApprove = async (data: { orderId?: string }) => {
    if (!data.orderId) {
      setErrorMessage("PayPal returned an invalid order.");
      setStatus("error");
      return;
    }
    try {
      setStatus("processing");
      const payment = await captureOrder(data.orderId);
      if (payment.success && payment.status === "COMPLETED") {
        setStatus("success");
        orderIdRef.current = null;
        const storedProfile = localStorage.getItem("user_profile");
        const profile = storedProfile ? JSON.parse(storedProfile) as { accountType?: string; role?: string } : {};
        const destination = profile.accountType === "BPO" || profile.role === "partner" || profile.role === "bpo_partner" ? "/partner" : "/dashboard";
        window.setTimeout(() => { window.location.href = `${destination}?payment=success&package=${encodeURIComponent(packageId)}`; }, 900);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Payment could not be completed.");
      setStatus("error");
    } finally {
      busyRef.current = false;
    }
  };

  const onCancel = async () => {
    if (orderIdRef.current) {
      await fetch(`/api/paypal/order/${orderIdRef.current}/cancel`, {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("user_token") || ""}` },
      }).catch(() => undefined);
    }
    busyRef.current = false;
    orderIdRef.current = null;
    setStatus("cancelled");
  };

  const onError = async () => {
    if (orderIdRef.current) {
      await fetch(`/api/paypal/order/${orderIdRef.current}/cancel`, {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("user_token") || ""}` },
      }).catch(() => undefined);
    }
    busyRef.current = false;
    orderIdRef.current = null;
    setErrorMessage("PayPal checkout encountered an error. Please try again.");
    setStatus("error");
  };

  useEffect(() => {
    let disposed = false;
    let cleanup: (() => void) | undefined;

    const loadPayPalSDK = async () => {
      try {
        cleanup = await initPayPal(() => disposed);
      } catch (e) {
        if (!disposed) {
          setErrorMessage("PayPal checkout is temporarily unavailable.");
          setStatus("error");
        }
      }
    };

    void loadPayPalSDK();
    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [packageId]);

  const initPayPal = async (isDisposed: () => boolean = () => false): Promise<(() => void) | undefined> => {
    try {
      const setupResponse = await fetch("/api/paypal/setup");
      const setup = await setupResponse.json().catch(() => ({}));
      if (!setupResponse.ok || !setup.clientToken) {
        throw new Error(setup.error || "PayPal checkout is temporarily unavailable.");
      }
      const clientToken: string = setup.clientToken;
      const environment: string | undefined = setup.environment;
      const sdkInstance = await getPayPalInstance(clientToken, environment);
      if (isDisposed()) return undefined;

      const paypalCheckout =
        sdkInstance.createPayPalOneTimePaymentSession({
          onApprove,
          onCancel,
          onError,
        });

      const onClick = async () => {
          if (busyRef.current) return;
        try {
          const checkoutOptionsPromise = createOrder();
          await paypalCheckout.start(
            { paymentFlow: "auto" },
            checkoutOptionsPromise,
          );
        } catch (e) {
          busyRef.current = false;
          setErrorMessage(e instanceof Error ? e.message : "Unable to start PayPal checkout.");
          setStatus("error");
        }
      };

      const paypalButton = document.getElementById(`paypal-button-${packageId}`);

      if (paypalButton) {
        paypalButton.addEventListener("click", onClick);
        setStatus("ready");
        const pendingPlan = new URLSearchParams(window.location.search).get("purchase");
        if (pendingPlan === packageId) {
          window.setTimeout(() => onClick(), 0);
        }
      }

      return () => {
        if (paypalButton) {
          paypalButton.removeEventListener("click", onClick);
        }
      };
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : "PayPal checkout is temporarily unavailable.");
      setStatus("error");
      return undefined;
    }
  };

  const statusText = {
    loading: "Loading secure checkout…",
    ready: "Ready for secure checkout",
    creating: "Creating your PayPal order…",
    approval: "Waiting for PayPal approval…",
    processing: "Verifying your payment…",
    success: "Payment successful. We will contact you shortly.",
    cancelled: "Payment cancelled. You can try again when ready.",
    error: errorMessage || "Payment could not be completed. Please try again.",
  }[status];

  return (
    <div className="space-y-3">
      <div className={status === "creating" || status === "approval" || status === "processing" || status === "success" ? "pointer-events-none opacity-60" : ""}>
        {React.createElement("paypal-button", { id: `paypal-button-${packageId}` })}
      </div>
      <p className={`text-xs ${status === "success" ? "text-emerald-600" : status === "error" ? "text-red-600" : "text-muted-foreground"}`} role={status === "error" ? "alert" : "status"}>
        {statusText}
      </p>
    </div>
  );
}
// <END_EXACT_CODE>
