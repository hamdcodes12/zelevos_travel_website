export type ProviderMode = "DEMO" | "LIVE";

export type ProviderHealth = {
  provider: string;
  mode: ProviderMode;
  status: "CONFIGURED" | "NOT_CONFIGURED";
};

export type FlightResult = {
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
  currency: "INR";
  provider: string;
  mode: ProviderMode;
};

export type HotelResult = {
  id: string;
  name: string;
  destination: string;
  rating: number;
  location: string;
  amenities: string[];
  room: string;
  cancellation: string;
  pricePerNight: number;
  image: string;
  provider: string;
  mode: ProviderMode;
};

export type ExperienceResult = {
  id: string;
  name: string;
  category: string;
  description: string;
  location: string;
  duration: string;
  price: number;
  rating: number;
  supplier: string;
  verified: boolean;
  image: string;
  provider: string;
  mode: ProviderMode;
};

export type TransportResult = {
  id: string;
  type: string;
  provider: string;
  pickup: string;
  drop: string;
  vehicle: string;
  duration: string;
  price: number;
  passengers: number;
  status: "AVAILABLE";
  mode: ProviderMode;
};

const modeFor = (secretName: string): ProviderMode =>
  process.env[secretName]?.trim() ? "LIVE" : "DEMO";

const money = (value: number) => Math.round(value);

export interface FlightProvider {
  search(input: { from: string; to: string; departure: string; returnDate?: string; travellers: number; cabin: string }): Promise<FlightResult[]>;
}

export interface HotelProvider {
  search(input: { destination: string; checkIn: string; checkOut: string; guests: number; rooms: number }): Promise<HotelResult[]>;
}

export interface ExperienceProvider {
  list(input: { destination?: string; category?: string }): Promise<ExperienceResult[]>;
}

export interface TransportProvider {
  search(input: { pickup: string; drop: string; date: string; passengers: number }): Promise<TransportResult[]>;
}

export interface PaymentProvider {
  createOrder(amount: number): Promise<{ id: string; amount: number; currency: "INR"; status: "DEMO_PENDING"; mode: "DEMO" }>;
  verify(reference: string): Promise<{ reference: string; status: "DEMO_VERIFIED"; mode: "DEMO" }>;
}

export function providerStatus() {
  return {
    flights: { provider: modeFor("FLIGHT_PROVIDER_API_KEY") === "LIVE" ? "configured-flight-provider" : "mock-flights", mode: modeFor("FLIGHT_PROVIDER_API_KEY"), status: modeFor("FLIGHT_PROVIDER_API_KEY") === "LIVE" ? "CONFIGURED" : "NOT_CONFIGURED" },
    hotels: { provider: modeFor("HOTEL_PROVIDER_API_KEY") === "LIVE" ? "configured-hotel-provider" : "mock-hotels", mode: modeFor("HOTEL_PROVIDER_API_KEY"), status: modeFor("HOTEL_PROVIDER_API_KEY") === "LIVE" ? "CONFIGURED" : "NOT_CONFIGURED" },
    activities: { provider: modeFor("ACTIVITIES_PROVIDER_API_KEY") === "LIVE" ? "configured-activities-provider" : "mock-experiences", mode: modeFor("ACTIVITIES_PROVIDER_API_KEY"), status: modeFor("ACTIVITIES_PROVIDER_API_KEY") === "LIVE" ? "CONFIGURED" : "NOT_CONFIGURED" },
    transport: { provider: modeFor("TRANSPORT_PROVIDER_API_KEY") === "LIVE" ? "configured-transport-provider" : "mock-transport", mode: modeFor("TRANSPORT_PROVIDER_API_KEY"), status: modeFor("TRANSPORT_PROVIDER_API_KEY") === "LIVE" ? "CONFIGURED" : "NOT_CONFIGURED" },
    payments: { provider: modeFor("RAZORPAY_KEY_ID") === "LIVE" ? "razorpay" : "mock-payments", mode: modeFor("RAZORPAY_KEY_ID"), status: modeFor("RAZORPAY_KEY_ID") === "LIVE" ? "CONFIGURED" : "NOT_CONFIGURED" },
  };
}

