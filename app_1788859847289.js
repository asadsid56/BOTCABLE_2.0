// BOT Cable case workspace. Data stays in localStorage so the app works offline.

/* ========= DOM ========= */
const els = {
  grid: document.getElementById("notesGrid"),
  search: document.getElementById("search"),
  showForm: document.getElementById("showForm"),
  form: document.getElementById("noteForm"),
  title: document.getElementById("noteTitle"),
  cc: document.getElementById("noteCC"),
  content: document.getElementById("noteContent"),
  datalist: document.getElementById("presetTitles"),
  manageTitles: document.getElementById("manageTitles"),
  titleManager: document.getElementById("titleManager"),
  closeTitleManager: document.getElementById("closeTitleManager"),
  titleForm: document.getElementById("titleForm"),
  titleInput: document.getElementById("titleInput"),
  saveTitle: document.getElementById("saveTitle"),
  cancelTitleEdit: document.getElementById("cancelTitleEdit"),
  titleList: document.getElementById("titleList"),
  cancelForm: document.getElementById("cancelForm"),
  formHeading: document.getElementById("formHeading"),
  saveNote: document.getElementById("saveNote"),
  resultCount: document.getElementById("resultCount"),
  clearSearch: document.getElementById("clearSearch"),
};

/* ========= Storage ========= */
const STORAGE_KEY = "notes_v1";
const TITLES_KEY = "case_titles_v1";
let notes = readStorage(STORAGE_KEY, []);
let customTitles = readStorage(TITLES_KEY, []);
let editingNoteId = null;
let editingTitle = null;

// IDs to animate once (new note pop + scroll)
let flashNewNoteIds = new Set();

/* ========= Presets ========= */
const PRESETS = [
  { title: "Internet Down", color: "#ffe5e5", cls: "p-internet-down" },
  { title: "Internet Quality", color: "#fff2e5", cls: "p-internet-quality" },
  { title: "Wifi", color: "#fffde5", cls: "p-wifi" },
  { title: "TV Down", color: "#f0e5ff", cls: "p-tv-down" },
  { title: "TV Quality", color: "#f5e5d6", cls: "p-tv-quality" },
  { title: "Orange TV Plus App", color: "#e5ffe5", cls: "p-orange-tv-plus-app" },
  { title: "Repair", color: "#e5f0ff", cls: "p-repair" },
  { title: "Ingress", color: "#e5e5e5", cls: "p-ingress" },
  { title: "Drop quotation", color: "#f9f9f9", cls: "p-drop-quotation-marks" },
];

if (!localStorage.getItem(TITLES_KEY)) {
  customTitles = PRESETS.map((preset) => preset.title);
  saveTitles();
}

const COLOR_MAP = Object.fromEntries(PRESETS.map((p) => [p.title.toLowerCase(), p.color]));
const CLASS_MAP = Object.fromEntries(PRESETS.map((p) => [p.title.toLowerCase(), p.cls]));

const colorFor = (title = "") => COLOR_MAP[title.toLowerCase()] || "#f9f9f9";
const pastelClassFor = (title = "") => CLASS_MAP[title.toLowerCase()] || "";

function readStorage(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function allTitles() {
  return [...new Set(customTitles)]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}

/* ========= Utils ========= */
let saveTimer;
function saveNotes(immediate = false) {
  clearTimeout(saveTimer);
  const write = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  if (immediate) write();
  else saveTimer = setTimeout(write, 140);
}

function saveTitles() {
  localStorage.setItem(TITLES_KEY, JSON.stringify(customTitles));
}

function autoCapitalize(text) {
  return (text || "").replace(/(^\s*\w|[.!?]\s*\w)/g, (m) => m.toUpperCase());
}

function ensureCreatedDate(note) {
  if (!note.created) note.created = new Date().toLocaleString();
}

function htmlFromRaw(raw) {
  return (raw || "")
    .split("\n")
    .map((line) => `<p>${line}</p>`)
    .join("");
}

// Detect "$" in content (raw or html)
function hasDollarSign(note) {
  const t = `${note.rawContent || ""} ${note.content || ""}`;
  return t.includes("$");
}

function scrollIntoViewSmooth(el) {
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

/* ========= Seed presets if empty ========= */
if (notes.length === 0) {
  notes = PRESETS.map((p, i) => ({
    id: Date.now() + i,
    title: p.title,
    cc: "",
    rawContent: "",
    content: "",
    color: p.color,
    cls: p.cls,
    created: new Date().toLocaleString(),
  }));
  saveNotes(true);
}

/* ========= Clipboard + Toast ========= */
function copyToClipboard(text) {
  if (!text) return;

  const done = () => showToast("Copied!");

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done).catch(() => {
      fallbackCopy(text);
      done();
    });
  } else {
    fallbackCopy(text);
    done();
  }
}

