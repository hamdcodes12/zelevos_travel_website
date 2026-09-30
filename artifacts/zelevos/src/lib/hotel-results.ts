export type HotelResultFilterInput = {
  name: string;
  destination: string;
  location: string;
  pricePerNight: number;
  category?: string;
  boardType?: string;
  refundable?: boolean;
};

export type HotelResultFilters = {
  search: string;
  minPrice: string;
  maxPrice: string;
  category: string;
  board: string;
  refundable: "all" | "yes" | "no";
};

export function filterHotelResults<T extends HotelResultFilterInput>(hotels: T[], filters: HotelResultFilters): T[] {
  return hotels.filter((hotel) => {
    const matchesSearch = !filters.search || `${hotel.name} ${hotel.destination} ${hotel.location}`.toLowerCase().includes(filters.search.toLowerCase());
    const matchesMin = !filters.minPrice || hotel.pricePerNight >= Number(filters.minPrice);
    const matchesMax = !filters.maxPrice || hotel.pricePerNight <= Number(filters.maxPrice);
    const matchesCategory = !filters.category || hotel.category === filters.category;
    const matchesBoard = !filters.board || hotel.boardType === filters.board;
    const matchesRefundable = filters.refundable === "all" || (filters.refundable === "yes" ? hotel.refundable === true : hotel.refundable === false);
    return matchesSearch && matchesMin && matchesMax && matchesCategory && matchesBoard && matchesRefundable;
  });
}

export function paginateHotelResults<T>(hotels: T[], page: number, pageSize: number): { items: T[]; page: number; pageCount: number } {
  const safePageSize = Math.max(1, Math.floor(pageSize));
  const pageCount = Math.max(1, Math.ceil(hotels.length / safePageSize));
  const currentPage = Math.min(Math.max(1, Math.floor(page)), pageCount);
  return { items: hotels.slice((currentPage - 1) * safePageSize, currentPage * safePageSize), page: currentPage, pageCount };
}
