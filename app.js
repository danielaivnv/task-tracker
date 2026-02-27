const STORAGE_KEY = "focus-tasks-v2";
const THEME_KEY = "focus-theme-v1";
const COLORS = [
  { name: "Ocean", hex: "#2D52FF" },
  { name: "Sunset", hex: "#FF7A3D" },
  { name: "Sky", hex: "#55A9FF" },
  { name: "Navy", hex: "#1A2E66" },
  { name: "Amber", hex: "#F2B544" }
];
const THEMES = [
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" }
];
const VISIBLE_COLOR_COUNT = 2;

let selectedColor = COLORS[0].hex;
let colorPickerExpanded = false;
let activeFilter = "all";
let tasks = loadTasks();

const page = document.body.dataset.page;
const els = {
  taskTitle: document.getElementById("taskTitle"),
  taskDeadline: document.getElementById("taskDeadline"),
  addTaskBtn: document.getElementById("addTaskBtn"),
  taskList: document.getElementById("taskList"),
  emptyState: document.getElementById("emptyState"),
  colorPicker: document.getElementById("taskColor"),
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

  if (els.colorPicker) {
    renderColorPicker();
  }

  if (page === "dashboard" && els.themePicker) {
    renderThemePicker();
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
      if (event.key === "Enter") {
        addTask();
      }
    });
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
  const title = els.taskTitle.value.trim();
  const dueAt = normalizeDeadlineInput(els.taskDeadline.value);

  if (!title) {
    els.taskTitle.focus();
    return;
  }

  const newTask = {
    id: crypto.randomUUID(),
    title,
    dueAt,
    color: selectedColor,
    completed: false,
    createdAt: Date.now()
  };

  tasks.unshift(newTask);
  tasks = sortByDeadline(tasks);
  saveTasks(tasks);

  els.taskTitle.value = "";
  els.taskDeadline.value = "";

  if (page === "dashboard") {
    renderStats();
    renderTaskList(getFilteredTasks(tasks, "today"));
  }
}

function renderColorPicker() {
  els.colorPicker.innerHTML = "";

  COLORS.forEach((color, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "color-dot";
    button.style.background = color.hex;
    button.setAttribute("aria-label", color.name);
    button.setAttribute("role", "radio");
    button.setAttribute("aria-checked", "false");

    if (color.hex === selectedColor) {
      button.classList.add("selected");
      button.setAttribute("aria-checked", "true");
    }

    const shouldHide = !colorPickerExpanded && index >= VISIBLE_COLOR_COUNT && color.hex !== selectedColor;
    if (shouldHide) {
      button.classList.add("hidden");
    }

    button.addEventListener("click", () => {
      selectedColor = color.hex;
      Array.from(els.colorPicker.children).forEach((node) => {
        if (node.classList.contains("color-dot")) {
          node.classList.remove("selected");
          node.setAttribute("aria-checked", "false");
        }
      });
      button.classList.add("selected");
      button.setAttribute("aria-checked", "true");
    });

    els.colorPicker.appendChild(button);
  });

  if (COLORS.length > VISIBLE_COLOR_COUNT) {
    const toggleBtn = document.createElement("button");
    toggleBtn.type = "button";
    toggleBtn.className = "color-more-btn";
    toggleBtn.textContent = colorPickerExpanded ? "-" : "+";
    toggleBtn.setAttribute("aria-label", colorPickerExpanded ? "Show fewer colors" : "Show more colors");

    toggleBtn.addEventListener("click", () => {
      colorPickerExpanded = !colorPickerExpanded;
      renderColorPicker();
    });

    els.colorPicker.appendChild(toggleBtn);
  }
}

function renderThemePicker() {
  els.themePicker.innerHTML = "";

  THEMES.forEach((theme) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "theme-pill";
    button.textContent = theme.label;
    button.dataset.theme = theme.id;

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
  if (!els.taskList || !els.itemTemplate) {
    return;
  }

  els.taskList.innerHTML = "";

  list.forEach((task) => {
    const node = els.itemTemplate.content.cloneNode(true);
    const item = node.querySelector(".task-item");
    const checkBtn = node.querySelector(".check-btn");
    const deleteBtn = node.querySelector(".delete-btn");
    const title = node.querySelector(".task-title");
    const meta = node.querySelector(".task-meta");

    item.style.borderLeft = `7px solid ${task.color}`;
    title.textContent = task.title;
    meta.textContent = formatMeta(task);

    if (task.completed) {
      item.classList.add("completed");
    }

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
  if (!els.todayCount || !els.overdueCount || !els.upcomingCount) {
    return;
  }

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

      if (filter === "completed") {
        return isDone;
      }

      if (isDone) {
        return false;
      }

      if (filter === "all") {
        return true;
      }

      if (filter === "today") {
        return isToday(task.dueAt);
      }

      if (filter === "upcoming") {
        return dueTs && dueTs > now && !isToday(task.dueAt);
      }

      if (filter === "overdue") {
        return dueTs && dueTs < now;
      }

      return true;
    })
  );
}

function formatMeta(task) {
  if (!task.dueAt) {
    return task.completed ? "No deadline · Completed" : "No deadline";
  }

  const due = new Date(task.dueAt);
  const pretty = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(due);

  if (task.completed) {
    return `Deadline ${pretty} · Completed`;
  }

  const now = Date.now();
  const dueTs = due.getTime();

  if (dueTs < now) {
    return `Deadline ${pretty} · Overdue`;
  }

  if (isToday(task.dueAt)) {
    const mins = Math.max(0, Math.round((dueTs - now) / 60000));
    if (mins <= 1) return `Deadline ${pretty} · Due now`;
    return `Deadline ${pretty} · In ${mins} min`;
  }

  return `Deadline ${pretty}`;
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

function normalizeDeadlineInput(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return value;
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

function loadTasks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem("focus-tasks-v1");
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const migrated = parsed.map((task) => {
      if (task.dueAt) {
        return task;
      }

      if (task.dueDate) {
        return {
          ...task,
          dueAt: `${task.dueDate}T23:59`
        };
      }

      return {
        ...task,
        dueAt: null
      };
    });

    const sorted = sortByDeadline(migrated);
    saveTasks(sorted);
    return sorted;
  } catch {
    return [];
  }
}

function saveTasks(value) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

function initializeTheme() {
  const storedTheme = localStorage.getItem(THEME_KEY);
  const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  const fallback = prefersDark ? "dark" : "light";
  const validTheme = THEMES.some((theme) => theme.id === storedTheme) ? storedTheme : fallback;
  applyTheme(validTheme);
}

function applyTheme(themeId) {
  document.body.dataset.theme = themeId;
}

function saveTheme(themeId) {
  localStorage.setItem(THEME_KEY, themeId);
}
