import { invalidRequest, serviceError } from "../errors.js";
import Flight from "../models/Flight.js";
import SeatClaim from "../models/SeatClaim.js";

export const seatColumns = Object.freeze(["A", "B", "C", "D", "E", "F"]);

export function seatInventoryError() {
  return serviceError(
    "BOOKING_CONSISTENCY_ERROR",
    "Booking inventory is temporarily inconsistent and requires repair",
    500,
  );
}

export function seatNumberAt(index) {
  return `${Math.floor(index / seatColumns.length) + 1}${seatColumns[index % seatColumns.length]}`;
}

export function isValidSeatNumber(seatNumber, totalSeats) {
  if (typeof seatNumber !== "string" || !/^[1-9]\d*[A-F]$/.test(seatNumber))
    return false;
  const row = Number(seatNumber.slice(0, -1));
  const column = seatColumns.indexOf(seatNumber.slice(-1));
  return (
    Number.isSafeInteger(row) &&
    column >= 0 &&
    (row - 1) * seatColumns.length + column < totalSeats
  );
}

export function compareSeats(left, right) {
  return (
    Number(left.slice(0, -1)) - Number(right.slice(0, -1)) ||
    seatColumns.indexOf(left.slice(-1)) - seatColumns.indexOf(right.slice(-1))
  );
}

export async function loadClaimedSeats(flight, session = null) {
  if (!Number.isSafeInteger(flight.totalSeats) || flight.totalSeats < 1) {
    throw seatInventoryError();
  }
  const claims = await SeatClaim.find({ flightId: flight._id })
    .select("seatNumber -_id")
    .session(session)
    .lean();
  const claimed = new Set(claims.map(({ seatNumber }) => seatNumber));
  if (
    claimed.size !== claims.length ||
    claims.some(
      ({ seatNumber }) => !isValidSeatNumber(seatNumber, flight.totalSeats),
    )
  ) {
    throw seatInventoryError();
  }
  return claimed;
}

export async function allocateSeats(flight, input, session) {
  const claimed = await loadClaimedSeats(flight, session);
  if (flight.totalSeats - claimed.size < input.seatCount)
    throw seatInventoryError();

  if (input.seatNumbers !== undefined) {
    if (
      input.seatNumbers.some(
        (seat) => !isValidSeatNumber(seat, flight.totalSeats),
      )
    ) {
      throw invalidRequest([
        {
          field: "seatNumbers",
          message: "Every seat must exist in the flight layout",
        },
      ]);
    }
    if (input.seatNumbers.some((seat) => claimed.has(seat))) {
      throw serviceError(
        "SEAT_UNAVAILABLE",
        "One or more selected seats are already occupied",
        409,
      );
    }
    return [...input.seatNumbers].sort(compareSeats);
  }

  const seats = [];
  for (
    let index = 0;
    index < flight.totalSeats && seats.length < input.seatCount;
    index++
  ) {
    const seat = seatNumberAt(index);
    if (!claimed.has(seat)) seats.push(seat);
  }
  return seats;
}

export async function getFlightSeats(flightId) {
  const flight = await Flight.findById(flightId).select("totalSeats").lean();
  if (!flight)
    throw serviceError("FLIGHT_NOT_FOUND", "Flight was not found", 404);
  const claimed = await loadClaimedSeats(flight);
  return {
    flightId: flight._id.toString(),
    totalSeats: flight.totalSeats,
    availableSeats: flight.totalSeats - claimed.size,
    layout: { columns: seatColumns },
    claimedSeatNumbers: [...claimed].sort(compareSeats),
  };
}
