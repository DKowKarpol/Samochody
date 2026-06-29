import express from "express";
import cors from "cors";
import reservationsRoutes from "./routes/reservations.js";
import carsRoutes from "./routes/cars.js";

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use("/api/reservations", reservationsRoutes);
app.use("/api/cars", carsRoutes);

app.use((req, res) => {
  res.status(404).json({ error: "Nie znaleziono endpointu." });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || "Błąd serwera." });
});

app.listen(port, () => {
  console.log(`SQL Server backend uruchomiony na http://localhost:${port}`);
});
