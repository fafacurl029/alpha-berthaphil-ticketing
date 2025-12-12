const path = require("path");
const express = require("express");
const helmet = require("helmet");
const morgan = require("morgan");

const authRoutes = require("./routes/auth.routes");
const bootstrapRoutes = require("./routes/bootstrap.routes");
const usersRoutes = require("./routes/users.routes");
const ticketsRoutes = require("./routes/tickets.routes");

function createApp() {
  const app = express();

  app.use(helmet({
    contentSecurityPolicy: false // keep simple for static assets
  }));
  app.use(morgan("tiny"));
  app.use(express.json({ limit: "1mb" }));

  // API
  app.get("/api/health", (req, res) => res.json({ ok: true, name: "Alpha berthaphil Ticketing", time: new Date().toISOString() }));
  app.use("/api/auth", authRoutes);
  app.use("/api/bootstrap", bootstrapRoutes);
  app.use("/api/users", usersRoutes);
  app.use("/api/tickets", ticketsRoutes);

  // Static frontend
  const publicDir = path.join(__dirname, "..", "public");
  app.use(express.static(publicDir));

  // Default route
  app.get("/", (req, res) => res.sendFile(path.join(publicDir, "index.html")));

  return app;
}

module.exports = { createApp };