function fallbackCopy(text) {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.left = "-9999px";
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand("copy");
  } catch (err) {
    console.error("Fallback copy failed", err);
  }
  ta.remove();
}

function showToast(msgText) {
  const msg = document.createElement("div");
  msg.textContent = msgText;
  Object.assign(msg.style, {
    position: "fixed",
    bottom: "20px",
    right: "20px",
    background: "#238636",
    color: "#fff",
    padding: "8px 14px",
    borderRadius: "10px",
    boxShadow: "0 4px 12px rgba(0,0,0,.3)",
    zIndex: 9999,
    fontSize: "14px",
    transition: "opacity .3s ease",
  });
  document.body.appendChild(msg);

  requestAnimationFrame(() => {
    setTimeout(() => (msg.style.opacity = "0"), 800);
    setTimeout(() => msg.remove(), 1200);
  });
}

/* ========= UI Helpers ========= */
function makeButton(icon, title, handler) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "iconbtn";
  btn.title = title;
  btn.textContent = icon;
  btn.addEventListener("click", handler);
  return btn;
}

/* ========= Render ========= */
function renderNotes(filter = "") {
  if (!els.grid) return;

  els.grid.innerHTML = "";
  const q = (filter || "").trim().toLowerCase();

  const visibleNotes = notes.filter((n) => {
    if (!q) return true;
    return (
      (n.title || "").toLowerCase().includes(q) ||
      (n.rawContent || "").toLowerCase().includes(q)
    );
  });

  if (els.resultCount) {
    els.resultCount.textContent = `${visibleNotes.length} ${visibleNotes.length === 1 ? "case" : "cases"}${q ? ` matching “${filter.trim()}”` : ""}`;
  }
  if (els.clearSearch) els.clearSearch.hidden = !q;

  if (!visibleNotes.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.innerHTML = q
      ? `<strong>No matching cases</strong><span>Try a different search or clear the filter.</span>`
      : `<strong>Your case board is empty</strong><span>Add your first case to start building your workspace.</span>`;
    const add = makeButton("＋ Add case", "Add a case", () => openNoteForm());
    add.className = "primary-button";
    empty.appendChild(add);
    els.grid.appendChild(empty);
    return;
  }

  const fragment = document.createDocumentFragment();
  visibleNotes.forEach((note) => {
    ensureCreatedDate(note);

    const card = document.createElement("article");
    card.className = `card ${note.cls || pastelClassFor(note.title)}`;
    card.style.setProperty("--pastel", (note.color || colorFor(note.title)) + "99");

    // pop-in + auto-scroll for newly created notes (once)
    if (flashNewNoteIds.has(String(note.id))) {
      card.classList.add("is-new");
      requestAnimationFrame(() => scrollIntoViewSmooth(card));
      setTimeout(() => flashNewNoteIds.delete(String(note.id)), 700);
    }

    // pulse warning if "$" detected
    if (hasDollarSign(note)) card.classList.add("has-dollar");

    const head = document.createElement("div");
    head.className = "head";

    const title = Object.assign(document.createElement("div"), {
      className: "title",
      textContent: note.title,
      spellcheck: false,
    });

    const actions = document.createElement("div");
    actions.className = "actions";

    const editBtn = makeButton("✎", "Edit case", () => editNote(note.id));
    const copyBtn = makeButton("📋", "Copy note", () => {
      const textToCopy = `Case : ${note.title}\nCC: ${note.cc || "-"}\n\n${note.rawContent || ""}`;
      copyToClipboard(textToCopy);
    });

    const dupBtn = makeButton("📄", "Duplicate", () => duplicateNote(note.id));
    const delBtn = makeButton("🗑", "Delete case", () => deleteNote(note.id));
    delBtn.classList.add("danger-button");

    actions.append(editBtn, copyBtn, dupBtn, delBtn);
    head.append(title, actions);

    const content = Object.assign(document.createElement("textarea"), {
      className: "content",
      spellcheck: false,
      value: note.rawContent || "",
    });

    // live save + live "$" warning
    content.addEventListener("input", () => {
      note.rawContent = autoCapitalize(content.value);
      note.content = htmlFromRaw(note.rawContent);

      // toggle warning class live
      if (hasDollarSign(note)) card.classList.add("has-dollar");
      else card.classList.remove("has-dollar");

      saveNotes();
    });

    const meta = document.createElement("div");
    meta.className = "meta";

    const ccDiv = document.createElement("div");
    ccDiv.className = "cc";

    const ccLabel = Object.assign(document.createElement("span"), {
      className: "muted",
      textContent: "CC:",
    });

    const ccVal = Object.assign(document.createElement("span"), {
      contentEditable: true,
      textContent: note.cc || "",
    });

    ccVal.addEventListener("input", () => {
      note.cc = (ccVal.textContent || "").trim();
      saveNotes();
    });

    const dateSpan = Object.assign(document.createElement("span"), {
      className: "muted",
      textContent: note.created,
    });

    ccDiv.append(ccLabel, ccVal);
    meta.append(ccDiv, dateSpan);

    card.append(head, content, meta);
    fragment.appendChild(card);
  });
  els.grid.appendChild(fragment);
}

