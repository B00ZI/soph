/* ============================================================
   CallTrack — gestion clients (front-end only, localStorage)
   ============================================================ */

const LS_AUTH = "calltrack_auth";
const LS_CLIENTS = "calltrack_clients";

const STEP_KEYS = ["appel", "devis", "meet", "paye"];
const STEP_META = {
  appel: { label: "Appel effectué", icon: "fa-solid fa-phone-volume" },
  devis: { label: "Devis envoyé", icon: "fa-solid fa-file-invoice" },
  meet:  { label: "Google Meet fait", icon: "fa-brands fa-google" },
  paye:  { label: "Payé", icon: "fa-solid fa-money-check-dollar" }
};
const WANT_LABEL = { oui: "Oui", non: "Non", "peut-etre": "Peut-être" };

let clients = [];
let currentPage = 1;
let editingId = null;
let deleteTargetId = null;
const PAGE_SIZE = 8;

/* ---------------- Utilities ---------------- */
const $ = (id) => document.getElementById(id);
const uid = () => "c_" + Date.now() + "_" + Math.floor(Math.random() * 9999);
const REDUCED = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const hasGsap = typeof window.gsap !== "undefined";

function play(fn) { if (hasGsap && !REDUCED) fn(); }

function loadClients() {
  try {
    clients = JSON.parse(localStorage.getItem(LS_CLIENTS)) || [];
  } catch (e) {
    clients = [];
  }
}
function saveClients() {
  localStorage.setItem(LS_CLIENTS, JSON.stringify(clients));
}

function initials(name) {
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0].toUpperCase()).join("");
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function showToast(msg, type = "success") {
  const toast = $("toast");
  toast.innerHTML = `<i class="fa-solid ${type === "success" ? "fa-circle-check" : "fa-circle-xmark"}"></i> ${msg}`;
  toast.classList.remove("hidden", "error");
  if (type === "error") toast.classList.add("error");
  play(() => gsap.fromTo(toast, { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: .35, ease: "back.out(1.7)" }));
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => {
    play(() => gsap.to(toast, { y: 40, opacity: 0, duration: .25, onComplete: () => toast.classList.add("hidden") }));
    if (REDUCED || !hasGsap) toast.classList.add("hidden");
  }, 2600);
}

/* ================= AUTH ================= */
function enterApp(name) {
  $("userNameDisplay").textContent = name;
  $("userAvatar").textContent = initials(name);

  const loginScreen = $("loginScreen");
  const show = () => {
    loginScreen.classList.add("hidden");
    $("app").classList.remove("hidden");
    renderAll();
    play(() => {
      gsap.from(".app-header", { y: -16, opacity: 0, duration: .45, ease: "power3.out" });
      gsap.from(".page-head", { y: -14, opacity: 0, duration: .45, delay: .05 });
      gsap.from(".kpi-card", { y: 16, opacity: 0, duration: .4, stagger: .06, delay: .12 });
      gsap.from(".toolbar", { y: 16, opacity: 0, duration: .4, delay: .2 });
      gsap.from(".table-wrap", { y: 16, opacity: 0, duration: .4, delay: .25 });
    });
  };
  play(() => gsap.to("#loginCard", {
    y: -30, opacity: 0, duration: .32, ease: "power2.in", onComplete: show
  }));
  if (REDUCED || !hasGsap) show();
}

$("loginForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = $("loginName").value.trim();
  const pass = $("loginPass").value;
  const loginError = $("loginError");
  loginError.textContent = "";
  if (!name || !pass) return;

  const existing = JSON.parse(localStorage.getItem(LS_AUTH) || "null");

  if (!existing) {
    localStorage.setItem(LS_AUTH, JSON.stringify({ name, pass }));
    enterApp(name);
  } else if (existing.name.toLowerCase() === name.toLowerCase() && existing.pass === pass) {
    enterApp(existing.name);
  } else {
    loginError.textContent = "Nom ou mot de passe incorrect.";
    play(() => gsap.fromTo("#loginCard", { x: -10 }, { x: 10, duration: .06, repeat: 5, yoyo: true, clearProps: "x" }));
  }
});

play(() => {
  gsap.from("#loginCard", { y: 40, opacity: 0, duration: .7, ease: "power3.out" });
  gsap.from(".blob", { scale: 0, opacity: 0, duration: 1, stagger: .12, ease: "power2.out" });
});

