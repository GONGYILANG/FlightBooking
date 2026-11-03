import mongoose from "mongoose";

const seatClaimSchema = new mongoose.Schema(
  {
    flightId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Flight",
      required: true,
    },
    seatNumber: { type: String, required: true, match: /^[1-9]\d*[A-F]$/ },
  },
  { collection: "seatClaims", versionKey: false },
);

seatClaimSchema.index(
  { flightId: 1, seatNumber: 1 },
  { unique: true, name: "unique_flight_seat_claim" },
);

export default mongoose.model("SeatClaim", seatClaimSchema);
