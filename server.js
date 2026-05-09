require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const path = require("path");

const app = express();

app.use(cors());
app.use(express.json());

// Serve static files from frontend
app.use(express.static(path.join(__dirname, '../frontend')));

// Serve index.html for root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

const PORT = process.env.PORT || 5000;
const SECRET = process.env.SECRET || "secret123";

/* ================= DB ================= */

mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/todopro")
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => console.log("❌ DB Error:", err.message));

/* ================= MODELS ================= */

const userSchema = new mongoose.Schema({
  username: { type: String, unique: true, trim: true },
  password: String,
}, { timestamps: true });

const taskSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  priority: {
    type: String,
    enum: ["low", "medium", "high"],
    default: "low"
  },
  status: {
    type: String,
    enum: ["todo", "progress", "done"],
    default: "todo"
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  }
}, { timestamps: true });

const User = mongoose.model("User", userSchema);
const Task = mongoose.model("Task", taskSchema);

/* ================= AUTH ================= */

function auth(req, res, next) {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token)
      return res.status(401).json({ message: "No token" });

    const decoded = jwt.verify(token, SECRET);

    req.userId = decoded.userId;

    next();

  } catch {
    res.status(401).json({ message: "Invalid token" });
  }
}

/* ================= AUTH ROUTES ================= */

app.post("/signup", async (req, res, next) => {
  try {
    const { username, password } = req.body;

    if (!username || !password)
      return res.status(400).json({ message: "Missing fields" });

    if (password.length < 5)
      return res.status(400).json({ message: "Password too short" });

    const exists = await User.findOne({ username });

    if (exists)
      return res.status(409).json({ message: "User exists" });

    const hash = await bcrypt.hash(password, 10);

    await User.create({ username, password: hash });

    res.json({ message: "Signup success" });

  } catch (err) {
    next(err);
  }
});

app.post("/login", async (req, res, next) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ username });

    if (!user)
      return res.status(404).json({ message: "User not found" });

    const ok = await bcrypt.compare(password, user.password);

    if (!ok)
      return res.status(401).json({ message: "Wrong password" });

    const token = jwt.sign(
      { userId: user._id.toString() },
      SECRET,
      { expiresIn: "2h" }
    );

    res.json({ token });

  } catch (err) {
    next(err);
  }
});

/* ================= PROFILE ================= */

app.get("/me", auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.userId).select("-password");
    res.json(user);
  } catch (err) {
    next(err);
  }
});

/* ================= TASKS ================= */

app.get("/tasks", auth, async (req, res, next) => {
  try {
    const { search, status, priority } = req.query;

    let filter = { userId: req.userId };

    if (status) filter.status = status;
    if (priority) filter.priority = priority;

    if (search) {
      filter.title = { $regex: search, $options: "i" };
    }

    const tasks = await Task.find(filter).sort({ createdAt: -1 });

    res.json(tasks);

  } catch (err) {
    next(err);
  }
});

app.post("/tasks", auth, async (req, res, next) => {
  try {
    const { title, description, priority, status } = req.body;

    if (!title)
      return res.status(400).json({ message: "Title required" });

    const task = await Task.create({
      title,
      description,
      priority,
      status,
      userId: req.userId
    });

    res.json(task);

  } catch (err) {
    next(err);
  }
});

app.put("/tasks/:id", auth, async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id);

    if (!task)
      return res.status(404).json({ message: "Task not found" });

    if (task.userId.toString() !== req.userId)
      return res.status(403).json({ message: "Unauthorized" });

    Object.assign(task, req.body);

    await task.save();

    res.json(task);

  } catch (err) {
    next(err);
  }
});

app.delete("/tasks/:id", auth, async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id);

    if (!task)
      return res.status(404).json({ message: "Not found" });

    if (task.userId.toString() !== req.userId)
      return res.status(403).json({ message: "Unauthorized" });

    await task.deleteOne();

    res.json({ message: "Deleted" });

  } catch (err) {
    next(err);
  }
});

/* ================= STATS ================= */

app.get("/stats", auth, async (req, res, next) => {
  try {
    const tasks = await Task.find({ userId: req.userId });

    const stats = {
      total: tasks.length,
      todo: tasks.filter(t => t.status === "todo").length,
      progress: tasks.filter(t => t.status === "progress").length,
      done: tasks.filter(t => t.status === "done").length,
      high: tasks.filter(t => t.priority === "high").length
    };

    res.json(stats);

  } catch (err) {
    next(err);
  }
});

/* ================= ERROR HANDLER ================= */

app.use((err, req, res, next) => {
  console.error("🔥 ERROR:", err);
  res.status(500).json({ message: "Server Error" });
});

/* ================= SERVER ================= */

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});