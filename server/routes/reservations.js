import express from "express";
import { poolPromise, sqlTypes } from "../db.js";

const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .query(
        `SELECT r.id, r.car_id, r.user_name, r.start_time, r.end_time, r.uwagi, c.name AS car_name
         FROM Reservations AS r
         LEFT JOIN Cars AS c ON r.car_id = c.id
         ORDER BY r.start_time`
      );

    res.json(
      result.recordset.map((row) => ({
        ...row,
        Cars: { name: row.car_name },
      }))
    );
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const { car_id, user_name, start_time, end_time, uwagi } = req.body;
    const pool = await poolPromise;
    await pool
      .request()
      .input("car_id", sqlTypes.Int, car_id)
      .input("user_name", sqlTypes.NVarChar(255), user_name)
      .input("start_time", sqlTypes.DateTime2, start_time)
      .input("end_time", sqlTypes.DateTime2, end_time)
      .input("uwagi", sqlTypes.NVarChar(sqlTypes.MAX), uwagi)
      .query(
        `INSERT INTO Reservations (car_id, user_name, start_time, end_time, uwagi)
         VALUES (@car_id, @user_name, @start_time, @end_time, @uwagi)`
      );

    res.status(201).json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.patch("/:id/time", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { start_time, end_time } = req.body;
    const pool = await poolPromise;
    await pool
      .request()
      .input("id", sqlTypes.Int, id)
      .input("start_time", sqlTypes.DateTime2, start_time)
      .input("end_time", sqlTypes.DateTime2, end_time)
      .query(
        `UPDATE Reservations SET start_time = @start_time, end_time = @end_time WHERE id = @id`
      );

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.patch("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { start_time, end_time, uwagi } = req.body;
    const pool = await poolPromise;
    await pool
      .request()
      .input("id", sqlTypes.Int, id)
      .input("start_time", sqlTypes.DateTime2, start_time)
      .input("end_time", sqlTypes.DateTime2, end_time)
      .input("uwagi", sqlTypes.NVarChar(sqlTypes.MAX), uwagi)
      .query(
        `UPDATE Reservations SET start_time = @start_time, end_time = @end_time, uwagi = @uwagi WHERE id = @id`
      );

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const pool = await poolPromise;
    await pool.request().input("id", sqlTypes.Int, id).query(`DELETE FROM Reservations WHERE id = @id`);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.post("/conflict", async (req, res, next) => {
  try {
    const { car_id, start_time, end_time, exclude_id } = req.body;
    const pool = await poolPromise;
    const request = pool
      .request()
      .input("car_id", sqlTypes.Int, car_id)
      .input("start_time", sqlTypes.DateTime2, start_time)
      .input("end_time", sqlTypes.DateTime2, end_time);

    if (exclude_id) {
      request.input("exclude_id", sqlTypes.Int, exclude_id);
    }

    const query = exclude_id
      ? `SELECT TOP 1 id FROM Reservations WHERE car_id = @car_id AND start_time < @end_time AND end_time > @start_time AND id <> @exclude_id`
      : `SELECT TOP 1 id FROM Reservations WHERE car_id = @car_id AND start_time < @end_time AND end_time > @start_time`;

    const result = await request.query(query);
    res.json({ conflict: result.recordset.length > 0 });
  } catch (error) {
    next(error);
  }
});

export default router;
