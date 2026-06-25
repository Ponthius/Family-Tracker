// ─────────────────────────────────────────────
//  Family Tracker — Audit Log (Family Admin)
//  audit-family.js
// ─────────────────────────────────────────────

'use strict';

// ── State ──────────────────────────────────────────────────────────────────
const ROWS_PER_PAGE = 8;
let currentPage = 1;

// ── DOM References ─────────────────────────────────────────────────────────
const auditTableBody = document.getElementById("auditTableBody");
const noAudit = document.getElementById("noAudit");
const pagination = document.getElementById("pagination");

const filterSearch = document.getElementById("filterSearch");
const filterRole = document.getElementById("filterRole");
const filterAction = document.getElementById("filterAction");
const filterStatus = document.getElementById("filterStatus");
const filterDateFrom = document.getElementById("filterDateFrom");
const filterDateTo = document.getElementById("filterDateTo");
const clearFilterBtn = document.getElementById("clearFilterBtn");

// ── API: Fetch Audit Logs ──────────────────────────────────────────────────
async function fetchAuditLogs() {
  const params = new URLSearchParams({
    page: currentPage,
    limit: ROWS_PER_PAGE,
    search: filterSearch.value.trim(),
    role: filterRole.value,
    action: filterAction.value,
    status: filterStatus.value,
    dateFrom: filterDateFrom.value,
    dateTo: filterDateTo.value,
  });

  const res = await fetch(`/api/audit/family?${params}`);
  if (!res.ok) throw new Error("Failed to load audit logs.");
  return await res.json(); // { total, page, limit, data }
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

// ── Load ───────────────────────────────────────────────────────────────────
async function loadAuditLogs() {
  auditTableBody.innerHTML = `<tr><td colspan="6" class="no-results">Loading...</td></tr>`;
  noAudit.classList.add("hidden");

  try {
    const { data, total } = await fetchAuditLogs();
    renderAuditTable(data, total);
  } catch (err) {
    console.error("[AuditLogs]", err.message);
    auditTableBody.innerHTML = `<tr><td colspan="6" class="no-results">Failed to load audit logs.</td></tr>`;
  }
}

// ── Filter & Search Events ─────────────────────────────────────────────────
[filterSearch, filterRole, filterAction, filterStatus, filterDateFrom, filterDateTo]
  .forEach(el => el.addEventListener("input", () => {
    currentPage = 1;
    loadAuditLogs();
  }));

clearFilterBtn.addEventListener("click", () => {
  filterSearch.value = "";
  filterRole.value = "";
  filterAction.value = "";
  filterStatus.value = "";
  filterDateFrom.value = "";
  filterDateTo.value = "";
  currentPage = 1;
  loadAuditLogs();
});

// ── Helpers ────────────────────────────────────────────────────────────────
function formatDate(str) {
  if (!str) return "";
  return new Date(str).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ── Init ───────────────────────────────────────────────────────────────────
loadAuditLogs();
