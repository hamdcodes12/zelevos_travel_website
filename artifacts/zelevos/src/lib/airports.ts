export type Airport = {
  iata: string;
  city: string;
  name: string;
  country: string;
  aliases?: string[];
};

export const AIRPORTS: Airport[] = [
  // Major Indian Hubs & Cities
  { iata: "DEL", city: "Delhi", name: "Indira Gandhi International Airport", country: "India", aliases: ["New Delhi", "NCR", "Palam"] },
  { iata: "BOM", city: "Mumbai", name: "Chhatrapati Shivaji Maharaj International Airport", country: "India", aliases: ["Bombay", "Sahar", "Santa Cruz"] },
  { iata: "BLR", city: "Bengaluru", name: "Kempegowda International Airport", country: "India", aliases: ["Bangalore", "Devanahalli"] },
  { iata: "HYD", city: "Hyderabad", name: "Rajiv Gandhi International Airport", country: "India", aliases: ["Secunderabad", "Shamshabad"] },
  { iata: "MAA", city: "Chennai", name: "Chennai International Airport", country: "India", aliases: ["Madras", "Meenambakkam"] },
  { iata: "CCU", city: "Kolkata", name: "Netaji Subhas Chandra Bose International Airport", country: "India", aliases: ["Calcutta", "Dum Dum"] },
  { iata: "AMD", city: "Ahmedabad", name: "Sardar Vallabhbhai Patel International Airport", country: "India", aliases: ["Amdavad"] },
  { iata: "PNQ", city: "Pune", name: "Pune Airport", country: "India", aliases: ["Lohegaon"] },
  { iata: "GOI", city: "Goa (Dabolim)", name: "Dabolim Airport", country: "India", aliases: ["Goa", "South Goa", "Vasco da Gama"] },
  { iata: "GOX", city: "Goa (Mopa)", name: "Manohar International Airport", country: "India", aliases: ["Goa", "North Goa", "Pernem", "Mopa"] },
  { iata: "JAI", city: "Jaipur", name: "Jaipur International Airport", country: "India", aliases: ["Pink City", "Sanganer"] },
  { iata: "LKO", city: "Lucknow", name: "Chaudhary Charan Singh International Airport", country: "India", aliases: ["Amausi"] },
  { iata: "COK", city: "Kochi", name: "Cochin International Airport", country: "India", aliases: ["Cochin", "Nedumbassery", "Ernakulam", "Kerala"] },
  { iata: "BBI", city: "Bhubaneswar", name: "Biju Patnaik International Airport", country: "India", aliases: ["Odisha", "Bhubaneshwar"] },
  { iata: "PAT", city: "Patna", name: "Jay Prakash Narayan Airport", country: "India", aliases: ["Bihar"] },
  { iata: "SXR", city: "Srinagar", name: "Sheikh ul-Alam International Airport", country: "India", aliases: ["Kashmir", "Dal Lake", "Gulmarg"] },
  { iata: "IXC", city: "Chandigarh", name: "Shaheed Bhagat Singh International Airport", country: "India", aliases: ["Mohali", "Panchkula", "Punjab", "Haryana"] },
  { iata: "ATQ", city: "Amritsar", name: "Sri Guru Ram Dass Jee International Airport", country: "India", aliases: ["Golden Temple", "Raja Sansi"] },
  { iata: "IDR", city: "Indore", name: "Devi Ahilyabai Holkar Airport", country: "India", aliases: ["Madhya Pradesh"] },
  { iata: "VNS", city: "Varanasi", name: "Lal Bahadur Shastri International Airport", country: "India", aliases: ["Banaras", "Kashi", "Babatpur"] },
  { iata: "NAG", city: "Nagpur", name: "Dr. Babasaheb Ambedkar International Airport", country: "India", aliases: ["Orange City", "Sonegaon"] },
  { iata: "STV", city: "Surat", name: "Surat International Airport", country: "India", aliases: ["Diamond City", "Gujarat"] },
  { iata: "IXR", city: "Ranchi", name: "Birsa Munda Airport", country: "India", aliases: ["Jharkhand"] },
  { iata: "GAU", city: "Guwahati", name: "Lokpriya Gopinath Bordoloi International Airport", country: "India", aliases: ["Assam", "Borjhar", "North East"] },
  { iata: "IXB", city: "Bagdogra", name: "Bagdogra International Airport", country: "India", aliases: ["Siliguri", "Darjeeling", "Gangtok", "Sikkim"] },
  { iata: "DED", city: "Dehradun", name: "Jolly Grant Airport", country: "India", aliases: ["Rishikesh", "Haridwar", "Mussoorie", "Uttarakhand"] },
  { iata: "RPR", city: "Raipur", name: "Swami Vivekananda Airport", country: "India", aliases: ["Chhattisgarh", "Mana"] },
  { iata: "CJB", city: "Coimbatore", name: "Coimbatore International Airport", country: "India", aliases: ["Peelamedu", "Ooty", "Tamil Nadu"] },
  { iata: "IXM", city: "Madurai", name: "Madurai Airport", country: "India", aliases: ["Tamil Nadu"] },
  { iata: "IXE", city: "Mangalore", name: "Mangaluru International Airport", country: "India", aliases: ["Bajpe", "Karnataka"] },
  { iata: "VTZ", city: "Visakhapatnam", name: "Visakhapatnam International Airport", country: "India", aliases: ["Vizag", "Andhra Pradesh"] },
  { iata: "TRV", city: "Trivandrum", name: "Thiruvananthapuram International Airport", country: "India", aliases: ["Kerala", "Chacka"] },
  { iata: "BHO", city: "Bhopal", name: "Raja Bhoj Airport", country: "India", aliases: ["Madhya Pradesh", "Gandhi Nagar"] },
  { iata: "JDH", city: "Jodhpur", name: "Jodhpur Airport", country: "India", aliases: ["Blue City", "Rajasthan"] },
  { iata: "UDR", city: "Udaipur", name: "Maharana Pratap Airport", country: "India", aliases: ["Dabok", "Lake City", "Rajasthan"] },
  { iata: "IXU", city: "Aurangabad", name: "Chhatrapati Sambhajinagar Airport", country: "India", aliases: ["Chhatrapati Sambhajinagar", "Ajanta", "Ellora"] },
  { iata: "IXL", city: "Leh", name: "Kushok Bakula Rimpochee Airport", country: "India", aliases: ["Ladakh"] },
  { iata: "IXZ", city: "Port Blair", name: "Veer Savarkar International Airport", country: "India", aliases: ["Andaman and Nicobar", "Havelock"] },
  { iata: "IXA", city: "Agartala", name: "Maharaja Bir Bikram Airport", country: "India", aliases: ["Tripura", "Singerbhil"] },
  { iata: "IMF", city: "Imphal", name: "Bir Tikendrajit International Airport", country: "India", aliases: ["Manipur", "Tulihal"] },
  { iata: "DHM", city: "Dharamshala", name: "Kangra Airport", country: "India", aliases: ["Gaggal", "Mcleodganj", "Himachal"] },
  { iata: "KUU", city: "Kullu", name: "Kullu–Manali Airport", country: "India", aliases: ["Bhuntar", "Manali", "Himachal"] },
  { iata: "GAY", city: "Gaya", name: "Gaya Airport", country: "India", aliases: ["Bodhgaya", "Bihar"] },
  { iata: "BDQ", city: "Vadodara", name: "Vadodara Airport", country: "India", aliases: ["Baroda", "Gujarat"] },
  { iata: "TIR", city: "Tirupati", name: "Tirupati Airport", country: "India", aliases: ["Renigunta", "Balaji"] },
  { iata: "TRZ", city: "Tiruchirappalli", name: "Tiruchirappalli International Airport", country: "India", aliases: ["Trichy", "Tamil Nadu"] },
  { iata: "IXJ", city: "Jammu", name: "Jammu Airport", country: "India", aliases: ["Satwari", "Vaishno Devi"] },
  { iata: "DMU", city: "Dimapur", name: "Dimapur Airport", country: "India", aliases: ["Nagaland"] },
  { iata: "SHL", city: "Shillong", name: "Shillong Airport", country: "India", aliases: ["Umroi", "Meghalaya"] },
  { iata: "AJL", city: "Aizawl", name: "Lengpui Airport", country: "India", aliases: ["Mizoram"] },
  { iata: "DIB", city: "Dibrugarh", name: "Dibrugarh Airport", country: "India", aliases: ["Mohanbari", "Assam"] },
  { iata: "JRH", city: "Jorhat", name: "Jorhat Airport", country: "India", aliases: ["Rowriah", "Kaziranga"] },

  // Top International Hubs
  { iata: "DXB", city: "Dubai", name: "Dubai International Airport", country: "United Arab Emirates", aliases: ["UAE", "Emirates"] },
  { iata: "AUH", city: "Abu Dhabi", name: "Zayed International Airport", country: "United Arab Emirates", aliases: ["UAE"] },
  { iata: "DOH", city: "Doha", name: "Hamad International Airport", country: "Qatar", aliases: ["Qatar"] },
  { iata: "SIN", city: "Singapore", name: "Singapore Changi Airport", country: "Singapore", aliases: ["Changi"] },
  { iata: "BKK", city: "Bangkok", name: "Suvarnabhumi Airport", country: "Thailand", aliases: ["Thailand"] },
  { iata: "DMK", city: "Bangkok (Don Mueang)", name: "Don Mueang International Airport", country: "Thailand", aliases: ["Don Mueang"] },
  { iata: "KUL", city: "Kuala Lumpur", name: "Kuala Lumpur International Airport", country: "Malaysia", aliases: ["KLIA", "Malaysia"] },
  { iata: "LHR", city: "London (Heathrow)", name: "Heathrow Airport", country: "United Kingdom", aliases: ["London", "UK", "England"] },
  { iata: "LGW", city: "London (Gatwick)", name: "Gatwick Airport", country: "United Kingdom", aliases: ["London", "UK"] },
  { iata: "CDG", city: "Paris", name: "Charles de Gaulle Airport", country: "France", aliases: ["Roissy", "France"] },
  { iata: "FRA", city: "Frankfurt", name: "Frankfurt Airport", country: "Germany", aliases: ["Germany"] },
  { iata: "AMS", city: "Amsterdam", name: "Amsterdam Airport Schiphol", country: "Netherlands", aliases: ["Schiphol", "Holland"] },
  { iata: "JFK", city: "New York (JFK)", name: "John F. Kennedy International Airport", country: "United States", aliases: ["NYC", "USA"] },
  { iata: "EWR", city: "New York (Newark)", name: "Newark Liberty International Airport", country: "United States", aliases: ["Newark", "New Jersey", "NYC", "USA"] },
  { iata: "SFO", city: "San Francisco", name: "San Francisco International Airport", country: "United States", aliases: ["Bay Area", "California", "USA"] },
  { iata: "ORD", city: "Chicago", name: "O'Hare International Airport", country: "United States", aliases: ["Illinois", "USA"] },
  { iata: "YYZ", city: "Toronto", name: "Toronto Pearson International Airport", country: "Canada", aliases: ["Ontario", "Canada"] },
  { iata: "HND", city: "Tokyo (Haneda)", name: "Tokyo Haneda Airport", country: "Japan", aliases: ["Tokyo", "Japan"] },
  { iata: "NRT", city: "Tokyo (Narita)", name: "Narita International Airport", country: "Japan", aliases: ["Tokyo", "Japan"] },
  { iata: "SYD", city: "Sydney", name: "Sydney Kingsford Smith Airport", country: "Australia", aliases: ["Mascot", "Australia"] },
  { iata: "MEL", city: "Melbourne", name: "Melbourne Airport", country: "Australia", aliases: ["Tullamarine", "Australia"] },
  { iata: "CMB", city: "Colombo", name: "Bandaranaike International Airport", country: "Sri Lanka", aliases: ["Katunayake", "Sri Lanka"] },
  { iata: "MLE", city: "Male", name: "Velana International Airport", country: "Maldives", aliases: ["Hulhule", "Maldives"] },
  { iata: "KTM", city: "Kathmandu", name: "Tribhuvan International Airport", country: "Nepal", aliases: ["Nepal"] },
  { iata: "DAC", city: "Dhaka", name: "Hazrat Shahjalal International Airport", country: "Bangladesh", aliases: ["Bangladesh"] },
];

