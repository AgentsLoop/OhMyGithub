<template>
  <main class="todo-page">
    <div class="todo-shell">
      <header class="todo-header">
        <p class="eyebrow orange">PRODUCTIVITY</p>
        <h1>Todo List</h1>
        <p class="todo-sub">Capture ideas, track progress, get things done. Stays in your browser — auto-saved.</p>
      </header>

      <section class="todo-card">
        <form class="todo-input-row" @submit.prevent="addTodo">
          <span class="todo-input-icon" aria-hidden="true">＋</span>
          <input
            v-model="newText"
            type="text"
            placeholder="What needs to be done?"
            aria-label="New todo"
            maxlength="120"
            @keydown.escape="newText = '' ; $event.target.blur()"
            enterkeyhint="done"
          />
          <button type="submit" :disabled="!newText.trim()" class="todo-add-btn" aria-label="Add todo">Add</button>
        </form>

        <div class="todo-toolbar" v-if="todos.length">
          <div class="todo-filters" role="tablist" aria-label="Filter todos" @keydown="onFilterKeydown">
            <button
              v-for="(f, idx) in filters"
              :key="f.key"
              :class="{ active: filter === f.key }"
              @click="filter = f.key"
              role="tab"
              :aria-selected="filter === f.key"
              :tabindex="filter === f.key ? 0 : -1"
              :data-idx="idx"
            >{{ f.label }}</button>
          </div>
          <div class="todo-search">
            <input
              v-model="search"
              placeholder="Search…"
              aria-label="Search todos"
              @keydown.escape="search = ''"
            />
            <button v-if="search" class="todo-search-clear" @click="search = ''" aria-label="Clear search" type="button">×</button>
          </div>
        </div>

        <label v-if="todos.length" class="todo-toggle-all">
          <input id="toggle-all" class="toggle-all" type="checkbox" :checked="allDone" @change="toggleAll($event.target.checked)" />
          <span></span>
          Mark all as {{ allDone ? 'active' : 'complete' }}
        </label>

        <TransitionGroup v-if="filteredTodos.length" name="todo-anim" tag="ul" class="todo-list">
          <li
            v-for="(todo, index) in filteredTodos"
            :key="todo.id"
            class="todo-item"
            :class="{ done: todo.done, dragging: dragId === todo.id }"
            :draggable="!isReorderDisabled"
            @dragstart="onDragStart($event, todo.id)"
            @dragend="onDragEnd"
            @dragover.prevent="onDragOver($event)"
            @drop.prevent="onDrop($event, todo.id)"
            :aria-grabbed="dragId === todo.id ? 'true' : 'false'"
          >
            <span class="todo-drag-handle" :class="{ disabled: isReorderDisabled }" aria-hidden="true" title="Drag to reorder">⠿</span>

            <label class="todo-check">
              <input
                type="checkbox"
                :checked="todo.done"
                @change="toggle(todo.id)"
                :aria-label="(todo.done ? 'Mark as active: ' : 'Mark as done: ') + todo.text"
              />
              <span class="check-box"><span v-if="todo.done">✓</span></span>
            </label>

            <div class="todo-text-wrap" @dblclick="startEdit(todo)">
              <span v-if="editingId !== todo.id" class="todo-text" :class="{ strike: todo.done }">{{ todo.text }}</span>
              <input
                v-else
                v-model="editText"
                class="todo-edit-input"
                :ref="el => setEditRef(el, todo.id)"
                @keydown.enter="commitEdit(todo.id)"
                @keydown.escape="cancelEdit"
                @blur="onEditBlur(todo.id)"
                maxlength="120"
                aria-label="Edit todo"
              />
              <small class="todo-meta">{{ formatDate(todo.createdAt) }} · <span :class="'priority-' + todo.priority">{{ todo.priority }}</span></small>
            </div>

            <select class="todo-priority" :value="todo.priority" @change="setPriority(todo.id, $event.target.value)" aria-label="Priority">
              <option value="low">Low</option>
              <option value="med">Med</option>
              <option value="high">High</option>
            </select>

            <div class="todo-reorder" v-if="!isReorderDisabled">
              <button class="todo-move-btn" @click="move(todo.id, -1)" :disabled="index === 0" aria-label="Move up" title="Move up">↑</button>
              <button class="todo-move-btn" @click="move(todo.id, 1)" :disabled="index === filteredTodos.length - 1" aria-label="Move down" title="Move down">↓</button>
            </div>

            <button class="todo-action" @click="startEdit(todo)" title="Edit" aria-label="Edit">✎</button>
            <button class="todo-action danger" @click="remove(todo.id)" title="Delete" aria-label="Delete">×</button>
          </li>
        </TransitionGroup>

        <div v-else class="todo-empty">
          <div v-if="todos.length === 0" class="todo-empty-inner">
            <span class="todo-empty-icon" aria-hidden="true">◯</span>
            <h3>No todos yet</h3>
            <p>Add your first task above — press <kbd>Enter</kbd> to create instantly.</p>
          </div>
          <div v-else class="todo-empty-inner">
            <h3>No matching tasks</h3>
            <p>Try a different filter or search term.</p>
            <button class="todo-clear" @click="filter='all'; search=''">Show all</button>
          </div>
        </div>

        <footer class="todo-footer" v-if="todos.length">
          <span class="todo-count" aria-live="polite"><strong>{{ remaining }}</strong> {{ remaining === 1 ? 'item' : 'items' }} left</span>
          <div class="todo-footer-actions">
            <button v-if="completedCount" @click="clearCompleted" class="todo-clear">Clear completed ({{ completedCount }})</button>
            <button @click="clearAll" class="todo-clear danger-text">Clear all</button>
          </div>
        </footer>
      </section>

      <div class="todo-stats" v-if="todos.length" aria-live="polite">
        <div class="stat"><strong>{{ todos.length }}</strong><span>Total</span></div>
        <div class="stat"><strong>{{ remaining }}</strong><span>Active</span></div>
        <div class="stat"><strong>{{ completedCount }}</strong><span>Done</span></div>
        <div class="stat"><strong>{{ completionRate }}%</strong><span>Complete</span></div>
      </div>

      <p class="todo-hint">Tip: Double-click text to edit • Drag <span class="hide-mobile">or use arrow buttons</span> to reorder • Data saved in localStorage</p>
      <p v-if="isReorderDisabled" class="todo-hint muted">Reordering disabled while filtering/searching — show all to reorder.</p>
    </div>
  </main>
