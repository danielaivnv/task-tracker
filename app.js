const STORAGE_KEY = "focus-tasks-v2";
const THEME_KEY = "focus-theme-v1";
const TYPE_STORAGE_KEY = "focus-task-types-v1";
const TASK_BACKUP_KEY = "focus-tasks-backup-v1";
const TYPE_BACKUP_KEY = "focus-task-types-backup-v1";

const TYPE_COLORS = ["#1F43B9", "#E85B0C", "#F1AD0A", "#2E8B57", "#EA7F82", "#5FA8C7"];
const DEFAULT_TYPES = [
  { id: "type-personal", name: "Personal", color: "#1F43B9" },
  { id: "type-work", name: "Work", color: "#E85B0C" },
  { id: "type-home", name: "Home", color: "#2E8B57" }
];
const THEMES = [
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" }
];

normalizeStandalonePath();
fixBottomNavLinks();

let types = loadTypes();
let tasks = loadTasks();
let selectedTypeId = types[0] ? types[0].id : null;
let selectedTypeColor = TYPE_COLORS[0];
let activeFilter = "all";

const page = document.body.dataset.page;
const els = {
  taskTitle: document.getElementById("taskTitle"),
  taskDate: document.getElementById("taskDate"),
  taskTime: document.getElementById("taskTime"),
  allDayToggle: document.getElementById("allDayToggle"),
  noDeadlineToggle: document.getElementById("noDeadlineToggle"),
  typeSelector: document.getElementById("typeSelector"),
  typeBuilder: document.getElementById("typeBuilder"),
  newTypeName: document.getElementById("newTypeName"),
  typeColorPicker: document.getElementById("typeColorPicker"),
  addTypeBtn: document.getElementById("addTypeBtn"),
  typeList: document.getElementById("typeList"),
  addTaskBtn: document.getElementById("addTaskBtn"),
  taskList: document.getElementById("taskList"),
  emptyState: document.getElementById("emptyState"),
  themePicker: document.getElementById("themePicker"),
  filters: document.querySelectorAll(".filter-chip"),
  itemTemplate: document.getElementById("taskItemTemplate"),
  clearCompletedBtn: document.getElementById("clearCompletedBtn"),
  todayCount: document.getElementById("todayCount"),
  overdueCount: document.getElementById("overdueCount"),
  upcomingCount: document.getElementById("upcomingCount")
};

setup();

function setup() {
  initializeTheme();
  setTodayAsDefault();

  if (page === "dashboard") {
    renderThemePicker();
    renderTypeSelector();
    renderTypeColorPicker();
    renderTypeList();
  }

  bindEvents();

  if (page === "dashboard") {
    renderStats();
    renderTaskList(getFilteredTasks(tasks, "today"));
  }

  if (page === "tasks") {
    renderTaskList(getFilteredTasks(tasks, activeFilter));
  }

  if (page === "completed") {
    renderTaskList(getFilteredTasks(tasks, "completed"));
  }
}

function bindEvents() {
  if (els.addTaskBtn) {
    els.addTaskBtn.addEventListener("click", addTask);
  }

  if (els.taskTitle) {
    els.taskTitle.addEventListener("keydown", (event) => {
      if (event.key === "Enter") addTask();
    });
  }

  if (els.addTypeBtn) {
    els.addTypeBtn.addEventListener("click", addType);
  }

  if (els.newTypeName) {
    els.newTypeName.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        addType();
      }
    });
  }

  if (els.allDayToggle) {
    els.allDayToggle.addEventListener("change", syncDeadlineState);
  }

  if (els.noDeadlineToggle) {
    els.noDeadlineToggle.addEventListener("change", syncDeadlineState);
  }

  if (els.allDayToggle || els.noDeadlineToggle) {
    syncDeadlineState();
  }

  els.filters.forEach((chip) => {
    chip.addEventListener("click", () => {
      activeFilter = chip.dataset.filter;
      els.filters.forEach((item) => item.classList.remove("active"));
      chip.classList.add("active");
      renderTaskList(getFilteredTasks(tasks, activeFilter));
    });
  });

  if (els.clearCompletedBtn) {
    els.clearCompletedBtn.addEventListener("click", () => {
      tasks = tasks.filter((task) => !task.completed);
      saveTasks(tasks);
      renderTaskList(getFilteredTasks(tasks, "completed"));
    });
  }
}