export function searchFlights(input: { from: string; to: string; departure: string; returnDate?: string; travellers: number; cabin: string }): FlightResult[] {
  const route = `${input.from.toUpperCase()} → ${input.to.toUpperCase()}`;
  const mode = modeFor("FLIGHT_PROVIDER_API_KEY");
  return [
    ["IndiGo", "6E 2187", "06:10", "08:35", "2h 25m", 0, 32450],
    ["Air India", "AI 825", "09:45", "12:25", "2h 40m", 0, 34200],
    ["Vistara", "UK 945", "15:20", "18:15", "2h 55m", 0, 38900],
  ].map(([airline, flightNumber, departure, arrival, duration, stops, price], index) => ({
    id: `flight-${index + 1}`,
    airline: String(airline),
    flightNumber: String(flightNumber),
    from: input.from,
    to: input.to,
    departure: String(departure),
    arrival: String(arrival),
    duration: String(duration),
    stops: Number(stops),
    baggage: index === 2 ? "30 kg check-in" : "15 kg check-in",
    price: money(Number(price) * Math.max(1, input.travellers)),
    currency: "INR" as const,
    provider: `Demo route ${route}`,
    mode,
  }));
}

export function searchHotels(input: { destination: string; checkIn: string; checkOut: string; guests: number; rooms: number }): HotelResult[] {
  const mode = modeFor("HOTEL_PROVIDER_API_KEY");
  const destination = input.destination || "Kashmir";
  return [
    ["The Khyber Himalayan Resort", "Gulmarg", 4.8, 14500, "Luxury mountain stay"],
    ["Nigeen Lake House", "Srinagar", 4.7, 8600, "Lakefront boutique room"],
    ["Dachigam Retreat", "Srinagar", 4.6, 6200, "Quiet garden retreat"],
    ["Lal Chowk Inn", "Srinagar", 4.2, 3800, "Budget city center room"],
    ["Pahalgam Riverside Lodge", "Pahalgam", 4.9, 11200, "River view premium suite"],
    ["Sonamarg Valley Hotel", "Sonamarg", 4.4, 7500, "Mountain view standard room"],
    ["Gulmarg Alpine Cottages", "Gulmarg", 4.5, 9200, "Cozy alpine cottage"],
    ["Srinagar Heritage Stay", "Srinagar", 4.3, 5400, "Heritage home stay"],
  ].map(([name, location, rating, pricePerNight, room], index) => ({
    id: `hotel-${index + 1}`,
    name: String(name),
    destination,
    rating: Number(rating),
    location: String(location),
    amenities: index === 0 ? ["Breakfast", "Spa", "Mountain view"] : index === 4 ? ["Breakfast", "Spa", "River view", "Premium dining"] : ["Breakfast", "Wi-Fi", "Flexible check-in"],
    room: String(room),
    cancellation: index === 2 || index === 3 ? "Free cancellation until 48h before check-in" : "Free cancellation until 7 days before check-in",
    pricePerNight: Number(pricePerNight) * Math.max(1, input.rooms),
    image: index % 2 === 0 ? "/ladakh-road.jpg" : "/kashmir-dawn.jpg",
    provider: "Demo stays catalogue",
    mode,
  }));
}

