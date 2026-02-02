const express = require("express");
const mongoose = require("mongoose");
require("dotenv").config();

const companyRoutes = require("./src/routes/company.routes");

const app = express();
const port = 3000;

// Middleware
app.use(express.json());

// Routes
app.use("/", companyRoutes);

app.get("/", (req, res) => {
  res.send("Server is running");
});

// Connect to MongoDB
const mongoUri = process.env.MONGO_URI;
const dbName = process.env.USER_NAME;
const dbPass = process.env.USER_PASS;

let connectionString;

if (mongoUri) {
  connectionString = mongoUri;
} else {
  connectionString = `mongodb+srv://${dbName}:${dbPass}@extensiondb.bguws1h.mongodb.net/?appName=ExtensionDB`;
}

mongoose
  .connect(connectionString)
  .then(() => {
    console.info(`[DB] Connected to MongoDB`);
    app.listen(port, () => {
      console.info(`[SERVER] Listening on port ${port}`);
    });
  })
  .catch((err) => console.error("[DB] Connection Error:", err));
