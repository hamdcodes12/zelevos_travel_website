import React, { useState, useEffect, useRef } from "react";
import {
  Search,
  RefreshCw,
  Radio,
  Car,
  MapPin,
  Phone,
  Shield,
  ShieldAlert,
  Clock,
  ArrowLeft,
  Navigation,
  ExternalLink,
  AlertTriangle,
  CheckCircle,
  X,
  User,
  Ticket,
} from "lucide-react";
import L from "leaflet";

interface AdminLiveTripsTabProps {
  onToast?: (msg: string) => void;
  initialSessionId?: string | null;
}

export function AdminLiveTripsTab({ onToast, initialSessionId }: AdminLiveTripsTabProps) {
  const [trips, setTrips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<"ALL" | "LIVE" | "STALE" | "OFFLINE" | "EMERGENCY" | "COMPLETED">("ALL");
  const [page, setPage] = useState(1);

  // Selected Trip for deep-dive tracking
  const [selectedTripId, setSelectedTripId] = useState<string | null>(initialSessionId || null);
  const [selectedTripData, setSelectedTripData] = useState<any | null>(null);
  const [selectedTripLoading, setSelectedTripLoading] = useState(false);

  // Emergency resolution modal
  const [resolveModalOpen, setResolveModalOpen] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [resolving, setResolving] = useState(false);

  // Map refs
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const customerMarkerRef = useRef<L.Marker | null>(null);
  const driverMarkerRef = useRef<L.Marker | null>(null);
  const routeLineRef = useRef<L.Polyline | null>(null);
  const sseRef = useRef<EventSource | null>(null);

  // Dynamic ticker for smooth "X seconds ago" updates
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  // 1. Fetch lightweight trip list from server
  const loadTrips = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.set("q", searchQuery.trim());
      if (activeFilter !== "ALL") params.set("filter", activeFilter);
      params.set("page", String(page));
      params.set("limit", "25");

      const res = await fetch(`/api/admin/live-trips?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load live trips");
      const data = await res.json();
      setTrips(data.trips || []);
    } catch {
      onToast?.("Could not load active live trips.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const debounce = setTimeout(() => {
      loadTrips();
    }, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery, activeFilter, page]);

  // 2. Fetch selected trip full tracking detail
  const loadTripDetail = async (id: string) => {
    setSelectedTripLoading(true);
    try {
      const res = await fetch(`/api/admin/live-trips/${id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Trip tracking session not found");
      const data = await res.json();
      setSelectedTripData(data);
    } catch (err: any) {
      onToast?.(err.message || "Failed to load live tracking stream.");
      setSelectedTripId(null);
    } finally {
      setSelectedTripLoading(false);
    }
  };

  useEffect(() => {
    if (selectedTripId) {
      loadTripDetail(selectedTripId);
    } else {
      setSelectedTripData(null);
      if (sseRef.current) {
        sseRef.current.close();
        sseRef.current = null;
      }
    }
  }, [selectedTripId]);

  // 3. Connect to Realtime SSE Stream for selected trip ONLY (scalable architecture)
  useEffect(() => {
    if (!selectedTripId || !selectedTripData?.session?.id) return;

    try {
      const sse = new EventSource(`/api/tracking/${selectedTripData.session.id}/stream`);
      sseRef.current = sse;

      sse.addEventListener("location_update", (e: MessageEvent) => {
        try {
          const payload = JSON.parse(e.data);
          setSelectedTripData((prev: any) => {
            if (!prev) return prev;
            const updated = { ...prev, session: { ...prev.session } };
            if (payload.actorType === "DRIVER") {
              updated.session.lastDriverLatitude = payload.latitude;
              updated.session.lastDriverLongitude = payload.longitude;
              updated.session.lastDriverAccuracy = payload.accuracy;
              updated.session.lastDriverHeading = payload.heading;
              updated.session.lastDriverSpeed = payload.speed;
              updated.session.lastDriverUpdateAt = payload.recordedAt;
              updated.session.driverStatus = payload.driverStatus || "LIVE";
              updated.session.driverSecondsAgo = 0;
            } else if (payload.actorType === "CUSTOMER") {
              updated.session.lastCustomerLatitude = payload.latitude;
              updated.session.lastCustomerLongitude = payload.longitude;
              updated.session.lastCustomerAccuracy = payload.accuracy;
              updated.session.lastCustomerUpdateAt = payload.recordedAt;
              updated.session.customerStatus = payload.customerStatus || "LIVE";
              updated.session.customerSecondsAgo = 0;
            }
            if (payload.calculatedDistanceKm !== undefined) {
              updated.session.calculatedDistanceKm = payload.calculatedDistanceKm;
              updated.session.distanceUpdatedAt = payload.distanceUpdatedAt;
            }
            return updated;
          });
        } catch {}
      });

      sse.addEventListener("emergency_alert", (e: MessageEvent) => {
        try {
          const payload = JSON.parse(e.data);
          setSelectedTripData((prev: any) => {
            if (!prev) return prev;
            return {
              ...prev,
              session: {
                ...prev.session,
                emergencyAlertActive: true,
                emergencyAlertAt: payload.alertAt,
                emergencyAlertNotes: payload.notes,
              },
            };
          });
          onToast?.(`🚨 EMERGENCY ALERT on booking ${payload.bookingId}`);
        } catch {}
      });

      sse.addEventListener("emergency_resolved", () => {
        setSelectedTripData((prev: any) => {
          if (!prev) return prev;
          return {
            ...prev,
            session: {
              ...prev.session,
              emergencyAlertActive: false,
            },
          };
        });
        onToast?.("Emergency alert marked resolved.");
      });
    } catch {}

    return () => {
      if (sseRef.current) {
        sseRef.current.close();
        sseRef.current = null;
      }
    };
  }, [selectedTripId, selectedTripData?.session?.id]);

  // 4. Initialize Map when detail screen opens
  useEffect(() => {
    if (!selectedTripId || !mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [34.0837, 74.837],
      zoom: 13,
      zoomControl: true,
      attributionControl: false,
    });

    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
    }).addTo(map);

    setTimeout(() => {
      try { map.invalidateSize(); } catch {}
    }, 150);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [selectedTripId, selectedTripLoading]);

  // 5. Update Map Markers and Trail
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !selectedTripData?.session) return;

    const session = selectedTripData.session;
    const custLat = session.lastCustomerLatitude;
    const custLng = session.lastCustomerLongitude;
    const drivLat = session.lastDriverLatitude;
    const drivLng = session.lastDriverLongitude;

    const boundsPoints: [number, number][] = [];

    // Customer Marker
    if (custLat && custLng) {
      boundsPoints.push([custLat, custLng]);
      const customerHtml = `
        <div style="position: relative; display: flex; flex-direction: column; align-items: center;">
          <div style="background: #2563eb; color: #fff; padding: 2px 7px; border-radius: 9999px; font-size: 10px; font-weight: 800; white-space: nowrap; box-shadow: 0 2px 6px rgba(0,0,0,0.3); margin-bottom: 2px; border: 1.5px solid #fff;">
            📍 CUSTOMER
          </div>
          <div style="width: 18px; height: 18px; border-radius: 50%; background: #2563eb; border: 3px solid #ffffff; box-shadow: 0 0 0 4px rgba(37,99,235,0.35); animation: pulse 2s infinite;"></div>
        </div>
      `;
      const custIcon = L.divIcon({
        className: "custom-leaflet-marker",
        html: customerHtml,
        iconSize: [40, 40],
        iconAnchor: [20, 36],
      });

      if (!customerMarkerRef.current) {
        customerMarkerRef.current = L.marker([custLat, custLng], { icon: custIcon }).addTo(map);
      } else {
        customerMarkerRef.current.setLatLng([custLat, custLng]);
        customerMarkerRef.current.setIcon(custIcon);
      }
    } else if (customerMarkerRef.current) {
      customerMarkerRef.current.remove();
      customerMarkerRef.current = null;
    }

    // Driver Marker
    if (drivLat && drivLng) {
      boundsPoints.push([drivLat, drivLng]);
      const driverHtml = `
        <div style="position: relative; display: flex; flex-direction: column; align-items: center;">
          <div style="background: #d97706; color: #fff; padding: 2px 7px; border-radius: 9999px; font-size: 10px; font-weight: 800; white-space: nowrap; box-shadow: 0 2px 6px rgba(0,0,0,0.3); margin-bottom: 2px; border: 1.5px solid #fff;">
            🚕 DRIVER
          </div>
          <div style="width: 20px; height: 20px; border-radius: 50%; background: #d97706; border: 3px solid #ffffff; box-shadow: 0 0 0 4px rgba(217,119,6,0.35); display: flex; align-items: center; justify-content: center;">
            <div style="width: 6px; height: 6px; border-radius: 50%; background: #fff;"></div>
          </div>
        </div>
      `;
      const drivIcon = L.divIcon({
        className: "custom-leaflet-marker",
        html: driverHtml,
        iconSize: [50, 42],
        iconAnchor: [25, 38],
      });

      if (!driverMarkerRef.current) {
        driverMarkerRef.current = L.marker([drivLat, drivLng], { icon: drivIcon }).addTo(map);
      } else {
        driverMarkerRef.current.setLatLng([drivLat, drivLng]);
        driverMarkerRef.current.setIcon(drivIcon);
      }
    } else if (driverMarkerRef.current) {
      driverMarkerRef.current.remove();
      driverMarkerRef.current = null;
    }

    // Route connection
    if (custLat && custLng && drivLat && drivLng) {
      const lineCoords: [number, number][] = [
        [custLat, custLng],
        [drivLat, drivLng],
      ];
      if (!routeLineRef.current) {
        routeLineRef.current = L.polyline(lineCoords, {
          color: "#2563eb",
          weight: 3,
          dashArray: "6, 8",
          opacity: 0.7,
        }).addTo(map);
      } else {
        routeLineRef.current.setLatLngs(lineCoords);
      }
    } else if (routeLineRef.current) {
      routeLineRef.current.remove();
      routeLineRef.current = null;
    }

    if (boundsPoints.length >= 2) {
      const bounds = L.latLngBounds(boundsPoints);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
    } else if (boundsPoints.length === 1) {
      map.setView(boundsPoints[0], 14);
    }

    setTimeout(() => {
      try { map.invalidateSize(); } catch {}
    }, 150);
  }, [selectedTripData?.session]);

  // 6. Handle Emergency Resolution
  const handleResolveEmergency = async () => {
    if (!selectedTripData?.session?.id) return;
    setResolving(true);
    try {
      const res = await fetch(`/api/tracking/${selectedTripData.session.id}/emergency/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ resolutionNotes }),
      });
      if (!res.ok) throw new Error("Failed to resolve alert");
      setResolveModalOpen(false);
      onToast?.("Emergency marked resolved.");
      loadTripDetail(selectedTripData.session.id);
    } catch {
      onToast?.("Could not resolve emergency alert.");
    } finally {
      setResolving(false);
    }
  };

  const getSecondsAgo = (dateStr?: string | null) => {
    if (!dateStr) return null;
    return Math.max(0, Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000));
  };

  const renderStatusBadge = (enabled: boolean, secAgo: number | null) => {
    if (!enabled || secAgo === null) {
      return (
        <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", color: "#64748b", fontSize: "11px", fontWeight: 700 }}>
          <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#94a3b8" }}></span>
          DISABLED
        </span>
      );
    }
    if (secAgo < 60) {
      return (
        <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", color: "#059669", fontSize: "11px", fontWeight: 800 }}>
          <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#10b981", animation: "pulse 1.5s infinite" }}></span>
          ● LIVE ({secAgo}s)
        </span>
      );
    }
    if (secAgo < 120) {
      return (
        <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", color: "#d97706", fontSize: "11px", fontWeight: 800 }}>
          <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#f59e0b" }}></span>
          ● STALE ({secAgo}s)
        </span>
      );
    }
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", color: "#dc2626", fontSize: "11px", fontWeight: 800 }}>
        <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#ef4444" }}></span>
        ● OFFLINE
      </span>
    );
  };

  // ============================================================================
  // VIEW: DETAILED LIVE TRACKING SCREEN (Section 6: Admin Track Live Screen)
  // ============================================================================
  if (selectedTripId) {
    if (selectedTripLoading && !selectedTripData) {
      return (
        <div style={{ padding: "60px", textAlign: "center", color: "#64748b", background: "#ffffff", borderRadius: "14px", border: "1px solid #e2e8f0" }}>
          <RefreshCw size={28} className="animate-spin" style={{ margin: "0 auto 12px", color: "#2563eb" }} />
          <strong style={{ fontSize: "15px", display: "block", color: "#0f172a" }}>Connecting to Realtime Ground Stream...</strong>
          <span style={{ fontSize: "12px" }}>Establishing secure session telemetry and loading GPS coordinates...</span>
        </div>
      );
    }

    const s = selectedTripData?.session;
    const custSecAgo = getSecondsAgo(s?.lastCustomerUpdateAt);
    const drivSecAgo = getSecondsAgo(s?.lastDriverUpdateAt);

    return (
      <div style={{ display: "grid", gap: "16px" }}>
        {/* Top Navigation Bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
          <button
            type="button"
            id="back-to-live-trips-list-btn"
            onClick={() => setSelectedTripId(null)}
            style={{
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              padding: "8px 14px",
              borderRadius: "8px",
              fontSize: "13px",
              fontWeight: 700,
              color: "#334155",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              cursor: "pointer",
            }}
          >
            <ArrowLeft size={16} /> All Live Trips
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {s?.emergencyAlertActive && (
              <button
                type="button"
                id="resolve-emergency-btn"
                onClick={() => setResolveModalOpen(true)}
                style={{
                  background: "#dc2626",
                  color: "#ffffff",
                  border: "none",
                  padding: "8px 16px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: 800,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  boxShadow: "0 4px 12px rgba(220, 38, 38, 0.3)",
                }}
              >
                <ShieldAlert size={16} /> RESOLVE EMERGENCY SOS
              </button>
            )}

            <button
              type="button"
              onClick={() => loadTripDetail(selectedTripId)}
              style={{
                background: "#ffffff",
                border: "1px solid #cbd5e1",
                padding: "8px 12px",
                borderRadius: "8px",
                fontSize: "13px",
                fontWeight: 600,
                color: "#475569",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                cursor: "pointer",
              }}
            >
              <RefreshCw size={14} className={selectedTripLoading ? "animate-spin" : ""} /> Refresh
            </button>
          </div>
        </div>

        {/* Emergency Alert Banner if Active */}
        {s?.emergencyAlertActive && (
          <div
            id="admin-emergency-alert-banner"
            style={{
              background: "#fef2f2",
              border: "2px solid #ef4444",
              borderRadius: "12px",
              padding: "16px 20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "14px",
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "#fee2e2", color: "#dc2626", display: "grid", placeItems: "center" }}>
                <ShieldAlert size={24} />
              </div>
              <div>
                <strong style={{ fontSize: "15px", color: "#991b1b", display: "block" }}>
                  CRITICAL: CUSTOMER EMERGENCY SOS ACTIVE
                </strong>
                <span style={{ fontSize: "12.5px", color: "#b91c1c" }}>
                  {s.emergencyAlertNotes || "Emergency alert triggered on device. Chauffeur & customer contact required."}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setResolveModalOpen(true)}
              style={{
                background: "#991b1b",
                color: "#ffffff",
                border: "none",
                padding: "8px 16px",
                borderRadius: "6px",
                fontSize: "12.5px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Take Action / Resolve
            </button>
          </div>
        )}

        {/* Live Tracking Two-Column Screen */}
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 340px", gap: "16px" }}>
          {/* Left Column: Live Map */}
          <div style={{ position: "relative", borderRadius: "14px", overflow: "hidden", border: "1px solid #cbd5e1", background: "#f8fafc", minHeight: "480px" }}>
            <div ref={mapContainerRef} id="admin-leaflet-live-map" style={{ width: "100%", height: "480px" }} />

            {/* Distance Pill */}
            <div
              style={{
                position: "absolute",
                top: "14px",
                left: "14px",
                zIndex: 10,
                background: "rgba(255, 255, 255, 0.95)",
                backdropFilter: "blur(6px)",
                border: "1px solid #cbd5e1",
                borderRadius: "10px",
                padding: "8px 14px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
              }}
            >
              <Car size={16} color="#d97706" />
              <strong style={{ fontSize: "13px", color: "#0f172a" }}>
                {s?.calculatedDistanceKm !== null && s?.calculatedDistanceKm !== undefined
                  ? `Distance: ${s.calculatedDistanceKm} km`
                  : "Distance unavailable (waiting for coordinates)"}
              </strong>
            </div>
          </div>

          {/* Right Column: Customer Dossier & Chauffeur Telemetry */}
          <div style={{ display: "grid", gap: "14px", alignContent: "start" }}>
            {/* Customer Card */}
            <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "16px", display: "grid", gap: "10px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{ width: "28px", height: "28px", borderRadius: "6px", background: "#eff6ff", color: "#2563eb", display: "grid", placeItems: "center" }}>
                  <User size={16} />
                </div>
                <div>
                  <strong style={{ fontSize: "14px", color: "#0f172a" }}>{s?.customerName || "Customer"}</strong>
                  <span style={{ fontSize: "11px", color: "#64748b", display: "block" }}>
                    ID: <strong>{s?.customerCustomId || s?.customerId}</strong>
                  </span>
                </div>
              </div>

              <div style={{ background: "#f8fafc", padding: "10px 12px", borderRadius: "8px", fontSize: "12px", display: "grid", gap: "4px" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#64748b" }}>Booking Ref:</span>
                  <strong style={{ color: "#2563eb" }}>{s?.bookingRef || s?.bookingId}</strong>
                </div>
                {s?.customerPhone && (
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#64748b" }}>Phone:</span>
                    <a href={`tel:${s.customerPhone}`} style={{ color: "#059669", fontWeight: 700, textDecoration: "none" }}>
                      {s.customerPhone}
                    </a>
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: "#64748b" }}>GPS Status:</span>
                  {renderStatusBadge(Boolean(s?.customerTrackingEnabled), custSecAgo)}
                </div>
              </div>

              {s?.customerPhone && (
                <a
                  href={`tel:${s.customerPhone}`}
                  style={{
                    background: "#2563eb",
                    color: "#ffffff",
                    padding: "8px",
                    borderRadius: "6px",
                    fontSize: "12px",
                    fontWeight: 700,
                    textAlign: "center",
                    textDecoration: "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                  }}
                >
                  <Phone size={14} /> Call Customer
                </a>
              )}
            </div>

            {/* Chauffeur & Vehicle Card */}
            <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "16px", display: "grid", gap: "10px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{ width: "28px", height: "28px", borderRadius: "6px", background: "#fef3c7", color: "#d97706", display: "grid", placeItems: "center" }}>
                  <Car size={16} />
                </div>
                <div>
                  <strong style={{ fontSize: "14px", color: "#0f172a" }}>{s?.driverName || "Assigned Driver"}</strong>
                  <span style={{ fontSize: "11px", color: "#64748b", display: "block" }}>
                    Vehicle: <strong>{s?.vehicleModel || "SUV/Sedan"}</strong>
                  </span>
                </div>
              </div>

              <div style={{ background: "#f8fafc", padding: "10px 12px", borderRadius: "8px", fontSize: "12px", display: "grid", gap: "4px" }}>
                {s?.vehicleRegistration && (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ color: "#64748b" }}>Registration:</span>
                    <span style={{ background: "#ffffff", border: "1px solid #cbd5e1", padding: "1px 6px", borderRadius: "4px", fontFamily: "monospace", fontWeight: 700 }}>
                      {s.vehicleRegistration}
                    </span>
                  </div>
                )}
                {s?.driverPhone && (
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#64748b" }}>Driver Phone:</span>
                    <a href={`tel:${s.driverPhone}`} style={{ color: "#059669", fontWeight: 700, textDecoration: "none" }}>
                      {s.driverPhone}
                    </a>
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: "#64748b" }}>Driver GPS:</span>
                  {renderStatusBadge(Boolean(s?.driverTrackingEnabled), drivSecAgo)}
                </div>
              </div>

              {s?.driverPhone && (
                <a
                  href={`tel:${s.driverPhone}`}
                  style={{
                    background: "#059669",
                    color: "#ffffff",
                    padding: "8px",
                    borderRadius: "6px",
                    fontSize: "12px",
                    fontWeight: 700,
                    textAlign: "center",
                    textDecoration: "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                  }}
                >
                  <Phone size={14} /> Call Driver
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Emergency Resolution Modal */}
        {resolveModalOpen && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              backgroundColor: "rgba(0,0,0,0.5)",
              zIndex: 10000,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "16px",
            }}
          >
            <div style={{ background: "#ffffff", borderRadius: "14px", padding: "20px", maxWidth: "440px", width: "100%", display: "grid", gap: "14px" }}>
              <strong style={{ fontSize: "16px", color: "#0f172a" }}>Resolve Emergency Alert</strong>
              <p style={{ margin: 0, fontSize: "12.5px", color: "#64748b" }}>
                Provide operational resolution notes before marking this incident resolved.
              </p>
              <textarea
                placeholder="e.g. Concierge reached chauffeur, detour cleared, customer safe..."
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "12px", minHeight: "80px" }}
              />
              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={() => setResolveModalOpen(false)}
                  style={{ background: "#f1f5f9", border: "none", padding: "8px 14px", borderRadius: "6px", fontSize: "12.5px", fontWeight: 600, cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleResolveEmergency}
                  disabled={resolving}
                  style={{ background: "#059669", color: "#fff", border: "none", padding: "8px 16px", borderRadius: "6px", fontSize: "12.5px", fontWeight: 700, cursor: "pointer" }}
                >
                  {resolving ? "Resolving..." : "Confirm Resolution"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ============================================================================
  // VIEW: HIGH-SCALE LIST SCREEN (Section 5: How Admin Identifies A Specific Customer)
  // ============================================================================
  return (
    <div style={{ display: "grid", gap: "16px" }}>
      {/* Header & Search */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <strong style={{ fontSize: "18px", color: "#0f172a", display: "flex", alignItems: "center", gap: "8px" }}>
            <Radio size={20} color="#2563eb" /> LIVE TRIPS & CUSTOMER SAFETY
          </strong>
          <span style={{ fontSize: "12.5px", color: "#64748b" }}>
            Real-time GPS tracking, chauffeur proximity, and SOS monitoring across all active customer tours.
          </span>
        </div>

        <button
          type="button"
          onClick={loadTrips}
          style={{
            background: "#ffffff",
            border: "1px solid #cbd5e1",
            padding: "8px 14px",
            borderRadius: "8px",
            fontSize: "13px",
            fontWeight: 600,
            color: "#475569",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            cursor: "pointer",
          }}
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      {/* Search Input Bar (Matches Customer ID, Booking ID, Customer Name, Driver, Vehicle) */}
      <div style={{ position: "relative" }}>
        <Search size={18} color="#94a3b8" style={{ position: "absolute", left: "14px", top: "12px" }} />
        <input
          type="text"
          id="admin-live-trips-search-input"
          placeholder="Search by Customer Name, Customer ID (ZLV-CUS-...), Booking ID (ZL...), Driver, or Vehicle Registration..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: "100%",
            padding: "10px 14px 10px 42px",
            borderRadius: "10px",
            border: "1px solid #cbd5e1",
            fontSize: "13px",
            background: "#ffffff",
          }}
        />
      </div>

      {/* Filter Tabs */}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        {(["ALL", "LIVE", "STALE", "OFFLINE", "EMERGENCY", "COMPLETED"] as const).map((f) => (
          <button
            key={f}
            type="button"
            id={`filter-tab-${f.toLowerCase()}`}
            onClick={() => {
              setActiveFilter(f);
              setPage(1);
            }}
            style={{
              padding: "6px 14px",
              borderRadius: "9999px",
              fontSize: "12px",
              fontWeight: 700,
              cursor: "pointer",
              border: activeFilter === f ? "1.5px solid #2563eb" : "1px solid #e2e8f0",
              background: activeFilter === f ? "#eff6ff" : "#ffffff",
              color: activeFilter === f ? "#2563eb" : "#64748b",
            }}
          >
            {f === "EMERGENCY" ? "🚨 EMERGENCY" : f}
          </button>
        ))}
      </div>

      {/* Lightweight Trips Table */}
      <div style={{ background: "#ffffff", borderRadius: "12px", border: "1px solid #e2e8f0", overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.02)" }}>
        {loading && trips.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center", color: "#64748b", fontSize: "13px" }}>
            <RefreshCw size={24} className="animate-spin" style={{ margin: "0 auto 8px", color: "#2563eb" }} />
            Loading active live trips...
          </div>
        ) : trips.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center", color: "#64748b", fontSize: "13px" }}>
            No live trips matched your search criteria.
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#64748b", fontSize: "11.5px", textTransform: "uppercase" }}>
                <th style={{ padding: "12px 16px" }}>Customer</th>
                <th style={{ padding: "12px 16px" }}>Booking Ref</th>
                <th style={{ padding: "12px 16px" }}>Driver & Vehicle</th>
                <th style={{ padding: "12px 16px" }}>GPS Proximity</th>
                <th style={{ padding: "12px 16px" }}>Status</th>
                <th style={{ padding: "12px 16px", textAlign: "right" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {trips.map((t) => {
                const custSec = getSecondsAgo(t.lastCustomerUpdateAt);
                const drivSec = getSecondsAgo(t.lastDriverUpdateAt);

                return (
                  <tr
                    key={t.id}
                    id={`live-trip-row-${t.id}`}
                    style={{
                      borderBottom: "1px solid #f1f5f9",
                      background: t.emergencyAlertActive ? "#fef2f2" : "#ffffff",
                    }}
                  >
                    <td style={{ padding: "14px 16px" }}>
                      <strong style={{ color: "#0f172a", display: "block" }}>{t.customerName || "Customer"}</strong>
                      <span style={{ fontSize: "11px", color: "#64748b" }}>{t.customerCustomId || t.customerId}</span>
                    </td>

                    <td style={{ padding: "14px 16px" }}>
                      <span style={{ fontFamily: "monospace", fontWeight: 700, color: "#2563eb" }}>
                        {t.bookingId || t.bookingDbId}
                      </span>
                    </td>

                    <td style={{ padding: "14px 16px" }}>
                      <span style={{ fontWeight: 600, color: "#1e293b", display: "block" }}>
                        {t.driverName || "Driver Pending"}
                      </span>
                      {t.vehicleRegistration && (
                        <span style={{ fontSize: "11px", background: "#f1f5f9", padding: "1px 6px", borderRadius: "4px", fontFamily: "monospace" }}>
                          {t.vehicleRegistration}
                        </span>
                      )}
                    </td>

                    <td style={{ padding: "14px 16px" }}>
                      {t.calculatedDistanceKm !== null && t.calculatedDistanceKm !== undefined ? (
                        <strong style={{ color: "#0f172a" }}>{t.calculatedDistanceKm} km</strong>
                      ) : (
                        <span style={{ color: "#94a3b8", fontSize: "12px" }}>—</span>
                      )}
                    </td>

                    <td style={{ padding: "14px 16px" }}>
                      {t.emergencyAlertActive ? (
                        <span style={{ background: "#fee2e2", color: "#dc2626", padding: "3px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: 800 }}>
                          🚨 SOS ACTIVE
                        </span>
                      ) : (
                        renderStatusBadge(Boolean(t.customerTrackingEnabled), custSec)
                      )}
                    </td>

                    <td style={{ padding: "14px 16px", textAlign: "right" }}>
                      <button
                        type="button"
                        id={`track-trip-btn-${t.id}`}
                        onClick={() => setSelectedTripId(t.id)}
                        style={{
                          background: "#2563eb",
                          color: "#ffffff",
                          border: "none",
                          padding: "6px 14px",
                          borderRadius: "6px",
                          fontSize: "12px",
                          fontWeight: 700,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        <Radio size={13} /> TRACK
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
