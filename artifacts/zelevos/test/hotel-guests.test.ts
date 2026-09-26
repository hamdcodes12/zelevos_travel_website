import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { syncHotelGuestRooms, toGuestRoomManifest, validateHotelGuestRooms } from "../src/lib/hotel-guests";

describe("Guest room manifest form", () => {
  it("creates one room with two adults and prefills the signed-in lead", () => {
    const rooms = syncHotelGuestRooms([], [{ adults: 2, children: 0, childAges: [] }], { firstName: "Lead", surname: "Guest" });
    assert.equal(rooms[0].adults.length, 2);
    assert.deepEqual(rooms[0].adults[0], { firstName: "Lead", surname: "Guest", type: "AD" });
    assert.equal(rooms[0].adults[1].firstName, "");
  });

  it("creates multiple rooms with children and preserves each exact age", () => {
    const rooms = syncHotelGuestRooms([], [{ adults: 2, children: 0, childAges: [] }, { adults: 2, children: 2, childAges: [7, 12] }]);
    assert.equal(rooms.length, 2);
    assert.deepEqual(rooms[1].children.map((child) => child.age), [7, 12]);
    const payload = toGuestRoomManifest(rooms);
    assert.deepEqual(payload.map((room) => room.paxes.map((pax) => pax.roomId)), [[1, 1], [2, 2, 2, 2]]);
    assert.deepEqual(payload[1].paxes.filter((pax) => pax.type === "CH").map((pax) => pax.age), [7, 12]);
  });

  it("rejects missing names and accepts a complete normalized payload", () => {
    const rooms = syncHotelGuestRooms([], [{ adults: 1, children: 1, childAges: [7] }]);
    assert.match(validateHotelGuestRooms(rooms) || "", /adult 1/);
    rooms[0].adults[0].firstName = "Lead";
    rooms[0].adults[0].surname = "Guest";
    rooms[0].children[0].firstName = "Child";
    rooms[0].children[0].surname = "Guest";
    assert.equal(validateHotelGuestRooms(rooms), null);
    assert.deepEqual(toGuestRoomManifest(rooms)[0].paxes[1], { roomId: 1, name: "Child", surname: "Guest", type: "CH", age: 7 });
  });
});
