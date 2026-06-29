import sql from "mssql";
import dotenv from "dotenv";

dotenv.config();

const config = {
  user: process.env.MSSQL_USER || "<MSSQL_USER>",
  password: process.env.MSSQL_PASSWORD || "<MSSQL_PASSWORD>",
  server: process.env.MSSQL_HOST || "<MSSQL_HOST>",
  port: Number(process.env.MSSQL_PORT || 1433),
  database: process.env.MSSQL_DATABASE || "<MSSQL_DATABASE>",
  options: {
    encrypt: process.env.MSSQL_ENCRYPT === "true",
    trustServerCertificate: process.env.MSSQL_TRUST_CERT === "true",
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

export const poolPromise = new sql.ConnectionPool(config)
  .connect()
  .then((pool) => {
    console.log("Połączono z SQL Server.");
    return pool;
  })
  .catch((error) => {
    console.error("Błąd połączenia z SQL Server:", error);
    throw error;
  });

export function createSqlParameter(request, name, type, value) {
  request.input(name, type, value);
}

export const sqlTypes = sql.TYPES;
