import { Router, type IRouter } from "express";
import {
  checkTravelpayoutsConnection,
  getTravelpayoutsConfig,
  TravelpayoutsError,
} from "../services/travelpayouts";

const router: IRouter = Router();

router.get("/travelpayouts/health", async (_req, res): Promise<void> => {
  if (!getTravelpayoutsConfig().apiToken) {
    res.status(503).json({
      connected: false,
      provider: "travelpayouts",
      service: "aviasales-data-api",
    });
    return;
  }

  try {
    res.json(await checkTravelpayoutsConnection());
  } catch (error) {
    if (error instanceof TravelpayoutsError) {
      res.status(error.statusCode).json({
        connected: false,
        provider: "travelpayouts",
        service: "aviasales-data-api",
      });
      return;
    }
    res.status(502).json({
      connected: false,
      provider: "travelpayouts",
      service: "aviasales-data-api",
    });
  }
});

export default router;
