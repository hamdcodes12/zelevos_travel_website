import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import aiRouter from "./ai";
import tripsRouter from "./trips";
import travelRouter from "./travel";
import profileRouter from "./profile";
import operationsRouter from "./operations";
import adminRouter from "./admin";
import travelpayoutsRouter from "./travelpayouts";
import flightDataRouter from "./flight-data";
import ignavRouter from "./ignav";
import hotelbedsRouter from "./hotelbeds";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(aiRouter);
router.use(tripsRouter);
router.use(travelRouter);
router.use(profileRouter);
router.use(operationsRouter);
router.use(adminRouter);
router.use(travelpayoutsRouter);
router.use(flightDataRouter);
router.use(ignavRouter);
router.use(hotelbedsRouter);

export default router;
