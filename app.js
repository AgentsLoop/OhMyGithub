(function () {
  "use strict";

  var STORAGE_KEY = "todos";
  var listEl = document.getElementById("todo-list");
  var formEl = document.getElementById("new-todo-form");
  var inputEl = document.getElementById("new-todo-input");
  var emptyEl = document.getElementById("empty-message");

  function load() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch (e) {
      return [];
    }
  }

  function save(todos) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
  }

  function render() {
    var todos = load();
    listEl.textContent = "";
    emptyEl.hidden = todos.length > 0;

    todos.forEach(function (todo) {
      var li = document.createElement("li");
      if (todo.done) li.classList.add("done");

      var checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = todo.done;
      checkbox.setAttribute("aria-label", "Toggle " + todo.text);
      checkbox.addEventListener("change", function () {
        toggle(todo.id);
      });

      var text = document.createElement("span");
      text.textContent = todo.text;

      var deleteBtn = document.createElement("button");
      deleteBtn.className = "delete";
      deleteBtn.textContent = "Delete";
      deleteBtn.setAttribute("aria-label", "Delete " + todo.text);
      deleteBtn.addEventListener("click", function () {
        remove(todo.id);
      });

      li.appendChild(checkbox);
      li.appendChild(text);
      li.appendChild(deleteBtn);
      listEl.appendChild(li);
    });
  }

  function add(text) {
    if (!text.trim()) return;
    var todos = load();
    todos.push({ id: Date.now(), text: text.trim(), done: false });
    save(todos);
    render();
  }

  function toggle(id) {
    var todos = load().map(function (todo) {
      return todo.id === id ? Object.assign({}, todo, { done: !todo.done }) : todo;
    });
    save(todos);
    render();
  }

  function remove(id) {
    save(load().filter(function (todo) {
      return todo.id !== id;
    }));
    render();
  }

  formEl.addEventListener("submit", function (e) {
    e.preventDefault();
    add(inputEl.value);
    inputEl.value = "";
    inputEl.focus();
  });

  window.__todos = { add: add, toggle: toggle, remove: remove, load: load };
  render();
})();