/* ================= RENDER: KPIs ================= */
function renderKpis() {
  const total = clients.length;
  const paye = clients.filter(c => c.steps.paye).length;
  const meet = clients.filter(c => c.steps.meet).length;

  const kpis = [
    { icon: "fa-users", cls: "slate", num: total, label: "Clients au total" },
    { icon: "fa-phone-volume", cls: "sky", num: clients.filter(c => c.steps.appel).length, label: "Appels effectués" },
    { icon: "fa-video", cls: "violet", num: meet, label: "Meets réalisés" },
    { icon: "fa-sack-dollar", cls: "emerald", num: paye, label: "Clients payés" }
  ];

  $("kpis").innerHTML = kpis.map(k => `
    <div class="kpi-card">
      <div class="kpi-icon ${k.cls}"><i class="fa-solid ${k.icon}"></i></div>
      <div>
        <div class="kpi-num">${k.num}</div>
        <div class="kpi-label">${k.label}</div>
      </div>
    </div>
  `).join("");
}

/* ================= RENDER: filters ================= */
function populateCategoryFilter() {
  const select = $("filterCategory");
  const cats = [...new Set(clients.map(c => c.category))].sort();
  const current = select.value;
  select.innerHTML = `<option value="">Toutes les catégories</option>` +
    cats.map(c => `<option value="${c}">${c}</option>`).join("");
  select.value = current;
}

function computeStatus(c) {
  if (c.steps.paye) return "paye";
  if (c.steps.meet) return "meet";
  if (c.steps.devis) return "devis";
  if (c.steps.appel) return "appel";
  return "nouveau";
}
const STATUS_LABEL = {
  nouveau: "Nouveau", appel: "Appel effectué", devis: "Devis envoyé", meet: "Meet réalisé", paye: "Payé"
};
const STATUS_ICON = {
  nouveau: "fa-circle-dot", appel: "fa-phone", devis: "fa-file-invoice", meet: "fa-video", paye: "fa-circle-check"
};

function getFilteredClients() {
  const q = $("searchInput").value.trim().toLowerCase();
  const cat = $("filterCategory").value;
  const status = $("filterStatus").value;

  return clients.filter(c => {
    const matchesQ = !q || c.name.toLowerCase().includes(q) || (c.phone || "").toLowerCase().includes(q);
    const matchesCat = !cat || c.category === cat;
    const matchesStatus = !status || computeStatus(c) === status;
    return matchesQ && matchesCat && matchesStatus;
  }).sort((a, b) => b.createdAt - a.createdAt);
}

/* ================= RENDER: table ================= */
function wantBadge(c) {
  if (!c.wants || !WANT_LABEL[c.wants]) return "";
  const icons = { oui: "fa-check", non: "fa-xmark", "peut-etre": "fa-question" };
  return `<span class="want want-${c.wants}"><i class="fa-solid ${icons[c.wants]}"></i> ${WANT_LABEL[c.wants]}</span>`;
}