function addTask() {
  const title = els.taskTitle ? els.taskTitle.value.trim() : "";
  const dateValue = els.taskDate ? els.taskDate.value : "";
  const isAllDay = els.allDayToggle ? els.allDayToggle.checked : true;
  const noDeadline = els.noDeadlineToggle ? els.noDeadlineToggle.checked : false;
  const timeValue = els.taskTime ? els.taskTime.value : "";
  const typeId = selectedTypeId;

  if (!title) {
    els.taskTitle.focus();
    return;
  }

  if (!noDeadline && !isAllDay && dateValue && !timeValue) {
    els.taskTime.focus();
    return;
  }

  const dueAt = noDeadline ? null : buildDueAt(dateValue, timeValue, isAllDay);
  const color = getTypeColor(typeId);

  const newTask = {
    id: crypto.randomUUID(),
    title,
    dueAt,
    allDay: noDeadline ? true : isAllDay,
    typeId,
    color,
    completed: false,
    createdAt: Date.now()
  };

  tasks.unshift(newTask);
  tasks = sortByDeadline(tasks);
  saveTasks(tasks);

  if (els.taskTitle) els.taskTitle.value = "";
  if (els.taskDate) els.taskDate.value = getTodayDateString();
  if (els.taskTime) els.taskTime.value = "";
  if (els.allDayToggle) els.allDayToggle.checked = true;
  if (els.noDeadlineToggle) els.noDeadlineToggle.checked = false;
  syncDeadlineState();

  if (page === "dashboard") {
    renderStats();
    renderTaskList(getFilteredTasks(tasks, "today"));
  }
}

function addType() {
  if (!els.newTypeName) return;

  const name = els.newTypeName.value.trim();
  if (!name) {
    els.newTypeName.focus();
    return;
  }

  const exists = types.some((type) => type.name.toLowerCase() === name.toLowerCase());
  if (exists) return;

  const newType = {
    id: `type-${crypto.randomUUID()}`,
    name,
    color: selectedTypeColor
  };

  types.push(newType);
  saveTypes(types);
  selectedTypeId = newType.id;

  els.newTypeName.value = "";
  renderTypeSelector();
  renderTypeList();
}

function deleteType(typeId) {
  if (types.length <= 1) return;

  const fallbackType = types.find((type) => type.id !== typeId);
  types = types.filter((type) => type.id !== typeId);

  tasks = tasks.map((task) => {
    if (task.typeId !== typeId) return task;
    return {
      ...task,
      typeId: fallbackType.id,
      color: fallbackType.color
    };
  });

  saveTypes(types);
  saveTasks(tasks);

  if (selectedTypeId === typeId) {
    selectedTypeId = fallbackType.id;
  }

  renderTypeSelector();
  renderTypeList();
  rerenderCurrentPage();
}

function renderTypeSelector() {
  if (!els.typeSelector) return;

  if (!types.length) {
    types = [...DEFAULT_TYPES];
    saveTypes(types);
  }

  if (!types.some((type) => type.id === selectedTypeId)) {
    selectedTypeId = types[0].id;
  }

  els.typeSelector.innerHTML = "";

  types.forEach((type) => {
    const chip = createTypeChip(type, true);
    els.typeSelector.appendChild(chip);
  });
}

function renderTypeColorPicker() {
  if (!els.typeColorPicker) return;

  els.typeColorPicker.innerHTML = "";

  TYPE_COLORS.forEach((color, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "color-dot";
    button.style.background = color;
    button.setAttribute("role", "radio");
    button.setAttribute("aria-label", `Type color ${index + 1}`);
    button.setAttribute("aria-checked", selectedTypeColor === color ? "true" : "false");

    if (selectedTypeColor === color) button.classList.add("selected");

    button.addEventListener("click", () => {
      selectedTypeColor = color;
      Array.from(els.typeColorPicker.children).forEach((node) => {
        node.classList.remove("selected");
        node.setAttribute("aria-checked", "false");
      });
      button.classList.add("selected");
      button.setAttribute("aria-checked", "true");
    });

    els.typeColorPicker.appendChild(button);
  });
}

