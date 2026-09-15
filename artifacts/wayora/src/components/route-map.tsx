import { useEffect, useState } from "react";
import { Clock3, ExternalLink, MapPinned, Route } from "lucide-react";

type RouteInfo = {
  distanceText: string;
  durationText: string;
  mapsUrl: string;
};

type RouteMapProps = {
  origin: string;
  destination: string;
};

export function RouteMap({ origin, destination }: RouteMapProps) {
  const [route, setRoute] = useState<RouteInfo | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "unavailable">("idle");

  useEffect(() => {
    if (!origin || !destination) {
      setRoute(null);
      setState("idle");
      return;
    }

    const controller = new AbortController();
    setState("loading");
    void fetch(`/api/maps/route?origin=${encodeURIComponent(`${origin} airport`)}&destination=${encodeURIComponent(`${destination} airport`)}`, {
      credentials: "include",
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = await response.json() as { route?: RouteInfo };
        if (!response.ok || !data.route) throw new Error("Route unavailable");
        setRoute(data.route);
        setState("ready");
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setRoute(null);
          setState("unavailable");
        }
      });

    return () => controller.abort();
  }, [origin, destination]);

  if (state === "idle") return null;

  return (
    <section style={{ marginTop: "20px", border: "1px solid var(--border)", borderRadius: "14px", overflow: "hidden", background: "#fff" }}>
      <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: "4px" }}><span className="eyebrow-line" /> ROUTE INTELLIGENCE</div>
          <strong style={{ fontSize: "14px" }}>{origin} → {destination}</strong>
        </div>
        {route?.mapsUrl && (
          <a href={route.mapsUrl} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: "var(--blue)", fontSize: "11px", fontWeight: 800 }}>
            Open in Google Maps <ExternalLink size={13} />
          </a>
        )}
      </div>
      {state === "loading" && <div style={{ padding: "0 16px 16px", color: "var(--muted)", fontSize: "12px" }}>Calculating the route with Google Maps…</div>}
      {state === "unavailable" && <div style={{ padding: "0 16px 16px", color: "var(--muted)", fontSize: "12px" }}>Google Maps route details are temporarily unavailable. Flight search is still available.</div>}
      {state === "ready" && route && (
        <>
          <img
            src={`/api/maps/static?origin=${encodeURIComponent(`${origin} airport`)}&destination=${encodeURIComponent(`${destination} airport`)}`}
            alt={`Google Maps route from ${origin} airport to ${destination} airport`}
            style={{ display: "block", width: "100%", height: "190px", objectFit: "cover", background: "#eef2ff" }}
            onError={(event) => { event.currentTarget.style.display = "none"; }}
          />
          <div style={{ display: "flex", gap: "18px", padding: "12px 16px", color: "var(--muted)", fontSize: "11px", flexWrap: "wrap" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}><Route size={13} style={{ color: "var(--blue)" }} /> {route.distanceText}</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}><Clock3 size={13} style={{ color: "var(--blue)" }} /> {route.durationText} by road</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}><MapPinned size={13} style={{ color: "var(--blue)" }} /> Google Maps data</span>
          </div>
        </>
      )}
    </section>
  );
}