function renderTable() {
  const filtered = getFilteredClients();
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  if (currentPage > totalPages) currentPage = totalPages;

  const start = (currentPage - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(start, start + PAGE_SIZE);

  const tbody = $("tableBody");
  const emptyState = $("emptyState");

  if (filtered.length === 0) {
    tbody.innerHTML = "";
    emptyState.classList.remove("hidden");
  } else {
    emptyState.classList.add("hidden");
    tbody.innerHTML = pageItems.map(c => {
      const status = computeStatus(c);
      const pipeline = STEP_KEYS.map((k, i) => {
        const done = !!c.steps[k];
        const dot = `<div class="p-step ${done ? "done" : ""}" data-id="${c.id}" data-step="${k}" title="${STEP_META[k].label}" role="button" tabindex="0" aria-label="${STEP_META[k].label}: ${done ? "terminé" : "à faire"}">
          <i class="${STEP_META[k].icon}"></i>
        </div>`;
        const line = i < STEP_KEYS.length - 1 ? `<span class="p-line ${done ? "done" : ""}"></span>` : "";
        return dot + line;
      }).join("");

      return `
      <tr data-row="${c.id}">
        <td>
          <div class="client-cell">
            <div class="client-avatar">${initials(c.name)}</div>
            <div>
              <div class="client-name">${escapeHtml(c.name)}</div>
              <div class="client-phone">${c.phone ? escapeHtml(c.phone) : "—"}</div>
            </div>
          </div>
        </td>
        <td><span class="tag">${escapeHtml(c.category)}</span></td>
        <td>
          <div class="svc-cell">
            <span class="svc-name">${escapeHtml(c.service)}</span>
            ${wantBadge(c)}
          </div>
        </td>
        <td><div class="pipeline">${pipeline}</div></td>
        <td><span class="status-badge status-${status}"><i class="fa-solid ${STATUS_ICON[status]}"></i> ${STATUS_LABEL[status]}</span></td>
        <td>
          <div class="row-actions">
            <button class="edit-btn" data-id="${c.id}" title="Modifier" aria-label="Modifier ${escapeHtml(c.name)}"><i class="fa-solid fa-pen"></i></button>
            <button class="del-btn" data-id="${c.id}" title="Supprimer" aria-label="Supprimer ${escapeHtml(c.name)}"><i class="fa-solid fa-trash"></i></button>
          </div>
        </td>
      </tr>`;
    }).join("");

    play(() => gsap.from("#tableBody tr", { opacity: 0, y: 8, duration: .3, stagger: .04, ease: "power2.out" }));
  }

  renderPagination(totalPages);
}

function renderPagination(totalPages) {
  const el = $("pagination");
  if (totalPages <= 1) { el.innerHTML = ""; return; }

  let html = `<button class="page-btn" id="prevPage" aria-label="Page précédente" ${currentPage === 1 ? "disabled" : ""}><i class="fa-solid fa-chevron-left"></i></button>`;
  for (let i = 1; i <= totalPages; i++) {
    html += `<button class="page-btn ${i === currentPage ? "active" : ""}" data-page="${i}" aria-label="Page ${i}">${i}</button>`;
  }
  html += `<button class="page-btn" id="nextPage" aria-label="Page suivante" ${currentPage === totalPages ? "disabled" : ""}><i class="fa-solid fa-chevron-right"></i></button>`;
  el.innerHTML = html;

  el.querySelectorAll("[data-page]").forEach(btn => {
    btn.addEventListener("click", () => { currentPage = parseInt(btn.dataset.page); renderTable(); });
  });
  const prev = $("prevPage"), next = $("nextPage");
  if (prev) prev.addEventListener("click", () => { if (currentPage > 1) { currentPage--; renderTable(); } });
  if (next) next.addEventListener("click", () => { if (currentPage < totalPages) { currentPage++; renderTable(); } });
}

function renderAll() {
  renderKpis();
  populateCategoryFilter();
  renderTable();
}

/* ================= Export CSV (ouvrable dans Excel) ================= */
function exportCsv() {
  if (clients.length === 0) {
    showToast("Aucun client à exporter", "error");
    return;
  }
  const header = ["Nom", "Téléphone", "Catégorie", "Service souhaité", "Veut le service", "Notes", "Appel", "Devis", "Meet", "Payé", "Ajouté le"];
  const rows = [header];
  clients.forEach(c => {
    rows.push([
      c.name, c.phone || "", c.category, c.service,
      WANT_LABEL[c.wants] || "",
      (c.notes || "").replace(/\n/g, " "),
      c.steps.appel ? "Oui" : "", c.steps.devis ? "Oui" : "", c.steps.meet ? "Oui" : "", c.steps.paye ? "Oui" : "",
      new Date(c.createdAt).toLocaleDateString("fr-FR")
    ]);
  });
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\r\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "clients-calltrack.csv";
  a.click();
  URL.revokeObjectURL(a.href);
  showToast("Export CSV généré, ouvrez-le dans Excel");
}
$("exportBtn").addEventListener("click", exportCsv);

/* ================= Table interactions (delegation) ================= */
function toggleStep(dot) {
  const c = clients.find(x => x.id === dot.dataset.id);
  if (!c) return;
  c.steps[dot.dataset.step] = !c.steps[dot.dataset.step];
  saveClients();
  play(() => gsap.fromTo(dot, { scale: 1.35 }, { scale: 1, duration: .3, ease: "back.out(3)" }));
  renderKpis();
  renderTable();
}

$("tableBody").addEventListener("click", (e) => {
  const dot = e.target.closest(".p-step");
  const editBtn = e.target.closest(".edit-btn");
  const delBtn = e.target.closest(".del-btn");
  if (dot) toggleStep(dot);
  else if (editBtn) openModal(editBtn.dataset.id);
  else if (delBtn) openConfirmDelete(delBtn.dataset.id);
});

$("tableBody").addEventListener("keydown", (e) => {
  if (e.key !== "Enter" && e.key !== " ") return;
  const dot = e.target.closest(".p-step");
  if (dot) { e.preventDefault(); toggleStep(dot); }
});

/* ================= Filters / search ================= */
$("searchInput").addEventListener("input", () => { currentPage = 1; renderTable(); });
$("filterCategory").addEventListener("change", () => { currentPage = 1; renderTable(); });
$("filterStatus").addEventListener("change", () => { currentPage = 1; renderTable(); });

/* ================= MODAL: add / edit client ================= */
const modalOverlay = $("modalOverlay");
const modalCard = $("modalCard");
const clientForm = $("clientForm");

function openModal(id = null) {
  editingId = id;
  clientForm.reset();
  STEP_KEYS.forEach(k => $("step" + capitalize(k)).checked = false);

  if (id) {
    const c = clients.find(x => x.id === id);
    $("modalTitle").innerHTML = `<i class="fa-solid fa-pen"></i> Modifier le client`;
    $("clientId").value = c.id;
    $("clientName").value = c.name;
    $("clientPhone").value = c.phone || "";
    $("clientCategory").value = c.category;
    $("clientWants").value = c.wants || "";
    $("clientService").value = c.service;
    $("clientNotes").value = c.notes || "";
    STEP_KEYS.forEach(k => $("step" + capitalize(k)).checked = !!c.steps[k]);
  } else {
    $("modalTitle").innerHTML = `<i class="fa-solid fa-user-plus"></i> Nouveau client`;
    $("clientId").value = "";
  }

  modalOverlay.classList.remove("hidden");
  $("clientName").focus();
  play(() => {
    gsap.fromTo(modalOverlay, { opacity: 0 }, { opacity: 1, duration: .2 });
    gsap.fromTo(modalCard, { y: 30, opacity: 0, scale: .97 }, { y: 0, opacity: 1, scale: 1, duration: .35, ease: "back.out(1.6)" });
  });
}
function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

function closeModalFn() {
  play(() => {
    gsap.to(modalCard, { y: 16, opacity: 0, scale: .98, duration: .2, ease: "power2.in" });
    gsap.to(modalOverlay, { opacity: 0, duration: .22, delay: .04, onComplete: () => modalOverlay.classList.add("hidden") });
  });
  if (REDUCED || !hasGsap) modalOverlay.classList.add("hidden");
}

$("openAddClient").addEventListener("click", () => openModal());
$("emptyAddBtn").addEventListener("click", () => openModal());
$("closeModal").addEventListener("click", closeModalFn);
$("cancelModal").addEventListener("click", closeModalFn);
modalOverlay.addEventListener("click", (e) => { if (e.target === modalOverlay) closeModalFn(); });

clientForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const data = {
    name: $("clientName").value.trim(),
    phone: $("clientPhone").value.trim(),
    category: $("clientCategory").value,
    wants: $("clientWants").value,
    service: $("clientService").value,
    notes: $("clientNotes").value.trim(),
    steps: {
      appel: $("stepAppel").checked,
      devis: $("stepDevis").checked,
      meet: $("stepMeet").checked,
      paye: $("stepPaye").checked
    }
  };

  if (!data.name || !data.category || !data.service) return;

  if (editingId) {
    const c = clients.find(x => x.id === editingId);
    Object.assign(c, data);
    showToast("Client mis à jour");
  } else {
    clients.push({ id: uid(), createdAt: Date.now(), ...data });
    showToast("Client ajouté");
  }

  saveClients();
  closeModalFn();
  currentPage = 1;
  renderAll();
});

