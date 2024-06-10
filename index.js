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
});

app.use(bodyParser.json());
app.use(cors());

app.post("/register", async (req, res) => {
  const { userId, username, password } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      "INSERT INTO users (user_id, username, password) VALUES ($1, $2, $3) RETURNING *",
      [userId, username, hashedPassword]
    );
    res.status(201).json({ success: true, user: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post("/login", async (req, res) => {
  const { userId, password } = req.body;
  try {
    const result = await pool.query("SELECT * FROM users WHERE user_id = $1", [
      userId,
    ]);
    if (result.rows.length > 0) {
      const user = result.rows[0];
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (isValidPassword) {
        res.status(200).json({ success: true, user });
      } else {
        res
          .status(401)
          .json({ success: false, message: "Invalid credentials" });
      }
    } else {
      res.status(401).json({ success: false, message: "Invalid credentials" });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post("/incidents", async (req, res) => {
  const { userId, subject, occurrenceDate, content, threatType, status } =
    req.body;
  try {
    const result = await pool.query(
      "INSERT INTO incidents (user_id, subject, occurrence_date, content, threat_type, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
      [userId, subject, occurrenceDate, content, threatType, status]
    );
    res.status(201).json({ success: true, incident: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get("/incidents", async (req, res) => {
  const { subject } = req.query;
  try {
    const result = await pool.query(
      "SELECT * FROM incidents WHERE subject ILIKE $1",
      [`%${subject}%`]
    );
    res.status(200).json(result.rows);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get("/incidents/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query("SELECT * FROM incidents WHERE id = $1", [
      id,
    ]);
    const incident = result.rows[0];
    const updatesResult = await pool.query(
      "SELECT * FROM incident_updates WHERE incident_id = $1",
      [id]
    );
    incident.updates = updatesResult.rows;
    res.status(200).json(incident);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post("/incidents/:id/updates", async (req, res) => {
  const { id } = req.params;
  const { updateContent } = req.body;
  try {
    const result = await pool.query(
      "INSERT INTO incident_updates (incident_id, update_content) VALUES ($1, $2) RETURNING *",
      [id, updateContent]
    );
    res.status(201).json({ success: true, update: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.delete("/incidents/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query("DELETE FROM incidents WHERE id = $1", [id]);
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.listen(3000, () => {
  console.log("Server is running on port 3000");
  console.log(process.env.DB_HOST);
});
