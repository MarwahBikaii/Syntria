import express from "express";

const router = express.Router();
import {getOrganizations } from "../controllers/organizations.controller.js"

router.get("/",
  getOrganizations)

export default router;