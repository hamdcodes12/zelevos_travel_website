/**
 * PARKED COMPONENT: TravelHub (Legacy Multi-Modal Travel OS Component)
 * 
 * Status: PARKED (Decoupled from active V1 Curated Marketplace homepage)
 * PRD Reference: Wayora_PRD_Without_APIs Section 3 & Section 7.1
 * Flights functionality is housed in the dedicated /flights route.
 * Preserved per directive's "park, don't delete" rule.
 */

import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, CalendarDays, Car, Check, Hotel, MapPin, Plane, Search, Star, Ticket, Users, X, AlertCircle } from "lucide-react";
import { LocationAutocomplete } from "@/components/location-autocomplete";
import { RouteMap } from "@/components/route-map";
import { filterHotelResults, paginateHotelResults } from "@/lib/hotel-results";
import { syncHotelGuestRooms, toGuestRoomManifest, validateHotelGuestRooms, type HotelGuestRoom } from "@/lib/hotel-guests";

declare global {
  interface Window {
    Razorpay?: any;
  }
}

type Provider = { provider: string; mode: "DEMO" | "LIVE" | "TEST"; status: string };
type HotelRoomOccupancy = { adults: number; children: number; childAges: number[] };
type HotelGuestUpdate = { firstName?: string; surname?: string; age?: number };
type HotelContent = { name?: string; category?: string; address?: string; destination?: string; images: string[]; description?: string; facilities: string[]; rooms: Array<{ name?: string; code?: string; roomType?: string; facilities: string[] }>; boards: Array<{ name?: string; code?: string }>; pointsOfInterest: Array<{ name: string; distance?: number }> };
type HotelResult = { id: string; name: string; destination: string; rating: number; location: string; amenities: string[]; room: string; cancellation: string; pricePerNight: number; image: string; provider: string; mode: "DEMO" | "LIVE" | "TEST"; category?: string; boardType?: string; refundable?: boolean };
type Experience = { id: string; name: string; category: string; description: string; location: string; duration: string; price: number; rating: number; supplier: string; verified: boolean; image: string; provider: string; mode: "DEMO" | "LIVE" };
type Transport = { id: string; type: string; provider: string; pickup: string; drop: string; vehicle: string; duration: string; price: number; passengers: number; status: string; mode: "DEMO" | "LIVE" };
type Tab = "flights" | "hotels" | "experiences" | "transport" | "bookings";

export type BookingRecord = {
  id: string;
  kind: string;
  amount: number;
  status: string;
  bookingReference: string;
  pnr?: string;
  ticketNumber?: string;
  providerMode?: string;
  emailStatus?: string;
  emailSentAt?: string;
  clientEmail?: string;
  emailError?: string;
  segments?: Array<{ carrier: string; flightNumber: string; origin: string; destination: string; departureTime: string; arrivalTime: string }>;
  passengers?: Array<{ title: string; firstName: string; lastName: string; type: string }>;
  refundAmount?: number;
  createdAt: string;
};

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { credentials: "include" });
  const payload = await response.json() as T & { message?: string };
  if (!response.ok) throw new Error(payload.message || "Zelevos could not load that search.");
  return payload;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const payload = await response.json() as T & { message?: string };
  if (!response.ok) {
    const error = new Error(payload.message || "Zelevos could not complete that action.") as Error & { status?: number; payload?: unknown };
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

async function loadRazorpayCheckout(): Promise<void> {
  if (window.Razorpay) return;
  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Unable to load Razorpay checkout SDK.")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Unable to load Razorpay checkout SDK. Please check your connection."));
    document.head.appendChild(script);
  });
  if (!window.Razorpay) throw new Error("Razorpay checkout SDK is unavailable.");
}

function DemoBadge({ mode }: { mode: "DEMO" | "LIVE" | "TEST" }) {
  if (mode === "TEST") {
    return <span className="provider-badge">CURATED TEST</span>;
  }
  if (mode === "LIVE") {
    return <span className="provider-badge live">Live inventory</span>;
  }
  return <span className="provider-badge">DEMO</span>;
}

function ProviderNote({ provider }: { provider?: Provider }) {
  if (!provider) return null;
  return (
    <p className="provider-note">
      <span className={`provider-dot ${provider.mode === "LIVE" ? "live" : ""}`} />
      {provider.mode === "LIVE"
        ? `${provider.provider} connected · Live flight inventory`
        : "DEMO / TEST provider · no supplier reservation or real-world PNR created"}
    </p>
  );
}

function supplierPolicyText(policy: Record<string, unknown>): string {
  const labels: Array<[string, string]> = [
    ["from", "Effective"],
    ["to", "Until"],
    ["date", "Date"],
    ["amount", "Fee"],
    ["currency", "Currency"],
    ["percent", "Percent"],
  ];
  const parts = labels.flatMap(([key, label]) => policy[key] === undefined || policy[key] === null || policy[key] === "" ? [] : [`${label}: ${String(policy[key])}`]);
  const knownKeys = new Set(labels.map(([key]) => key));
  const extra = Object.entries(policy).filter(([key, value]) => !knownKeys.has(key) && value !== undefined && value !== null && value !== "").map(([key, value]) => `${key}: ${typeof value === "object" ? JSON.stringify(value) : String(value)}`);
  return [...parts, ...extra].join(" · ") || "Supplier cancellation terms returned without displayable fields.";
}

