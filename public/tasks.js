// Tasks — backed by the database via API
let tasks = [];

const tableBody = document.getElementById("taskTableBody");
const noResults = document.getElementById("noResults");
const searchInput = document.getElementById("searchInput");
const confirmation = document.getElementById("confirmation");

const modalOverlay = document.getElementById("modalOverlay");
const createTaskBtn = document.getElementById("createTaskBtn");
const cancelBtn = document.getElementById("cancelBtn");
const saveTaskBtn = document.getElementById("saveTaskBtn");

const assignRole = document.getElementById("assignRole");
const taskName = document.getElementById("taskName");
const taskDesc = document.getElementById("taskDesc");
const taskDate = document.getElementById("taskDate");
const taskTime = document.getElementById("taskTime");

const errAssign = document.getElementById("errAssign");
const errName = document.getElementById("errName");
const errDate = document.getElementById("errDate");
const errTime = document.getElementById("errTime");

// ----- Helpers -----

function formatDateTime(dateStr, timeStr) {
  if (!dateStr) return "";

  let d;

  // SQL DATE serializes as a full ISO string like "2026-06-20T00:00:00.000Z"
  if (dateStr.includes('T')) {
    d = new Date(dateStr);
  } else if (timeStr) {
    // Plain YYYY-MM-DD + time — strip subseconds if present
    const cleanTime = timeStr.includes('.') ? timeStr.split('.')[0] : timeStr;
    d = new Date(`${dateStr}T${cleanTime}`);
  } else {
    d = new Date(dateStr);
  }

  if (isNaN(d.getTime())) return "";

  return d.toLocaleString(undefined, {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit"
  });
}

function renderTable(list) {
  tableBody.innerHTML = "";

  if (list.length === 0) {
    noResults.classList.remove("hidden");
    return;
  }
  noResults.classList.add("hidden");

  list.forEach(task => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><span class="role-tag">${task.Role || task.role}</span></td>
      <td>${task.Username || task.username}</td>
      <td>${task.TaskName || task.name}</td>
      <td>${(task.Description || task.desc) ? (task.Description || task.desc) : "—"}</td>
      <td>${formatDateTime(task.TaskDate || task.date, task.TaskTime || task.time)}</td>
    `;
    tableBody.appendChild(tr);
  });
}

function applySearch() {
  const term = searchInput.value.trim().toLowerCase();
  if (!term) {
    renderTable(tasks);
    return;
  }
  const filtered = tasks.filter(t => {
    const name = (t.TaskName || t.name || "").toLowerCase();
    const user = (t.Username || t.username || "").toLowerCase();
    const desc = (t.Description || t.desc || "").toLowerCase();
    return name.includes(term) || user.includes(term) || desc.includes(term);
  });
  renderTable(filtered);
}

searchInput.addEventListener("input", applySearch);

// ----- Modal -----

function openModal() {
  modalOverlay.style.display = "flex";
}

function closeModal() {
  modalOverlay.style.display = "none";
  assignRole.value = "";
  taskName.value = "";
  taskDesc.value = "";
  taskDate.value = "";
  taskTime.value = "";
  [errAssign, errName, errDate, errTime].forEach(e => {
    e.classList.add("hidden");
    e.textContent = ""; // reset any custom message
  });
}

createTaskBtn.addEventListener("click", openModal);
cancelBtn.addEventListener("click", closeModal);
modalOverlay.addEventListener("click", (e) => {
  if (e.target === modalOverlay) closeModal();
});

// ----- Load users into the dropdown -----

async function loadUsers() {
  try {
    const res = await fetch('http://localhost:4001/members');
    const data = await res.json();

    if (!res.ok || !data.success) throw new Error(data.error || 'Failed');

    const users = data.members || [];
    assignRole.innerHTML = '<option value="">Select user</option>';
    users.forEach(u => {
      const opt = document.createElement('option');
      opt.value = `${u.role}|${u.username}`;
      opt.textContent = `${u.role.charAt(0).toUpperCase() + u.role.slice(1)} — ${u.username}`;
      assignRole.appendChild(opt);
    });
  } catch (err) {
    console.error('Could not load users:', err);
    // Leave the select with just the default option
  }
}

// ----- Fetch tasks from server -----

async function loadTasks() {
  try {
    const res = await fetch('http://localhost:4001/tasks');
    const data = await res.json();

    if (!res.ok || !data.success) throw new Error(data.error || 'Failed');

    tasks = data.tasks || [];
  } catch (err) {
    console.error('Could not load tasks:', err);
    tasks = [];
  }
  renderTable(tasks);
}

// ----- Save task to server -----

function isPast(dateStr, timeStr) {
  const selected = new Date(`${dateStr}T${timeStr}`);
  return selected.getTime() < Date.now();
}

saveTaskBtn.addEventListener("click", async () => {
  let valid = true;

  [errAssign, errName, errDate, errTime].forEach(e => {
    e.classList.add("hidden");
    e.textContent = "";
  });

  if (!assignRole.value) {
    errAssign.classList.remove("hidden");
    valid = false;
  }
  if (!taskName.value.trim()) {
    errName.classList.remove("hidden");
    valid = false;
  }
  if (!taskDate.value) {
    errDate.classList.remove("hidden");
    valid = false;
  }
  if (!taskTime.value) {
    errTime.classList.remove("hidden");
    valid = false;
  }

  if (valid && taskDate.value && taskTime.value && isPast(taskDate.value, taskTime.value)) {
    errDate.textContent = "Date/time cannot be in the past.";
    errDate.classList.remove("hidden");
    valid = false;
  }

  if (!valid) return;

  const [role, username] = assignRole.value.split("|");

  try {
    const res = await fetch('http://localhost:4001/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role,
        username,
        taskName: taskName.value.trim(),
        description: taskDesc.value.trim(),
        date: taskDate.value,
        time: taskTime.value
      })
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to create task');
    }

    closeModal();
    searchInput.value = "";
    await loadTasks();

    confirmation.classList.remove("hidden");
    setTimeout(() => confirmation.classList.add("hidden"), 3000);
  } catch (err) {
    alert('Could not create task. Make sure the server is running.');
    console.error(err);
  }
});

// ----- Init -----

loadUsers();
loadTasks();
