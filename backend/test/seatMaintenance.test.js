import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import mongoose from "mongoose";
import {
  testDatabaseName,
  developmentDatabaseName,
} from "../src/scripts/testDatabase.js";
import { connectDatabase, disconnectDatabase } from "../src/config/database.js";
import Booking from "../src/models/Booking.js";
import Flight from "../src/models/Flight.js";
import SeatClaim from "../src/models/SeatClaim.js";

function runScript(script, apply = false, paused = false) {
  const result = spawnSync(
    process.execPath,
    [`src/scripts/${script}.js`, ...(apply ? ["--apply"] : [])],
    {
      encoding: "utf8",
      timeout: 30000,
      env: {
        ...process.env,
        NODE_ENV: "test",
        MONGODB_DB_NAME: testDatabaseName,
        BOOKING_WRITES_PAUSED: paused ? "true" : "false",
      },
    },
  );
  if (result.error) throw result.error;
  return result;
}

test("maintenance reports mismatches without changing flights and repairs only under the write pause", async () => {
  const connection = await connectDatabase();
  assert.equal(connection.name, testDatabaseName);
  assert.notEqual(connection.name, developmentDatabaseName);
  const flightId = new mongoose.Types.ObjectId();
  let bookingId;
  try {
    await Flight.collection.insertOne({
      _id: flightId,
      totalSeats: 8,
      availableSeats: 2,
      status: "SCHEDULED",
    });
    const booking = await Booking.create({
      bookingReference: `BK${flightId.toHexString().slice(-12)}`,
      user: new mongoose.Types.ObjectId(),
      flight: flightId,
      seatCount: 1,
      seatNumbers: ["1A"],
      seatSelectionMode: "AUTO",
      source: "AI",
      status: "CONFIRMED",
      idempotencyKey: "00000000-0000-4000-8000-000000000001",
      priceSnapshot: {
        unitPriceCents: 100,
        totalPriceCents: 100,
        currency: "USD",
      },
    });
    bookingId = booking._id;
    await SeatClaim.create({ flightId, seatNumber: "1C" });
    const report = runScript("reconcileBookings");
    assert.equal(report.status, 0, report.stderr);
    assert.equal((await Flight.findById(flightId)).availableSeats, 2);
    assert.equal(
      await SeatClaim.countDocuments({ flightId, seatNumber: "1C" }),
      1,
    );
    const unpaused = runScript("reconcileBookings", true);
    assert.equal(unpaused.status, 1);
    assert.match(unpaused.stderr, /BOOKING_WRITES_PAUSED/);
    const repaired = runScript("reconcileBookings", true, true);
    assert.equal(repaired.status, 0, repaired.stderr);
    assert.equal((await Flight.findById(flightId)).availableSeats, 7);
    assert.deepEqual(
      (await SeatClaim.find({ flightId }).lean()).map(
        ({ seatNumber }) => seatNumber,
      ),
      ["1A"],
    );
    await Flight.updateOne(
      { _id: flightId },
      { $set: { status: "CANCELLED" } },
    );
    const cancellationRepair = runScript(
      "reconcileAdminCancellations",
      true,
      true,
    );
    assert.equal(cancellationRepair.status, 0, cancellationRepair.stderr);
    assert.equal((await Booking.findById(bookingId)).status, "CANCELLED");
    assert.equal(await SeatClaim.countDocuments({ flightId }), 0);
    assert.equal((await Flight.findById(flightId)).availableSeats, 8);
  } finally {
    await SeatClaim.deleteMany({ flightId });
    await Booking.deleteMany({ flight: flightId });
    await Flight.deleteOne({ _id: flightId });
    await disconnectDatabase();
  }
});