export type FlightSearchPrefill = {
  from?: string;
  to?: string;
  departure?: string;
  travellers?: string | number;
  cabin?: string;
};

export function TravelHub({
  user,
  onLogin,
  onRequireAuth,
  onToast,
  activeTab,
  onTabChange,
  flightPrefill,
}: {
  user: any;
  onLogin: () => void;
  onRequireAuth?: (onSuccess?: () => void, notice?: string) => void;
  onToast: (message: string) => void;
  activeTab?: Tab;
  onTabChange?: (tab: Tab) => void;
  flightPrefill?: FlightSearchPrefill;
}) {
  const [tab, setTabState] = useState<Tab>(activeTab || "flights");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [provider, setProvider] = useState<Provider>();
  const [hotels, setHotels] = useState<HotelResult[]>([]);
  const [hotelContent, setHotelContent] = useState<Record<string, HotelContent>>({});
  const [hotelComments, setHotelComments] = useState<Record<string, string>>({});
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [transport, setTransport] = useState<Transport[]>([]);
  const [sortBy, setSortBy] = useState<"recommended" | "price-low" | "rating-high">("recommended");
  const [hotelRooms, setHotelRooms] = useState<HotelRoomOccupancy[]>([{ adults: 2, children: 0, childAges: [] }]);
  const [hotelGuestRooms, setHotelGuestRooms] = useState<HotelGuestRoom[]>([]);
  const [hotelBookingState, setHotelBookingState] = useState("");
  const [hotelFilters, setHotelFilters] = useState<{ search: string; minPrice: string; maxPrice: string; category: string; board: string; refundable: "all" | "yes" | "no" }>({ search: "", minPrice: "", maxPrice: "", category: "", board: "", refundable: "all" });
  const [hotelPage, setHotelPage] = useState(1);
  const [experienceCategory, setExperienceCategory] = useState("");
  const [hotelForm, setHotelForm] = useState({ destination: "Kashmir", checkIn: "2026-10-12", checkOut: "2026-10-17", guests: "2", children: "0", childAges: "", rooms: "1" });
  const [transportForm, setTransportForm] = useState({ pickup: "Srinagar Airport", drop: "Gulmarg", date: "2026-10-12", passengers: "2" });
  const [validationError, setValidationError] = useState("");

  const setTab = (newTab: Tab) => {
    setTabState(newTab);
    onTabChange?.(newTab);
  };

  useEffect(() => {
    if (activeTab && activeTab !== tab) {
      setTabState(activeTab);
    }
  }, [activeTab]);

  const runSearch = async (event?: FormEvent) => {
    event?.preventDefault();
    if (tab === "bookings" || tab === "flights") return;
    setLoading(true);
    setError("");
    setValidationError("");
    try {
      if (tab === "hotels") {
        const params = new URLSearchParams({ ...hotelForm, guests: String(hotelRooms[0]?.adults || 1), children: String(hotelRooms[0]?.children || 0), childAges: (hotelRooms[0]?.childAges || []).join(","), rooms: String(hotelRooms.length), roomOccupancies: JSON.stringify(hotelRooms) });
        const payload = await getJson<{ provider: Provider; results: HotelResult[] }>(`/api/hotels/search?${params}`);
        setProvider(payload.provider);
        setHotels(payload.results);
      } else if (tab === "experiences") {
        const params = new URLSearchParams({ destination: "Kashmir" });
        if (experienceCategory) params.set("category", experienceCategory);
        const payload = await getJson<{ provider: Provider; results: Experience[] }>(`/api/experiences?${params}`);
        setProvider(payload.provider);
        setExperiences(payload.results);
      } else if (tab === "transport") {
        const payload = await getJson<{ provider: Provider; results: Transport[] }>(`/api/transport/search?${new URLSearchParams(transportForm)}`);
        setProvider(payload.provider);
        setTransport(payload.results);
      }
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : "Search could not be completed.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tab !== "flights" && tab !== "bookings") {
      void runSearch();
    }
  }, [tab]);

  useEffect(() => {
    if (tab === "experiences") void runSearch();
  }, [experienceCategory]);

  const filteredHotels = filterHotelResults(hotels.map((hotel) => ({ ...hotel, category: hotel.category || String(hotel.rating), boardType: hotel.boardType, refundable: hotel.refundable })), hotelFilters);

  // Sorting logic: recommended = best value (rating/price ratio), price-low = cheapest first, rating-high = highest rated first
  const sortedHotels = [...filteredHotels].sort((a, b) => {
    if (sortBy === "price-low") return a.pricePerNight - b.pricePerNight;
    if (sortBy === "rating-high") return b.rating - a.rating;
    // recommended: balance of rating and value (rating/price ratio)
    const scoreA = (a.rating / (a.pricePerNight / 1000));
    const scoreB = (b.rating / (b.pricePerNight / 1000));
    return scoreB - scoreA;
  });
  const { items: visibleHotels, page: currentHotelPage, pageCount: hotelPageCount } = paginateHotelResults(sortedHotels, hotelPage, 6);

  useEffect(() => {
    setHotelPage(1);
  }, [hotelFilters, sortBy, hotels]);

  const updateHotelRoom = (index: number, update: Partial<HotelRoomOccupancy>) => {
    setHotelRooms((rooms) => rooms.map((room, roomIndex) => roomIndex === index ? { ...room, ...update } : room));
  };

  useEffect(() => {
    const userName = String(user?.fullName || user?.name || user?.email?.split("@")[0] || "").trim().split(/\s+/);
    setHotelGuestRooms((existing) => syncHotelGuestRooms(existing, hotelRooms, userName[0] ? { firstName: userName[0], surname: userName.slice(1).join(" ") } : undefined));
  }, [hotelRooms, user]);

  const updateHotelGuest = (roomIndex: number, group: "adults" | "children", guestIndex: number, update: HotelGuestUpdate) => {
    setHotelGuestRooms((rooms) => rooms.map((room, index) => {
      if (index !== roomIndex) return room;
      if (group === "adults") {
        const adults = [...room.adults];
        adults[guestIndex] = { ...adults[guestIndex], firstName: update.firstName ?? adults[guestIndex].firstName, surname: update.surname ?? adults[guestIndex].surname };
        return { ...room, adults };
      }
      const children = [...room.children];
      children[guestIndex] = { ...children[guestIndex], firstName: update.firstName ?? children[guestIndex].firstName, surname: update.surname ?? children[guestIndex].surname };
      return { ...room, children };
    }));
  };

  const sortedExperiences = [...experiences].sort((a, b) => {
    if (sortBy === "price-low") return a.price - b.price;
    if (sortBy === "rating-high") return b.rating - a.rating;
    // recommended: balance of rating and value
    const scoreA = (a.rating / (a.price / 1000));
    const scoreB = (b.rating / (b.price / 1000));
    return scoreB - scoreA;
  });

  const sortedTransport = [...transport].sort((a, b) => {
    if (sortBy === "price-low") return a.price - b.price;
    // recommended: lowest price (no ratings for transport)
    return a.price - b.price;
  });

  const makeBooking = async (kind: "HOTEL" | "ACTIVITY" | "TRANSPORT", itemId: string, amount: number, payload: Record<string, unknown>) => {
    if (!user) {
      onLogin();
      return;
    }
    try {
      const result = await postJson<{
        message: string;
        requiresPayment?: boolean;
        booking?: BookingRecord & { paymentOrderId?: string };
        orderId?: string;
        amountSubunits?: number;
        currency?: string;
        keyId?: string;
        provider?: string;
      }>("/api/bookings", {
        kind,
        itemId,
        amount,
        payload,
        idempotencyKey: `booking-${crypto.randomUUID()}`,
      });

      if (result.requiresPayment && result.booking && result.orderId && result.amountSubunits && result.keyId) {
        try {
          await loadRazorpayCheckout();
          if (!window.Razorpay) throw new Error("Razorpay checkout SDK is unavailable.");

          const payment = await new Promise<{ orderId: string; paymentId: string; signature: string }>((resolve, reject) => {
            const checkout = new window.Razorpay({
              key: result.keyId,
              amount: result.amountSubunits,
              currency: result.currency || "INR",
              name: "Zelevos",
              description: `${kind.charAt(0) + kind.slice(1).toLowerCase()} booking`,
              order_id: result.orderId,
              prefill: { email: user.email },
              theme: { color: "#214ecf" },
              handler: (response: any) => {
                if (!response?.razorpay_payment_id || !response?.razorpay_signature) {
                  reject(new Error("Incomplete payment response from Razorpay."));
                  return;
                }
                resolve({
                  orderId: response.razorpay_order_id || result.orderId!,
                  paymentId: response.razorpay_payment_id,
                  signature: response.razorpay_signature,
                });
              },
              payment: {
                failed: (response: any) => reject(new Error(response?.error?.description || "Razorpay could not complete the payment.")),
              },
              modal: {
                ondismiss: () => reject(new Error("Payment checkout was cancelled before completing the transaction.")),
              },
            });
            checkout.open();
          });

          const finalized = await postJson<{ message: string }>(`/api/bookings/${result.booking.id}/payment`, payment);
          onToast(finalized.message);
        } catch (paymentError) {
          void postJson("/api/payments/cancel", {
            orderId: result.orderId,
            reason: paymentError instanceof Error ? paymentError.message : "Checkout was cancelled.",
          }).catch(() => undefined);
          throw paymentError;
        }
      } else {
        onToast(result.message);
      }
      if (tab === "bookings") void runSearch();
    } catch (bookingError) {
      onToast(bookingError instanceof Error ? bookingError.message : "Booking could not be created.");
    }
  };

  const tabs: Array<{ id: Tab; label: string; icon: typeof Plane }> = [
    { id: "flights", label: "Flights", icon: Plane },
    { id: "hotels", label: "Hotels", icon: Hotel },
    { id: "experiences", label: "Experiences", icon: Star },
    { id: "transport", label: "Transport", icon: Car },
    { id: "bookings", label: "My bookings", icon: Ticket },
  ];

  return (
    <section id="travel-hub" className="travel-hub">
      <div className="page-shell">
        <div className="travel-hub-heading">
          <div>
            <div className="eyebrow"><span className="eyebrow-line" />TRAVEL MARKETPLACE</div>
            <h2>Compare the pieces.<br /><span>Keep the trip together.</span></h2>
            <p>Live flight inventory, instant fare lock, secure payments, and live PNR confirmation saved directly to your account.</p>
          </div>
          <div className="travel-hub-summary"><strong>One trip, one place</strong><span>Search · select · save to Trip OS</span></div>
        </div>
        <div className="travel-tabs" role="tablist">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              className={tab === id ? "active" : ""}
              onClick={() => setTab(id)}
            >
              <Icon size={15} />{label}
            </button>
          ))}
        </div>

        {tab === "flights" && (
          <div
            className="travel-result-card"
            style={{
              padding: "32px 36px",
              marginTop: "16px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "24px",
              background: "linear-gradient(135deg, rgba(255,255,255,0.98), rgba(244,247,251,0.92))",
              border: "1px solid var(--border)",
              borderRadius: "16px",
              boxShadow: "0 4px 20px rgba(0,0,0,0.04)",
            }}
          >
            <div style={{ maxWidth: "620px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                <span className="provider-badge">DEMO / TEST FLIGHT</span>
                <span style={{ fontSize: "11px", color: "var(--muted)", fontWeight: 600 }}>Dedicated Flight Portal</span>
              </div>
              <h3 style={{ fontSize: "22px", fontWeight: 800, margin: "0 0 10px", color: "var(--text)" }}>
                Fly anywhere with Zelevos
              </h3>
              <p style={{ margin: "0 0 16px", color: "var(--muted)", fontSize: "13px", lineHeight: "1.6" }}>
                Search demo Indian and international routes, review fare rules, complete a demo checkout, and save the booking to your account. No supplier reservation or real money is involved.
              </p>
              <div style={{ display: "flex", gap: "18px", flexWrap: "wrap", fontSize: "12px", color: "var(--muted)", fontWeight: 600 }}>
                <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <Check size={14} style={{ color: "var(--success)" }} /> Verified Indian Airports
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <Check size={14} style={{ color: "var(--success)" }} /> Demo inventory
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <Check size={14} style={{ color: "var(--success)" }} /> Safe demo confirmation
                </span>
              </div>
            </div>
            <div>
              <a
                id="marketplace-search-flights-btn"
                href="/flights"
                onClick={(e) => {
                  e.preventDefault();
                  window.location.href = "/flights";
                }}
                className="button button-primary"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "14px 28px",
                  fontSize: "14px",
                  fontWeight: 700,
                  textDecoration: "none",
                  borderRadius: "10px",
                }}
              >
                Search flights <ArrowRight size={16} />
              </a>
            </div>
          </div>
        )}

        {tab !== "bookings" && tab !== "flights" && (
          <form className="travel-search" onSubmit={runSearch}>
            {tab === "hotels" && (
              <>
                <label><span>Destination</span><div><LocationAutocomplete id="hotel-destination-input" value={hotelForm.destination} onChange={(destination) => setHotelForm({ ...hotelForm, destination })} placeholder="Search city or destination..." /></div></label>
                <label><span>Check-in</span><div><CalendarDays size={15} /><input type="date" value={hotelForm.checkIn} onChange={(event) => setHotelForm({ ...hotelForm, checkIn: event.target.value })} /></div></label>
                <label><span>Check-out</span><div><CalendarDays size={15} /><input type="date" value={hotelForm.checkOut} onChange={(event) => setHotelForm({ ...hotelForm, checkOut: event.target.value })} /></div></label>
                <div style={{ gridColumn: "1 / -1", display: "grid", gap: "8px" }}>
                  {hotelRooms.map((room, index) => <div key={index} style={{ display: "flex", gap: "8px", alignItems: "end", flexWrap: "wrap", padding: "8px", border: "1px solid var(--border)", borderRadius: "8px" }}>
                    <strong style={{ fontSize: "11px", marginRight: "4px" }}>Room {index + 1}</strong>
                    <label><span>Adults</span><div><Users size={15} /><input aria-label={`Room ${index + 1} adults`} type="number" min="1" max="9" value={room.adults} onChange={(event) => updateHotelRoom(index, { adults: Number(event.target.value) || 1 })} /></div></label>
                    <label><span>Children</span><div><Users size={15} /><input aria-label={`Room ${index + 1} children`} type="number" min="0" max="8" value={room.children} onChange={(event) => { const children = Number(event.target.value) || 0; updateHotelRoom(index, { children, childAges: room.childAges.slice(0, children) }); }} /></div></label>
                    {room.children > 0 && <label><span>Child ages</span><div><input aria-label={`Room ${index + 1} child ages`} type="text" placeholder="e.g. 7, 12" value={room.childAges.join(", ")} onChange={(event) => updateHotelRoom(index, { childAges: event.target.value.split(",").map(Number).filter((age) => Number.isInteger(age) && age >= 0 && age <= 17).slice(0, room.children) })} /></div></label>}
                    {hotelRooms.length > 1 && <button type="button" onClick={() => setHotelRooms((rooms) => rooms.filter((_, roomIndex) => roomIndex !== index))} style={{ border: "0", background: "transparent", color: "var(--danger)", fontSize: "11px" }}>Remove room</button>}
                  </div>)}
                  {hotelRooms.length < 8 && <button type="button" onClick={() => setHotelRooms((rooms) => [...rooms, { adults: 2, children: 0, childAges: [] }])} style={{ justifySelf: "start", border: "1px solid var(--border)", background: "white", color: "var(--blue)", borderRadius: "6px", padding: "6px 9px", fontSize: "11px", fontWeight: 700 }}>+ Add room</button>}
                </div>
              </>
            )}
            {tab === "experiences" && <div className="travel-search-copy"><Search size={18} /><span>Explore verified local experiences across India.</span></div>}
            {tab === "transport" && (
              <>
                <label><span>Pickup</span><div><LocationAutocomplete id="transport-pickup-input" value={transportForm.pickup} onChange={(pickup) => setTransportForm({ ...transportForm, pickup })} placeholder="Search pickup location..." /></div></label>
                <label><span>Drop</span><div><LocationAutocomplete id="transport-drop-input" value={transportForm.drop} onChange={(drop) => setTransportForm({ ...transportForm, drop })} placeholder="Search drop location..." /></div></label>
                <label><span>Date</span><div><CalendarDays size={15} /><input type="date" value={transportForm.date} onChange={(event) => setTransportForm({ ...transportForm, date: event.target.value })} /></div></label>
                <label><span>Passengers</span><div><Users size={15} /><input type="number" min="1" value={transportForm.passengers} onChange={(event) => setTransportForm({ ...transportForm, passengers: event.target.value })} /></div></label>
              </>
            )}
            {tab !== "experiences" && (
              <button className="travel-search-button" type="submit" disabled={loading}>
                <Search size={15} />
                {loading ? "Searching..." : "Search"}
              </button>
            )}
          </form>
        )}
        {tab === "hotels" && hotelGuestRooms.length > 0 && (
          <div style={{ display: "grid", gap: "10px", marginTop: "12px", padding: "14px", border: "1px solid var(--border)", borderRadius: "10px", background: "var(--soft)" }}>
            <div><strong style={{ fontSize: "13px" }}>Guest details</strong><span style={{ display: "block", color: "var(--muted)", fontSize: "11px", marginTop: "3px" }}>Names are required for every guest. Child ages are preserved for room occupancy.</span></div>
            {hotelGuestRooms.map((room, roomIndex) => <div key={roomIndex} style={{ display: "grid", gap: "8px", paddingTop: "8px", borderTop: "1px solid var(--border)" }}>
              <strong style={{ fontSize: "11px" }}>Room {roomIndex + 1}</strong>
              {room.adults.map((guest, guestIndex) => <div key={`adult-${guestIndex}`} style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <span style={{ width: "70px", fontSize: "10px", color: "var(--muted)", paddingTop: "9px" }}>Adult {guestIndex + 1}</span>
                <input aria-label={`Room ${roomIndex + 1} adult ${guestIndex + 1} first name`} placeholder="First name" value={guest.firstName} onChange={(event) => updateHotelGuest(roomIndex, "adults", guestIndex, { firstName: event.target.value })} style={{ flex: "1 1 140px", minWidth: "120px", padding: "8px", border: "1px solid var(--border)", borderRadius: "6px" }} />
                <input aria-label={`Room ${roomIndex + 1} adult ${guestIndex + 1} surname`} placeholder="Surname" value={guest.surname} onChange={(event) => updateHotelGuest(roomIndex, "adults", guestIndex, { surname: event.target.value })} style={{ flex: "1 1 140px", minWidth: "120px", padding: "8px", border: "1px solid var(--border)", borderRadius: "6px" }} />
              </div>)}
              {room.children.map((guest, guestIndex) => <div key={`child-${guestIndex}`} style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <span style={{ width: "70px", fontSize: "10px", color: "var(--muted)", paddingTop: "9px" }}>Child {guestIndex + 1} · {guest.age}</span>
                <input aria-label={`Room ${roomIndex + 1} child ${guestIndex + 1} first name`} placeholder="First name" value={guest.firstName} onChange={(event) => updateHotelGuest(roomIndex, "children", guestIndex, { firstName: event.target.value })} style={{ flex: "1 1 140px", minWidth: "120px", padding: "8px", border: "1px solid var(--border)", borderRadius: "6px" }} />
                <input aria-label={`Room ${roomIndex + 1} child ${guestIndex + 1} surname`} placeholder="Surname" value={guest.surname} onChange={(event) => updateHotelGuest(roomIndex, "children", guestIndex, { surname: event.target.value })} style={{ flex: "1 1 140px", minWidth: "120px", padding: "8px", border: "1px solid var(--border)", borderRadius: "6px" }} />
              </div>)}
            </div>)}
            {validationError && <span style={{ color: "var(--danger)", fontSize: "11px" }}>{validationError}</span>}
            {hotelBookingState && <span style={{ color: hotelBookingState.includes("confirmed") ? "var(--success)" : "var(--muted)", fontSize: "11px", fontWeight: 700 }}>{hotelBookingState}</span>}
          </div>
        )}
        {tab === "transport" && transportForm.pickup && transportForm.drop && (
          <RouteMap origin={transportForm.pickup} destination={transportForm.drop} />
        )}
        {tab !== "flights" && <ProviderNote provider={provider} />}
        {tab !== "flights" && tab !== "bookings" && (
          <div style={{ display: "flex", gap: "8px", alignItems: "center", margin: "14px 0", flexWrap: "wrap" }}>
            <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)" }}>Sort
              <select value={sortBy} onChange={(event) => setSortBy(event.target.value as typeof sortBy)} style={{ marginLeft: "6px", padding: "6px 8px", border: "1px solid var(--border)", borderRadius: "6px" }}>
                <option value="recommended">Recommended</option>
                <option value="price-low">Price: low to high</option>
                <option value="rating-high">Rating: high to low</option>
              </select>
            </label>
            {tab === "experiences" && <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)" }}>Category
              <select value={experienceCategory} onChange={(event) => setExperienceCategory(event.target.value)} style={{ marginLeft: "6px", padding: "6px 8px", border: "1px solid var(--border)", borderRadius: "6px" }}>
                <option value="">All</option><option value="Nature">Nature</option><option value="Food">Food</option><option value="Wellness">Wellness</option><option value="Adventure">Adventure</option>
              </select>
            </label>}
            {tab === "hotels" && <>
              <input aria-label="Search hotels" placeholder="Search hotel or destination" value={hotelFilters.search} onChange={(event) => setHotelFilters({ ...hotelFilters, search: event.target.value })} style={{ minWidth: "190px", padding: "6px 8px", border: "1px solid var(--border)", borderRadius: "6px", fontSize: "11px" }} />
              <input aria-label="Minimum hotel price" type="number" min="0" placeholder="Min price" value={hotelFilters.minPrice} onChange={(event) => setHotelFilters({ ...hotelFilters, minPrice: event.target.value })} style={{ width: "90px", padding: "6px 8px", border: "1px solid var(--border)", borderRadius: "6px", fontSize: "11px" }} />
              <input aria-label="Maximum hotel price" type="number" min="0" placeholder="Max price" value={hotelFilters.maxPrice} onChange={(event) => setHotelFilters({ ...hotelFilters, maxPrice: event.target.value })} style={{ width: "90px", padding: "6px 8px", border: "1px solid var(--border)", borderRadius: "6px", fontSize: "11px" }} />
              <select aria-label="Hotel category" value={hotelFilters.category} onChange={(event) => setHotelFilters({ ...hotelFilters, category: event.target.value })} style={{ padding: "6px 8px", border: "1px solid var(--border)", borderRadius: "6px", fontSize: "11px" }}><option value="">All categories</option>{Array.from(new Set(hotels.map((hotel) => hotel.category || String(hotel.rating)))).map((category) => <option key={category} value={category}>{category}</option>)}</select>
              <select aria-label="Hotel board type" value={hotelFilters.board} onChange={(event) => setHotelFilters({ ...hotelFilters, board: event.target.value })} style={{ padding: "6px 8px", border: "1px solid var(--border)", borderRadius: "6px", fontSize: "11px" }}><option value="">All boards</option>{Array.from(new Set(hotels.map((hotel) => hotel.boardType).filter(Boolean))).map((board) => <option key={board} value={board}>{board}</option>)}</select>
              <select aria-label="Refundability" value={hotelFilters.refundable} onChange={(event) => setHotelFilters({ ...hotelFilters, refundable: event.target.value as "all" | "yes" | "no" })} style={{ padding: "6px 8px", border: "1px solid var(--border)", borderRadius: "6px", fontSize: "11px" }}><option value="all">All cancellation</option><option value="yes">Refundable</option><option value="no">Non-refundable</option></select>
            </>}
          </div>
        )}
        {error && tab !== "flights" && (
          <div className="travel-state error">
            <strong>Search unavailable</strong>
            <span>{error}</span>
            <button onClick={() => void runSearch()}>Try again</button>
          </div>
        )}
        {!error && tab === "hotels" && (
          <>
          <div className="travel-results">
            {visibleHotels.map((hotel) => (
              <article className="travel-result-card hotel-result" key={hotel.id}>
                {hotel.image && <img src={hotel.image} alt={hotel.name} />}
                <div className="travel-result-main">
                  <DemoBadge mode={hotel.mode} />
                  <div className="result-title">
                    <strong>{hotel.name}</strong>
                    <span><Star size={12} fill="currentColor" /> {hotel.category || hotel.rating} · {hotel.location}</span>
                  </div>
                  <p>{hotel.room} · {hotel.amenities.join(" · ")}</p>
                  <small>{hotel.cancellation || "Standard cancellation policy applies."}</small>
                </div>
                <div className="result-price">
                  <span>per night</span>
                  <strong>INR {hotel.pricePerNight.toLocaleString("en-IN")}</strong>
                  <button onClick={() => void makeBooking("HOTEL", hotel.id, hotel.pricePerNight, hotel)}>
                    Select stay <ArrowRight size={14} />
                  </button>
                </div>
              </article>
            ))}
          </div>
          {!visibleHotels.length && <div className="travel-state"><strong>No hotels match these filters.</strong><span>Adjust the price, category, board, cancellation, or search filters.</span></div>}
          {hotelPageCount > 1 && <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "12px", marginTop: "16px" }}><button type="button" disabled={currentHotelPage === 1} onClick={() => setHotelPage((page) => page - 1)} aria-label="Previous hotel page">Previous</button><span style={{ fontSize: "11px", color: "var(--muted)" }}>Page {currentHotelPage} of {hotelPageCount}</span><button type="button" disabled={currentHotelPage === hotelPageCount} onClick={() => setHotelPage((page) => page + 1)} aria-label="Next hotel page">Next</button></div>}
          </>
        )}
        {!error && tab === "experiences" && (
          <div className="travel-experience-grid">
            {sortedExperiences.map((experience) => (
              <article className="experience-result" key={experience.id}>
                <img src={experience.image} alt="" />
                <div>
                  <DemoBadge mode={experience.mode} />
                  <h3>{experience.name}</h3>
                  <p>{experience.description}</p>
                  <span><MapPin size={12} />{experience.location} · {experience.duration}</span>
                  <span><Star size={12} fill="currentColor" />{experience.rating} · {experience.supplier}</span>
                  <div>
                    <strong>₹{experience.price.toLocaleString("en-IN")}</strong>
                    <button onClick={() => void makeBooking("ACTIVITY", experience.id, experience.price, experience)}>
                      Add to trip <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
        {!error && tab === "transport" && (
          <div className="travel-results">
            {sortedTransport.map((ride) => (
              <article className="travel-result-card" key={ride.id}>
                <div className="travel-result-main">
                  <DemoBadge mode={ride.mode} />
                  <div className="result-title">
                    <strong>{ride.type}</strong>
                    <span>{ride.provider} · {ride.vehicle}</span>
                  </div>
                  <div className="result-route">
                    <strong>{ride.pickup}</strong>
                    <span>{ride.duration}</span>
                    <strong>{ride.drop}</strong>
                    <span>{ride.passengers} passengers</span>
                  </div>
                </div>
                <div className="result-price">
                  <span>one way</span>
                  <strong>₹{ride.price.toLocaleString("en-IN")}</strong>
                  <button onClick={() => void makeBooking("TRANSPORT", ride.id, ride.price, ride)}>
                    Select ride <ArrowRight size={14} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
        {tab === "bookings" && <Bookings user={user} onLogin={onLogin} onToast={onToast} />}
      </div>
    </section>
  );
}

function Bookings({ user, onLogin, onToast }: { user: { id: string } | null; onLogin: () => void; onToast: (message: string) => void }) {
  const [results, setResults] = useState<BookingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const loadBookings = () => {
    if (!user) { setLoading(false); return; }
    void getJson<{ results: BookingRecord[] }>("/api/bookings")
      .then((payload) => setResults(payload.results))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadBookings();
  }, [user]);

  const handleCancelBooking = async (booking: BookingRecord) => {
    if (!confirm(`Are you sure you want to cancel booking ${booking.pnr || booking.bookingReference}? Cancellation fees may apply according to airline rules.`)) {
      return;
    }

    setCancellingId(booking.id);
    try {
      const res = await postJson<{ success: boolean; message: string; cancellation: { refundAmount: number } }>(
        `/api/bookings/${booking.id}/cancel`,
        { reason: "Customer requested cancellation via My Bookings" }
      );
      onToast(res.message);
      loadBookings();
    } catch (err) {
      onToast(err instanceof Error ? err.message : "Failed to cancel booking.");
    } finally {
      setCancellingId(null);
    }
  };

  const [resendingEmailId, setResendingEmailId] = useState<string | null>(null);

  const handleResendEmail = async (booking: BookingRecord) => {
    setResendingEmailId(booking.id);
    try {
      const res = await postJson<{ success: boolean; message: string }>(
        `/api/bookings/${booking.id}/email`,
        {}
      );
      onToast(res.message || "Booking email dispatched successfully!");
      loadBookings();
    } catch (err) {
      onToast(err instanceof Error ? err.message : "Failed to dispatch email.");
    } finally {
      setResendingEmailId(null);
    }
  };

  const downloadHotelVoucher = async (booking: BookingRecord) => {
    try {
      const response = await fetch("/api/documents/sign", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resourceType: "voucher", resourceId: booking.id, title: `Voucher - ${booking.bookingReference}` }),
      });
      if (!response.ok) throw new Error("Voucher could not be downloaded.");
      const data = await response.json() as { signedUrl: string };
      window.open(data.signedUrl, "_blank");
    } catch (err) {
      onToast(err instanceof Error ? err.message : "Voucher could not be downloaded.");
    }
  };

  if (!user) return <div className="travel-state"><Ticket size={23} /><strong>Log in to see your bookings.</strong><span>Your flight tickets and reservations are saved privately to your Zelevos account.</span><button onClick={onLogin}>Log in <ArrowRight size={14} /></button></div>;
  if (loading) return <div className="travel-state"><span className="typing"><i /><i /><i /></span> Loading your bookings...</div>;
  if (!results.length) return <div className="travel-state"><Ticket size={23} /><strong>No bookings yet.</strong><span>Search for flights or stays above to book and receive live airline PNR tickets.</span></div>;

  return (
    <div className="booking-list" style={{ display: "grid", gap: "12px" }}>
      {results.map((booking) => {
        const isConfirmed = booking.status === "CONFIRMED" || booking.status === "SUPPLIER_CONFIRMED";
        const isCancelled = booking.status === "CANCELLED" || booking.status === "DEMO_CANCELLED";

        return (
          <div
            className="booking-row"
            key={booking.id}
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "14px",
              padding: "16px",
              border: "1px solid var(--border)",
              borderRadius: "10px",
              background: "white",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: "260px" }}>
              <span
                className="booking-icon"
                style={{
                  background: isConfirmed ? "var(--success)" : isCancelled ? "var(--muted)" : "var(--blue)",
                  color: "white",
                }}
              >
                {booking.kind === "FLIGHT" ? <Plane size={15} /> : <Check size={15} />}
              </span>

              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <strong style={{ fontSize: "13px" }}>
                    {booking.kind} · {booking.bookingReference}
                  </strong>
                  <span
                    style={{
                      padding: "2px 7px",
                      borderRadius: "4px",
                      fontSize: "9px",
                      fontWeight: 800,
                      background: isConfirmed ? "#ecfdf5" : isCancelled ? "#fef2f2" : "#eff6ff",
                      color: isConfirmed ? "var(--success)" : isCancelled ? "var(--danger)" : "var(--blue)",
                    }}
                  >
                    {booking.status}
                  </span>
                </div>

                {booking.pnr && (
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--blue)", marginTop: "2px" }}>
                    Airline PNR: {booking.pnr} {booking.ticketNumber && `· Ticket: ${booking.ticketNumber}`}
                  </div>
                )}

                {booking.segments && booking.segments.length > 0 && (
                  <span style={{ color: "var(--muted)", fontSize: "10px", marginTop: "2px", display: "block" }}>
                    {booking.segments[0].carrier} · {booking.segments[0].flightNumber} ({booking.segments[0].origin} → {booking.segments[0].destination})
                  </span>
                )}

                {booking.emailStatus && (
                  <span
                    style={{
                      color: booking.emailStatus === "SENT" || booking.emailStatus === "MOCK_SENT" ? "var(--success)" : "#e11d48",
                      fontSize: "10px",
                      marginTop: "3px",
                      display: "block",
                      fontWeight: 600,
                    }}
                  >
                    ✉ Client Email: {booking.emailStatus === "SENT" || booking.emailStatus === "MOCK_SENT" ? "Delivered to operations" : booking.emailStatus}
                    {booking.clientEmail ? ` (${booking.clientEmail})` : ""}
                  </span>
                )}

                {isCancelled && typeof booking.refundAmount === "number" && (
                  <span style={{ color: "var(--success)", fontSize: "10px", marginTop: "2px", display: "block" }}>
                    Refund of ₹{booking.refundAmount.toLocaleString("en-IN")} processed to original payment method
                  </span>
                )}
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginLeft: "auto" }}>
              <div style={{ textAlign: "right" }}>
                <span style={{ fontSize: "10px", color: "var(--muted)", display: "block" }}>Total Paid</span>
                <b style={{ fontSize: "14px" }}>₹{booking.amount.toLocaleString("en-IN")}</b>
              </div>

              {isConfirmed && (
                booking.kind === "HOTEL" ? <button type="button" onClick={() => void downloadHotelVoucher(booking)} style={{ padding: "6px 10px", border: "1px solid var(--blue)", borderRadius: "6px", background: "var(--blue-surface)", color: "var(--blue)", fontSize: "11px", fontWeight: 700 }}>Download voucher</button> : null
              )}

              {isConfirmed && (
                <button
                  type="button"
                  onClick={() => handleResendEmail(booking)}
                  disabled={resendingEmailId === booking.id}
                  style={{
                    padding: "6px 10px",
                    border: "1px solid var(--border)",
                    borderRadius: "6px",
                    background: "#f8fafc",
                    color: "var(--text)",
                    fontSize: "11px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                  title="Resend booking confirmation to client email"
                >
                  {resendingEmailId === booking.id ? "Sending..." : "Resend Email"}
                </button>
              )}

              {isConfirmed && (
                <button
                  type="button"
                  onClick={() => handleCancelBooking(booking)}
                  disabled={cancellingId === booking.id}
                  style={{
                    padding: "6px 12px",
                    border: "1px solid var(--danger)",
                    borderRadius: "6px",
                    background: "white",
                    color: "var(--danger)",
                    fontSize: "11px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {cancellingId === booking.id ? "Cancelling..." : `Cancel ${booking.kind.toLowerCase()}`}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}