/* ========= Actions ========= */
function duplicateNote(id) {
  const orig = notes.find((n) => n.id === id);
  if (!orig) return;

  const copy = {
    ...orig,
    id: makeId(),
    created: new Date().toLocaleString(),
  };

  notes.unshift(copy);
  flashNewNoteIds.add(String(copy.id));

  saveNotes(true);
  renderNotes(els.search ? els.search.value : "");
}

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function deleteNote(id) {
  const note = notes.find((n) => n.id === id);
  if (!note || !confirm(`Delete “${note.title}”? This cannot be undone.`)) return;
  notes = notes.filter((n) => n.id !== id);
  saveNotes(true);
  renderNotes(els.search ? els.search.value : "");
  showToast("Case deleted");
}

function openNoteForm(note = null) {
  if (!els.form) return;
  editingNoteId = note ? note.id : null;
  els.form.reset();
  if (note) {
    els.title.value = note.title || "";
    els.cc.value = note.cc || "";
    els.content.value = note.rawContent || "";
  }
  if (els.formHeading) els.formHeading.textContent = note ? "Edit case" : "Add a case";
  if (els.saveNote) els.saveNote.textContent = note ? "Save changes" : "Save case";
  els.form.style.display = "flex";
  els.form.scrollIntoView({ behavior: "smooth", block: "nearest" });
  requestAnimationFrame(() => els.title && els.title.focus());
}

function closeNoteForm() {
  editingNoteId = null;
  if (els.form) {
    els.form.reset();
    els.form.style.display = "none";
  }
  if (els.formHeading) els.formHeading.textContent = "Add a case";
  if (els.saveNote) els.saveNote.textContent = "Save case";
}

function editNote(id) {
  const note = notes.find((item) => item.id === id);
  if (note) openNoteForm(note);
}

/* ========= Form toggle ========= */
if (els.showForm && els.form) {
  els.showForm.addEventListener("click", () => {
    if (els.form.style.display === "flex") closeNoteForm();
    else openNoteForm();
  });
}
if (els.cancelForm) els.cancelForm.addEventListener("click", closeNoteForm);