export function getAirportByCode(code: string): Airport | undefined {
  if (!code) return undefined;
  const upper = code.trim().toUpperCase();
  return AIRPORTS.find((a) => a.iata === upper);
}

export function searchAirports(query: string, excludeIata?: string): Airport[] {
  const normalized = query.trim().toLowerCase();
  const excludeUpper = excludeIata ? excludeIata.trim().toUpperCase() : undefined;

  let pool = AIRPORTS;
  if (excludeUpper) {
    pool = pool.filter((a) => a.iata !== excludeUpper);
  }

  if (!normalized) {
    // Return top popular airports by default
    return pool.slice(0, 8);
  }

  // Exact IATA match gets top priority
  const exactIata = pool.filter((a) => a.iata.toLowerCase() === normalized);

  // Starts with IATA or City
  const prefixMatches = pool.filter(
    (a) =>
      a.iata.toLowerCase() !== normalized &&
      (a.iata.toLowerCase().startsWith(normalized) || a.city.toLowerCase().startsWith(normalized))
  );

  // Substring matches in City, Name, or Aliases
  const substringMatches = pool.filter(
    (a) =>
      a.iata.toLowerCase() !== normalized &&
      !a.iata.toLowerCase().startsWith(normalized) &&
      !a.city.toLowerCase().startsWith(normalized) &&
      (a.city.toLowerCase().includes(normalized) ||
        a.name.toLowerCase().includes(normalized) ||
        a.country.toLowerCase().includes(normalized) ||
        (a.aliases && a.aliases.some((alias) => alias.toLowerCase().includes(normalized))))
  );

  return [...exactIata, ...prefixMatches, ...substringMatches].slice(0, 10);
}
