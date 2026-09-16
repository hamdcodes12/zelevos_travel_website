import { useEffect, useState, type FormEvent } from "react";
import { useLocation } from "wouter";
import {
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CreditCard,
  Luggage,
  MapPin,
  Menu,
  MessageCircle,
  Plane,
  Search,
  ShieldCheck,
  Sparkles,
  Ticket,
  Users,
  X,
  AlertCircle,
} from "lucide-react";
import { AirportAutocomplete } from "@/components/airport-autocomplete";
import { FlightBookingModal, type FlightOffer } from "@/components/flight-booking-modal";
import { AuthDialog, type AuthUser } from "@/components/auth-dialog";
import { RouteMap } from "@/components/route-map";

type Provider = { provider: string; mode: "DEMO" | "LIVE"; status: string };

type FlightDataPoint = {
  origin: string;
  destination: string;
  origin_airport?: string;
  destination_airport?: string;
  price?: number;
  currency?: string;
  airline?: string;
  flight_number?: string | number;
  departure_at?: string;
  return_at?: string;
  transfers?: number;
  duration?: number;
};

interface FlightsPageProps {
  user: AuthUser | null;
  authLoading?: boolean;
  onLogin: (mode?: "login" | "signup", notice?: string | null, onSuccess?: () => void) => void;
  onLogout: () => void;
}

function DemoBadge({ mode, isIgnav }: { mode: "DEMO" | "LIVE"; isIgnav: boolean }) {
  if (mode === "LIVE") {
    return <span className="provider-badge live">{isIgnav ? "LIVE FARE" : "Live inventory"}</span>;
  }
  return <span className="provider-badge">Test / Demo</span>;
}

function ProviderNote({ provider }: { provider?: Provider }) {
  if (!provider) return null;
  return (
    <p className="provider-note">
      <span className={`provider-dot ${provider.mode === "LIVE" ? "live" : ""}`} />
      {provider.mode === "LIVE"
        ? provider.provider.toLowerCase().includes("ignav")
          ? "Ignav connected · LIVE FARE DATA · external booking only"
          : `${provider.provider} connected · Live flight inventory`
        : "DEMO / TEST flight inventory · no supplier reservation or real-world PNR created"}
    </p>
  );
}

