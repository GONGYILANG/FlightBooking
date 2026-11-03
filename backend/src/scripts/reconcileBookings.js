import "dotenv/config";
import { connectDatabase, disconnectDatabase } from "../config/database.js";
import {
  inspectSeatInventory,
  repairFlightInventory,
} from "../services/seatInventoryService.js";

const applyChanges = process.argv.includes("--apply");

try {
  if (applyChanges && process.env.BOOKING_WRITES_PAUSED !== "true") {
    throw new Error(
      "--apply requires BOOKING_WRITES_PAUSED=true and a maintenance window with Booking writes actually paused",
    );
  }
  const connection = await connectDatabase();
  const report = await inspectSeatInventory();
  console.log(
    JSON.stringify(
      {
        database: connection.name,
        mode: applyChanges ? "APPLY" : "REPORT_ONLY",
        ...report,
      },
      null,
      2,
    ),
  );
  if (applyChanges) {
    if (
      report.orphanedBookings.length ||
      report.orphanedClaims.length ||
      report.mismatches.some((state) => !state.repairable)
    ) {
      throw new Error(
        "Repair stopped: resolve orphaned records, invalid capacities or invalid/duplicate booking seats first",
      );
    }
    for (const state of report.mismatches)
      await repairFlightInventory(state.flightId);
    const after = await inspectSeatInventory();
    if (
      after.mismatchCount ||
      after.orphanedBookings.length ||
      after.orphanedClaims.length
    ) {
      throw new Error("Seat inventory reconciliation did not converge");
    }
    console.log(
      `Repaired and verified ${report.mismatchCount} flight inventory record(s)`,
    );
  } else {
    console.log(
      "No changes applied. Pause Booking writes, then use --apply with BOOKING_WRITES_PAUSED=true.",
    );
  }
} catch (error) {
  console.error("Booking reconciliation failed:", error.message);
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
