import assert from "node:assert/strict";
import { test } from "node:test";
import mongoose from "mongoose";
import {
  seatNumberAt,
  isValidSeatNumber,
} from "../src/services/seatService.js";
import { inspectFlightInventory } from "../src/services/seatInventoryService.js";

test("seat numbering always uses six columns and respects a partial last row", () => {
  assert.deepEqual(
    Array.from({ length: 8 }, (_, index) => seatNumberAt(index)),
    ["1A", "1B", "1C", "1D", "1E", "1F", "2A", "2B"],
  );
  assert.equal(isValidSeatNumber("2B", 8), true);
  for (const seat of ["2C", "1G", "1Z", "01A", "0A", "1AA"]) {
    assert.equal(isValidSeatNumber(seat, 8), false);
  }
});

test("inventory inspection refuses missing historical seats, invalid capacity and duplicate ownership", () => {
  const flight = {
    _id: new mongoose.Types.ObjectId(),
    totalSeats: 8,
    availableSeats: 7,
  };
  const booking = {
    _id: new mongoose.Types.ObjectId(),
    seatCount: 1,
    seatNumbers: ["1A"],
    seatSelectionMode: "AUTO",
  };
  const claims = [{ seatNumber: "1A" }];
  assert.equal(
    inspectFlightInventory(flight, [booking], claims).repairable,
    true,
  );
  const duplicate = inspectFlightInventory(
    flight,
    [booking, { ...booking, _id: new mongoose.Types.ObjectId() }],
    claims,
  );
  assert.equal(duplicate.repairable, false);
  assert.ok(duplicate.issues.includes("DUPLICATE_BOOKING_SEAT:1A"));
  assert.equal(
    inspectFlightInventory(
      flight,
      [{ ...booking, seatNumbers: undefined }],
      claims,
    ).repairable,
    false,
  );
  assert.equal(
    inspectFlightInventory(
      flight,
      [{ ...booking, seatNumbers: ["2C"] }],
      claims,
    ).repairable,
    false,
  );
  assert.equal(
    inspectFlightInventory({ ...flight, totalSeats: 0 }, [booking], claims)
      .repairable,
    false,
  );
});
