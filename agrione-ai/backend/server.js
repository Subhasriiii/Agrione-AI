const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const connectDB = require("./config/db");
const errorHandler = require("./middleware/errorHandler");

const app = express();

// Connect Database
connectDB();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// API Routes
app.use("/api/auth", require("./routes/auth"));
app.use("/api/farms", require("./routes/farm"));
app.use("/api/soil", require("./routes/soil"));
app.use("/api/recommendation", require("./routes/recommendation"));
app.use("/api/disease", require("./routes/disease"));
app.use("/api/irrigation", require("./routes/irrigation"));
app.use("/api/yield", require("./routes/yield"));
app.use("/api/risk", require("./routes/risk"));
app.use("/api/profit", require("./routes/profit"));
app.use("/api/weather", require("./routes/weather"));
app.use("/api/simulation", require("./routes/simulation"));
app.use("/api/assistant", require("./routes/assistant"));
app.use("/api/schemes", require("./routes/schemes"));
app.use("/api/market", require("./routes/market"));
app.use("/api/marketplace", require("./routes/marketplace"));
app.use("/api/notifications", require("./routes/notifications"));
app.use("/api/ocr", require("./routes/ocr"));

// Welcome route
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Welcome to AgriOne AI API 🌾",
    endpoints: {
      auth: "/api/auth",
      farms: "/api/farms",
      soil: "/api/soil",
      recommendation: "/api/recommendation",
      disease: "/api/disease",
      irrigation: "/api/irrigation",
      yield: "/api/yield",
      risk: "/api/risk",
      profit: "/api/profit",
      weather: "/api/weather",
      simulation: "/api/simulation",
      assistant: "/api/assistant",
      schemes: "/api/schemes",
      market: "/api/market",
      marketplace: "/api/marketplace",
      notifications: "/api/notifications",
      ocr: "/api/ocr",
    },
  });
});

// Error Handler (must be last)
app.use(errorHandler);

// Server
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`AgriOne AI server running on http://localhost:${PORT}`);
});