function renderTypeList() {
  if (!els.typeList) return;

  els.typeList.innerHTML = "";
  types.forEach((type) => {
    const pill = createTypeChip(type, false);
    els.typeList.appendChild(pill);
  });
}

function createTypeChip(type, isSelectable) {
  const pill = document.createElement("div");
  pill.className = "type-pill";

  if (selectedTypeId === type.id) {
    pill.classList.add("active");
  }

  const dot = document.createElement("span");
  dot.className = "type-pill-dot";
  dot.style.background = type.color;

  const name = document.createElement("span");
  name.textContent = type.name;

  const del = document.createElement("button");
  del.type = "button";
  del.className = "type-pill-delete";
  del.textContent = "x";
  del.setAttribute("aria-label", `Delete type ${type.name}`);
  del.disabled = types.length <= 1;
  del.addEventListener("click", (event) => {
    event.stopPropagation();
    deleteType(type.id);
  });

  if (isSelectable) {
    pill.setAttribute("role", "button");
    pill.setAttribute("tabindex", "0");
    pill.addEventListener("click", () => {
      selectedTypeId = type.id;
      renderTypeSelector();
    });
    pill.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        selectedTypeId = type.id;
        renderTypeSelector();
      }
    });
  }

  pill.appendChild(dot);
  pill.appendChild(name);
  pill.appendChild(del);
  return pill;
}

function renderThemePicker() {
  if (!els.themePicker) return;

  els.themePicker.innerHTML = "";

  THEMES.forEach((theme) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "theme-pill";
    button.textContent = theme.label;

    if (document.body.dataset.theme === theme.id) {
      button.classList.add("active");
    }

    button.addEventListener("click", () => {
      applyTheme(theme.id);
      saveTheme(theme.id);
      Array.from(els.themePicker.children).forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
    });

    els.themePicker.appendChild(button);
  });
}

function renderTaskList(list) {
  if (!els.taskList || !els.itemTemplate) return;

  els.taskList.innerHTML = "";

  list.forEach((task) => {
    const node = els.itemTemplate.content.cloneNode(true);
    const item = node.querySelector(".task-item");
    const checkBtn = node.querySelector(".check-btn");
    const deleteBtn = node.querySelector(".delete-btn");
    const title = node.querySelector(".task-title");
    const meta = node.querySelector(".task-meta");

    item.style.borderLeft = `7px solid ${getTaskColor(task)}`;
    title.textContent = task.title;
    meta.textContent = formatMeta(task);

    if (task.completed) item.classList.add("completed");

    checkBtn.addEventListener("click", () => {
      task.completed = !task.completed;
      saveTasks(tasks);
      rerenderCurrentPage();
    });

    deleteBtn.addEventListener("click", () => {
      tasks = tasks.filter((entry) => entry.id !== task.id);
      saveTasks(tasks);
      rerenderCurrentPage();
    });

    els.taskList.appendChild(node);
  });

  if (els.emptyState) {
    els.emptyState.style.display = list.length ? "none" : "block";
  }
}

function rerenderCurrentPage() {
  tasks = sortByDeadline(tasks);

  if (page === "dashboard") {
    renderStats();
    renderTaskList(getFilteredTasks(tasks, "today"));
  }

  if (page === "tasks") {
    renderTaskList(getFilteredTasks(tasks, activeFilter));
  }

  if (page === "completed") {
    renderTaskList(getFilteredTasks(tasks, "completed"));
  }
}

function renderStats() {
  if (!els.todayCount || !els.overdueCount || !els.upcomingCount) return;

  els.todayCount.textContent = getFilteredTasks(tasks, "today").length;
  els.overdueCount.textContent = getFilteredTasks(tasks, "overdue").length;
  els.upcomingCount.textContent = getFilteredTasks(tasks, "upcoming").length;
}

function getFilteredTasks(list, filter) {
  const now = Date.now();

  return sortByDeadline(
    list.filter((task) => {
      const dueTs = toTimestamp(task.dueAt);
      const isDone = Boolean(task.completed);

      if (filter === "completed") return isDone;
      if (isDone) return false;
      if (filter === "all") return true;
      if (filter === "today") return isToday(task.dueAt);
      if (filter === "upcoming") return dueTs && dueTs > now && !isToday(task.dueAt);
      if (filter === "overdue") return dueTs && dueTs < now;
      return true;
    })
  );
}

