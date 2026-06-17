// In-memory task store (no localStorage per environment constraints)
let tasks = [
  { role: "father", username: "Dad", name: "Mow the lawn", desc: "Front and back yard", date: "2026-06-20", time: "10:00" },
  { role: "child", username: "Alex", name: "Clean room", desc: "", date: "2026-06-18", time: "17:00" },
  { role: "mother", username: "Mom", name: "Grocery shopping", desc: "Weekly groceries list", date: "2026-06-19", time: "09:30" }
];

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

function formatDateTime(dateStr, timeStr) {
  if (!dateStr || !timeStr) return "";
  const d = new Date(`${dateStr}T${timeStr}`);
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
      <td><span class="role-tag">${task.role}</span></td>
      <td>${task.username}</td>
      <td>${task.name}</td>
      <td>${task.desc ? task.desc : "—"}</td>
      <td>${formatDateTime(task.date, task.time)}</td>
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
  const filtered = tasks.filter(t =>
    t.name.toLowerCase().includes(term) ||
    t.username.toLowerCase().includes(term) ||
    (t.desc && t.desc.toLowerCase().includes(term))
  );
  renderTable(filtered);
}

searchInput.addEventListener("input", applySearch);

function openModal() {
  modalOverlay.classList.remove("hidden");
}

function closeModal() {
  modalOverlay.classList.add("hidden");
  assignRole.value = "";
  taskName.value = "";
  taskDesc.value = "";
  taskDate.value = "";
  taskTime.value = "";
  [errAssign, errName, errDate, errTime].forEach(e => e.classList.add("hidden"));
}

createTaskBtn.addEventListener("click", openModal);
cancelBtn.addEventListener("click", closeModal);
modalOverlay.addEventListener("click", (e) => {
  if (e.target === modalOverlay) closeModal();
});

function isPast(dateStr, timeStr) {
  const selected = new Date(`${dateStr}T${timeStr}`);
  return selected.getTime() < Date.now();
}

saveTaskBtn.addEventListener("click", () => {
  let valid = true;

  [errAssign, errName, errDate, errTime].forEach(e => e.classList.add("hidden"));

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

  tasks.push({
    role,
    username,
    name: taskName.value.trim(),
    desc: taskDesc.value.trim(),
    date: taskDate.value,
    time: taskTime.value
  });

  closeModal();
  searchInput.value = "";
  renderTable(tasks);

  confirmation.classList.remove("hidden");
  setTimeout(() => confirmation.classList.add("hidden"), 3000);
});

// Initial render
renderTable(tasks);
