const API = "http://localhost:5000";

/* ================= HELPERS ================= */

const el = (id) => document.getElementById(id);
const getToken = () => localStorage.getItem("token");

/* ================= TOAST ================= */

function toast(msg, type = "info") {
  const t = document.createElement("div");

  t.innerText = msg;

  Object.assign(t.style, {
    position: "fixed",
    bottom: "20px",
    right: "20px",
    padding: "10px 14px",
    borderRadius: "10px",
    color: "white",
    zIndex: 9999,
    fontSize: "14px",
    background:
      type === "error" ? "#ef4444" :
      type === "success" ? "#22c55e" :
      "#3b82f6"
  });

  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2200);
}

/* ================= AUTH ================= */

function login() {
  const u = getValue("username");
  const p = getValue("password");

  if (!u || !p) {
    setMsg("Enter username & password ⚠️", "red");
    return;
  }

  setLoading(true);
  setMsg("Logging in...", "white");

  setTimeout(() => {
    const data = localStorage.getItem(u);

    if (!data) {
      setMsg("User not found ❌", "red");
      setLoading(false);
      return;
    }

    const user = JSON.parse(data);

    if (user.password === p) {
      setMsg("Login successful ✅", "lightgreen");

      // ✅ store session
      localStorage.setItem("currentUser", u);

      // ✅ FORCE REDIRECT (no delay)
      window.location.href = "dashboard.html";

    } else {
      setMsg("Wrong password ❌", "red");
    }

    setLoading(false);
  }, 500);
}
/* ================= STATE ================= */

let TASKS = [];
let FILTER = "all";

/* ================= LOAD ================= */

async function loadTasks() {
  const board = el("taskList");
  const loader = el("loader");

  if (!board) return;

  loader.style.display = "block";
  board.innerHTML = "";

  try {
    const res = await fetch(API + "/tasks", {
      headers: {
        Authorization: "Bearer " + getToken()
      }
    });

    if (!res.ok) throw new Error();

    TASKS = await res.json();

    renderTasks();

  } catch {
    toast("Failed to load tasks", "error");
  }

  loader.style.display = "none";
}

/* ================= RENDER ================= */

function renderTasks() {
  const board = el("taskList");
  const empty = el("emptyState");

  if (!board) return;

  const search = el("search")?.value?.toLowerCase() || "";

  board.innerHTML = "";

  let filtered = TASKS.filter(t =>
    t.title.toLowerCase().includes(search)
  );

  if (FILTER === "completed") {
    filtered = filtered.filter(t => t.status === "done");
  } else if (FILTER === "pending") {
    filtered = filtered.filter(t => t.status !== "done");
  }

  if (!filtered.length) {
    if (empty) empty.style.display = "block";
    return;
  }

  if (empty) empty.style.display = "none";

  filtered.forEach(task => {
    const div = document.createElement("div");

    div.className = `task ${task.status === "done" ? "completed" : ""}`;

    div.innerHTML = `
      <h3>${task.title}</h3>
      <p>${task.description || ""}</p>

      <span class="badge">${task.priority || "low"}</span>

      <div class="actions">
        <button data-id="${task._id}" class="toggle">
          ${task.status === "done" ? "Undo" : "Done"}
        </button>

        <button data-id="${task._id}" class="edit">Edit</button>
        <button data-id="${task._id}" class="delete">Delete</button>
      </div>
    `;

    board.appendChild(div);
  });
}

/* ================= EVENTS (CLEAN WAY) ================= */

document.addEventListener("click", async (e) => {
  const id = e.target.dataset.id;

  if (!id) return;

  if (e.target.classList.contains("delete")) {
    deleteTask(id);
  }

  if (e.target.classList.contains("toggle")) {
    const task = TASKS.find(t => t._id === id);
    toggleDone(id, task.status);
  }

  if (e.target.classList.contains("edit")) {
    editTask(id);
  }
});

/* ================= FILTER ================= */

function setFilter(type, btn) {
  FILTER = type;

  document.querySelectorAll(".filters button")
    .forEach(b => b.classList.remove("active"));

  btn.classList.add("active");

  renderTasks();
}

/* ================= ADD TASK ================= */

async function addTask() {
  const input = el("taskInput");
  const title = input?.value?.trim();

  if (!title) return toast("Enter task", "error");

  try {
    const res = await fetch(API + "/tasks", {
      method: "POST",
      headers: {
        "Content-Type":"application/json",
        Authorization:"Bearer "+getToken()
      },
      body: JSON.stringify({
        title,
        priority: "low",
        status: "todo"
      })
    });

    if (!res.ok) throw new Error();

    const task = await res.json();

    TASKS.unshift(task);

    input.value = "";

    renderTasks();

    toast("Task added ✔", "success");

  } catch {
    toast("Failed to add task", "error");
  }
}

/* ================= DELETE ================= */

async function deleteTask(id) {
  const old = [...TASKS];

  TASKS = TASKS.filter(t => t._id !== id);
  renderTasks();

  try {
    const res = await fetch(API + "/tasks/" + id, {
      method: "DELETE",
      headers: {
        Authorization:"Bearer "+getToken()
      }
    });

    if (!res.ok) throw new Error();

    toast("Deleted ✔", "success");

  } catch {
    TASKS = old;
    renderTasks();
    toast("Delete failed", "error");
  }
}

/* ================= TOGGLE ================= */

async function toggleDone(id, status) {
  const task = TASKS.find(t => t._id === id);
  if (!task) return;

  const oldStatus = task.status;
  const newStatus = status === "done" ? "todo" : "done";

  task.status = newStatus;
  renderTasks();

  try {
    const res = await fetch(API + "/tasks/" + id, {
      method: "PUT",
      headers: {
        "Content-Type":"application/json",
        Authorization:"Bearer "+getToken()
      },
      body: JSON.stringify({ status: newStatus })
    });

    if (!res.ok) throw new Error();

  } catch {
    task.status = oldStatus;
    renderTasks();
    toast("Update failed", "error");
  }
}

/* ================= EDIT ================= */

async function editTask(id) {
  const task = TASKS.find(t => t._id === id);

  const title = prompt("Edit task", task.title);
  if (!title) return;

  const oldTitle = task.title;
  task.title = title;

  renderTasks();

  try {
    const res = await fetch(API + "/tasks/" + id, {
      method: "PUT",
      headers: {
        "Content-Type":"application/json",
        Authorization:"Bearer "+getToken()
      },
      body: JSON.stringify({ title })
    });

    if (!res.ok) throw new Error();

    toast("Updated ✔", "success");

  } catch {
    task.title = oldTitle;
    renderTasks();
    toast("Update failed", "error");
  }
}

/* ================= LOGOUT ================= */

function logout() {
  localStorage.removeItem("token");
  window.location.href = "index.html";
}

/* ================= INIT ================= */

if (window.location.pathname.includes("dashboard")) {
  if (!getToken()) {
    window.location.href = "index.html";
  } else {
    loadTasks();
    el("search")?.addEventListener("input", renderTasks);
  }
}