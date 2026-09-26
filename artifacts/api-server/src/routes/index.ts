import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
// PARKED (Phase 1, 2026-09-19): AI Travel OS feature, out of scope for current API-Free V1 per Wayora_PRD_Without_APIs. Do not re-enable without explicit instruction.
// import aiRouter from "./ai";
import tripsRouter from "./trips";
import travelRouter from "./travel";
import profileRouter from "./profile";
import packagesRouter from "./packages";
import destinationsRouter from "./destinations";
import bookingsRouter from "./bookings";
import operationsRouter from "./operations";
import vendorsRouter from "./vendors";
import partnersRouter from "./partners";
import customTripsRouter from "./custom-trips";
import financeRouter from "./finance";
import slaRouter from "./sla";
import documentsRouter from "./documents";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(adminRouter);
// PARKED (Phase 1, 2026-09-19): AI Travel OS feature, out of scope for current API-Free V1 per Wayora_PRD_Without_APIs. Do not re-enable without explicit instruction.
// router.use(aiRouter);
router.use(tripsRouter);
router.use(travelRouter);
router.use(profileRouter);
router.use(packagesRouter);
router.use(destinationsRouter);
router.use(bookingsRouter);
router.use(operationsRouter);
router.use(vendorsRouter);
router.use(partnersRouter);
router.use(customTripsRouter);
router.use(financeRouter);
router.use(slaRouter);
router.use(documentsRouter);

export default router;
