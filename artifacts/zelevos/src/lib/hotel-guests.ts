export type HotelGuestRoom = {
  adults: Array<{ firstName: string; surname: string; type: "AD" }>;
  children: Array<{ firstName: string; surname: string; type: "CH"; age: number }>;
};

type Occupancy = { adults: number; children: number; childAges: number[] };
type LeadGuest = { firstName: string; surname: string };

type ExistingRoom = HotelGuestRoom | undefined;

export function syncHotelGuestRooms(existing: ExistingRoom[], occupancies: Occupancy[], leadGuest?: LeadGuest): HotelGuestRoom[] {
  return occupancies.map((occupancy, roomIndex) => {
    const previous = existing[roomIndex];
    const adults = Array.from({ length: occupancy.adults }, (_, adultIndex) => ({
      firstName: previous?.adults[adultIndex]?.firstName || (roomIndex === 0 && adultIndex === 0 ? leadGuest?.firstName || "" : ""),
      surname: previous?.adults[adultIndex]?.surname || (roomIndex === 0 && adultIndex === 0 ? leadGuest?.surname || "" : ""),
      type: "AD" as const,
    }));
    const children = Array.from({ length: occupancy.children }, (_, childIndex) => ({
      firstName: previous?.children[childIndex]?.firstName || "",
      surname: previous?.children[childIndex]?.surname || "",
      type: "CH" as const,
      age: occupancy.childAges[childIndex],
    }));
    return { adults, children };
  });
}

export function validateHotelGuestRooms(rooms: HotelGuestRoom[]): string | null {
  for (let roomIndex = 0; roomIndex < rooms.length; roomIndex += 1) {
    const room = rooms[roomIndex];
    for (const [guestIndex, guest] of room.adults.entries()) {
      if (!guest.firstName.trim() || !guest.surname.trim()) return `Room ${roomIndex + 1}, adult ${guestIndex + 1}: first name and surname are required.`;
    }
    for (const [guestIndex, guest] of room.children.entries()) {
      if (!guest.firstName.trim() || !guest.surname.trim()) return `Room ${roomIndex + 1}, child ${guestIndex + 1}: first name and surname are required.`;
      if (!Number.isInteger(guest.age) || guest.age < 0 || guest.age > 17) return `Room ${roomIndex + 1}, child ${guestIndex + 1}: the supplier child age is invalid.`;
    }
  }
  return null;
}

export function toGuestRoomManifest(rooms: HotelGuestRoom[]) {
  return rooms.map((room, roomIndex) => ({
    roomId: roomIndex + 1,
    paxes: [...room.adults, ...room.children].map((guest) => ({
      roomId: roomIndex + 1,
      name: guest.firstName.trim(),
      surname: guest.surname.trim(),
      type: guest.type,
      ...(guest.type === "CH" ? { age: guest.age } : {}),
    })),
  }));
}
