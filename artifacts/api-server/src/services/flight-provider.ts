import crypto from "node:crypto";
import { IgnavFlightProvider, getIgnavConfig } from "./ignav";

export type FlightPassengerType = "ADULT" | "CHILD" | "INFANT";
export type CabinClass = "Economy" | "Premium Economy" | "Business" | "First";

export type FlightSearchParams = {
  from: string;
  to: string;
  departure: string;
  returnDate?: string;
  travellers?: number;
  adults?: number;
  children?: number;
  infants?: number;
  cabin?: string;
};

export type FlightSegment = {
  carrier: string;
  flightNumber: string;
  origin: string;
  destination: string;
  departureTime: string;
  arrivalTime: string;
  duration: string;
  cabin: string;
  aircraft?: string;
};

export type FlightOffer = {
  id: string;
  airline: string;
  flightNumber: string;
  from: string;
  to: string;
  departure: string;
  arrival: string;
  duration: string;
  stops: number;
  baggage: string;
  price: number;
  baseFare: number;
  taxes: number;
  currency: "INR";
  provider: string;
  mode: "DEMO" | "LIVE";
  refundable?: boolean;
  cabin?: string;
  cabinClass: string;
  seatsAvailable?: number;
  segments: FlightSegment[];
  fareRules?: {
    cancellationFee: number;
    changeFee: number;
  };
  externalBookingUrl?: string;
  externalBooking?: boolean;
  ignavId?: string;
};

export type FlightRevalidationResult = {
  valid: boolean;
  priceChanged: boolean;
  oldPrice: number;
  newPrice: number;
  soldOut: boolean;
  currency: "INR";
  offerId: string;
  flight?: FlightOffer;
  message?: string;
};

export type PassengerDetails = {
  type: FlightPassengerType;
  title: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: "MALE" | "FEMALE" | "OTHER";
  nationality: string;
  passportNumber?: string;
  passportExpiry?: string;
  passportCountry?: string;
};

export type ContactDetails = {
  email: string;
  phone: string;
  countryCode?: string;
};

export type FlightBookingParams = {
  offerId: string;
  passengers: PassengerDetails[];
  contact: ContactDetails;
  addons?: {
    extraBaggageKg?: number;
    extraBaggagePrice?: number;
    mealPreference?: string;
    seatPreference?: string;
  };
  idempotencyKey: string;
};

export type FlightBookingConfirmation = {
  success: boolean;
  bookingId?: string;
  pnr: string;
  bookingReference: string;
  ticketNumber: string;
  status: "CONFIRMED" | "TICKETED" | "FAILED";
  amount: number;
  currency: "INR";
  airline: string;
  segments: FlightSegment[];
  passengers: PassengerDetails[];
  message?: string;
};

export type FlightCancellationResult = {
  success: boolean;
  cancellationReference: string;
  refundAmount: number;
  cancellationFee: number;
  status: "CANCELLED" | "REFUND_PENDING";
  message: string;
};

export interface FlightProvider {
  readonly name: string;
  readonly mode: "DEMO" | "LIVE";
  search(params: FlightSearchParams): Promise<FlightOffer[]>;
  revalidate(offerId: string, expectedPrice?: number): Promise<FlightRevalidationResult>;
  createBooking(params: FlightBookingParams): Promise<FlightBookingConfirmation>;
  cancelBooking(pnr: string, reason?: string): Promise<FlightCancellationResult>;
  getBooking(pnr: string): Promise<FlightBookingConfirmation | null>;
}

// --------------------------------------------------------------------------
// 1. Duffel API Provider Implementation (Real Live Flight Supplier API)
// --------------------------------------------------------------------------
export class DuffelFlightProvider implements FlightProvider {
  readonly name = "Duffel Flights API";
  readonly mode = "LIVE" as const;
  private readonly baseUrl = "https://api.duffel.com/air";
  private readonly token: string;

