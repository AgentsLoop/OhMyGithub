const STORAGE_KEY = "todos.v1";

const form = document.getElementById("new-todo-form");
const input = document.getElementById("new-todo-input");
const list = document.getElementById("todo-list");
const emptyState = document.getElementById("empty-state");
const remainingLabel = document.getElementById("remaining-label");
const clearCompletedBtn = document.getElementById("clear-completed");
const filterButtons = Array.from(document.querySelectorAll(".filter-btn"));

let todos = load();
let filter = "all";

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
}

function addTodo(text) {
  const trimmed = text.trim();
  if (!trimmed) return;
  todos.unshift({ id: crypto.randomUUID(), text: trimmed, completed: false });
  save();
  render();
}

function toggleTodo(id) {
  const todo = todos.find((t) => t.id === id);
  if (!todo) return;
  todo.completed = !todo.completed;
  save();
  render();
}

function deleteTodo(id) {
  todos = todos.filter((t) => t.id !== id);
  save();
  render();
}

function clearCompleted() {
  todos = todos.filter((t) => !t.completed);
  save();
  render();
}

function visibleTodos() {
  if (filter === "active") return todos.filter((t) => !t.completed);
  if (filter === "completed") return todos.filter((t) => t.completed);
  return todos;
}

function render() {
  const items = visibleTodos();

  list.replaceChildren(
    ...items.map((todo) => {
      const li = document.createElement("li");
      li.className = "todo-item" + (todo.completed ? " completed" : "");
      li.dataset.id = todo.id;

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "todo-checkbox";
      checkbox.checked = todo.completed;
      checkbox.setAttribute("aria-label", `Mark "${todo.text}" as ${todo.completed ? "active" : "completed"}`);
      checkbox.addEventListener("change", () => toggleTodo(todo.id));

      const text = document.createElement("span");
      text.className = "todo-text";
      text.textContent = todo.text;

      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "todo-delete";
      deleteBtn.setAttribute("aria-label", `Delete "${todo.text}"`);
      deleteBtn.textContent = "\u00d7";
      deleteBtn.addEventListener("click", () => deleteTodo(todo.id));

      li.append(checkbox, text, deleteBtn);
      return li;
    })
  );

  emptyState.hidden = items.length > 0;

  const remaining = todos.filter((t) => !t.completed).length;
  remainingLabel.textContent =
    remaining === 1 ? "1 item left" : `${remaining} items left`;

  clearCompletedBtn.style.visibility = todos.some((t) => t.completed)
    ? "visible"
    : "hidden";

  filterButtons.forEach((btn) =>
    btn.classList.toggle("is-active", btn.dataset.filter === filter)
  );
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  addTodo(input.value);
  input.value = "";
  input.focus();
});

filterButtons.forEach((btn) =>
  btn.addEventListener("click", () => {
    filter = btn.dataset.filter;
    render();
  })
);

clearCompletedBtn.addEventListener("click", clearCompleted);

render();