</template>

<script setup>
import { computed, onMounted, ref, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const STORAGE_KEY = 'omg-todos-v1'

const filters = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'completed', label: 'Completed' },
]

const todos = ref([])
const newText = ref('')
const filter = ref('all')
const search = ref('')
const editingId = ref(null)
const editText = ref('')
const dragId = ref(null)
let cancelingEdit = false
let editInputEl = null
const route = useRoute()
const router = useRouter()
const validFilters = ['all', 'active', 'completed']

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        // validate shape
        todos.value = parsed.filter(t => t && typeof t.id === 'string' && typeof t.text === 'string')
      } else {
        todos.value = []
      }
    } else {
      todos.value = [
        { id: '1', text: 'Welcome to your todo list — try adding a task!', done: false, priority: 'med', createdAt: Date.now() - 100000 },
        { id: '2', text: 'Double-click to edit a task', done: false, priority: 'low', createdAt: Date.now() - 80000 },
        { id: '3', text: 'Tick the circle to complete', done: true, priority: 'high', createdAt: Date.now() - 60000 },
      ]
    }
  } catch { todos.value = [] }
}

function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(todos.value)) } catch {}
}

watch(todos, save, { deep: true })

// sync filter to URL query (TodoMVC hash-style via router query)
watch(filter, (v) => {
  if (!validFilters.includes(v)) return
  const q = { ...route.query }
  if (v === 'all') delete q.filter
  else q.filter = v
  router.replace({ query: q })
})

onMounted(() => {
  load()
  const qf = route.query.filter
  if (typeof qf === 'string' && validFilters.includes(qf)) filter.value = qf
})

const remaining = computed(() => todos.value.filter(t => !t.done).length)
const completedCount = computed(() => todos.value.filter(t => t.done).length)
const completionRate = computed(() => todos.value.length ? Math.round((completedCount.value / todos.value.length) * 100) : 0)

const isReorderDisabled = computed(() => filter.value !== 'all' || !!search.value.trim())
const allDone = computed(() => todos.value.length > 0 && todos.value.every(t => t.done))

const filteredTodos = computed(() => {
  let list = [...todos.value]
  if (filter.value === 'active') list = list.filter(t => !t.done)
  if (filter.value === 'completed') list = list.filter(t => t.done)
  if (search.value.trim()) {
    const q = search.value.toLowerCase()
    list = list.filter(t => t.text.toLowerCase().includes(q))
  }
  return list
})

function addTodo() {
  const text = newText.value.trim()
  if (!text) return
  todos.value.unshift({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    text,
    done: false,
    priority: 'med',
    createdAt: Date.now(),
  })
  newText.value = ''
}

