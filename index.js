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

// 初期化用のSQLクエリ
const initQueries = `
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(255) NOT NULL,
    password VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS status (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS incidents (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    subject VARCHAR(255) NOT NULL,
    occurrence_date DATE NOT NULL,
    content TEXT NOT NULL,
    threat_type VARCHAR(255) NOT NULL,
    status_id INTEGER NOT NULL REFERENCES status(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS incident_updates (
    id SERIAL PRIMARY KEY,
    incident_id INTEGER NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    update_content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO status (name) VALUES ('Open') ON CONFLICT (name) DO NOTHING;
INSERT INTO status (name) VALUES ('In Progress') ON CONFLICT (name) DO NOTHING;
INSERT INTO status (name) VALUES ('Closed') ON CONFLICT (name) DO NOTHING;
`;

app.post("/initialize", async (req, res) => {
  try {
    await pool.query(initQueries);
    res
      .status(200)
      .json({ success: true, message: "Database initialized successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

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
  const { userId, subject, occurrenceDate, content, threatType, statusId } =
    req.body;
  try {
    const result = await pool.query(
      "INSERT INTO incidents (user_id, subject, occurrence_date, content, threat_type, status_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
      [userId, subject, occurrenceDate, content, threatType, statusId]
    );
    res.status(201).json({ success: true, incident: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get("/incidents", async (req, res) => {
  const { subject } = req.query;
  try {
    let query;
    let values;
    if (subject) {
      query = `SELECT incidents.*, status.name as status
               FROM incidents
               JOIN status ON incidents.status_id = status.id
               WHERE subject ILIKE $1`;
      values = [`%${subject}%`];
    } else {
      query = `SELECT incidents.*, status.name as status
               FROM incidents
               JOIN status ON incidents.status_id = status.id`;
      values = [];
    }
    const result = await pool.query(query, values);
    res.status(200).json(result.rows);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get("/incidents/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `SELECT incidents.*, status.name as status
       FROM incidents
       JOIN status ON incidents.status_id = status.id
       WHERE incidents.id = $1`,
      [id]
    );
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