function formatMeta(task) {
  const typeName = getTaskTypeName(task);

  if (!task.dueAt) {
    return task.completed ? `${typeName} · No deadline · Completed` : `${typeName} · No deadline`;
  }

  const due = new Date(task.dueAt);
  const prettyDate = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(due);
  const prettyTime = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit"
  }).format(due);

  const isAllDay = task.allDay !== false;

  if (task.completed) {
    return isAllDay
      ? `${typeName} · ${prettyDate} · All day · Completed`
      : `${typeName} · ${prettyDate}, ${prettyTime} · Completed`;
  }

  const now = Date.now();
  const dueTs = due.getTime();

  if (dueTs < now) {
    return isAllDay
      ? `${typeName} · ${prettyDate} · All day · Overdue`
      : `${typeName} · ${prettyDate}, ${prettyTime} · Overdue`;
  }

  if (isToday(task.dueAt) && !isAllDay) {
    const mins = Math.max(0, Math.round((dueTs - now) / 60000));
    if (mins <= 1) return `${typeName} · ${prettyDate}, ${prettyTime} · Due now`;
    return `${typeName} · ${prettyDate}, ${prettyTime} · In ${mins} min`;
  }

  return isAllDay
    ? `${typeName} · ${prettyDate} · All day`
    : `${typeName} · ${prettyDate}, ${prettyTime}`;
}

function getTaskTypeName(task) {
  const type = types.find((entry) => entry.id === task.typeId);
  return type ? type.name : "General";
}

function getTypeColor(typeId) {
  const type = types.find((entry) => entry.id === typeId);
  return type ? type.color : TYPE_COLORS[0];
}

function getTaskColor(task) {
  if (task.typeId) return getTypeColor(task.typeId);
  return task.color || TYPE_COLORS[0];
}

function sortByDeadline(list) {
  return [...list].sort((a, b) => {
    const aDone = Number(Boolean(a.completed));
    const bDone = Number(Boolean(b.completed));
    if (aDone !== bDone) return aDone - bDone;

    const aTs = toTimestamp(a.dueAt) || Number.MAX_SAFE_INTEGER;
    const bTs = toTimestamp(b.dueAt) || Number.MAX_SAFE_INTEGER;
    if (aTs !== bTs) return aTs - bTs;

    return (b.createdAt || 0) - (a.createdAt || 0);
  });
}

function buildDueAt(dateValue, timeValue, isAllDay) {
  if (!dateValue) return null;
  const raw = isAllDay ? `${dateValue}T23:59` : `${dateValue}T${timeValue}`;
  const ts = new Date(raw).getTime();
  return Number.isNaN(ts) ? null : raw;
}

function toTimestamp(dueAt) {
  if (!dueAt) return null;
  const ts = new Date(dueAt).getTime();
  return Number.isNaN(ts) ? null : ts;
}

