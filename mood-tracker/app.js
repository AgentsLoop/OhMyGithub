const STORAGE_KEY = "mood-tracker-entries";

const MOODS = {
  great: { emoji: "😄", label: "Great" },
  good: { emoji: "🙂", label: "Good" },
  okay: { emoji: "😐", label: "Okay" },
  low: { emoji: "😔", label: "Low" },
  awful: { emoji: "😫", label: "Awful" },
};

const form = document.getElementById("entry-form");
const noteInput = document.getElementById("note");
const saveBtn = document.getElementById("save-btn");
const historyList = document.getElementById("history-list");
const emptyState = document.getElementById("empty-state");
const dateDisplay = document.getElementById("date-display");

let selectedMood = null;
let entries = loadEntries();
let editingDate = todayKey();

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function formatDate(key) {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function loadEntries() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveEntries() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    alert("Could not save your entry. Local storage may be unavailable.");
  }
}

function renderDate() {
  dateDisplay.textContent = formatDate(editingDate);
}

function selectMood(mood) {
  selectedMood = mood;
  document.querySelectorAll(".mood-option").forEach((btn) => {
    const isSelected = btn.dataset.mood === mood;
    btn.classList.toggle("selected", isSelected);
    btn.setAttribute("aria-checked", String(isSelected));
  });
  updateSaveButton();
}

function clearSelection() {
  selectedMood = null;
  noteInput.value = "";
  editingDate = todayKey();
  document.querySelectorAll(".mood-option").forEach((btn) => {
    btn.classList.remove("selected");
    btn.setAttribute("aria-checked", "false");
  });
  updateSaveButton();
  renderDate();
}

function updateSaveButton() {
  saveBtn.disabled = !selectedMood;
  saveBtn.textContent =
    selectedMood && entries[editingDate]
      ? "Update Entry"
      : "Save Entry";
}

function renderHistory() {
  historyList.innerHTML = "";
  const dates = Object.keys(entries).sort((a, b) => (a < b ? 1 : -1));

  emptyState.classList.toggle("hidden", dates.length > 0);

  for (const date of dates) {
    const entry = entries[date];
    const mood = MOODS[entry.mood] || MOODS.okay;

    const li = document.createElement("li");
    li.className = "history-item";

    const emoji = document.createElement("span");
    emoji.className = "mood-emoji";
    emoji.textContent = mood.emoji;

    const info = document.createElement("div");
    info.className = "entry-info";

    const dateEl = document.createElement("div");
    dateEl.className = "entry-date";
    dateEl.textContent = `${formatDate(date)} · ${mood.label}`;

    if (entry.note) {
      const noteEl = document.createElement("div");
      noteEl.className = "entry-note";
      noteEl.textContent = entry.note;
      info.appendChild(dateEl);
      info.appendChild(noteEl);
    } else {
      info.appendChild(dateEl);
    }

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "delete-btn";
    deleteBtn.textContent = "✕";
    deleteBtn.setAttribute("aria-label", `Delete entry for ${date}`);
    deleteBtn.addEventListener("click", () => deleteEntry(date));

    li.appendChild(emoji);
    li.appendChild(info);
    li.appendChild(deleteBtn);
    historyList.appendChild(li);
  }
}

function handleFormSubmit(event) {
  event.preventDefault();
  if (!selectedMood || !MOODS[selectedMood]) return;

  const existing = entries[editingDate];
  const note = noteInput.value.trim();

  if (
    existing &&
    existing.mood === selectedMood &&
    (existing.note || "") === note
  ) {
    clearSelection();
    return;
  }

  entries[editingDate] = { mood: selectedMood, note };
  saveEntries();
  clearSelection();
  renderHistory();
}

function deleteEntry(date) {
  delete entries[date];
  saveEntries();

  if (date === editingDate) {
    const existing = entries[editingDate];
    if (!existing) {
      document.querySelectorAll(".mood-option").forEach((btn) => {
        btn.classList.remove("selected");
        btn.setAttribute("aria-checked", "false");
      });
      selectedMood = null;
      updateSaveButton();
    }
  }

  renderHistory();
}

document.querySelectorAll(".mood-option").forEach((btn) => {
  btn.addEventListener("click", () => {
    selectMood(btn.dataset.mood);

    if (btn.dataset.mood && entries[editingDate]) {
      const existing = entries[editingDate];
      if (existing.mood === btn.dataset.mood) {
        noteInput.value = existing.note || "";
      }
    }
  });
});

form.addEventListener("submit", handleFormSubmit);

renderDate();
renderHistory();
updateSaveButton();
