import { Router } from "express";
import { getFlightSeats } from "../services/seatService.js";
import {
  getFlightById,
  searchFlights,
} from "../services/flightService.js";
import {
  validateFlightId,
  validateFlightSearch,
} from "../validators/flightValidators.js";

const router = Router();

router.get("/search", validateFlightSearch, async (request, response) => {
  response.json({ data: await searchFlights(request.validatedQuery) });
});
router.get("/:flightId/seats", validateFlightId, async (request, response) => {
  response.json({ data: await getFlightSeats(request.params.flightId) });
});
router.get("/:flightId", validateFlightId, async (request, response) => {
  response.json({
    data: { flight: await getFlightById(request.params.flightId) },
  });
});

export default router;