export function listExperiences(input: { destination?: string; category?: string }): ExperienceResult[] {
  const mode = modeFor("ACTIVITIES_PROVIDER_API_KEY");
  const destination = input.destination || "India";
  const items = [
    ["Dal Lake at dawn", "Nature", "A quiet shikara ride before the city wakes.", "Srinagar", "2 hours", 1800, 4.9, "Harwan local hosts", "/kashmir-dawn.jpg"],
    ["Old city food walk", "Food", "Seven small plates and the stories behind them.", "Jaipur", "4 hours", 2200, 4.8, "Meera & Co.", "/ladakh-road.jpg"],
    ["Backwater slow day", "Wellness", "A local-led day on the water, with no rush.", "Alappuzha", "7 hours", 2400, 5.0, "Sana's Kerala", "/kashmir-dawn.jpg"],
    ["Himalayan sunrise", "Adventure", "A gentle ridge walk with a mountain guide.", "Gulmarg", "5 hours", 3200, 4.9, "Arjun Outdoors", "/ladakh-road.jpg"],
    ["Mughal garden walk", "Nature", "Explore the historic Shalimar and Nishat gardens.", "Srinagar", "3 hours", 1200, 4.6, "Kashmir Heritage", "/kashmir-dawn.jpg"],
    ["Srinagar street food tour", "Food", "Taste authentic Kashmiri wazwan and kahwa.", "Srinagar", "3 hours", 1600, 4.7, "Kashmir Food Trails", "/ladakh-road.jpg"],
    ["Yoga by the lake", "Wellness", "Morning yoga session overlooking Dal Lake.", "Srinagar", "1.5 hours", 900, 4.8, "Mindful Kashmir", "/kashmir-dawn.jpg"],
    ["Gondola cable car ride", "Adventure", "Ride Asia's highest cable car to Apharwat Peak.", "Gulmarg", "2 hours", 2800, 4.9, "Gulmarg Adventures", "/ladakh-road.jpg"],
    ["Saffron field visit", "Nature", "Visit local saffron farms and learn harvesting.", "Pampore", "4 hours", 2000, 4.5, "Saffron Collective", "/kashmir-dawn.jpg"],
    ["Traditional wazwan cooking", "Food", "Learn to cook authentic Kashmiri feast.", "Srinagar", "5 hours", 3500, 4.9, "Kashmir Kitchen", "/ladakh-road.jpg"],
    ["Meditation retreat", "Wellness", "Half-day silent meditation in pine forest.", "Pahalgam", "4 hours", 1800, 4.7, "Inner Peace Retreat", "/kashmir-dawn.jpg"],
    ["White water rafting", "Adventure", "Thrilling rapids on Lidder river.", "Pahalgam", "3 hours", 2500, 4.8, "River Rush Adventures", "/ladakh-road.jpg"],
  ];
  return items
    .filter((item) => !input.category || item[1] === input.category)
    .map(([name, category, description, location, duration, price, rating, supplier, image], index) => ({
      id: `experience-${index + 1}`,
      name: String(name),
      category: String(category),
      description: String(description),
      location: input.destination || String(location) || destination,
      duration: String(duration),
      price: Number(price),
      rating: Number(rating),
      supplier: String(supplier),
      verified: true,
      image: String(image),
      provider: "Demo local marketplace",
      mode,
    }));
}

export function searchTransport(input: { pickup: string; drop: string; date: string; passengers: number }): TransportResult[] {
  const mode = modeFor("TRANSPORT_PROVIDER_API_KEY");
  return [
    ["Airport transfer", "Zelevos demo drivers", "Sedan", "45 min", 1800],
    ["Premium airport transfer", "Zelevos demo drivers", "SUV", "50 min", 2600],
    ["Intercity cab", "Zelevos demo drivers", "Innova", "3h 20m", 5400],
    ["Budget airport shuttle", "Zelevos demo drivers", "Shared minivan", "1h 10m", 800],
    ["Luxury airport transfer", "Zelevos demo drivers", "Mercedes", "45 min", 4200],
    ["City to Gulmarg", "Zelevos demo drivers", "SUV", "2h 30m", 3800],
    ["City to Pahalgam", "Zelevos demo drivers", "Innova", "2h 45m", 4100],
    ["Half-day rental", "Zelevos demo drivers", "Sedan with driver", "4 hours", 2400],
  ].map(([type, provider, vehicle, duration, price], index) => ({
    id: `transport-${index + 1}`,
    type: String(type),
    provider: String(provider),
    pickup: input.pickup,
    drop: input.drop,
    vehicle: String(vehicle),
    duration: String(duration),
    price: Number(price),
    passengers: input.passengers,
    status: "AVAILABLE" as const,
    mode,
  }));
}

export function createMockPayment(amount: number) {
  return {
    id: `pay_demo_${crypto.randomUUID().slice(0, 8)}`,
    amount,
    currency: "INR" as const,
    status: "DEMO_PENDING" as const,
    mode: "DEMO" as const,
    message: "Demo payment only. No money was charged.",
  };
}

export class MockPaymentProvider implements PaymentProvider {
  async createOrder(amount: number) {
    return createMockPayment(amount);
  }

  async verify(reference: string) {
    return { reference, status: "DEMO_VERIFIED" as const, mode: "DEMO" as const };
  }
}

// Credentials can be wired here without changing route contracts or the client.
export class RealPaymentProvider implements PaymentProvider {
  async createOrder(_amount: number): Promise<never> {
    throw new Error("Razorpay provider adapter is not configured.");
  }

  async verify(_reference: string): Promise<never> {
    throw new Error("Razorpay provider adapter is not configured.");
  }
}