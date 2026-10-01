/**
 * CLASSIFICATION: KEEP / REFACTOR (Internal Offline Flight Engine)
 * 
 * Status: ACTIVE. Fully internal and offline with ZERO external travel supplier API dependencies.
 * PRD Reference: Wayora_PRD_Without_APIs Section 7 & Section 13 (Flight Handling Without API).
 * Generates deterministic offline schedules for demo search and manual flight fulfillment desk.
 */

import crypto from "node:crypto";

export type FlightSegment = {
  origin: string;
  destination: string;
  departureTime: string;
  arrivalTime: string;
  airline: string;
  flightNumber: string;
  duration: string;
};

export type FlightOffer = {
  id: string;
  from: string;
  to: string;
  airline: string;
  flightNumber: string;
  departureTime: string;
  arrivalTime: string;
  duration: string;
  stops: number;
  price: number;
  currency: "INR";
  baggage: string;
  cabin: string;
  refundable: boolean;
  segments: FlightSegment[];
};

export type PassengerDetails = {
  title?: string;
  firstName: string;
  lastName: string;
  type?: "ADULT" | "CHILD" | "INFANT";
  dateOfBirth?: string;
  gender?: string;
  passportNumber?: string;
  passportExpiry?: string;
};

export type ContactDetails = {
  email: string;
  phone: string;
  countryCode?: string;
};

export interface FlightSearchQuery {
  from: string;
  to: string;
  departure?: string;
  returnDate?: string;
  travellers?: number;
  adults?: number;
  children?: number;
  infants?: number;
  cabin?: string;
}

export class FlightProvider {
  public readonly name = "Zelevos Internal Demo Flight Engine";
  public readonly mode = "DEMO" as const;

  async search(query: FlightSearchQuery): Promise<FlightOffer[]> {
    const from = query.from.toUpperCase();
    const to = query.to.toUpperCase();
    const departure = query.departure || new Date(Date.now() + 86400000 * 7).toISOString().split("T")[0];
    const cabin = query.cabin || "Economy";

    const airlines = [
      { name: "IndiGo", code: "6E" },
      { name: "Air India", code: "AI" },
      { name: "Vistara", code: "UK" },
      { name: "Akasa Air", code: "QP" },
    ];

    const results: FlightOffer[] = [];

    // Direct flights
    for (let i = 0; i < 3; i++) {
      const airline = airlines[i % airlines.length];
      const fn = `${airline.code}-${100 + ((from.charCodeAt(0) * 7 + to.charCodeAt(0) * 11 + i * 37) % 899)}`;
      const basePrice = 3800 + ((from.charCodeAt(0) * 13 + to.charCodeAt(0) * 17 + i * 450) % 5000);
      const depHour = 6 + i * 4;
      const arrHour = depHour + 2;

      results.push({
        id: `fl_demo_${from}_${to}_${i}_${crypto.randomUUID().slice(0, 6)}`,
        from,
        to,
        airline: airline.name,
        flightNumber: fn,
        departureTime: `${departure}T${String(depHour).padStart(2, "0")}:30:00Z`,
        arrivalTime: `${departure}T${String(arrHour).padStart(2, "0")}:45:00Z`,
        duration: "2h 15m",
        stops: 0,
        price: basePrice,
        currency: "INR",
        baggage: "15 kg check-in, 7 kg cabin",
        cabin,
        refundable: true,
        segments: [
          {
            origin: from,
            destination: to,
            departureTime: `${departure}T${String(depHour).padStart(2, "0")}:30:00Z`,
            arrivalTime: `${departure}T${String(arrHour).padStart(2, "0")}:45:00Z`,
            airline: airline.name,
            flightNumber: fn,
            duration: "2h 15m",
          },
        ],
      });
    }

    // Add a 1-stop connecting flight option
    const layover = (from !== "BOM" && to !== "BOM") ? "BOM" : "DEL";
    const airline1 = airlines[0];
    const airline2 = airlines[1];
    const fn1 = `${airline1.code}-${200 + ((from.charCodeAt(0) * 5 + 19) % 700)}`;
    const fn2 = `${airline2.code}-${300 + ((to.charCodeAt(0) * 7 + 23) % 600)}`;

    results.push({
      id: `fl_demo_${from}_${to}_conn_${crypto.randomUUID().slice(0, 6)}`,
      from,
      to,
      airline: `${airline1.name} / ${airline2.name}`,
      flightNumber: `${fn1} / ${fn2}`,
      departureTime: `${departure}T07:15:00Z`,
      arrivalTime: `${departure}T13:45:00Z`,
      duration: "6h 30m",
      stops: 1,
      price: 5200 + ((from.charCodeAt(0) * 11 + to.charCodeAt(0) * 13) % 3000),
      currency: "INR",
      baggage: "15 kg check-in, 7 kg cabin",
      cabin,
      refundable: true,
      segments: [
        {
          origin: from,
          destination: layover,
          departureTime: `${departure}T07:15:00Z`,
          arrivalTime: `${departure}T09:30:00Z`,
          airline: airline1.name,
          flightNumber: fn1,
          duration: "2h 15m",
        },
        {
          origin: layover,
          destination: to,
          departureTime: `${departure}T11:30:00Z`,
          arrivalTime: `${departure}T13:45:00Z`,
          airline: airline2.name,
          flightNumber: fn2,
          duration: "2h 15m",
        },
      ],
    });

    return results;
  }

  async revalidate(offerId: string, expectedPrice?: number) {
    const originalPrice = expectedPrice || 4800;
    return {
      valid: true,
      offerId,
      originalPrice,
      newPrice: originalPrice,
      priceChanged: false,
      soldOut: false,
      oldPrice: originalPrice,
      flight: {
        id: offerId,
        airline: "IndiGo",
        cabinClass: "Economy",
        price: originalPrice,
      } as any,
    };
  }

  async createBooking(params: {
    offerId: string;
    passengers: PassengerDetails[];
    contact: ContactDetails;
    paymentReference?: string;
    addons?: any;
    idempotencyKey?: string;
  }) {
    const pnr = `ZL${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
    return {
      success: true,
      pnr,
      ticketNumber: `TK-${pnr}`,
      bookingReference: `ZL-FLIGHT-${pnr}`,
      status: "CONFIRMED" as const,
      amount: 4800 * (params.passengers.length || 1),
      airline: "IndiGo",
      message: "Flight booked successfully",
      segments: [
        {
          origin: "DEL",
          destination: "BOM",
          departureTime: new Date().toISOString(),
          arrivalTime: new Date().toISOString(),
          airline: "IndiGo",
          flightNumber: "6E-204",
          duration: "2h 15m",
        },
      ],
      flight: {
        airline: "IndiGo",
        cabinClass: "Economy",
      } as any,
    };
  }

  async cancelBooking(pnr: string, _reason?: string) {
    return {
      success: true,
      message: `Booking ${pnr} cancelled successfully.`,
      refundAmount: 4800,
    };
  }
}

let instance: FlightProvider | null = null;

export function getFlightProvider(): FlightProvider {
  if (!instance) {
    instance = new FlightProvider();
  }
  return instance;
}
