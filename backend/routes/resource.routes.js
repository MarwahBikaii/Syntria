const express = require("express");

const router = express.Router();

router.get("/", (req, res) => {
  res.status(501).json({
    success: false,
    message: "Resource listing is not implemented yet.",
  });
});

module.exports = router;