import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import reservationsRoutes from "./routes/reservations.js";
import carsRoutes from "./routes/cars.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use("/api/reservations", reservationsRoutes);
app.use("/api/cars", carsRoutes);

// Error logging endpoint
app.post("/api/error-log", (req, res) => {
  try {
    const { timestamp, context, message, stack, url, userAgent } = req.body;
    // Log file zawsze w folderze bazowym projektu, niezależnie od lokalizacji
    const logFile = path.resolve(__dirname, "..", "error_log.txt");
    
    const logEntry = `
${new Date().toISOString()} - ERROR LOG
Context: ${context}
Message: ${message}
Stack: ${stack}
URL: ${url}
UserAgent: ${userAgent}
Timestamp: ${timestamp}
---
`;

    fs.appendFileSync(logFile, logEntry, "utf8");
    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error writing to error log:", error);
    res.status(500).json({ error: "Failed to log error" });
  }
});

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
