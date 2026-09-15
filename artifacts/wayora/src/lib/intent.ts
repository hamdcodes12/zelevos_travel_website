export type HomepageIntent =
  | {
      type: "flight";
      origin?: string;
      destination?: string;
      departureDate?: string;
      passengers?: number;
    }
  | {
      type: "planner";
    };

const CITY_IATA_MAP: Record<string, string> = {
  delhi: "DEL",
  "new delhi": "DEL",
  mumbai: "BOM",
  bombay: "BOM",
  bangalore: "BLR",
  bengaluru: "BLR",
  goa: "GOI",
  srinagar: "SXR",
  kashmir: "SXR",
  pune: "PNQ",
  kolkata: "CCU",
  calcutta: "CCU",
  hyderabad: "HYD",
  chennai: "MAA",
  madras: "MAA",
  ahmedabad: "AMD",
  jaipur: "JAI",
  chandigarh: "IXC",
  amritsar: "ATQ",
  lucknow: "LKO",
  kochi: "COK",
  cochin: "COK",
  patna: "PAT",
  bhubaneswar: "BBI",
  bhubaneshwar: "BBI",
  indore: "IDR",
  varanasi: "VNS",
  banaras: "VNS",
  kashi: "VNS",
  nagpur: "NAG",
  surat: "STV",
  ranchi: "IXR",
  guwahati: "GAU",
  bagdogra: "IXB",
  siliguri: "IXB",
  dehradun: "DED",
  raipur: "RPR",
  coimbatore: "CJB",
  madurai: "IXM",
  mangalore: "IXE",
  visakhapatnam: "VTZ",
  vizag: "VTZ",
  trivandrum: "TRV",
  bhopal: "BHO",
  jodhpur: "JDH",
  udaipur: "UDR",
  leh: "IXL",
  ladakh: "IXL",
  dharamshala: "DHM",
  kullu: "KUU",
  manali: "KUU",
  dubai: "DXB",
  london: "LHR",
  singapore: "SIN",
  bangkok: "BKK",
};

export function normalizeCityOrCode(input: string): string {
  const trimmed = input.trim().toLowerCase();
  if (CITY_IATA_MAP[trimmed]) {
    return CITY_IATA_MAP[trimmed];
  }
  // If it's already a 3-letter IATA code, uppercase it
  if (input.trim().length === 3) {
    return input.trim().toUpperCase();
  }
  // Otherwise return title-cased city name
  return input
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

export function detectHomepageIntent(input: string): HomepageIntent {
  const trimmed = input.trim();
  if (!trimmed) return { type: "planner" };

  const lower = trimmed.toLowerCase();

  // 1. Explicit full-itinerary or vacation queries that happen to mention "flights"
  // Examples:
  // "Plan my honeymoon in Goa for 5 days"
  // "Plan a trip to Kashmir including flights and hotels"
  // "I want to plan a trip and include flights, hotels and activities"
  const plannerPatterns = [
    /\bplan\s+(?:my|a|our|the)?\s*(?:trip|vacation|holiday|honeymoon|itinerary|journey|tour)\b/i,
    /\b(?:including|include)\s+flights?\b/i,
    /\bhoneymoon\b/i,
    /\bcustom\s+itinerary\b/i,
    /\bbuild\s+(?:me\s+)?a\s+trip\b/i,
    /\bwhere\s+should\s+i\s+go\b/i,
    /\btrip\s+to\s+.*?\s+for\s+\d+\s+days\b/i,
    /\bfor\s+\d+\s+days\b/i,
    /\b\d+\s+days?\s+trip\b/i,
    /\b\d+\s+days?\s+itinerary\b/i,
  ];

  if (plannerPatterns.some((pattern) => pattern.test(lower))) {
    return { type: "planner" };
  }

  // 2. Flight-specific keywords
  const flightKeywords = [
    /\bflights?\b/i,
    /\bfly\b/i,
    /\bairfare\b/i,
    /\bairlines?\b/i,
    /\bair\s*tickets?\b/i,
    /\bplane\s*tickets?\b/i,
  ];

  const hasFlightKeyword = flightKeywords.some((pattern) => pattern.test(lower));
  if (!hasFlightKeyword) {
    return { type: "planner" };
  }

  // 3. User definitely has FLIGHT intent! Parse route, date and pax.
  let origin: string | undefined;
  let destination: string | undefined;
  let departureDate: string | undefined;
  let passengers: number | undefined;

  // Extract passenger count: e.g. "for 2 people", "2 passengers", "2 travellers", "for 3 pax"
  const paxMatch = lower.match(/(?:for\s+)?(\d+)\s*(?:people|persons?|passengers?|pax|travellers?|travelers?|adults?|tickets?)/i);
  if (paxMatch) {
    const count = parseInt(paxMatch[1], 10);
    if (!isNaN(count) && count >= 1 && count <= 9) {
      passengers = count;
    }
  }

  // Extract relative dates: "tomorrow", "day after tomorrow", "today"
  const now = new Date();
  if (/\bday\s+after\s+tomorrow\b/i.test(lower)) {
    const d = new Date(now);
    d.setDate(now.getDate() + 2);
    departureDate = d.toISOString().split("T")[0];
  } else if (/\btomorrow\b/i.test(lower)) {
    const d = new Date(now);
    d.setDate(now.getDate() + 1);
    departureDate = d.toISOString().split("T")[0];
  } else if (/\btoday\b/i.test(lower)) {
    departureDate = now.toISOString().split("T")[0];
  }

  // Clean the text to parse origin and destination
  let clean = lower
    .replace(/\b(?:search|find|book|show|get|look\s+for|i\s+need|cheap|best|domestic|international|direct)\b/gi, "")
    .replace(/\b(?:flights?|air\s*tickets?|plane\s*tickets?|tickets?|airfare|airline)\b/gi, "")
    .replace(/\b(?:tomorrow|today|day\s+after\s+tomorrow|next\s+week)\b/gi, "")
    .replace(/(?:for\s+)?\d+\s*(?:people|persons?|passengers?|pax|travellers?|travelers?|adults?|tickets?)/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  // Pattern: "(from) <Origin> to <Destination>"
  const fromToMatch = clean.match(/(?:from\s+)?([a-z\s]+?)\s+to\s+([a-z\s]+)/i);
  if (fromToMatch) {
    const rawFrom = fromToMatch[1].trim();
    const rawTo = fromToMatch[2].trim();
    if (rawFrom) origin = normalizeCityOrCode(rawFrom);
    if (rawTo) destination = normalizeCityOrCode(rawTo);
  } else {
    // Pattern: "<City1> <City2>" e.g. "Delhi Mumbai" or "DEL BOM"
    const twoWordsMatch = clean.match(/^([a-z]{3,20})\s+([a-z]{3,20})$/i);
    if (twoWordsMatch) {
      origin = normalizeCityOrCode(twoWordsMatch[1]);
      destination = normalizeCityOrCode(twoWordsMatch[2]);
    }
  }

  return {
    type: "flight",
    origin,
    destination,
    departureDate,
    passengers,
  };
}
