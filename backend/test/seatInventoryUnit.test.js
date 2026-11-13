import assert from "node:assert/strict";
import { test } from "node:test";
import {
  seatNumberAt,
  isValidSeatNumber,
} from "../src/services/seatService.js";

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
