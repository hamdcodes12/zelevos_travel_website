import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { filterHotelResults, paginateHotelResults } from "../src/lib/hotel-results";

const hotels = [
  { name: "Lake Hotel", destination: "London", location: "Central", pricePerNight: 100, category: "4 stars", boardType: "Breakfast", refundable: true },
  { name: "City Hotel", destination: "London", location: "North", pricePerNight: 220, category: "5 stars", boardType: "Room only", refundable: false },
  { name: "Beach Hotel", destination: "Rome", location: "South", pricePerNight: 140, category: "4 stars", boardType: "Breakfast", refundable: true },
];

const all = { search: "", minPrice: "", maxPrice: "", category: "", board: "", refundable: "all" as const };

describe("Hotel result filters and pagination", () => {
  it("filters actual name, price, category, board, and refundability data", () => {
    assert.deepEqual(filterHotelResults(hotels, { ...all, search: "lake" }).map((hotel) => hotel.name), ["Lake Hotel"]);
    assert.deepEqual(filterHotelResults(hotels, { ...all, minPrice: "120", maxPrice: "200", category: "4 stars", board: "Breakfast", refundable: "yes" }).map((hotel) => hotel.name), ["Beach Hotel"]);
    assert.deepEqual(filterHotelResults(hotels, { ...all, refundable: "no" }).map((hotel) => hotel.name), ["City Hotel"]);
  });

  it("paginates results and clamps invalid pages", () => {
    assert.deepEqual(paginateHotelResults(hotels, 1, 2), { items: hotels.slice(0, 2), page: 1, pageCount: 2 });
    assert.deepEqual(paginateHotelResults(hotels, 99, 2), { items: [hotels[2]], page: 2, pageCount: 2 });
    assert.deepEqual(paginateHotelResults([], 1, 2), { items: [], page: 1, pageCount: 1 });
  });
});
