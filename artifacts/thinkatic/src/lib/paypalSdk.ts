let sdkPromise: Promise<any> | undefined;
let sdkInstancePromise: Promise<any> | undefined;

function sdkUrl(environment?: string): string {
  if (environment === "production" || environment === "live") {
    return "https://www.paypal.com/web-sdk/v6/core";
  }
  if (environment === "sandbox") {
    return "https://www.sandbox.paypal.com/web-sdk/v6/core";
  }
  return import.meta.env.PROD
    ? "https://www.paypal.com/web-sdk/v6/core"
    : "https://www.sandbox.paypal.com/web-sdk/v6/core";
}

function loadSdk(environment?: string): Promise<any> {
  const targetUrl = sdkUrl(environment);
  if (sdkPromise) return sdkPromise;

  sdkPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      `script[src="${targetUrl}"]`,
    );
    if (existingScript) {
      if ((window as any).paypal) {
        resolve((window as any).paypal);
        return;
      }
      existingScript.addEventListener("load", () => resolve((window as any).paypal), { once: true });
      existingScript.addEventListener("error", () => reject(new Error("PayPal checkout could not load.")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = targetUrl;
    script.async = true;
    script.onload = () => resolve((window as any).paypal);
    script.onerror = () => reject(new Error("PayPal checkout could not load."));
    document.body.appendChild(script);
  });

  return sdkPromise;
}

export function getPayPalInstance(clientToken: string, environment?: string): Promise<any> {
  if (!sdkInstancePromise) {
    sdkInstancePromise = loadSdk(environment).then((paypal) => {
      if (!paypal?.createInstance) throw new Error("PayPal checkout is unavailable.");
      return paypal.createInstance({
        clientToken,
        components: ["paypal-payments"],
      });
    });
  }
  return sdkInstancePromise;
}
