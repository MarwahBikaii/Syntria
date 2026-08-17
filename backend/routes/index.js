import express from "express";
import initiativeRoutes from "./initiative.routes.js";
import issueRoutes from "./issue.routes.js";
import userRoutes from "./user.routes.js";
import authRoutes from "./auth.routes.js";
import resourceRoutes from "./resource.routes.js";
import contributionOfferRoutes from "./contribution-offer.routes.js";
import workItemsRoutes from "./workItems.routes.js";
import resourceRequestsRoutes from "./resource-request.routes.js"
const router = express.Router();

router.get("/health", (req, res) => {
  return res.status(200).json({
    success: true,
    message: "Syntria API is healthy.",
    timestamp: new Date().toISOString(),
  });
});

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/issues", issueRoutes);
router.use("/initiatives", initiativeRoutes);
router.use("/resources", resourceRoutes);
router.use("/resourceRequests", resourceRequestsRoutes);
router.use("/workItems", workItemsRoutes);
router.use("/contributionOffers", contributionOfferRoutes);
export default router;