  constructor(token?: string) {
    this.token = (token || process.env.FLIGHT_PROVIDER_API_KEY || process.env.DUFFEL_ACCESS_TOKEN || "").trim();
    if (!this.token) {
      throw new Error("Duffel API key is required but missing (set FLIGHT_PROVIDER_API_KEY or DUFFEL_ACCESS_TOKEN).");
    }
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers = {
      "Authorization": `Bearer ${this.token}`,
      "Duffel-Version": "v2",
      "Content-Type": "application/json",
      "Accept": "application/json",
      ...options.headers,
    };

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers,
    });

    const body = (await response.json()) as { data?: T; errors?: Array<{ message: string; code: string }> };
    if (!response.ok || !body.data) {
      const errorMsg = body.errors?.[0]?.message || `Duffel API returned HTTP ${response.status}`;
      throw new Error(errorMsg);
    }
    return body.data;
  }

  async search(params: FlightSearchParams): Promise<FlightOffer[]> {
    const totalTravellers = params.travellers || (params.adults || 1) + (params.children || 0) + (params.infants || 0);
    const adults = params.adults || Math.max(1, totalTravellers - (params.children || 0) - (params.infants || 0));
    const children = params.children || 0;
    const infants = params.infants || 0;

    const passengers: Array<{ type: string }> = [];
    for (let i = 0; i < adults; i++) passengers.push({ type: "adult" });
    for (let i = 0; i < children; i++) passengers.push({ type: "child" });
    for (let i = 0; i < infants; i++) passengers.push({ type: "infant_without_seat" });

    const slices: Array<{ origin: string; destination: string; departure_date: string }> = [
      {
        origin: params.from.toUpperCase(),
        destination: params.to.toUpperCase(),
        departure_date: params.departure,
      },
    ];

    if (params.returnDate) {
      slices.push({
        origin: params.to.toUpperCase(),
        destination: params.from.toUpperCase(),
        departure_date: params.returnDate,
      });
    }

    const cabinMap: Record<string, string> = {
      "Economy": "economy",
      "Premium Economy": "premium_economy",
      "Business": "business",
      "First": "first",
    };

    const payload = {
      slices,
      passengers,
      cabin_class: cabinMap[params.cabin || "Economy"] || "economy",
    };

    type DuffelOfferResponse = {
      id: string;
      offers: Array<{
        id: string;
        total_amount: string;
        total_currency: string;
        base_amount: string;
        tax_amount: string;
        owner: { name: string; iata_code: string };
        slices: Array<{
          duration: string;
          segments: Array<{
            operating_carrier: { name: string; iata_code: string };
            operating_carrier_flight_number: string;
            origin: { iata_code: string; name: string };
            destination: { iata_code: string; name: string };
            departing_at: string;
            arriving_at: string;
            duration: string;
            aircraft?: { name: string };
            passengers?: Array<{
              baggages?: Array<{ type: string; quantity: number; weight?: string }>;
            }>;
          }>;
        }>;
      }>;
    };

    const offerRequest = await this.request<DuffelOfferResponse>("/offer_requests", {
      method: "POST",
      body: JSON.stringify({ data: payload }),
    });

    return (offerRequest.offers || []).slice(0, 15).map((offer) => {
      const firstSlice = offer.slices[0];
      const segments = (firstSlice?.segments || []).map((seg) => ({
        carrier: seg.operating_carrier?.name || offer.owner?.name || "Airline",
        flightNumber: `${seg.operating_carrier?.iata_code || ""}${seg.operating_carrier_flight_number}`,
        origin: seg.origin.iata_code,
        destination: seg.destination.iata_code,
        departureTime: seg.departing_at,
        arrivalTime: seg.arriving_at,
        duration: seg.duration?.replace("PT", "").toLowerCase() || "2h 30m",
        cabin: params.cabin || "Economy",
        aircraft: seg.aircraft?.name,
      }));

      const firstSeg = segments[0];
      const lastSeg = segments[segments.length - 1];
      if (offer.total_currency !== "INR") {
        throw new Error(`Duffel returned unsupported currency ${offer.total_currency}.`);
      }
      const price = Math.round(Number(offer.total_amount));
      const baseFare = Math.round(Number(offer.base_amount || 0));
      const taxes = Math.round(Number(offer.tax_amount || 0));

      return {
        id: offer.id,
        airline: offer.owner?.name || firstSeg?.carrier || "",
        flightNumber: firstSeg?.flightNumber || "",
        from: params.from,
        to: params.to,
        departure: firstSeg?.departureTime ? new Date(firstSeg.departureTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "",
        arrival: lastSeg?.arrivalTime ? new Date(lastSeg.arrivalTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "",
        duration: firstSlice?.duration?.replace("PT", "").toLowerCase() || "",
        stops: Math.max(0, segments.length - 1),
        baggage: "Baggage details unavailable",
        price,
        baseFare,
        taxes,
        currency: "INR" as const,
        provider: "Duffel Live Inventory",
        mode: "LIVE" as const,
        refundable: undefined,
        cabin: params.cabin || "Economy",
        cabinClass: params.cabin || "Economy",
        seatsAvailable: undefined,
        segments,
      };
    });
  }

  async revalidate(offerId: string, expectedPrice?: number): Promise<FlightRevalidationResult> {
    type DuffelOffer = {
      id: string;
      total_amount: string;
      total_currency: string;
      base_amount: string;
      tax_amount: string;
      expires_at: string;
      owner: { name: string };
      slices: Array<any>;
    };

    try {
      const offer = await this.request<DuffelOffer>(`/offers/${offerId}`);
      const newPrice = Math.round(Number(offer.total_amount));
      const oldPrice = expectedPrice || newPrice;
      const isExpired = offer.expires_at ? new Date(offer.expires_at).getTime() < Date.now() : false;

      if (isExpired) {
        return {
          valid: false,
          priceChanged: false,
          oldPrice,
          newPrice,
          soldOut: true,
          currency: "INR",
          offerId,
          message: "The flight fare has expired. Please select a fresh flight.",
        };
      }

      return {
        valid: true,
        priceChanged: newPrice !== oldPrice,
        oldPrice,
        newPrice,
        soldOut: false,
        currency: "INR",
        offerId,
        message: newPrice !== oldPrice ? `Fare updated from ₹${oldPrice} to ₹${newPrice}` : "Fare verified with airline",
      };
    } catch (err) {
      return {
        valid: false,
        priceChanged: false,
        oldPrice: expectedPrice || 0,
        newPrice: expectedPrice || 0,
        soldOut: true,
        currency: "INR",
        offerId,
        message: err instanceof Error ? err.message : "Selected flight is no longer available.",
      };
    }
  }

  async createBooking(params: FlightBookingParams): Promise<FlightBookingConfirmation> {
    type DuffelOrderResponse = {
      id: string;
      booking_reference: string;
      documents: Array<{ type: string; unique_identifier: string }>;
      slices: Array<any>;
      total_amount: string;
    };

    const duffelPassengers = params.passengers.map((p, idx) => ({
      id: `pas_${idx + 1}`,
      title: p.title.toLowerCase(),
      family_name: p.lastName,
      given_name: p.firstName,
      born_on: p.dateOfBirth,
      gender: p.gender === "MALE" ? "m" : p.gender === "FEMALE" ? "f" : "m",
      email: params.contact.email,
      phone_number: `${params.contact.countryCode || "+91"}${params.contact.phone.replace(/^0+/, "")}`,
    }));

    const orderData = {
      selected_offers: [params.offerId],
      passengers: duffelPassengers,
      type: "instant",
      payments: [
        {
          type: "balance",
          currency: "INR",
          amount: String(params.passengers.length * 5000),
        },
      ],
    };

    const order = await this.request<DuffelOrderResponse>("/orders", {
      method: "POST",
      body: JSON.stringify({ data: orderData }),
    });

    const pnr = order.booking_reference || "";
    const ticketNumber = order.documents?.[0]?.unique_identifier || "";

    return {
      success: true,
      bookingId: order.id,
      pnr,
      bookingReference: pnr ? `WY-${pnr}` : order.id,
      ticketNumber,
      status: "CONFIRMED",
      amount: Math.round(Number(order.total_amount)),
      currency: "INR",
      airline: "",
      segments: [],
      passengers: params.passengers,
      message: pnr || ticketNumber
        ? "Flight booking confirmed by the live supplier."
        : "Supplier order created, but no PNR or ticket document was returned.",
    };
  }

  async cancelBooking(pnr: string, reason?: string): Promise<FlightCancellationResult> {
    return {
      success: false,
      cancellationReference: "",
      refundAmount: 0,
      cancellationFee: 0,
      status: "REFUND_PENDING",
      message: "Live supplier cancellation is not implemented for this provider.",
    };
  }

  async getBooking(pnr: string): Promise<FlightBookingConfirmation | null> {
    return null;
  }
}

// --------------------------------------------------------------------------
// 2. High-Fidelity Compliant Test Flight Provider
// --------------------------------------------------------------------------
export class CompliantTestFlightProvider implements FlightProvider {
  readonly name = "Zelevos Flight Test Engine";
  readonly mode: "DEMO" | "LIVE" = "DEMO";

  private readonly testBookings = new Map<string, FlightBookingConfirmation>();

  private readonly routeInventory: Record<string, Array<{ airline: string; flightNumber: string; depTime: string; arrTime: string; duration: string; stops: number; basePrice: number }>> = {
    "DEFAULT": [
      { airline: "IndiGo", flightNumber: "6E 2187", depTime: "06:10", arrTime: "08:35", duration: "2h 25m", stops: 0, basePrice: 5850 },
      { airline: "Air India", flightNumber: "AI 825", depTime: "09:45", arrTime: "12:25", duration: "2h 40m", stops: 0, basePrice: 6200 },
      { airline: "Vistara", flightNumber: "UK 945", depTime: "14:15", arrTime: "17:10", duration: "2h 55m", stops: 0, basePrice: 7100 },
      { airline: "Akasa Air", flightNumber: "QP 1342", depTime: "18:30", arrTime: "21:10", duration: "2h 40m", stops: 0, basePrice: 5400 },
      { airline: "SpiceJet", flightNumber: "SG 8169", depTime: "21:40", arrTime: "00:20", duration: "2h 40m", stops: 0, basePrice: 5100 },
    ],
  };

  async search(params: FlightSearchParams): Promise<FlightOffer[]> {
    const from = (params.from || "DEL").trim().toUpperCase();
    const to = (params.to || "BOM").trim().toUpperCase();
    const travellers = Math.max(1, params.travellers || (params.adults || 1) + (params.children || 0));
    const cabin = params.cabin || "Economy";
    const departureDate = params.departure || new Date().toISOString().split("T")[0];

    const cabinMultiplier = cabin === "Business" ? 2.8 : cabin === "Premium Economy" ? 1.6 : cabin === "First" ? 4.5 : 1.0;

    // Layover hub for connecting flights (neither origin nor destination)
    const layoverHub = from !== "BOM" && to !== "BOM" ? "BOM" : from !== "DEL" && to !== "DEL" ? "DEL" : "BLR";

    const flightTemplates = [
      {
        airline: "IndiGo",
        flightNumber: "6E 2187",
        depTime: "06:15",
        arrTime: "08:35",
        duration: "2h 20m",
        stops: 0,
        basePrice: 5850,
        aircraft: "Airbus A321neo",
        refundable: true,
        seatsAvailable: 9,
      },
      {
        airline: "Air India",
        flightNumber: "AI 825",
        depTime: "09:40",
        arrTime: "12:15",
        duration: "2h 35m",
        stops: 0,
        basePrice: 6200,
        aircraft: "Airbus A320neo",
        refundable: true,
        seatsAvailable: 7,
      },
      {
        airline: "Air India Express",
        flightNumber: "IX 742",
        depTime: "13:10",
        arrTime: "15:35",
        duration: "2h 25m",
        stops: 0,
        basePrice: 5150,
        aircraft: "Boeing 737 MAX 8",
        refundable: true,
        seatsAvailable: 8,
      },
      {
        airline: "Akasa Air",
        flightNumber: "QP 1342",
        depTime: "16:45",
        arrTime: "19:15",
        duration: "2h 30m",
        stops: 0,
        basePrice: 5400,
        aircraft: "Boeing 737 MAX 8",
        refundable: true,
        seatsAvailable: 6,
      },
      {
        airline: "SpiceJet",
        flightNumber: "SG 8169",
        depTime: "20:30",
        arrTime: "22:55",
        duration: "2h 25m",
        stops: 0,
        basePrice: 4950,
        aircraft: "Boeing 737-800",
        refundable: false,
        seatsAvailable: 4,
      },
      {
        airline: "IndiGo",
        flightNumber: "6E 5021",
        depTime: "07:20",
        arrTime: "12:10",
        duration: "4h 50m",
        stops: 1,
        basePrice: 6450,
        aircraft: "Airbus A320neo",
        refundable: true,
        seatsAvailable: 5,
        isConnecting: true,
        layoverHub,
        firstLeg: { flightNumber: "6E 5021", depTime: "07:20", arrTime: "09:25", duration: "2h 05m" },
        secondLeg: { flightNumber: "6E 5022", depTime: "10:35", arrTime: "12:10", duration: "1h 35m" },
      },
    ];

    return flightTemplates.map((item, index) => {
      const offerId = `offer_test_${from.toLowerCase().slice(0, 3)}_${to.toLowerCase().slice(0, 3)}_${index + 1}_${Date.now()}`;
      const baseFarePerPax = Math.round(item.basePrice * cabinMultiplier);
      const taxesPerPax = Math.round(baseFarePerPax * 0.18);
      const totalPerPax = baseFarePerPax + taxesPerPax;
      const totalPrice = totalPerPax * travellers;

      let segments: FlightSegment[];

      if (item.isConnecting && item.firstLeg && item.secondLeg) {
        segments = [
          {
            carrier: item.airline,
            flightNumber: item.firstLeg.flightNumber,
            origin: from,
            destination: item.layoverHub,
            departureTime: `${departureDate}T${item.firstLeg.depTime}:00`,
            arrivalTime: `${departureDate}T${item.firstLeg.arrTime}:00`,
            duration: item.firstLeg.duration,
            cabin,
            aircraft: item.aircraft,
          },
          {
            carrier: item.airline,
            flightNumber: item.secondLeg.flightNumber,
            origin: item.layoverHub,
            destination: to,
            departureTime: `${departureDate}T${item.secondLeg.depTime}:00`,
            arrivalTime: `${departureDate}T${item.secondLeg.arrTime}:00`,
            duration: item.secondLeg.duration,
            cabin,
            aircraft: item.aircraft,
          },
        ];
      } else {
        segments = [
          {
            carrier: item.airline,
            flightNumber: item.flightNumber,
            origin: from,
            destination: to,
            departureTime: `${departureDate}T${item.depTime}:00`,
            arrivalTime: `${departureDate}T${item.arrTime}:00`,
            duration: item.duration,
            cabin,
            aircraft: item.aircraft,
          },
        ];
      }

      return {
        id: offerId,
        airline: item.airline,
        flightNumber: item.flightNumber,
        from,
        to,
        departure: item.depTime,
        arrival: item.arrTime,
        duration: item.duration,
        stops: item.stops,
        baggage: cabin === "Business" ? "30 kg check-in · 10 kg cabin" : "15 kg check-in · 7 kg cabin",
        price: totalPrice,
        baseFare: baseFarePerPax * travellers,
        taxes: taxesPerPax * travellers,
        currency: "INR" as const,
        provider: this.name,
        mode: "DEMO" as const,
        refundable: item.refundable,
        cabin,
        cabinClass: cabin,
        seatsAvailable: item.seatsAvailable,
        segments,
        fareRules: {
          cancellationFee: 2500,
          changeFee: 1500,
        },
      };
    });
  }

  async revalidate(offerId: string, expectedPrice?: number): Promise<FlightRevalidationResult> {
    // Testing edge case: if offerId contains "soldout", simulate sold out
    if (offerId.includes("soldout")) {
      return {
        valid: false,
        priceChanged: false,
        oldPrice: expectedPrice || 0,
        newPrice: expectedPrice || 0,
        soldOut: true,
        currency: "INR",
        offerId,
        message: "This flight is sold out. Please choose an alternate flight.",
      };
    }

    // Testing edge case: if offerId contains "reprice", simulate a fare change
    if (offerId.includes("reprice") && expectedPrice) {
      const newPrice = expectedPrice + 450;
      return {
        valid: true,
        priceChanged: true,
        oldPrice: expectedPrice,
        newPrice,
        soldOut: false,
        currency: "INR",
        offerId,
        message: `Airline fare updated by ₹450 (fuel surcharge). New fare: ₹${newPrice.toLocaleString("en-IN")}.`,
      };
    }

    const currentPrice = expectedPrice || 7000;
    const taxes = Math.round(currentPrice * 0.18);
    const baseFare = currentPrice - taxes;
    const flight: FlightOffer = {
      id: offerId,
      airline: "IndiGo",
      flightNumber: "6E-5021",
      from: "DEL",
      to: "BOM",
      departure: "06:15",
      arrival: "08:30",
      duration: "2h 15m",
      stops: 0,
      baggage: "15 kg Check-in, 7 kg Cabin",
      price: currentPrice,
      baseFare,
      taxes,
      currency: "INR",
      provider: this.name,
      mode: this.mode,
      refundable: true,
      cabinClass: "Economy",
      seatsAvailable: 7,
      segments: [
        {
          carrier: "IndiGo",
          flightNumber: "6E-5021",
          origin: "DEL",
          destination: "BOM",
          departureTime: "06:15",
          arrivalTime: "08:30",
          duration: "2h 15m",
          cabin: "Economy",
          aircraft: "Airbus A321neo",
        },
      ],
      fareRules: {
        cancellationFee: 2500,
        changeFee: 2000,
      },
    };

    return {
      valid: true,
      priceChanged: false,
      oldPrice: currentPrice,
      newPrice: currentPrice,
      soldOut: false,
      currency: "INR",
      offerId,
      flight,
      message: "Flight fare confirmed with airline inventory.",
    };
  }

  async createBooking(params: FlightBookingParams): Promise<FlightBookingConfirmation> {
    // Generate realistic 6-character PNR (IATA standard format: e.g. "WY4M8K")
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let pnrCode = "";
    for (let i = 0; i < 6; i++) {
      pnrCode += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const pnr = pnrCode;
    const ticketNumber = `098-${Math.floor(1000000000 + Math.random() * 9000000000)}`;

    const carrier = params.offerId.includes("indigo") ? "IndiGo" : params.offerId.includes("airindia") ? "Air India" : "IndiGo";
    const flightNumber = carrier === "IndiGo" ? "6E 2187" : "AI 825";

    const segments: FlightSegment[] = [
      {
        carrier,
        flightNumber,
        origin: "DEL",
        destination: "BOM",
        departureTime: "06:10",
        arrivalTime: "08:35",
        duration: "2h 25m",
        cabin: "Economy",
        aircraft: "Airbus A321neo",
      },
    ];

    const confirmation: FlightBookingConfirmation = {
      success: true,
      bookingId: `bk_${crypto.randomUUID().slice(0, 12)}`,
      pnr,
      bookingReference: `WAY-${pnr}`,
      ticketNumber,
      status: "CONFIRMED",
      amount: params.passengers.length * 6903 + (params.addons?.extraBaggagePrice || 0),
      currency: "INR",
      airline: carrier,
      segments,
      passengers: params.passengers,
      message: "Booking confirmed with airline. E-Ticket issued.",
    };

    this.testBookings.set(pnr, confirmation);
    return confirmation;
  }

  async cancelBooking(pnr: string, _reason?: string): Promise<FlightCancellationResult> {
    const existing = this.testBookings.get(pnr);
    const originalAmount = existing?.amount || 7000;
    const cancellationFee = 2500;
    const refundAmount = Math.max(0, originalAmount - cancellationFee);

    if (existing) {
      existing.status = "FAILED"; // cancelled
    }

    return {
      success: true,
      cancellationReference: `CNX-${pnr}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`,
      refundAmount,
      cancellationFee,
      status: "CANCELLED",
      message: `Booking ${pnr} cancelled successfully. Eligible refund of ₹${refundAmount.toLocaleString("en-IN")} will be processed to original payment method.`,
    };
  }

  async getBooking(pnr: string): Promise<FlightBookingConfirmation | null> {
    return this.testBookings.get(pnr) || null;
  }
}

// --------------------------------------------------------------------------
// 3. Provider Factory
// --------------------------------------------------------------------------
export function getFlightProvider(): FlightProvider {
  const providerType = (process.env.FLIGHT_PROVIDER || "").toLowerCase().trim();
  const apiKey = (process.env.FLIGHT_PROVIDER_API_KEY || process.env.DUFFEL_ACCESS_TOKEN || "").trim();

  if (process.env.NODE_ENV !== "test" && (providerType === "ignav" || (!providerType && getIgnavConfig().apiKey))) {
    return new IgnavFlightProvider();
  }

  if (providerType === "tbo") {
    throw new Error("TBO flight supplier is not configured. Add approved TBO API access and credentials before enabling production flights.");
  }

  if (process.env.NODE_ENV === "production" && !apiKey) {
    throw new Error("Flight provider not configured. Set FLIGHT_PROVIDER_API_KEY or DUFFEL_ACCESS_TOKEN before enabling production mode.");
  }

  if (providerType === "duffel" || apiKey.startsWith("duffel_")) {
    if (!apiKey && providerType === "duffel") {
      throw new Error("FLIGHT_PROVIDER is set to 'duffel', but FLIGHT_PROVIDER_API_KEY is not configured.");
    }
    return new DuffelFlightProvider(apiKey);
  }

  // Demo mode is explicit in production and local development.
  return new CompliantTestFlightProvider();
}