function toggle(id) {
  const t = todos.value.find(x => x.id === id)
  if (t) t.done = !t.done
}

function remove(id) {
  todos.value = todos.value.filter(t => t.id !== id)
  if (editingId.value === id) editingId.value = null
}

function setEditRef(el, id) {
  if (editingId.value === id && el) {
    editInputEl = el
    nextTick(() => el.focus())
  }
}

function startEdit(todo) {
  editingId.value = todo.id
  editText.value = todo.text
  cancelingEdit = false
}

function commitEdit(id) {
  if (cancelingEdit) return
  const t = todos.value.find(x => x.id === id)
  if (t) {
    const v = editText.value.trim()
    if (v) t.text = v
    else remove(id)
  }
  editingId.value = null
}

function cancelEdit() {
  cancelingEdit = true
  editingId.value = null
  nextTick(() => { cancelingEdit = false })
}

function onEditBlur(id) {
  // delay to allow Escape to cancel before commit
  setTimeout(() => commitEdit(id), 120)
}

function setPriority(id, p) {
  const t = todos.value.find(x => x.id === id)
  if (t && ['low','med','high'].includes(p)) t.priority = p
}

function toggleAll(checked) {
  todos.value.forEach(t => t.done = checked)
}

function clearCompleted() {
  todos.value = todos.value.filter(t => !t.done)
}

function clearAll() {
  if (confirm('Clear all todos?')) todos.value = []
}