/* ================= Confirm delete ================= */
const confirmOverlay = $("confirmOverlay");
const confirmCard = $("confirmCard");

function openConfirmDelete(id) {
  deleteTargetId = id;
  confirmOverlay.classList.remove("hidden");
  $("cancelDelete").focus();
  play(() => {
    gsap.fromTo(confirmOverlay, { opacity: 0 }, { opacity: 1, duration: .2 });
    gsap.fromTo(confirmCard, { scale: .9, opacity: 0 }, { scale: 1, opacity: 1, duration: .3, ease: "back.out(1.8)" });
  });
}
function closeConfirm() {
  play(() => {
    gsap.to(confirmCard, { scale: .92, opacity: 0, duration: .18 });
    gsap.to(confirmOverlay, { opacity: 0, duration: .22, delay: .03, onComplete: () => confirmOverlay.classList.add("hidden") });
  });
  if (REDUCED || !hasGsap) confirmOverlay.classList.add("hidden");
}
$("cancelDelete").addEventListener("click", closeConfirm);
confirmOverlay.addEventListener("click", (e) => { if (e.target === confirmOverlay) closeConfirm(); });
$("confirmDelete").addEventListener("click", () => {
  clients = clients.filter(c => c.id !== deleteTargetId);
  saveClients();
  closeConfirm();
  showToast("Client supprimé", "error");
  renderAll();
});

/* ================= Escape closes dialogs ================= */
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (!modalOverlay.classList.contains("hidden")) closeModalFn();
  else if (!confirmOverlay.classList.contains("hidden")) closeConfirm();
});

/* ================= INIT ================= */
loadClients();
$("loginName").focus();
