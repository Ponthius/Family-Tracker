// ─────────────────────────────────────────────
//  Family Tracker — System Audit (Super Admin)
//  audit-super.js
// ─────────────────────────────────────────────

'use strict';

// ── State ──────────────────────────────────────────────────────────────────
const ROWS_PER_PAGE = 8;
let currentPage = 1;
let totalRecords = 0;

// ── DOM References ─────────────────────────────────────────────────────────
const familyTableBody = document.getElementById("familyTableBody");
const auditTableBody = document.getElementById("auditTableBody");
const noFamilies = document.getElementById("noFamilies");
const noAudit = document.getElementById("noAudit");
const auditPanelTitle = document.getElementById("auditPanelTitle");
const pagination = document.getElementById("pagination");

const familySearch = document.getElementById("familySearch");
const filterSearch = document.getElementById("filterSearch");
const filterFamily = document.getElementById("filterFamily");
const filterRole = document.getElementById("filterRole");
const filterAction = document.getElementById("filterAction");
const filterStatus = document.getElementById("filterStatus");
const filterDateFrom = document.getElementById("filterDateFrom");
const filterDateTo = document.getElementById("filterDateTo");
const clearFilterBtn = document.getElementById("clearFilterBtn");

// ── API: Fetch Family Overview ─────────────────────────────────────────────
async function fetchFamilyOverview(search = "") {
  const params = new URLSearchParams();
  if (search) params.set("search", search);

  const res = await fetch(`/api/audit/families-overview?${params}`);
  if (!res.ok) throw new Error("Failed to load family overview.");
  const { data } = await res.json();
  return data;
}

// ── API: Fetch Audit Logs ──────────────────────────────────────────────────
async function fetchAuditLogs() {
  const params = new URLSearchParams({
    page: currentPage,
    limit: ROWS_PER_PAGE,
    search: filterSearch.value.trim(),
    family: filterFamily.value,
    role: filterRole.value,
    action: filterAction.value,
    status: filterStatus.value,
    dateFrom: filterDateFrom.value,
    dateTo: filterDateTo.value,
  });

  const res = await fetch(`/api/audit/all?${params}`);
  if (!res.ok) throw new Error("Failed to load audit logs.");
  return await res.json(); // { total, page, limit, data }
}

// ── Render: Family Overview Table ──────────────────────────────────────────
function renderFamilyTable(list) {
  familyTableBody.innerHTML = "";

  if (!list || list.length === 0) {
    noFamilies.classList.remove("hidden");
    return;
  }
  noFamilies.classList.add("hidden");

  list.forEach(f => {
    const statusClass = f.status === "active" ? "active" : "suspended";
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${f.family_name}</td>
      <td>${f.admin_username}</td>
      <td>${f.member_count}</td>
      <td><span class="badge ${statusClass}">${capitalize(f.status)}</span></td>
      <td>${formatDate(f.date_created)}</td>
      <td>${formatDate(f.last_activity) || "—"}</td>
      <td>
        <button class="btn-link" data-family="${f.family_name}">View Logs</button>
      </td>
    `;
    familyTableBody.appendChild(tr);
  });

  familyTableBody.querySelectorAll(".btn-link[data-family]").forEach(btn => {
    btn.addEventListener("click", () => {
      const fam = btn.getAttribute("data-family");
      filterFamily.value = fam;
      auditPanelTitle.textContent = `Audit Logs — ${fam}`;
      currentPage = 1;
      loadAuditLogs();
      document.querySelector(".panel:last-child").scrollIntoView({ behavior: "smooth" });
    });
  });
}

// ── Render: Audit Table ────────────────────────────────────────────────────
function renderAuditTable(data, total) {
  auditTableBody.innerHTML = "";

  if (!data || data.length === 0) {
    noAudit.classList.remove("hidden");
    renderPagination(0);
    return;
  }
  noAudit.classList.add("hidden");

  data.forEach(log => {
    const statusClass = log.status === "Success" ? "success" : "failed";
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${log.username}</td>
      <td><span class="role-tag">${log.role.replace(/_/g, " ")}</span></td>
      <td>${log.family || "—"}</td>
      <td>${log.action}</td>
      <td>${formatDate(log.date)}</td>
      <td>${log.time}</td>
      <td><span class="badge ${statusClass}">${log.status}</span></td>
    `;
    auditTableBody.appendChild(tr);
  });

  renderPagination(total);
}

// ── Pagination ─────────────────────────────────────────────────────────────
function renderPagination(total) {
  pagination.innerHTML = "";
  const totalPages = Math.ceil(total / ROWS_PER_PAGE);
  if (totalPages <= 1) return;

  for (let i = 1; i <= totalPages; i++) {
    const btn = document.createElement("button");
    btn.className = "page-btn" + (i === currentPage ? " active" : "");
    btn.textContent = i;
    btn.addEventListener("click", () => {
      currentPage = i;
      loadAuditLogs();
    });
    pagination.appendChild(btn);
  }
}

// ── Load Helpers ───────────────────────────────────────────────────────────
async function loadFamilyOverview(search = "") {
  try {
    const data = await fetchFamilyOverview(search);

    // Populate family filter dropdown from real data
    filterFamily.innerHTML = '<option value="">All Families</option>';
    data.forEach(f => {
      const opt = document.createElement("option");
      opt.value = f.family_name;
      opt.textContent = f.family_name;
      filterFamily.appendChild(opt);
    });

    renderFamilyTable(data);
  } catch (err) {
    console.error("[FamilyOverview]", err.message);
    familyTableBody.innerHTML = `<tr><td colspan="7" class="no-results">Failed to load family accounts.</td></tr>`;
  }
}

async function loadAuditLogs() {
  auditTableBody.innerHTML = `<tr><td colspan="7" class="no-results">Loading...</td></tr>`;
  noAudit.classList.add("hidden");

  try {
    const { data, total } = await fetchAuditLogs();
    totalRecords = total;
    renderAuditTable(data, total);

    // Update title if no family filter active
    if (!filterFamily.value && !filterRole.value && !filterAction.value &&
      !filterStatus.value && !filterDateFrom.value && !filterDateTo.value &&
      !filterSearch.value.trim()) {
      auditPanelTitle.textContent = "All Audit Logs";
    }
  } catch (err) {
    console.error("[AuditLogs]", err.message);
    auditTableBody.innerHTML = `<tr><td colspan="7" class="no-results">Failed to load audit logs.</td></tr>`;
  }
}

// ── Filter & Search Events ─────────────────────────────────────────────────
familySearch.addEventListener("input", () => {
  loadFamilyOverview(familySearch.value.trim());
});

[filterSearch, filterFamily, filterRole, filterAction, filterStatus, filterDateFrom, filterDateTo]
  .forEach(el => el.addEventListener("input", () => {
    currentPage = 1;
    loadAuditLogs();
  }));

clearFilterBtn.addEventListener("click", () => {
  filterSearch.value = "";
  filterFamily.value = "";
  filterRole.value = "";
  filterAction.value = "";
  filterStatus.value = "";
  filterDateFrom.value = "";
  filterDateTo.value = "";
  auditPanelTitle.textContent = "All Audit Logs";
  currentPage = 1;
  loadAuditLogs();
});

// ── Helpers ────────────────────────────────────────────────────────────────
function formatDate(str) {
  if (!str) return "";
  return new Date(str).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ── Init ───────────────────────────────────────────────────────────────────
loadFamilyOverview();
loadAuditLogs();
