const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const { Pool } = require("pg");
const bcrypt = require("bcrypt");
require("dotenv").config();

const app = express();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
});

app.use(bodyParser.json());
app.use(cors());

// その他のエンドポイント...

app.get("/statuses", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM status");
    res.status(200).json(result.rows);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post("/statuses", async (req, res) => {
  const { name } = req.body;
  try {
    const result = await pool.query(
      "INSERT INTO status (name) VALUES ($1) RETURNING *",
      [name]
    );
    res.status(201).json({ success: true, status: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.put("/statuses/:id", async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  try {
    const result = await pool.query(
      "UPDATE status SET name = $1 WHERE id = $2 RETURNING *",
      [name, id]
    );
    res.status(200).json({ success: true, status: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.delete("/statuses/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query("DELETE FROM status WHERE id = $1", [id]);
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.listen(3000, () => {
  console.log("Server is running on port 3000");
});