export function FlightsPage({ user, authLoading = false, onLogin, onLogout }: FlightsPageProps) {
  const [, setLocation] = useLocation();

  // Parse initial query parameters from URL (defaults to clean/empty form unless intentional URL query params exist)
  const [flightForm, setFlightForm] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return {
      from: params.get("from")?.trim().toUpperCase() || "",
      to: params.get("to")?.trim().toUpperCase() || "",
      departure: params.get("departure")?.trim() || "",
      returnDate: params.get("return")?.trim() || "",
      travellers: params.get("travellers")?.trim() || "1",
      cabin: params.get("cabin")?.trim() || "Economy",
    };
  });

  const [hasReturn, setHasReturn] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return Boolean(params.get("return")?.trim());
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [validationError, setValidationError] = useState("");
  const [provider, setProvider] = useState<Provider>();
  const [flights, setFlights] = useState<FlightOffer[]>([]);
  const [dataFlights, setDataFlights] = useState<FlightDataPoint[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedFlight, setSelectedFlight] = useState<FlightOffer | null>(null);
  const [toast, setToast] = useState("");
  const [bookingLinkLoading, setBookingLinkLoading] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 3500);
  };

  const openExternalBooking = async (flight: FlightOffer) => {
    if (!flight.ignavId) {
      showToast("External booking link is unavailable for this fare.");
      return;
    }

    // Reserve the tab during the user gesture so browser popup blockers do not reject it after fetch resolves.
    const bookingWindow = window.open("about:blank", "_blank");
    if (!bookingWindow) {
      showToast("Your browser blocked the booking tab. Allow popups and try again.");
      return;
    }

    setBookingLinkLoading(flight.id);
    try {
      const response = await fetch("/api/ignav/booking-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ignavId: flight.ignavId }),
      });
      console.info("Ignav booking-link request", { status: response.status, ok: response.ok });
      const payload = await response.json() as { url?: string; message?: string };
      if (!response.ok || !payload.url) throw new Error(payload.message || "External booking link is unavailable.");
      bookingWindow.location.href = payload.url;
    } catch (error) {
      console.warn("Ignav booking-link request failed", { message: error instanceof Error ? error.message : "Unknown error" });
      bookingWindow.close();
      showToast(error instanceof Error ? error.message : "External booking link is unavailable.");
    } finally {
      setBookingLinkLoading(null);
    }
  };

  const runSearch = async (
    event?: FormEvent,
    overrideParams?: {
      from: string;
      to: string;
      departure: string;
      travellers: string;
      cabin: string;
    }
  ) => {
    event?.preventDefault();
    setLoading(true);
    setError("");
    setDataError("");
    setDataFlights([]);
    setValidationError("");

    const currentForm = overrideParams || flightForm;
    const fromCode = currentForm.from.trim().toUpperCase();
    const toCode = currentForm.to.trim().toUpperCase();

    if (!fromCode || !toCode) {
      setValidationError("Please select both an origin and destination airport.");
      setLoading(false);
      return;
    }

    if (fromCode === toCode) {
      setValidationError("Origin and destination cannot be the same airport.");
      setLoading(false);
      return;
    }

    if (!currentForm.departure) {
      setValidationError("Please select a departure date.");
      setLoading(false);
      return;
    }

    try {
      setHasSearched(true);
      const params = new URLSearchParams({
        from: fromCode,
        to: toCode,
        departure: currentForm.departure,
        travellers: currentForm.travellers,
        cabin: currentForm.cabin,
      });

      window.history.replaceState(null, '', `/flights?${params.toString()}`);
      const response = await fetch(`/api/flights/search?${params.toString()}`, {
        credentials: "include",
      });
      const data = (await response.json()) as {
        provider: string;
        mode: "DEMO" | "LIVE";
        results: FlightOffer[];
        message?: string;
      };

      if (!response.ok) {
        throw new Error(data.message || "Flight search could not be completed.");
      }

      setProvider({ provider: data.provider, mode: data.mode, status: "READY" });
      setFlights(data.results || []);

      setDataLoading(true);
      try {
        const dataResponse = await fetch(`/api/flights/data?${new URLSearchParams({
          from: fromCode,
          to: toCode,
          departure: currentForm.departure,
          ...(hasReturn && flightForm.returnDate ? { returnDate: flightForm.returnDate } : {}),
          currency: "INR",
        })}`, { credentials: "include" });
        const dataPayload = await dataResponse.json() as { data?: FlightDataPoint[]; message?: string };
        if (!dataResponse.ok) throw new Error(dataPayload.message || "Historical fare data is unavailable.");
        setDataFlights(dataPayload.data || []);
      } catch (dataSearchError) {
        setDataError(dataSearchError instanceof Error ? dataSearchError.message : "Historical fare data is unavailable.");
      } finally {
        setDataLoading(false);
      }
    } catch (searchError) {
      setError(
        searchError instanceof Error ? searchError.message : "Search could not be completed."
      );
    } finally {
      setLoading(false);
    }
  };

  // Run initial search on mount ONLY if explicit intentional query parameters exist in the URL (e.g. from homepage AI search)
  useEffect(() => {
    document.title = "Zelevos — Flights & Airline Booking";

    const params = new URLSearchParams(window.location.search);
    const fromParam = params.get("from")?.trim().toUpperCase();
    const toParam = params.get("to")?.trim().toUpperCase();
    const departureParam = params.get("departure")?.trim();

    if (fromParam && toParam) {
      const effectiveDeparture =
        departureParam || new Date(Date.now() + 86400000).toISOString().split("T")[0];
      if (!departureParam) {
        setFlightForm((prev) => ({ ...prev, departure: effectiveDeparture }));
      }
      void runSearch(undefined, {
        from: fromParam,
        to: toParam,
        departure: effectiveDeparture,
        travellers: params.get("travellers")?.trim() || "1",
        cabin: params.get("cabin")?.trim() || "Economy",
      });
    }
  }, []);

  useEffect(() => {
    const onPopState = () => {
      const params = new URLSearchParams(window.location.search);
      const fromParam = params.get("from")?.trim().toUpperCase() || "";
      const toParam = params.get("to")?.trim().toUpperCase() || "";
      const departureParam = params.get("departure")?.trim() || "";
      const returnParam = params.get("return")?.trim() || "";

      setFlightForm({
        from: fromParam,
        to: toParam,
        departure: departureParam,
        returnDate: returnParam,
        travellers: params.get("travellers")?.trim() || "1",
        cabin: params.get("cabin")?.trim() || "Economy",
      });
      setHasReturn(Boolean(returnParam));
      setValidationError("");

      if (fromParam && toParam) {
        const effectiveDeparture =
          departureParam || new Date(Date.now() + 86400000).toISOString().split("T")[0];
        void runSearch(undefined, {
          from: fromParam,
          to: toParam,
          departure: effectiveDeparture,
          travellers: params.get("travellers")?.trim() || "1",
          cabin: params.get("cabin")?.trim() || "Economy",
        });
      } else {
        setFlights([]);
        setHasSearched(false);
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  return (
    <main className="page-shell flights-main-content" style={{ paddingTop: "28px", paddingBottom: "80px" }}>
      {/* Navigation Breadcrumb / Back button */}
      <button
        className="back-link"
        type="button"
        onClick={() => setLocation("/")}
        style={{ marginBottom: "20px", cursor: "pointer" }}
      >
        <ArrowRight size={14} className="back-arrow" /> Back to Zelevos
      </button>

        {/* Dedicated Flight Page Header */}
        <div className="section-heading" style={{ marginBottom: "28px" }}>
          <div className="eyebrow">
            <span className="eyebrow-line" />
            FLIGHTS & AIRLINE GDS
          </div>
          <h2>Find your flight.</h2>
          <p>Compare real flight options, lock your fare and book your journey with Zelevos.</p>
        </div>

        {/* Flight Search Form */}
        <form className="travel-search" onSubmit={runSearch} style={{ margin: "0 auto" }}>
          <label>
            <span>From (City / Airport)</span>
            <div>
              <AirportAutocomplete
                id="flight-from-input"
                value={flightForm.from}
                excludeIata={flightForm.to}
                onChange={(iata) => {
                  setFlightForm((prev) => ({ ...prev, from: iata }));
                  setValidationError("");
                }}
                placeholder="Origin city or code..."
              />
            </div>
          </label>

          <label>
            <span>To (City / Airport)</span>
            <div>
              <AirportAutocomplete
                id="flight-to-input"
                value={flightForm.to}
                excludeIata={flightForm.from}
                onChange={(iata) => {
                  setFlightForm((prev) => ({ ...prev, to: iata }));
                  setValidationError("");
                }}
                placeholder="Destination city or code..."
              />
            </div>
          </label>

          <label>
            <span>Departure</span>
            <div>
              <CalendarDays size={15} />
              <input
                id="flight-departure-input"
                type="date"
                min={new Date().toISOString().split("T")[0]}
                value={flightForm.departure}
                onChange={(event) => {
                  setFlightForm((prev) => ({ ...prev, departure: event.target.value }));
                  setValidationError("");
                }}
              />
            </div>
          </label>

          {hasReturn ? (
            <label>
              <span>
                Return{" "}
                <button
                  type="button"
                  onClick={() => {
                    setHasReturn(false);
                    setFlightForm((prev) => ({ ...prev, returnDate: "" }));
                  }}
                  style={{
                    border: "none",
                    background: "none",
                    color: "#b42318",
                    fontSize: "9px",
                    cursor: "pointer",
                    marginLeft: "4px",
                  }}
                >
                  (Remove)
                </button>
              </span>
              <div>
                <CalendarDays size={15} />
                <input
                  id="flight-return-input"
                  type="date"
                  min={flightForm.departure || new Date().toISOString().split("T")[0]}
                  value={flightForm.returnDate}
                  onChange={(event) =>
                    setFlightForm({ ...flightForm, returnDate: event.target.value })
                  }
                />
              </div>
            </label>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-end",
                paddingBottom: "8px",
              }}
            >
              <button
                type="button"
                onClick={() => setHasReturn(true)}
                style={{
                  border: "1px dashed var(--border)",
                  borderRadius: "8px",
                  padding: "9px 12px",
                  background: "transparent",
                  color: "var(--blue)",
                  fontSize: "11px",
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "5px",
                }}
              >
                + Add Return
              </button>
            </div>
          )}

          <label>
            <span>Travellers</span>
            <div>
              <Users size={15} />
              <input
                id="flight-travellers-input"
                type="number"
                min="1"
                max="9"
                value={flightForm.travellers}
                onChange={(event) =>
                  setFlightForm({ ...flightForm, travellers: event.target.value })
                }
              />
            </div>
          </label>

          <label>
            <span>Cabin Class</span>
            <div>
              <select
                id="flight-cabin-input"
                value={flightForm.cabin}
                onChange={(event) =>
                  setFlightForm({ ...flightForm, cabin: event.target.value })
                }
                style={{
                  width: "100%",
                  height: "38px",
                  border: "none",
                  outline: "none",
                  background: "transparent",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "var(--text)",
                  cursor: "pointer",
                }}
              >
                <option value="Economy">Economy</option>
                <option value="Premium Economy">Premium Economy</option>
                <option value="Business">Business</option>
                <option value="First">First</option>
              </select>
            </div>
          </label>

          <button
            id="search-flights-button"
            className="travel-search-button"
            type="submit"
            disabled={loading}
          >
            <Search size={15} />
            {loading ? "Searching flights..." : "Search flights"}
          </button>
        </form>

        {hasSearched && flightForm.from && flightForm.to && (
          <RouteMap origin={flightForm.from} destination={flightForm.to} />
        )}

        {/* Validation Error Message */}
        {validationError && (
          <div
            className="travel-state error"
            style={{ marginTop: "16px", padding: "12px 16px", borderRadius: "10px" }}
          >
            <strong>Route Validation Issue</strong>
            <span>{validationError}</span>
          </div>
        )}

        {/* Provider Note */}
        <ProviderNote provider={provider} />

        <section className="flight-data-panel" aria-live="polite">
          <div className="flight-data-heading">
            <div>
              <span className="mini-label">TRAVELPAYOUTS / AVIASALES DATA</span>
              <h3>Fare inspiration for this route</h3>
            </div>
            <span className="provider-badge">DATA ONLY</span>
          </div>
          <p className="flight-data-note">
            Cached and historical fare data for planning only. These prices are not live inventory and cannot be booked here.
          </p>
          {dataLoading && <div className="flight-data-state">Loading fare trends...</div>}
          {!dataLoading && dataError && (
            <div className="flight-data-state error">
              <span>{dataError}</span>
              <button type="button" onClick={() => void runSearch()}>Retry data</button>
            </div>
          )}
          {!dataLoading && !dataError && hasSearched && dataFlights.length === 0 && (
            <div className="flight-data-state">No cached fare data was found for this route and date.</div>
          )}
          {!dataLoading && dataFlights.length > 0 && (
            <div className="flight-data-grid">
              {dataFlights.slice(0, 6).map((item, index) => (
                <article className="flight-data-card" key={`${item.departure_at || "date"}-${item.airline || "airline"}-${index}`}>
                  <div><strong>{item.airline || "Airline unavailable"}</strong><span>{item.flight_number ? `Flight ${item.flight_number}` : "Route trend"}</span></div>
                  <strong>{typeof item.price === "number" ? `${item.currency || "INR"} ${item.price.toLocaleString("en-IN")}` : "Price unavailable"}</strong>
                  <span>{item.departure_at ? new Date(item.departure_at).toLocaleDateString("en-IN") : flightForm.departure}</span>
                  <small>{typeof item.transfers === "number" ? `${item.transfers} stop${item.transfers === 1 ? "" : "s"}` : "Stops unavailable"}</small>
                </article>
              ))}
            </div>
          )}
        </section>

        {/* General Error State */}
        {error && (
          <div className="travel-state error" style={{ marginTop: "16px" }}>
            <strong>Flight Search Unavailable</strong>
            <span>{error}</span>
            <button type="button" onClick={() => void runSearch()}>
              Try again
            </button>
          </div>
        )}

        {/* Flight Results List */}
        {!error && (
          <div className="travel-results" style={{ marginTop: "24px" }}>
            {hasSearched && flights.length === 0 && !loading && (
              <div className="travel-state">
                <Plane size={24} style={{ color: "var(--muted)", margin: "0 auto 8px" }} />
                <strong>No flights found</strong>
                <span>
                  We couldn't find available flights for {flightForm.from} → {flightForm.to} on{" "}
                  {flightForm.departure}. Try selecting another date or nearby airport.
                </span>
              </div>
            )}

            {flights.map((flight) => {
              const hasConnectingSegments = Boolean(flight.segments && flight.segments.length > 1);
              const layoverCity =
                hasConnectingSegments && flight.segments
                  ? flight.segments[0].destination
                  : undefined;
              const isIgnav = flight.externalBooking === true;
              const showBaggage = flight.baggage && flight.baggage.trim().length > 0;

              return (
                <article className="travel-result-card" key={flight.id}>
                  <div className="travel-result-main">
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                      <DemoBadge mode={flight.mode} isIgnav={isIgnav} />
                      {/* Ignav: LIVE FARE DATA badge — clearly indicates external live data */}
                      {isIgnav && (
                        <span
                          style={{
                            fontSize: "8px",
                            fontWeight: 700,
                            padding: "2px 6px",
                            borderRadius: "4px",
                            background: "#dbeafe",
                            color: "#1d4ed8",
                            letterSpacing: "0.04em",
                          }}
                        >
                          LIVE FARE DATA
                        </span>
                      )}
                      {/* Ignav: EXTERNAL BOOKING badge */}
                      {isIgnav && (
                        <span
                          style={{
                            fontSize: "8px",
                            fontWeight: 700,
                            padding: "2px 6px",
                            borderRadius: "4px",
                            background: "#fef9c3",
                            color: "#854d0e",
                          }}
                        >
                          EXTERNAL BOOKING
                        </span>
                      )}
                      {flight.refundable !== undefined && (flight.refundable ? (
                        <span
                          style={{
                            fontSize: "8px",
                            fontWeight: 700,
                            padding: "2px 6px",
                            borderRadius: "4px",
                            background: "#ecfdf5",
                            color: "var(--success)",
                          }}
                        >
                          Refundable
                        </span>
                      ) : (
                        <span
                          style={{
                            fontSize: "8px",
                            fontWeight: 700,
                            padding: "2px 6px",
                            borderRadius: "4px",
                            background: "#fff1f2",
                            color: "#e11d48",
                          }}
                        >
                          Non-refundable
                        </span>
                      ))}
                      <span
                        style={{
                          fontSize: "8px",
                          fontWeight: 700,
                          padding: "2px 6px",
                          borderRadius: "4px",
                          background: "var(--soft)",
                          color: "var(--muted)",
                        }}
                      >
                        {flight.cabinClass || "Economy"}
                      </span>
                      {typeof flight.seatsAvailable === "number" && (
                        <span
                          style={{
                            fontSize: "8px",
                            fontWeight: 700,
                            padding: "2px 6px",
                            borderRadius: "4px",
                            background: "#fef3c7",
                            color: "#92400e",
                          }}
                        >
                          {flight.seatsAvailable} seats left
                        </span>
                      )}
                    </div>

                    <div className="result-title">
                      <strong>{flight.airline}</strong>
                      <span>
                        {flight.flightNumber}{showBaggage ? ` · ${flight.baggage}` : ""}
                      </span>
                    </div>

                    <div className="result-route">
                      <strong>{flight.departure}</strong>
                      <span>
                        {hasConnectingSegments
                          ? `${flight.from} → ${layoverCity} → ${flight.to} · ${flight.duration} · 1 stop (via ${layoverCity})`
                          : `${flight.from} · ${flight.duration} · non-stop`}
                      </span>
                      <strong>{flight.arrival}</strong>
                      <span>{flight.to}</span>
                    </div>

                    {hasConnectingSegments && flight.segments && (
                      <div
                        style={{
                          marginTop: "10px",
                          padding: "8px 12px",
                          background: "var(--soft)",
                          borderRadius: "6px",
                          fontSize: "10px",
                          color: "var(--muted)",
                          display: "flex",
                          flexWrap: "wrap",
                          gap: "14px",
                          border: "1px solid var(--border)",
                        }}
                      >
                        {flight.segments.map((seg, idx) => (
                          <div key={idx} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <Plane size={11} style={{ color: "var(--blue)" }} />
                            <span>
                              <strong>Leg {idx + 1}:</strong> {seg.carrier} {seg.flightNumber} (
                              {seg.origin}{" "}
                              {seg.departureTime.includes("T")
                                ? seg.departureTime.split("T")[1].slice(0, 5)
                                : seg.departureTime}{" "}
                              → {seg.destination}{" "}
                              {seg.arrivalTime.includes("T")
                                ? seg.arrivalTime.split("T")[1].slice(0, 5)
                                : seg.arrivalTime}
                              )
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Ignav: external booking disclaimer — Zelevos does not issue PNR/tickets */}
                    {isIgnav && (
                      <div
                        style={{
                          marginTop: "10px",
                          padding: "8px 12px",
                          background: "#fffbeb",
                          borderRadius: "6px",
                          fontSize: "10px",
                          color: "#78350f",
                          border: "1px solid #fde68a",
                        }}
                      >
                        <AlertCircle size={11} style={{ display: "inline", marginRight: "5px", verticalAlign: "middle" }} />
                        <strong>External booking only.</strong> "Book Now" opens the airline or OTA website. Zelevos does not process this booking and does not issue PNRs or tickets through this provider.
                      </div>
                    )}
                  </div>

                  <div className="result-price">
                    <span>from</span>
                    <strong>₹{flight.price.toLocaleString("en-IN")}</strong>
                    {flight.externalBooking ? (
                      <button type="button" onClick={() => void openExternalBooking(flight)} disabled={bookingLinkLoading === flight.id} style={{ cursor: "pointer" }}>
                        {bookingLinkLoading === flight.id ? "Opening..." : "Book Now"} <ArrowRight size={14} />
                      </button>
                    ) : (
                      <button type="button" onClick={() => setSelectedFlight(flight)} style={{ cursor: "pointer" }}>
                        Select flight <ArrowRight size={14} />
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* Flight Booking Modal */}
        {selectedFlight && (
          <FlightBookingModal
            flight={selectedFlight}
            travellerCount={Number(flightForm.travellers) || 1}
            user={user}
            onRequireAuth={(onSuccess, notice) => {
              onLogin("login", notice, onSuccess);
            }}
            onClose={() => setSelectedFlight(null)}
            onBookingSuccess={(booking) => {
              setSelectedFlight(null);
              showToast(`Flight booked! PNR: ${booking.pnr}`);
            }}
            onToast={showToast}
          />
        )}

        {/* Toast Notification */}
        {toast && (
          <div className="toast">
            <Check size={16} />
            {toast}
            <button type="button" onClick={() => setToast("")}>
              <X size={14} />
            </button>
          </div>
        )}
      </main>
  );
}
