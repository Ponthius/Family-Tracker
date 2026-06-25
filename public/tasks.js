// Tasks — backed by the database via API
const API = 'http://13.140.143.58:4001';
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

// Conflict message element (shown below the form)
const conflictMsg = document.createElement('p');
conflictMsg.className = 'error-msg hidden';
conflictMsg.id = 'errConflict';
conflictMsg.style.marginTop = '10px';
document.querySelector('.modal-actions').before(conflictMsg);

function getStoredUser() {
  try { return JSON.parse(localStorage.getItem('user')) || {}; }
  catch (e) { return {}; }
}

const currentUser = getStoredUser();
const isFather = currentUser.role === 'father';

// Hide Create Task button if not father
if (!isFather && createTaskBtn) {
  createTaskBtn.style.display = 'none';
}

// ----- Helpers -----

function formatDateTime(dateStr, timeStr) {
  if (!dateStr) return "";
  let d;
  if (dateStr.includes('T')) {
    d = new Date(dateStr);
  } else if (timeStr) {
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
    const status = task.status || 'pending';
    const statusBadge = status === 'done'
      ? '<span style="background:#d4e6c6;color:#3c5a3c;padding:3px 10px;border-radius:999px;font-size:0.7rem;font-weight:600;">Done</span>'
      : '<span style="background:#ece1d2;color:#5a4038;padding:3px 10px;border-radius:999px;font-size:0.7rem;font-weight:600;">Pending</span>';

    let doneBtn = '';
    if (isFather && status === 'pending') {
      doneBtn = '<button class="btn-done" data-taskid="' + task.TaskID + '" style="padding:4px 10px;font-size:0.75rem;background:#3d3530;color:#f5f1ec;border:none;border-radius:6px;cursor:pointer;">Done</button>';
    }

    tr.innerHTML = `
      <td><span class="role-tag">${task.Role || task.role}</span></td>
      <td>${task.Username || task.username}</td>
      <td>${task.TaskName || task.name}</td>
      <td>${(task.Description || task.desc) ? (task.Description || task.desc) : "—"}</td>
      <td>${formatDateTime(task.TaskDate || task.date, task.TaskTime || task.time)}</td>
      <td>${statusBadge} ${doneBtn}</td>
    `;
    tableBody.appendChild(tr);
  });

  // Bind done buttons
  document.querySelectorAll('.btn-done').forEach(btn => {
    btn.addEventListener('click', async function () {
      const taskId = this.getAttribute('data-taskid');
      await markTaskDone(taskId);
    });
  });
}

function applySearch() {
  const term = searchInput.value.trim().toLowerCase();
  if (!term) { renderTable(tasks); return; }
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

function openModal() { modalOverlay.style.display = "flex"; }
function closeModal() {
  modalOverlay.style.display = "none";
  assignRole.value = "";
  taskName.value = "";
  taskDesc.value = "";
  taskDate.value = "";
  taskTime.value = "";
  [errAssign, errName, errDate, errTime, conflictMsg].forEach(e => {
    e.classList.add("hidden");
    e.textContent = "";
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
    const res = await fetch(API + '/members');
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
  }
}

// ----- Fetch tasks from server -----

async function loadTasks() {
  try {
    const res = await fetch(API + '/tasks');
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Failed');
    tasks = data.tasks || [];
  } catch (err) {
    console.error('Could not load tasks:', err);
    tasks = [];
  }
  renderTable(tasks);
}

// ----- Mark task done -----

async function markTaskDone(taskId) {
  try {
    const res = await fetch(API + '/tasks/' + taskId + '/done', { method: 'PUT' });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Failed');
    await loadTasks();
    confirmation.textContent = 'Task marked as done!';
    confirmation.classList.remove("hidden");
    setTimeout(() => confirmation.classList.add("hidden"), 3000);
  } catch (err) {
    showNotification('Could not mark task done: ' + err.message, 'error');
    console.error(err);
  }
}

// ----- Save task to server -----

function isPast(dateStr, timeStr) {
  const selected = new Date(`${dateStr}T${timeStr}`);
  return selected.getTime() < Date.now();
}

saveTaskBtn.addEventListener("click", async () => {
  let valid = true;
  [errAssign, errName, errDate, errTime, conflictMsg].forEach(e => {
    e.classList.add("hidden");
    e.textContent = "";
  });

  if (!assignRole.value) { errAssign.classList.remove("hidden"); valid = false; }
  if (!taskName.value.trim()) { errName.classList.remove("hidden"); valid = false; }
  if (!taskDate.value) { errDate.classList.remove("hidden"); valid = false; }
  if (!taskTime.value) { errTime.classList.remove("hidden"); valid = false; }

  if (valid && taskDate.value && taskTime.value && isPast(taskDate.value, taskTime.value)) {
    errDate.textContent = "Date/time cannot be in the past.";
    errDate.classList.remove("hidden");
    valid = false;
  }

  if (!valid) return;

  const [role, username] = assignRole.value.split("|");

  // Check schedule conflict
  try {
    const conflictRes = await fetch(API + '/events/conflict?username=' + encodeURIComponent(username) + '&date=' + encodeURIComponent(taskDate.value));
    const conflictData = await conflictRes.json();

    if (conflictData.success && conflictData.conflict) {
      conflictMsg.textContent = username + ' is busy at this time according to their schedule (' + (conflictData.event ? conflictData.event.EventName : 'event') + '). Please reschedule.';
      conflictMsg.classList.remove("hidden");
      return;
    }
  } catch (err) {
    console.error('Conflict check error:', err);
  }

  try {
    const res = await fetch(API + '/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role,
        username,
        taskName: taskName.value.trim(),
        description: taskDesc.value.trim(),
        date: taskDate.value,
        time: taskTime.value,
        assignedById: currentUser.id,
        assignedByName: currentUser.username
      })
    });

    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Failed to create task');

    closeModal();
    searchInput.value = "";
    await loadTasks();

    confirmation.textContent = 'Task created successfully!';
    confirmation.classList.remove("hidden");
    setTimeout(() => confirmation.classList.add("hidden"), 3000);
  } catch (err) {
    showNotification('Could not create task: ' + err.message, 'error');
    console.error(err);
  }
});

// ----- Init -----
loadUsers();
loadTasks();