function isToday(dueAt) {
  if (!dueAt) return false;
  const date = new Date(dueAt);
  if (Number.isNaN(date.getTime())) return false;

  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function syncDeadlineState() {
  const noDeadline = els.noDeadlineToggle ? els.noDeadlineToggle.checked : false;
  const isAllDay = els.allDayToggle ? els.allDayToggle.checked : true;

  if (els.taskDate) {
    els.taskDate.disabled = noDeadline;
  }

  if (els.allDayToggle) {
    els.allDayToggle.disabled = noDeadline;
  }

  if (!els.taskTime) return;

  const hideTime = noDeadline || isAllDay;
  els.taskTime.disabled = hideTime;
  els.taskTime.classList.toggle("hidden", hideTime);
  if (hideTime) {
    els.taskTime.value = "";
  }
}

function loadTypes() {
  try {
    const raw = localStorage.getItem(TYPE_STORAGE_KEY);
    const backupRaw = localStorage.getItem(TYPE_BACKUP_KEY);

    if (!raw) {
      if (backupRaw) {
        const backupParsed = JSON.parse(backupRaw);
        if (Array.isArray(backupParsed) && backupParsed.length) {
          saveTypes(backupParsed);
          return backupParsed;
        }
      }

      const defaults = [...DEFAULT_TYPES];
      saveTypes(defaults);
      return defaults;
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.length) {
      saveTypes(DEFAULT_TYPES);
      return [...DEFAULT_TYPES];
    }

    const valid = parsed.filter((item) => item && item.id && item.name && item.color);
    if (!valid.length) {
      saveTypes(DEFAULT_TYPES);
      return [...DEFAULT_TYPES];
    }

    return valid;
  } catch {
    return [...DEFAULT_TYPES];
  }
}

function saveTypes(value) {
  localStorage.setItem(TYPE_STORAGE_KEY, JSON.stringify(value));
  localStorage.setItem(TYPE_BACKUP_KEY, JSON.stringify(value));
}

function loadTasks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem("focus-tasks-v1");
    const backupRaw = localStorage.getItem(TASK_BACKUP_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const fallbackTypeId = types[0] ? types[0].id : DEFAULT_TYPES[0].id;

    const migrated = parsed.map((task) => {
      if (task.dueAt) {
        return {
          ...task,
          allDay: typeof task.allDay === "boolean" ? task.allDay : task.dueAt.endsWith("23:59"),
          typeId: task.typeId || fallbackTypeId,
          color: task.color || getTypeColor(task.typeId || fallbackTypeId)
        };
      }

      if (task.dueDate) {
        return {
          ...task,
          dueAt: `${task.dueDate}T23:59`,
          allDay: true,
          typeId: task.typeId || fallbackTypeId,
          color: task.color || getTypeColor(task.typeId || fallbackTypeId)
        };
      }

      return {
        ...task,
        dueAt: null,
        allDay: true,
        typeId: task.typeId || fallbackTypeId,
        color: task.color || getTypeColor(task.typeId || fallbackTypeId)
      };
    });

    const sorted = sortByDeadline(migrated);
    saveTasks(sorted);

    if (!sorted.length && backupRaw) {
      const backupParsed = JSON.parse(backupRaw);
      if (Array.isArray(backupParsed) && backupParsed.length) {
        const repaired = sortByDeadline(backupParsed);
        saveTasks(repaired);
        return repaired;
      }
    }

    return sorted;
  } catch {
    try {
      const backupRaw = localStorage.getItem(TASK_BACKUP_KEY);
      if (backupRaw) {
        const backupParsed = JSON.parse(backupRaw);
        if (Array.isArray(backupParsed)) return sortByDeadline(backupParsed);
      }
    } catch {}
    return [];
  }
}

function saveTasks(value) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  localStorage.setItem(TASK_BACKUP_KEY, JSON.stringify(value));
}

function initializeTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  const fallback = prefersDark ? "dark" : "light";
  const theme = THEMES.some((item) => item.id === saved) ? saved : fallback;
  applyTheme(theme);
}

function applyTheme(themeId) {
  document.body.dataset.theme = themeId;
}

function saveTheme(themeId) {
  localStorage.setItem(THEME_KEY, themeId);
}

function setTodayAsDefault() {
  if (!els.taskDate) return;
  if (!els.taskDate.value) {
    els.taskDate.value = getTodayDateString();
  }
}

function getTodayDateString() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function normalizeStandalonePath() {
  const { hostname, pathname, search, hash } = window.location;
  if (!hostname.endsWith("github.io")) return;
  if (pathname.endsWith("/") || pathname.endsWith(".html")) return;
  window.location.replace(`${pathname}/${search}${hash}`);
}

function fixBottomNavLinks() {
  const links = document.querySelectorAll(".nav-link");
  if (!links.length) return;

  const root = getAppRoot();
  links.forEach((link) => {
    const href = link.getAttribute("href");
    if (!href || href.startsWith("http")) return;

    const file = href.split("/").pop();
    link.setAttribute("href", `${root}${file}`);
  });
}

function getAppRoot() {
  const { hostname, pathname } = window.location;
  if (!hostname.endsWith("github.io")) return "/";

  const parts = pathname.split("/").filter(Boolean);
  if (!parts.length) return "/";
  return `/${parts[0]}/`;
}