/* ========= Form submit ========= */
if (els.form) {
  els.form.addEventListener("submit", (e) => {
    e.preventDefault();

    const title = ((els.title && els.title.value) || "").trim();
    if (!title) return;

    const raw = autoCapitalize((els.content && els.content.value) || "");

    const cc = ((els.cc && els.cc.value) || "").trim();
    const existing = editingNoteId && notes.find((note) => note.id === editingNoteId);

    if (existing) {
      Object.assign(existing, {
        title,
        cc,
        rawContent: raw,
        content: htmlFromRaw(raw),
        color: colorFor(title),
        cls: pastelClassFor(title),
      });
      showToast("Case updated");
    } else {
      const noteObj = {
        id: makeId(),
        title,
        cc,
        rawContent: raw,
        content: htmlFromRaw(raw),
        color: colorFor(title),
        cls: pastelClassFor(title),
        created: new Date().toLocaleString(),
      };
      notes.unshift(noteObj);
      flashNewNoteIds.add(String(noteObj.id));
      copyToClipboard(`Case : ${title}\nCC: ${noteObj.cc || "-"}\n\n${raw}`);
      showToast("Case saved and copied");
    }

    saveNotes(true);
    renderNotes(els.search ? els.search.value : "");
    closeNoteForm();
  });
  els.form.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      els.form.requestSubmit();
    }
  });
}

/* ========= Search ========= */
if (els.search) {
  let searchFrame;
  els.search.addEventListener("input", (e) => {
    cancelAnimationFrame(searchFrame);
    searchFrame = requestAnimationFrame(() => renderNotes(e.target.value));
  });
}
if (els.clearSearch) {
  els.clearSearch.addEventListener("click", () => {
    els.search.value = "";
    renderNotes("");
    els.search.focus();
  });
}

/* ========= Datalist ========= */
function renderTitleOptions() {
  if (!els.datalist) return;
  els.datalist.innerHTML = "";
  allTitles().forEach((title) => {
    const opt = document.createElement("option");
    opt.value = title;
    els.datalist.appendChild(opt);
  });
}
renderTitleOptions();

/* ========= Title manager ========= */
function titleUsage(title) {
  return notes.filter((note) => (note.title || "").toLowerCase() === title.toLowerCase()).length;
}

function renderTitleManager() {
  if (!els.titleList) return;
  els.titleList.innerHTML = "";
  const titles = allTitles();

  if (!titles.length) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "No titles yet. Add one above.";
    els.titleList.appendChild(empty);
    return;
  }

  const fragment = document.createDocumentFragment();
  titles.forEach((title) => {
    const row = document.createElement("div");
    row.className = "title-row";

    const info = document.createElement("div");
    info.className = "title-row-info";
    const name = document.createElement("strong");
    name.textContent = title;
    const usage = document.createElement("span");
    usage.className = "muted";
    const count = titleUsage(title);
    usage.textContent = `${count} ${count === 1 ? "case" : "cases"}`;
    info.append(name, usage);

    const actions = document.createElement("div");
    actions.className = "title-row-actions";
    actions.append(
      makeButton("✎", `Edit ${title}`, () => startTitleEdit(title)),
      makeButton("🗑", `Delete ${title}`, () => removeTitle(title)),
    );
    actions.lastElementChild.classList.add("danger-button");
    row.append(info, actions);
    fragment.appendChild(row);
  });
  els.titleList.appendChild(fragment);
}

function startTitleEdit(title) {
  editingTitle = title;
  els.titleInput.value = title;
  els.saveTitle.textContent = "Save title";
  els.cancelTitleEdit.hidden = false;
  els.titleInput.focus();
  els.titleInput.select();
}

function resetTitleForm() {
  editingTitle = null;
  if (els.titleForm) els.titleForm.reset();
  if (els.saveTitle) els.saveTitle.textContent = "Add title";
  if (els.cancelTitleEdit) els.cancelTitleEdit.hidden = true;
}

