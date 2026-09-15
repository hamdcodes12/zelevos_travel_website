import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import aiRouter from "./ai";
import tripsRouter from "./trips";
import travelRouter from "./travel";
import profileRouter from "./profile";
import operationsRouter from "./operations";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(aiRouter);
router.use(tripsRouter);
router.use(travelRouter);
router.use(profileRouter);
router.use(operationsRouter);
router.use(adminRouter);

export default router;
