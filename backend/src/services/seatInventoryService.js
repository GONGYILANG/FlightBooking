import Booking from "../models/Booking.js";
import Flight from "../models/Flight.js";
import SeatClaim from "../models/SeatClaim.js";
import { runBookingTransaction } from "./bookingService.js";
import { isValidSeatNumber } from "./seatService.js";

export function inspectFlightInventory(flight, bookings, claims) {
  const issues = [];
  const expected = new Set();
  if (!Number.isSafeInteger(flight.totalSeats) || flight.totalSeats < 1)
    issues.push("INVALID_CAPACITY");
  for (const booking of bookings) {
    if (
      !Array.isArray(booking.seatNumbers) ||
      booking.seatNumbers.length !== booking.seatCount ||
      !Number.isInteger(booking.seatCount) ||
      booking.seatCount < 1 ||
      booking.seatCount > 9 ||
      !["AUTO", "MANUAL"].includes(booking.seatSelectionMode)
    ) {
      issues.push(`INVALID_BOOKING_SEATS:${booking._id}`);
      continue;
    }
    for (const seat of booking.seatNumbers) {
      if (expected.has(seat)) issues.push(`DUPLICATE_BOOKING_SEAT:${seat}`);
      if (!isValidSeatNumber(seat, flight.totalSeats))
        issues.push(`INVALID_BOOKING_SEAT:${seat}`);
      expected.add(seat);
    }
  }
  const actual = new Set(claims.map(({ seatNumber }) => seatNumber));
  if (actual.size !== claims.length) issues.push("DUPLICATE_CLAIMS");
  return {
    flightId: flight._id.toString(),
    totalSeats: flight.totalSeats,
    actualAvailableSeats: flight.availableSeats,
    expectedAvailableSeats: flight.totalSeats - expected.size,
    missingClaims: [...expected].filter((seat) => !actual.has(seat)),
    unexpectedClaims: [...actual].filter((seat) => !expected.has(seat)),
    issues,
    repairable: issues.length === 0,
  };
}

function groupByFlight(rows, field) {
  const groups = new Map();
  for (const row of rows) {
    const key = row[field].toString();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return groups;
}

async function findOrphans(model, field, match = {}) {
  return model.aggregate([
    { $match: match },
    {
      $lookup: {
        from: "flights",
        localField: field,
        foreignField: "_id",
        as: "parent",
      },
    },
    { $match: { "parent.0": { $exists: false } } },
    { $project: { [field]: 1 } },
  ]);
}

export async function inspectSeatInventory() {
  const [flights, orphanedBookings, orphanedClaims] = await Promise.all([
    Flight.find({}).select("totalSeats availableSeats").lean(),
    findOrphans(Booking, "flight", { status: "CONFIRMED" }),
    findOrphans(SeatClaim, "flightId"),
  ]);
  const mismatches = [];
  // Bound claim/booking memory and query count for large flight catalogues.
  for (let offset = 0; offset < flights.length; offset += 200) {
    const batch = flights.slice(offset, offset + 200);
    const ids = batch.map(({ _id }) => _id);
    const [bookings, claims] = await Promise.all([
      Booking.find({ flight: { $in: ids }, status: "CONFIRMED" })
        .select("flight seatCount seatNumbers seatSelectionMode")
        .lean(),
      SeatClaim.find({ flightId: { $in: ids } })
        .select("flightId seatNumber")
        .lean(),
    ]);
    const bookingsByFlight = groupByFlight(bookings, "flight");
    const claimsByFlight = groupByFlight(claims, "flightId");
    for (const flight of batch) {
      const id = flight._id.toString();
      const state = inspectFlightInventory(
        flight,
        bookingsByFlight.get(id) ?? [],
        claimsByFlight.get(id) ?? [],
      );
      if (
        state.issues.length ||
        state.missingClaims.length ||
        state.unexpectedClaims.length ||
        state.actualAvailableSeats !== state.expectedAvailableSeats
      )
        mismatches.push(state);
    }
  }
  return {
    mismatchCount: mismatches.length,
    orphanedBookings,
    orphanedClaims,
    mismatches,
  };
}

export async function repairFlightInventory(flightId) {
  return runBookingTransaction(async (session) => {
    const flight = await Flight.findById(flightId).session(session).lean();
    if (!flight) throw new Error(`Flight ${flightId} no longer exists`);
    const bookings = await Booking.find({
      flight: flightId,
      status: "CONFIRMED",
    })
      .session(session)
      .lean();
    const claims = await SeatClaim.find({ flightId }).session(session).lean();
    const state = inspectFlightInventory(flight, bookings, claims);
    if (!state.repairable)
      throw new Error(
        `Flight ${flightId} cannot be repaired: ${state.issues.join(", ")}`,
      );
    if (state.unexpectedClaims.length)
      await SeatClaim.deleteMany(
        { flightId, seatNumber: { $in: state.unexpectedClaims } },
        { session },
      );
    if (state.missingClaims.length) {
      await SeatClaim.insertMany(
        state.missingClaims.map((seatNumber) => ({ flightId, seatNumber })),
        { session },
      );
    }
    const result = await Flight.updateOne(
      { _id: flightId, availableSeats: flight.availableSeats },
      { $set: { availableSeats: state.expectedAvailableSeats } },
      { session },
    );
    if (result.matchedCount !== 1)
      throw new Error(`Flight ${flightId} changed during repair`);
  });
}