function formatDate(ts) {
  const d = new Date(ts)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function onFilterKeydown(e) {
  const tabs = [...e.currentTarget.querySelectorAll('[role="tab"]')]
  const idx = tabs.indexOf(document.activeElement)
  if (e.key === 'ArrowRight') {
    e.preventDefault()
    const next = tabs[(idx + 1) % tabs.length]
    next.focus(); filter.value = next.textContent.toLowerCase() === 'active' ? 'active' : next.textContent.toLowerCase() === 'completed' ? 'completed' : 'all'
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault()
    const prev = tabs[(idx - 1 + tabs.length) % tabs.length]
    prev.focus(); filter.value = prev.textContent.toLowerCase() === 'active' ? 'active' : prev.textContent.toLowerCase() === 'completed' ? 'completed' : 'all'
  } else if (e.key === 'Home') {
    e.preventDefault(); tabs[0].focus(); filter.value = 'all'
  } else if (e.key === 'End') {
    e.preventDefault(); tabs[tabs.length -1].focus(); filter.value = 'completed'
  }
}

function onDragStart(e, id) {
  if (isReorderDisabled.value) { e.preventDefault(); return }
  dragId.value = id
  e.dataTransfer.effectAllowed = 'move'
  e.dataTransfer.setData('text/plain', id)
}

function onDragEnd() {
  dragId.value = null
}

function onDragOver(e) {
  e.dataTransfer.dropEffect = 'move'
}

function onDrop(e, targetId) {
  const fromId = dragId.value || e.dataTransfer.getData('text/plain')
  if (!fromId || fromId === targetId) return
  if (isReorderDisabled.value) return
  const fromIdx = todos.value.findIndex(t => t.id === fromId)
  const toIdx = todos.value.findIndex(t => t.id === targetId)
  if (fromIdx === -1 || toIdx === -1) return
  const [moved] = todos.value.splice(fromIdx, 1)
  todos.value.splice(toIdx, 0, moved)
  dragId.value = null
}

function move(id, dir) {
  const idx = todos.value.findIndex(t => t.id === id)
  if (idx === -1) return
  const newIdx = idx + dir
  if (newIdx < 0 || newIdx >= todos.value.length) return
  const [m] = todos.value.splice(idx, 1)
  todos.value.splice(newIdx, 0, m)
}
</script>

<style scoped>
.todo-page {
  min-height: calc(100vh - 68px);
  background: #0c0c0d;
  padding: 40px 20px 80px;
  display: grid;
  justify-items: center;
}
.todo-shell {
  width: min(720px, 100%);
}
.todo-header {
  text-align: center;
  margin-bottom: 28px;
}
.todo-header h1 {
  font-size: clamp(36px, 5vw, 52px);
  letter-spacing: -0.04em;
  margin: 6px 0 10px;
}
.todo-sub {
  color: #9d9d9f;
  font-size: 15px;
  line-height: 1.6;
  max-width: 520px;
  margin: 0 auto;
}
.todo-card {
  background: #171718;
  border: 1px solid #2a2a2c;
  border-radius: 20px;
  overflow: hidden;
  box-shadow: 0 18px 50px #0006;
}
.todo-input-row {
  display: grid;
  grid-template-columns: 36px 1fr auto;
  align-items: center;
  gap: 8px;
  padding: 14px 14px 14px 18px;
  border-bottom: 1px solid #2a2a2c;
  background: #1e1e20;
}
.todo-input-icon {
  color: var(--orange);
  font-size: 18px;
  display: grid;
  place-items: center;
}
.todo-input-row input {
  background: transparent;
  border: 0;
  outline: 0;
  color: white;
  font-size: 16px;
  width: 100%;
}
.todo-input-row input::placeholder { color: #6e6e70; }
.todo-add-btn {
  background: var(--orange);
  color: #111;
  border: 0;
  border-radius: 999px;
  padding: 10px 20px;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 0.15s, transform 0.1s;
}
.todo-add-btn:disabled { opacity: 0.4; cursor: default; }
.todo-add-btn:not(:disabled):active { transform: scale(0.97); }
.todo-add-btn:focus-visible { outline: 2px solid white; outline-offset: 2px; }

.todo-toolbar {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #2a2a2c;
  flex-wrap: wrap;
}
.todo-filters {
  display: flex;
  gap: 6px;
  background: #0f0f10;
  padding: 4px;
  border-radius: 999px;
  border: 1px solid #2a2a2c;
}
.todo-filters button {
  border: 0;
  background: transparent;
  color: #9d9d9f;
  padding: 6px 14px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.todo-filters button.active {
  background: white;
  color: #111;
}
.todo-filters button:focus-visible { outline: 2px solid var(--orange); outline-offset: 1px; }
.todo-search { position: relative; display: flex; align-items: center; }
.todo-search input {
  background: #0f0f10;
  border: 1px solid #2a2a2c;
  border-radius: 999px;
  padding: 8px 14px;
  padding-right: 28px;
  color: white;
  font-size: 13px;
  outline: 0;
  width: 180px;
  transition: border-color 0.15s;
}
.todo-search input:focus { border-color: #444; }
.todo-search input:focus-visible { outline: 2px solid var(--orange); outline-offset: 1px; }
.todo-search input::placeholder { color: #666; }
.todo-search-clear {
  position: absolute;
  right: 6px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 0;
  background: #2a2a2c;
  color: #aaa;
  cursor: pointer;
  display: grid;
  place-items: center;
  font-size: 12px;
  line-height: 1;
}
.todo-search-clear:hover { color: white; background: #333; }

.todo-toggle-all {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-bottom: 1px solid #232326;
  background: #131316;
  font-size: 12px;
  color: #9d9d9f;
  cursor: pointer;
  user-select: none;
}
.todo-toggle-all input {
  accent-color: #1c8b59;
  width: 16px;
  height: 16px;
}
.todo-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.todo-item {
  display: grid;
  grid-template-columns: 18px 36px 1fr auto auto auto auto;
  gap: 8px;
  align-items: center;
  padding: 14px 12px 14px 8px;
  border-bottom: 1px solid #232326;
  transition: background 0.15s, opacity 0.15s, transform 0.2s;
  cursor: grab;
  background: #171718;
}
.todo-item:hover { background: #1c1c1e; }
.todo-item.done { opacity: 0.7; }
.todo-item.dragging { opacity: 0.35; border: 1px dashed #444; }
.todo-drag-handle {
  color: #3a3a3c;
  font-size: 12px;
  cursor: grab;
  text-align: center;
  user-select: none;
}
.todo-drag-handle.disabled { opacity: 0.2; cursor: not-allowed; }
.todo-check {
  cursor: pointer;
  display: grid;
  place-items: center;
  position: relative;
}
.todo-check input { position: absolute; opacity: 0; width: 1px; height: 1px; overflow: hidden; }
.todo-check input:focus-visible + .check-box { outline: 2px solid var(--orange); outline-offset: 2px; }
.check-box {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: 1.5px solid #444;
  display: grid;
  place-items: center;
  color: white;
  font-size: 13px;
  transition: 0.15s;
}
.todo-item.done .check-box {
  background: #1c8b59;
  border-color: #1c8b59;
}
.todo-text-wrap {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.todo-text {
  font-size: 14.5px;
  line-height: 1.4;
  word-break: break-word;
}
.todo-text.strike { text-decoration: line-through; color: #888; }
.todo-meta {
  color: #6e6e70;
  font-size: 11px;
}
.priority-high { color: #ff6b6b; font-weight: 700; }
.priority-med { color: #f0ad4e; }
.priority-low { color: #6e9bff; }
.todo-edit-input {
  background: #0f0f10;
  border: 1px solid var(--orange);
  border-radius: 8px;
  padding: 8px 10px;
  color: white;
  font-size: 14px;
  outline: 0;
  width: 100%;
}
.todo-edit-input:focus-visible { outline: 2px solid var(--orange); outline-offset: 1px; }
.todo-priority {
  background: #0f0f10;
  border: 1px solid #2a2a2c;
  color: #aaa;
  border-radius: 8px;
  padding: 6px 6px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  cursor: pointer;
}
.todo-priority:focus-visible { outline: 2px solid var(--orange); outline-offset: 1px; }
.todo-reorder {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.todo-move-btn {
  width: 22px;
  height: 16px;
  border: 1px solid #2a2a2c;
  background: #0f0f10;
  color: #777;
  border-radius: 4px;
  cursor: pointer;
  font-size: 8px;
  display: grid;
  place-items: center;
  line-height: 1;
}
.todo-move-btn:hover:not(:disabled) { color: white; border-color: #555; }
.todo-move-btn:disabled { opacity: 0.25; cursor: default; }
.todo-move-btn:focus-visible { outline: 1px solid var(--orange); }
.todo-action {
  width: 28px;
  height: 28px;
  border: 1px solid #2a2a2c;
  background: #0f0f10;
  color: #aaa;
  border-radius: 8px;
  cursor: pointer;
  display: grid;
  place-items: center;
  font-size: 14px;
  transition: color 0.15s, border-color 0.15s;
}
.todo-action:hover { color: white; border-color: #555; }
.todo-action.danger:hover { color: #ff6b6b; border-color: #ff6b6b; }
.todo-action:focus-visible { outline: 2px solid var(--orange); outline-offset: 1px; }

.todo-empty {
  padding: 48px 24px;
  text-align: center;
  color: #777;
}
.todo-empty-inner { animation: fadeIn 0.3s ease; }
.todo-empty-icon { font-size: 42px; color: #333; display: block; }
.todo-empty h3 { color: #ccc; margin: 12px 0 6px; font-size: 16px; }
.todo-empty p { font-size: 13px; line-height: 1.5; max-width: 320px; margin: 0 auto; }
.todo-empty kbd { background: #222; border: 1px solid #333; border-bottom-width: 2px; border-radius: 4px; padding: 1px 5px; font-size: 11px; color: #aaa; }

.todo-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px;
  background: #0f0f10;
  font-size: 13px;
  flex-wrap: wrap;
  gap: 10px;
}
.todo-count { color: #9d9d9f; }
.todo-count strong { color: white; }
.todo-footer-actions { display: flex; gap: 8px; }
.todo-clear {
  background: transparent;
  border: 1px solid #2a2a2c;
  color: #9d9d9f;
  border-radius: 999px;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
}
.todo-clear:hover { color: white; border-color: #555; }
.todo-clear:focus-visible { outline: 2px solid var(--orange); outline-offset: 1px; }
.danger-text:hover { color: #ff6b6b !important; border-color: #ff6b6b !important; }

.todo-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-top: 16px;
}
.stat {
  background: #171718;
  border: 1px solid #2a2a2c;
  border-radius: 14px;
  padding: 14px;
  text-align: center;
}
.stat strong { display: block; font-size: 22px; color: white; }
.stat span { font-size: 11px; color: #777; text-transform: uppercase; letter-spacing: 0.08em; }
.todo-hint {
  text-align: center;
  color: #555;
  font-size: 11px;
  margin-top: 14px;
}
.todo-hint.muted { color: #7a5a2a; margin-top: 6px; }

/* animations */
.todo-anim-enter-active, .todo-anim-leave-active { transition: all 0.25s ease; }
.todo-anim-enter-from { opacity: 0; transform: translateY(-8px); }
.todo-anim-leave-to { opacity: 0; transform: translateX(12px); }
.todo-anim-leave-active { position: absolute; }
.todo-anim-move { transition: transform 0.25s ease; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }

@media (max-width: 600px) {
  .todo-item { grid-template-columns: 14px 32px 1fr auto auto auto; gap: 6px; padding: 12px 8px; }
  .todo-priority { padding: 5px 4px; font-size: 10px; }
  .todo-search input { width: 120px; }
  .todo-stats { grid-template-columns: repeat(2, 1fr); }
  .hide-mobile { display: none; }
  .todo-reorder { display: none; }
}
@media (max-width: 380px) {
  .todo-toolbar { gap: 8px; }
  .todo-filters button { padding: 6px 10px; font-size: 12px; }
}
</style>
