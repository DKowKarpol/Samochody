import express from "express";
import { poolPromise, sqlTypes } from "../db.js";

const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query("SELECT id, name FROM Cars ORDER BY name");
    res.json(result.recordset);
  } catch (error) {
    next(error);
  }
});

export default router;
