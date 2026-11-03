const path = require("path");

const credentials = process.env.PGHOST
  ? {
      host: process.env.PGHOST,
      port: Number(process.env.PGPORT ?? 5432),
      user: process.env.PGUSER,
      password: process.env.PGPASSWORD,
      database: process.env.PGDATABASE,
      ssl: false,
    }
  : {
      url: "postgresql://postgres:postgres@localhost:5432/postgres",
      ssl: false,
    };

/** @type {import("drizzle-kit").Config} */
module.exports = {
  schema: path.join(__dirname, "./src/schema/*.ts").replace(/\\/g, "/"),
  dialect: "postgresql",
  dbCredentials: credentials,
};
