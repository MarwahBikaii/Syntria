const express = require("express");

const {
  createInitiative,
  getInitiatives,
  getInitiativeById,
} = require("../controllers/initiative.controller");

const router = express.Router();

router.route("/").get(getInitiatives).post(createInitiative);

router.get("/:initiativeId", getInitiativeById);

module.exports = router;