import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, CalendarDays, Car, Check, Hotel, MapPin, Plane, Search, Star, Ticket, Users, X, AlertCircle } from "lucide-react";

type Provider = { provider: string; mode: "DEMO" | "LIVE"; status: string };
type HotelResult = { id: string; name: string; destination: string; rating: number; location: string; amenities: string[]; room: string; cancellation: string; pricePerNight: number; image: string; provider: string; mode: "DEMO" | "LIVE" };
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
  if (!response.ok) throw new Error(payload.message || "Wayora could not load that search.");
  return payload;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const payload = await response.json() as T & { message?: string };
  if (!response.ok) throw new Error(payload.message || "Wayora could not complete that action.");
  return payload;
}

function DemoBadge({ mode }: { mode: "DEMO" | "LIVE" }) {
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
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [transport, setTransport] = useState<Transport[]>([]);
  const [sortBy, setSortBy] = useState<"recommended" | "price-low" | "rating-high">("recommended");
  const [experienceCategory, setExperienceCategory] = useState("");
  const [hotelForm, setHotelForm] = useState({ destination: "Kashmir", checkIn: "2026-10-12", checkOut: "2026-10-17", guests: "2", rooms: "1" });
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
        const payload = await getJson<{ provider: Provider; results: HotelResult[] }>(`/api/hotels/search?${new URLSearchParams(hotelForm)}`);
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

  // Sorting logic: recommended = best value (rating/price ratio), price-low = cheapest first, rating-high = highest rated first
  const sortedHotels = [...hotels].sort((a, b) => {
    if (sortBy === "price-low") return a.pricePerNight - b.pricePerNight;
    if (sortBy === "rating-high") return b.rating - a.rating;
    // recommended: balance of rating and value (rating/price ratio)
    const scoreA = (a.rating / (a.pricePerNight / 1000));
    const scoreB = (b.rating / (b.pricePerNight / 1000));
    return scoreB - scoreA;
  });

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
      const result = await postJson<{ message: string }>("/api/bookings", { kind, itemId, amount, payload });
      onToast(result.message);
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
                Fly anywhere with Wayora
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
                <label><span>Destination</span><div><MapPin size={15} /><input value={hotelForm.destination} onChange={(event) => setHotelForm({ ...hotelForm, destination: event.target.value })} /></div></label>
                <label><span>Check-in</span><div><CalendarDays size={15} /><input type="date" value={hotelForm.checkIn} onChange={(event) => setHotelForm({ ...hotelForm, checkIn: event.target.value })} /></div></label>
                <label><span>Check-out</span><div><CalendarDays size={15} /><input type="date" value={hotelForm.checkOut} onChange={(event) => setHotelForm({ ...hotelForm, checkOut: event.target.value })} /></div></label>
                <label><span>Guests / rooms</span><div><Users size={15} /><input type="number" min="1" value={hotelForm.guests} onChange={(event) => setHotelForm({ ...hotelForm, guests: event.target.value })} /></div></label>
              </>
            )}
            {tab === "experiences" && <div className="travel-search-copy"><Search size={18} /><span>Explore verified local experiences across India.</span></div>}
            {tab === "transport" && (
              <>
                <label><span>Pickup</span><div><MapPin size={15} /><input value={transportForm.pickup} onChange={(event) => setTransportForm({ ...transportForm, pickup: event.target.value })} /></div></label>
                <label><span>Drop</span><div><MapPin size={15} /><input value={transportForm.drop} onChange={(event) => setTransportForm({ ...transportForm, drop: event.target.value })} /></div></label>
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
          <div className="travel-results">
            {sortedHotels.map((hotel) => (
              <article className="travel-result-card hotel-result" key={hotel.id}>
                <img src={hotel.image} alt="" />
                <div className="travel-result-main">
                  <DemoBadge mode={hotel.mode} />
                  <div className="result-title">
                    <strong>{hotel.name}</strong>
                    <span><Star size={12} fill="currentColor" /> {hotel.rating} · {hotel.location}</span>
                  </div>
                  <p>{hotel.room} · {hotel.amenities.join(" · ")}</p>
                  <small>{hotel.cancellation}</small>
                </div>
                <div className="result-price">
                  <span>per night</span>
                  <strong>₹{hotel.pricePerNight.toLocaleString("en-IN")}</strong>
                  <button onClick={() => void makeBooking("HOTEL", hotel.id, hotel.pricePerNight, hotel)}>
                    Select stay <ArrowRight size={14} />
                  </button>
                </div>
              </article>
            ))}
          </div>
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

  if (!user) return <div className="travel-state"><Ticket size={23} /><strong>Log in to see your bookings.</strong><span>Your flight tickets and reservations are saved privately to your Wayora account.</span><button onClick={onLogin}>Log in <ArrowRight size={14} /></button></div>;
  if (loading) return <div className="travel-state"><span className="typing"><i /><i /><i /></span> Loading your bookings...</div>;
  if (!results.length) return <div className="travel-state"><Ticket size={23} /><strong>No bookings yet.</strong><span>Search for flights or stays above to book and receive live airline PNR tickets.</span></div>;

  return (
    <div className="booking-list" style={{ display: "grid", gap: "12px" }}>
      {results.map((booking) => {
        const isConfirmed = booking.status === "CONFIRMED";
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