function removeTitle(title) {
  const used = titleUsage(title);
  const message = used
    ? `Remove “${title}” from your title list? The ${used} existing ${used === 1 ? "case" : "cases"} will stay.`
    : `Remove “${title}” from your title list?`;
  if (!confirm(message)) return;
  customTitles = customTitles.filter((item) => item.toLowerCase() !== title.toLowerCase());
  saveTitles();
  renderTitleOptions();
  renderTitleManager();
  showToast("Title removed");
}

if (els.manageTitles && els.titleManager) {
  els.manageTitles.addEventListener("click", () => {
    const isOpen = !els.titleManager.hidden;
    els.titleManager.hidden = isOpen;
    if (!isOpen) {
      renderTitleManager();
      els.titleManager.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  });
}
if (els.closeTitleManager) {
  els.closeTitleManager.addEventListener("click", () => {
    els.titleManager.hidden = true;
    resetTitleForm();
  });
}
if (els.cancelTitleEdit) els.cancelTitleEdit.addEventListener("click", resetTitleForm);
if (els.titleForm) {
  els.titleForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const nextTitle = (els.titleInput.value || "").trim().replace(/\s+/g, " ");
    if (!nextTitle) return;

    const duplicate = customTitles.some(
      (title) => title.toLowerCase() === nextTitle.toLowerCase() && title !== editingTitle,
    );
    if (duplicate) {
      showToast("That title already exists");
      return;
    }

    if (editingTitle) {
      notes.forEach((note) => {
        if ((note.title || "").toLowerCase() === editingTitle.toLowerCase()) {
          note.title = nextTitle;
          note.color = colorFor(nextTitle);
          note.cls = pastelClassFor(nextTitle);
        }
      });
      customTitles = customTitles.map((title) => (title === editingTitle ? nextTitle : title));
      showToast("Title updated");
    } else {
      customTitles.push(nextTitle);
      showToast("Title added");
    }
    saveTitles();
    saveNotes(true);
    resetTitleForm();
    renderTitleOptions();
    renderTitleManager();
    renderNotes(els.search ? els.search.value : "");
  });
}

/* ========= Export / Import ========= */
function exportNotes() {
  try {
    const data = JSON.stringify(notes, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "notes_export.json";
    document.body.appendChild(a);
    a.click();
    a.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (err) {
    alert("Export failed: " + (err && err.message));
  }
}

function importNotes(file) {
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const imported = JSON.parse(e.target.result);
      if (!Array.isArray(imported)) {
        alert("Invalid JSON format (expected array of notes).");
        return;
      }

      notes = imported.map((n) => ({
        id: n.id || makeId(),
        title: n.title || "Untitled",
        cc: n.cc || "",
        rawContent: n.rawContent || n.content || "",
        content:
          n.content ||
          (n.rawContent ? htmlFromRaw(n.rawContent) : ""),
        color: n.color || colorFor(n.title || ""),
        cls: n.cls || pastelClassFor(n.title || ""),
        created: n.created || new Date().toLocaleString(),
      }));

      customTitles = [...new Set([...customTitles, ...notes.map((note) => note.title).filter(Boolean)])];

      // animate imported notes once
      flashNewNoteIds = new Set(notes.map((n) => String(n.id)));

      saveNotes(true);
      saveTitles();
      renderTitleOptions();
      renderTitleManager();
      renderNotes(els.search ? els.search.value : "");
      showToast(`${notes.length} cases imported`);
    } catch (err) {
      console.error(err);
      alert("Error reading JSON file.");
    }
  };

  reader.readAsText(file);
}

(function wireImportExport() {
  const exportBtn = document.getElementById("exportBtn");
  const importBtn = document.getElementById("importBtn");
  const importFile = document.getElementById("importFile");

  if (exportBtn) exportBtn.addEventListener("click", exportNotes);

  if (importBtn && importFile) {
    importBtn.addEventListener("click", () => importFile.click());
    importFile.addEventListener("change", (e) => {
      const f = e.target.files && e.target.files[0];
      if (f) importNotes(f);
      importFile.value = "";
    });
  }
})();

/* ========= Expose (optional) ========= */
window.exportNotes = exportNotes;
window.importNotes = importNotes;

/* ========= Init ========= */
renderNotes();
