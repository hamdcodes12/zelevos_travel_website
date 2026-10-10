import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Shield,
  ShieldAlert,
  Car,
  MapPin,
  Phone,
  Clock,
  Radio,
  Navigation,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  CheckCircle,
  HelpCircle,
  Signal,
  SignalZero,
} from "lucide-react";
import L from "leaflet";

interface LiveTripSafetyModalProps {
  bookingId: string;
  onClose: () => void;
  onToast?: (msg: string) => void;
}

export function LiveTripSafetyModal({ bookingId, onClose, onToast }: LiveTripSafetyModalProps) {
  const [session, setSession] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // GPS state
  const [gpsConsent, setGpsConsent] = useState<boolean | null>(null); // null = not prompted, true = allowed, false = denied
  const [gpsActive, setGpsActive] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number; accuracy?: number } | null>(null);

  // Emergency SOS state
  const [showSosModal, setShowSosModal] = useState(false);
  const [sosSending, setSosSending] = useState(false);
  const [sosNote, setSosNote] = useState("");
  const [sosActive, setSosActive] = useState(false);

  // Elapsed time tracker for live display (re-renders every second)
  const [, setTick] = useState(0);

  // Leaflet map refs
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const customerMarkerRef = useRef<L.Marker | null>(null);
  const driverMarkerRef = useRef<L.Marker | null>(null);
  const routeLineRef = useRef<L.Polyline | null>(null);

  const watchIdRef = useRef<number | null>(null);
  const sseRef = useRef<EventSource | null>(null);

  // Fetch initial tracking data
  const loadTrackingSession = async () => {
    try {
      const res = await fetch(`/api/tracking/my-trip/${bookingId}`, { credentials: "include" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to load tracking session.");
      }
      const data = await res.json();
      if (data.session) {
        setSession(data.session);
        setSosActive(Boolean(data.session.emergencyAlertActive));
        if (data.session.customerTrackingEnabled) {
          setGpsConsent(true);
          setGpsActive(true);
        }
      }
    } catch (err: any) {
      setError(err.message || "Unable to connect to live tracking service.");
    } finally {
      setLoading(false);
    }
  };

  // 1. Initial Load & Network Listeners
  useEffect(() => {
    loadTrackingSession();

    const handleOnline = () => {
      setIsOnline(true);
      loadTrackingSession();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Dynamic timer ticker to update "X seconds ago" counters smoothly
    const interval = setInterval(() => setTick((t) => t + 1), 1000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(interval);
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (sseRef.current) {
        sseRef.current.close();
      }
    };
  }, [bookingId]);

  // 2. Setup Server-Sent Events (SSE) Realtime Stream once session is loaded
  useEffect(() => {
    if (!session?.id) return;

    try {
      const sse = new EventSource(`/api/tracking/${session.id}/stream`);
      sseRef.current = sse;

      sse.addEventListener("location_update", (e: MessageEvent) => {
        try {
          const payload = JSON.parse(e.data);
          setSession((prev: any) => {
            if (!prev) return prev;
            const updated = { ...prev };
            if (payload.actorType === "DRIVER") {
              updated.lastDriverLocation = {
                latitude: payload.latitude,
                longitude: payload.longitude,
                accuracy: payload.accuracy,
                heading: payload.heading,
                speed: payload.speed,
                updatedAt: payload.recordedAt,
                status: payload.driverStatus || "LIVE",
                secondsAgo: 0,
              };
            } else if (payload.actorType === "CUSTOMER") {
              updated.lastCustomerLocation = {
                latitude: payload.latitude,
                longitude: payload.longitude,
                accuracy: payload.accuracy,
                updatedAt: payload.recordedAt,
                status: payload.customerStatus || "LIVE",
                secondsAgo: 0,
              };
            }
            if (payload.calculatedDistanceKm !== undefined) {
              updated.calculatedDistanceKm = payload.calculatedDistanceKm;
              updated.distanceUpdatedAt = payload.distanceUpdatedAt;
            }
            return updated;
          });
        } catch {}
      });

      sse.addEventListener("emergency_alert", (e: MessageEvent) => {
        setSosActive(true);
        onToast?.("🚨 Emergency SOS has been broadcast to Operations Desk.");
      });

      sse.addEventListener("emergency_resolved", () => {
        setSosActive(false);
        onToast?.("Emergency alert has been resolved by Operations.");
      });

      sse.addEventListener("session_ended", () => {
        setSession((prev: any) => prev ? { ...prev, status: "COMPLETED" } : prev);
        setGpsActive(false);
        onToast?.("Trip has concluded. GPS tracking stopped.");
      });
    } catch {}

    return () => {
      if (sseRef.current) {
        sseRef.current.close();
      }
    };
  }, [session?.id]);

  // 3. Leaflet Map Initialization
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Default center to North India / Kashmir or 20, 78
    const map = L.map(mapContainerRef.current, {
      center: [34.0837, 74.837],
      zoom: 13,
      zoomControl: true,
      attributionControl: false,
    });

    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
    }).addTo(map);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [loading]);

  // 4. Update Map Markers and Bounds dynamically whenever coordinates change
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const custLat = currentCoords?.lat ?? session?.lastCustomerLocation?.latitude;
    const custLng = currentCoords?.lng ?? session?.lastCustomerLocation?.longitude;

    const drivLat = session?.lastDriverLocation?.latitude;
    const drivLng = session?.lastDriverLocation?.longitude;

    const boundsPoints: [number, number][] = [];

    // Customer Marker
    if (custLat && custLng) {
      boundsPoints.push([custLat, custLng]);

      const customerHtml = `
        <div style="position: relative; display: flex; flex-direction: column; align-items: center;">
          <div style="background: #2563eb; color: #fff; padding: 2px 7px; border-radius: 9999px; font-size: 10px; font-weight: 800; white-space: nowrap; box-shadow: 0 2px 6px rgba(0,0,0,0.3); margin-bottom: 2px; border: 1.5px solid #fff;">
            📍 YOU
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

    // Draw connecting line between Customer and Driver
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

    // Fit map viewport to include both markers if available
    if (boundsPoints.length >= 2) {
      const bounds = L.latLngBounds(boundsPoints);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
    } else if (boundsPoints.length === 1) {
      map.setView(boundsPoints[0], 14);
    }
  }, [currentCoords, session?.lastCustomerLocation, session?.lastDriverLocation]);

  // 5. Customer GPS Activation Handlers
  const handleAllowLocation = () => {
    if (!navigator.geolocation) {
      setGpsError("Geolocation is not supported by your browser.");
      setGpsConsent(false);
      return;
    }

    setGpsError(null);
    setGpsConsent(true);

    // Call backend start endpoint
    if (session?.id) {
      fetch(`/api/tracking/${session.id}/customer/start`, {
        method: "POST",
        credentials: "include",
      }).catch(() => {});
    }

    // Activate real browser GPS watching
    const id = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        setCurrentCoords({ latitude, longitude, accuracy } as any);
        setGpsActive(true);
        setGpsError(null);

        // Transmit coordinates to backend
        if (session?.id) {
          fetch(`/api/tracking/${session.id}/location`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              latitude,
              longitude,
              accuracy,
              recordedAt: new Date(position.timestamp).toISOString(),
            }),
          }).catch(() => {});
        }
      },
      (err) => {
        let msg = "Location temporarily unavailable.";
        if (err.code === err.PERMISSION_DENIED) {
          msg = "Location permission denied. Please allow location access in your browser settings to activate live tracking.";
          setGpsConsent(false);
          setGpsActive(false);
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          msg = "GPS signal unavailable. Ensure your device's location service is turned on.";
        } else if (err.code === err.TIMEOUT) {
          msg = "Location request timed out. Retrying...";
        }
        setGpsError(msg);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 5000,
      }
    );

    watchIdRef.current = id;
  };

  const handleDenyLocation = () => {
    setGpsConsent(false);
    setGpsActive(false);
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (session?.id) {
      fetch(`/api/tracking/${session.id}/customer/stop`, {
        method: "POST",
        credentials: "include",
      }).catch(() => {});
    }
  };

  // 6. Emergency SOS Trigger
  const handleTriggerEmergency = async () => {
    if (!session?.id) return;
    setSosSending(true);
    try {
      const res = await fetch(`/api/tracking/${session.id}/emergency`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          notes: sosNote || "Customer requested urgent emergency assistance",
          currentLatitude: currentCoords?.lat,
          currentLongitude: currentCoords?.lng,
        }),
      });
      if (res.ok) {
        setSosActive(true);
        setShowSosModal(false);
        onToast?.("🚨 Emergency alert dispatched to 24/7 Zelevos Operations Desk.");
      }
    } catch {
      onToast?.("Failed to transmit emergency signal. Please call support directly.");
    } finally {
      setSosSending(false);
    }
  };

  // Compute live seconds elapsed
  const getSecondsAgo = (dateStr?: string | null) => {
    if (!dateStr) return null;
    const diff = Math.max(0, Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000));
    return diff;
  };

  const customerSecAgo = getSecondsAgo(session?.lastCustomerLocation?.updatedAt);
  const driverSecAgo = getSecondsAgo(session?.lastDriverLocation?.updatedAt);

  const getStatusBadge = (enabled: boolean, secAgo: number | null) => {
    if (!enabled || secAgo === null) {
      return (
        <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", color: "#64748b", fontSize: "11px", fontWeight: 700 }}>
          <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#94a3b8" }}></span>
          DISABLED
        </span>
      );
    }
    if (secAgo < 60) {
      return (
        <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", color: "#059669", fontSize: "11px", fontWeight: 800 }}>
          <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#10b981", animation: "pulse 1.5s infinite" }}></span>
          ● LIVE ({secAgo}s ago)
        </span>
      );
    }
    if (secAgo < 120) {
      return (
        <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", color: "#d97706", fontSize: "11px", fontWeight: 800 }}>
          <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#f59e0b" }}></span>
          ● STALE ({secAgo}s ago)
        </span>
      );
    }
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", color: "#dc2626", fontSize: "11px", fontWeight: 800 }}>
        <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#ef4444" }}></span>
        ● OFFLINE
      </span>
    );
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(15, 23, 42, 0.75)",
        backdropFilter: "blur(5px)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
    >
      <div
        id="live-trip-safety-modal"
        style={{
          background: "#ffffff",
          borderRadius: "18px",
          width: "100%",
          maxWidth: "880px",
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          overflow: "hidden",
          border: sosActive ? "2px solid #ef4444" : "1px solid #e2e8f0",
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: "16px 22px",
            background: sosActive ? "#fef2f2" : "#ffffff",
            borderBottom: "1px solid #f1f5f9",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                background: sosActive ? "#fee2e2" : "#eff6ff",
                color: sosActive ? "#dc2626" : "#2563eb",
                display: "grid",
                placeItems: "center",
              }}
            >
              {sosActive ? <ShieldAlert size={20} /> : <Shield size={20} />}
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <strong style={{ fontSize: "16px", color: sosActive ? "#991b1b" : "#0f172a" }}>
                  ZELEVOS LIVE TRIP SAFETY
                </strong>
                {sosActive && (
                  <span style={{ background: "#dc2626", color: "#fff", padding: "2px 8px", borderRadius: "9999px", fontSize: "11px", fontWeight: 800 }}>
                    🚨 SOS ACTIVE
                  </span>
                )}
              </div>
              <span style={{ fontSize: "12px", color: "#64748b" }}>
                Booking Ref: <strong>{session?.bookingId || bookingId}</strong> • Customer-First Ground Protection
              </span>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {!isOnline && (
              <span style={{ background: "#fee2e2", color: "#b91c1c", padding: "4px 10px", borderRadius: "6px", fontSize: "11px", fontWeight: 700, display: "flex", alignItems: "center", gap: "4px" }}>
                <SignalZero size={13} /> Network Lost (Reconnecting...)
              </span>
            )}
            <button
              type="button"
              id="close-live-trip-modal-btn"
              onClick={onClose}
              style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "6px", cursor: "pointer", color: "#64748b" }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div style={{ overflowY: "auto", flex: 1, padding: "20px", display: "grid", gap: "16px" }}>
          {/* Location Consent Prompt (Section 8: Never silently activate customer GPS) */}
          {gpsConsent === null && (
            <div
              id="customer-gps-consent-banner"
              style={{
                background: "#eff6ff",
                border: "1.5px solid #bfdbfe",
                borderRadius: "14px",
                padding: "16px 20px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "16px",
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                <Navigation size={22} color="#2563eb" style={{ marginTop: "2px", flexShrink: 0 }} />
                <div>
                  <strong style={{ fontSize: "14px", color: "#1e3a8a", display: "block", marginBottom: "3px" }}>
                    Enable Live Trip Safety Sharing
                  </strong>
                  <p style={{ margin: 0, fontSize: "12.5px", color: "#1d4ed8", lineHeight: 1.45 }}>
                    To help keep you safe during your active trip, Zelevos can share your current location with authorized Zelevos Operations staff. Location sharing is strictly limited to this active trip.
                  </p>
                </div>
              </div>

              <div style={{ display: "flex", gap: "10px", flexShrink: 0 }}>
                <button
                  type="button"
                  id="allow-customer-gps-btn"
                  onClick={handleAllowLocation}
                  style={{
                    background: "#2563eb",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "8px",
                    padding: "9px 18px",
                    fontSize: "13px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  ALLOW LOCATION
                </button>
                <button
                  type="button"
                  id="deny-customer-gps-btn"
                  onClick={handleDenyLocation}
                  style={{
                    background: "#ffffff",
                    color: "#475569",
                    border: "1px solid #cbd5e1",
                    borderRadius: "8px",
                    padding: "9px 14px",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  NOT NOW
                </button>
              </div>
            </div>
          )}

          {/* If Consent Denied */}
          {gpsConsent === false && (
            <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "10px 14px", fontSize: "12px", color: "#64748b", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>Customer location sharing is currently disabled.</span>
              <button
                type="button"
                onClick={handleAllowLocation}
                style={{ background: "none", border: "none", color: "#2563eb", fontWeight: 700, cursor: "pointer", textDecoration: "underline" }}
              >
                Enable Location Sharing
              </button>
            </div>
          )}

          {/* GPS Error Guidance if any */}
          {gpsError && (
            <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "10px", padding: "12px 16px", fontSize: "12px", color: "#92400e", display: "flex", alignItems: "center", gap: "10px" }}>
              <AlertTriangle size={18} color="#d97706" style={{ flexShrink: 0 }} />
              <div>
                <strong>Location Notice:</strong> {gpsError}
              </div>
            </div>
          )}

          {/* Real Live Map Container */}
          <div style={{ position: "relative", borderRadius: "14px", overflow: "hidden", border: "1px solid #e2e8f0", background: "#f1f5f9" }}>
            <div
              ref={mapContainerRef}
              id="leaflet-live-trip-map"
              style={{ width: "100%", height: "360px", zIndex: 1 }}
            />

            {/* Floating Distance Badge (Calculated Geodesic Haversine Distance) */}
            <div
              id="floating-distance-pill"
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
                {session?.calculatedDistanceKm !== null && session?.calculatedDistanceKm !== undefined
                  ? `Driver is ${session.calculatedDistanceKm} km away`
                  : "Distance unavailable (waiting for GPS)"}
              </strong>
            </div>
          </div>

          {/* Driver & Trip Telemetry Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "12px" }}>
            {/* Status Telemetry Card */}
            <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "14px 16px", display: "grid", gap: "8px" }}>
              <span style={{ fontSize: "11px", fontWeight: 800, color: "#64748b", textTransform: "uppercase" }}>
                LIVE GPS STATUS
              </span>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "13px", color: "#334155" }}>Customer Location</span>
                {getStatusBadge(Boolean(session?.customerTrackingEnabled || gpsActive), customerSecAgo)}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "13px", color: "#334155" }}>Driver Location</span>
                {getStatusBadge(Boolean(session?.driverTrackingEnabled), driverSecAgo)}
              </div>
            </div>

            {/* Chauffeur & Vehicle Card */}
            <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "14px 16px", display: "grid", gap: "6px" }}>
              <span style={{ fontSize: "11px", fontWeight: 800, color: "#64748b", textTransform: "uppercase" }}>
                ASSIGNED CHAUFFEUR & VEHICLE
              </span>
              <div style={{ fontSize: "13px", color: "#0f172a" }}>
                Chauffeur: <strong>{session?.driverName || "Assigned Driver"}</strong>
              </div>
              <div style={{ fontSize: "12px", color: "#475569" }}>
                Vehicle: <strong>{session?.vehicleModel || "Standard SUV/Sedan"}</strong>
                {session?.vehicleRegistration && (
                  <span style={{ marginLeft: "8px", background: "#ffffff", border: "1px solid #cbd5e1", padding: "2px 6px", borderRadius: "4px", fontFamily: "monospace", fontWeight: 700 }}>
                    {session.vehicleRegistration}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer Safety Actions */}
        <div
          style={{
            padding: "14px 22px",
            background: "#ffffff",
            borderTop: "1px solid #f1f5f9",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "10px",
          }}
        >
          <div style={{ display: "flex", gap: "10px" }}>
            {session?.driverPhone ? (
              <a
                id="call-driver-btn"
                href={`tel:${session.driverPhone}`}
                style={{
                  background: "#059669",
                  color: "#ffffff",
                  padding: "9px 16px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: 700,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  textDecoration: "none",
                }}
              >
                <Phone size={15} /> CALL DRIVER ({session.driverPhone})
              </a>
            ) : (
              <button
                type="button"
                disabled
                style={{
                  background: "#f1f5f9",
                  color: "#94a3b8",
                  padding: "9px 16px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: 600,
                  border: "none",
                }}
              >
                Driver Phone Pending
              </button>
            )}

            <a
              id="call-zelevos-support-btn"
              href="tel:+919876543210"
              style={{
                background: "#f8fafc",
                color: "#1e293b",
                border: "1px solid #cbd5e1",
                padding: "9px 14px",
                borderRadius: "8px",
                fontSize: "13px",
                fontWeight: 600,
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                textDecoration: "none",
              }}
            >
              <Phone size={14} color="#2563eb" /> 24/7 Concierge Support
            </a>
          </div>

          <div>
            <button
              type="button"
              id="emergency-sos-trigger-btn"
              onClick={() => setShowSosModal(true)}
              style={{
                background: "#dc2626",
                color: "#ffffff",
                border: "none",
                borderRadius: "8px",
                padding: "10px 20px",
                fontSize: "13px",
                fontWeight: 800,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                boxShadow: "0 4px 14px rgba(220, 38, 38, 0.35)",
              }}
            >
              <ShieldAlert size={16} /> EMERGENCY / SOS
            </button>
          </div>
        </div>
      </div>

      {/* Emergency Assistance Dialog (Section 9: Customer Safety Priority) */}
      {showSosModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.65)",
            backdropFilter: "blur(4px)",
            zIndex: 10001,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
          }}
        >
          <div
            id="emergency-sos-confirm-dialog"
            style={{
              background: "#ffffff",
              borderRadius: "16px",
              padding: "24px",
              maxWidth: "460px",
              width: "100%",
              boxShadow: "0 25px 50px -12px rgba(220, 38, 38, 0.4)",
              border: "2px solid #ef4444",
              display: "grid",
              gap: "16px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ width: "42px", height: "42px", borderRadius: "12px", background: "#fee2e2", color: "#dc2626", display: "grid", placeItems: "center" }}>
                <ShieldAlert size={24} />
              </div>
              <div>
                <strong style={{ fontSize: "16px", color: "#991b1b" }}>EMERGENCY ASSISTANCE</strong>
                <span style={{ fontSize: "12px", color: "#64748b", display: "block" }}>
                  Dispatches high-priority alert to Zelevos 24/7 Operations Desk
                </span>
              </div>
            </div>

            <p style={{ margin: 0, fontSize: "13px", color: "#334155", lineHeight: 1.45 }}>
              Are you in distress or need immediate intervention? This will notify on-ground operations staff with your real-time coordinates and booking dossier.
            </p>

            <textarea
              placeholder="Describe situation (optional): e.g. cab route deviation, medical need..."
              value={sosNote}
              onChange={(e) => setSosNote(e.target.value)}
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                fontSize: "12px",
                minHeight: "70px",
                resize: "vertical",
              }}
            />

            <div style={{ display: "grid", gap: "10px" }}>
              <button
                type="button"
                id="confirm-send-sos-btn"
                onClick={handleTriggerEmergency}
                disabled={sosSending}
                style={{
                  background: "#dc2626",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "8px",
                  padding: "12px",
                  fontSize: "14px",
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                {sosSending ? "DISPATCHING SOS..." : "CREATE EMERGENCY ALERT"}
              </button>

              <button
                type="button"
                onClick={() => setShowSosModal(false)}
                style={{
                  background: "#f1f5f9",
                  color: "#475569",
                  border: "none",
                  borderRadius: "8px",
                  padding: "10px",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
