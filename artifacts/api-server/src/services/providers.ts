import crypto from "node:crypto";

export type ProviderMode = "DEMO" | "LIVE";

export type ProviderHealth = {
  provider: string;
  mode: ProviderMode;
  status: "CONFIGURED" | "NOT_CONFIGURED";
};

export type HotelResult = {
  id: string;
  name: string;
  destination: string;
  rating: number;
  location: string;
  amenities: string[];
  room: string;
  pricePerNight: number;
  image: string;
  provider: string;
  mode: ProviderMode;
  cancellation: string;
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

export function searchHotels(query?: { destination?: string }): HotelResult[] {
  const dest = query?.destination || "Kashmir";
  return [
    {
      id: "ht_demo_1",
      name: "The Grand Dragon Luxury Resort",
      destination: dest,
      rating: 5,
      location: `Central ${dest}`,
      amenities: ["Free Wi-Fi", "Mountain View", "Spa", "Breakfast Included"],
      room: "Deluxe Pine Suite",
      pricePerNight: 8500,
      image: "https://images.unsplash.com/photo-1566073771259-6a8506099945",
      provider: "zelevos-vetted",
      mode: "DEMO",
      cancellation: "Free cancellation up to 48 hours before check-in",
    },
    {
      id: "ht_demo_2",
      name: "Heritage Pine Valley Retreat",
      destination: dest,
      rating: 4,
      location: `Valley View, ${dest}`,
      amenities: ["Free Wi-Fi", "Fireplace", "Restaurant"],
      room: "Heritage Cottage",
      pricePerNight: 5500,
      image: "https://images.unsplash.com/photo-1582719508461-905c673771fd",
      provider: "zelevos-vetted",
      mode: "DEMO",
      cancellation: "Non-refundable",
    },
  ];
}

export function listExperiences(query?: { destination?: string; category?: string }): ExperienceResult[] {
  const dest = query?.destination || "Kashmir";
  return [
    {
      id: "act_demo_1",
      name: `Private Guided Heritage Walk in ${dest}`,
      category: "Culture",
      description: "Authentic local tour led by certified cultural guides.",
      location: dest,
      duration: "3 hours",
      price: 1800,
      rating: 4.9,
      supplier: "Zelevos Local Curators",
      verified: true,
      image: "https://images.unsplash.com/photo-1524492412937-b28074a5d7da",
      provider: "zelevos-vetted",
      mode: "DEMO",
    },
    {
      id: "act_demo_2",
      name: `Scenic Sunset Experience in ${dest}`,
      category: "Sightseeing",
      description: "Picturesque evening experience with traditional refreshments.",
      location: dest,
      duration: "2 hours",
      price: 2400,
      rating: 4.8,
      supplier: "Zelevos Local Curators",
      verified: true,
      image: "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
      provider: "zelevos-vetted",
      mode: "DEMO",
    },
  ];
}

export function searchTransport(query?: { pickup?: string; drop?: string }): TransportResult[] {
  return [
    {
      id: "tr_demo_1",
      type: "Private Sedan Transfer",
      provider: "zelevos-vetted",
      pickup: query?.pickup || "Airport",
      drop: query?.drop || "Hotel",
      vehicle: "Toyota Innova Crysta",
      duration: "1h 30m",
      price: 2800,
      passengers: 4,
      status: "AVAILABLE",
      mode: "DEMO",
    },
  ];
}

export function providerStatus() {
  return {
    curatedPackages: { provider: "zelevos-curated", mode: "LIVE" as const, status: "CONFIGURED" as const },
    hotels: { provider: "zelevos-curated", mode: "LIVE" as const, status: "CONFIGURED" as const },
    activities: { provider: "zelevos-curated", mode: "LIVE" as const, status: "CONFIGURED" as const },
    transport: { provider: "zelevos-curated", mode: "LIVE" as const, status: "CONFIGURED" as const },
    payments: {
      provider: modeFor("RAZORPAY_KEY_ID") === "LIVE" ? "razorpay" : "mock-payments",
      mode: modeFor("RAZORPAY_KEY_ID"),
      status: modeFor("RAZORPAY_KEY_ID") === "LIVE" ? "CONFIGURED" : "NOT_CONFIGURED" as const,
    },
  };
}
