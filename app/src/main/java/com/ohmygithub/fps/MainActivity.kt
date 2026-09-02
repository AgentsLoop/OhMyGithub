package com.ohmygithub.fps

import android.content.Context
import android.content.SharedPreferences
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Clear
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch


// --- Data & Logic (testable pure functions) ---

data class TodoItem(val id: Long, val text: String, val done: Boolean, val createdAt: Long)

enum class TodoFilter { ALL, ACTIVE, COMPLETED }

fun filterTodos(todos: List<TodoItem>, filter: TodoFilter): List<TodoItem> = when (filter) {
    TodoFilter.ALL -> todos
    TodoFilter.ACTIVE -> todos.filter { !it.done }
    TodoFilter.COMPLETED -> todos.filter { it.done }
}

fun addTodo(todos: List<TodoItem>, text: String, id: Long = System.currentTimeMillis(), createdAt: Long = System.currentTimeMillis()): List<TodoItem> {
    val trimmed = text.trim()
    if (trimmed.isEmpty()) return todos
    return todos + TodoItem(id = id, text = trimmed, done = false, createdAt = createdAt)
}

fun toggleTodo(todos: List<TodoItem>, id: Long): List<TodoItem> =
    todos.map { if (it.id == id) it.copy(done = !it.done) else it }

fun deleteTodo(todos: List<TodoItem>, id: Long): List<TodoItem> =
    todos.filterNot { it.id == id }

fun updateTodoText(todos: List<TodoItem>, id: Long, newText: String): List<TodoItem> {
    val trimmed = newText.trim()
    if (trimmed.isEmpty()) return todos
    return todos.map { if (it.id == id) it.copy(text = trimmed) else it }
}

fun clearCompleted(todos: List<TodoItem>): List<TodoItem> =
    todos.filterNot { it.done }

fun countActive(todos: List<TodoItem>): Int = todos.count { !it.done }
fun countCompleted(todos: List<TodoItem>): Int = todos.count { it.done }

private const val MAX_TODO_LENGTH = 200

private fun escapeJson(s: String): String = s
    .replace("\\", "\\\\")
    .replace("\"", "\\\"")
    .replace("\b", "\\b")
    .replace("\u000C", "\\f")
    .replace("\n", "\\n")
    .replace("\r", "\\r")
    .replace("\t", "\\t")

private fun unescapeJson(s: String): String {
    val sb = StringBuilder()
    var i = 0
    while (i < s.length) {
        if (s[i] == '\\' && i + 1 < s.length) {
            when (s[i + 1]) {
                '\\' -> sb.append('\\')
                '"' -> sb.append('"')
                'b' -> sb.append('\b')
                'f' -> sb.append('\u000C')
                'n' -> sb.append('\n')
                'r' -> sb.append('\r')
                't' -> sb.append('\t')
                else -> sb.append(s[i + 1])
            }
            i += 2
        } else {
            sb.append(s[i]); i++
        }
    }
    return sb.toString()
}

fun todosToJson(todos: List<TodoItem>): String {
    if (todos.isEmpty()) return "[]"
    return buildString {
        append("[")
        todos.forEachIndexed { idx, t ->
            append("{\"id\":${t.id},\"text\":\"${escapeJson(t.text)}\",\"done\":${t.done},\"createdAt\":${t.createdAt}}")
            if (idx < todos.size - 1) append(",")
        }
        append("]")
    }
}

fun todosFromJson(json: String): List<TodoItem> {
    if (json.isBlank()) return emptyList()
    val trimmed = json.trim()
    if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) return emptyList()
    val inner = trimmed.substring(1, trimmed.length - 1).trim()
    if (inner.isEmpty()) return emptyList()
    return try {
        val result = mutableListOf<TodoItem>()
        var i = 0
        while (i < inner.length) {
            // find next object start
            while (i < inner.length && inner[i] != '{') i++
            if (i >= inner.length) break
            var depth = 0
            var inStr = false
            var esc = false
            var start = i
            var end = -1
            var j = i
            while (j < inner.length) {
                val c = inner[j]
                if (esc) { esc = false }
                else if (c == '\\' && inStr) { esc = true }
                else if (c == '"') { inStr = !inStr }
                else if (!inStr) {
                    if (c == '{') depth++
                    else if (c == '}') {
                        depth--
                        if (depth == 0) { end = j; break }
                    }
                }
                j++
            }
            if (end == -1) break
            val obj = inner.substring(start, end + 1)
            // parse fields via helpers that respect escaping
            fun extractString(key: String): String? {
                val k = "\"$key\""
                val ki = obj.indexOf(k)
                if (ki == -1) return null
                var p = obj.indexOf(':', ki + k.length)
                if (p == -1) return null
                p++
                while (p < obj.length && obj[p].isWhitespace()) p++
                if (p >= obj.length || obj[p] != '"') return null
                p++
                val sb = StringBuilder()
                var esc2 = false
                while (p < obj.length) {
                    val ch = obj[p]
                    if (esc2) {
                        when (ch) {
                            '\\' -> sb.append('\\')
                            '"' -> sb.append('"')
                            'b' -> sb.append('\b')
                            'f' -> sb.append('\u000C')
                            'n' -> sb.append('\n')
                            'r' -> sb.append('\r')
                            't' -> sb.append('\t')
                            else -> sb.append(ch)
                        }
                        esc2 = false
                    } else if (ch == '\\') esc2 = true
                    else if (ch == '"') break
                    else sb.append(ch)
                    p++
                }
                return sb.toString()
            }
            fun extractLong(key: String): Long? {
                val k = "\"$key\""
                val ki = obj.indexOf(k)
                if (ki == -1) return null
                var p = obj.indexOf(':', ki + k.length) + 1
                while (p < obj.length && obj[p].isWhitespace()) p++
                var e = p
                while (e < obj.length && (obj[e].isDigit() || obj[e] == '-')) e++
                return obj.substring(p, e).toLongOrNull()
            }
            fun extractBool(key: String): Boolean? {
                val k = "\"$key\""
                val ki = obj.indexOf(k)
                if (ki == -1) return null
                var p = obj.indexOf(':', ki + k.length) + 1
                while (p < obj.length && obj[p].isWhitespace()) p++
                return when {
                    obj.startsWith("true", p) -> true
                    obj.startsWith("false", p) -> false
                    else -> null
                }
            }
            val id = extractLong("id") ?: 0L
            val text = extractString("text") ?: ""
            val done = extractBool("done") ?: false
            val createdAt = extractLong("createdAt") ?: System.currentTimeMillis()
            result.add(TodoItem(id, text, done, createdAt))
            i = end + 1
        }
        result
    } catch (_: Exception) {
        emptyList()
    }
}

object TodoPrefs {
    private const val PREFS = "todo_prefs"
    private const val KEY = "todos_json"
    fun load(context: Context): List<TodoItem> {
        val sp: SharedPreferences = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val json = sp.getString(KEY, null) ?: return emptyList()
        return todosFromJson(json)
    }
    fun save(context: Context, todos: List<TodoItem>) {
        val sp = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        sp.edit().putString(KEY, todosToJson(todos)).apply()
    }
}

// --- Theme ---

private val LightScheme = lightColorScheme(
    primary = Color(0xFF6750A4),
    onPrimary = Color.White,
    primaryContainer = Color(0xFFEADDFF),
    onPrimaryContainer = Color(0xFF21005D),
    secondary = Color(0xFF625B71),
    secondaryContainer = Color(0xFFE8DEF8),
    onSecondaryContainer = Color(0xFF1D192B),
    background = Color(0xFFFFFBFE),
    surface = Color(0xFFFFFBFE),
    surfaceVariant = Color(0xFFE7E0EC),
    outline = Color(0xFF79747E),
    outlineVariant = Color(0xFFCAC4D0),
    error = Color(0xFFBA1A1A),
    errorContainer = Color(0xFFFFDAD6),
    onErrorContainer = Color(0xFF410002)
)
private val DarkScheme = darkColorScheme(
    primary = Color(0xFFD0BCFF),
    onPrimary = Color(0xFF381E72),
    primaryContainer = Color(0xFF4F378B),
    onPrimaryContainer = Color(0xFFEADDFF),
    secondary = Color(0xFFCCC2DC),
    secondaryContainer = Color(0xFF4F378B),
    onSecondaryContainer = Color(0xFFE8DEF8),
    background = Color(0xFF141218),
    surface = Color(0xFF141218),
    surfaceVariant = Color(0xFF49454F),
    outline = Color(0xFF938F99),
    outlineVariant = Color(0xFF49454F),
    error = Color(0xFFFFB4AB),
    errorContainer = Color(0xFF93000A),
    onErrorContainer = Color(0xFFFFDAD6)
)

// --- Activity ---

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        setContent {
            val dark = isSystemInDarkTheme()
            MaterialTheme(colorScheme = if (dark) DarkScheme else LightScheme) {
                TodoApp()
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TodoApp() {
    val context = LocalContext.current
    var todos by remember { mutableStateOf(TodoPrefs.load(context)) }
    var input by rememberSaveable { mutableStateOf("") }
    var filterName by rememberSaveable { mutableStateOf(TodoFilter.ALL.name) }
    val filter = remember(filterName) { runCatching { TodoFilter.valueOf(filterName) }.getOrDefault(TodoFilter.ALL) }
    var editingId by remember { mutableStateOf<Long?>(null) }
    var editingText by remember { mutableStateOf("") }

    val snackbarHostState = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()

    // For undo: hold last deleted single item and last cleared batch
    var lastDeleted by remember { mutableStateOf<Pair<TodoItem, Int>?>(null) }
    var lastCleared by remember { mutableStateOf<List<TodoItem>?>(null) }

    // persist on change
    LaunchedEffect(todos) {
        TodoPrefs.save(context, todos)
    }

    val filtered = remember(todos, filter) { filterTodos(todos, filter) }
    val activeCount = remember(todos) { countActive(todos) }
    val completedCount = remember(todos) { countCompleted(todos) }

    fun doAdd() {
        val trimmed = input.trim()
        if (trimmed.isEmpty()) return
        // Avoid id collision on rapid adds: ensure new id not already present
        var newId = System.currentTimeMillis()
        while (todos.any { it.id == newId }) newId += 1
        todos = addTodo(todos, trimmed, id = newId, createdAt = System.currentTimeMillis())
        input = ""
    }

    fun deleteWithUndo(id: Long) {
        val idx = todos.indexOfFirst { it.id == id }
        if (idx == -1) return
        val item = todos[idx]
        lastDeleted = item to idx
        lastCleared = null
        todos = deleteTodo(todos, id)
        // close editing if it was the deleted item
        if (editingId == id) editingId = null
        scope.launch {
            // Sanitize newlines for single-line snackbar
            val preview = item.text.replace("\n", " ").replace("\r", " ").take(32)
            val suffix = if (item.text.length > 32) "…" else ""
            val result = snackbarHostState.showSnackbar(
                message = "\"$preview$suffix\" deleted",
                actionLabel = "Undo",
                withDismissAction = true,
                duration = SnackbarDuration.Short
            )
            if (result == SnackbarResult.ActionPerformed) {
                val (deleted, index) = lastDeleted ?: return@launch
                // restore at original position if possible, otherwise append
                val mutable = todos.toMutableList()
                if (index in 0..mutable.size) mutable.add(index, deleted) else mutable.add(deleted)
                todos = mutable
                lastDeleted = null
            } else {
                lastDeleted = null
            }
        }
    }

    fun clearCompletedWithUndo() {
        val completed = todos.filter { it.done }
        if (completed.isEmpty()) return
        lastCleared = completed
        lastDeleted = null
        todos = clearCompleted(todos)
        if (editingId != null && todos.none { it.id == editingId }) editingId = null
        scope.launch {
            val result = snackbarHostState.showSnackbar(
                message = "${completed.size} completed ${if (completed.size == 1) "task" else "tasks"} cleared",
                actionLabel = "Undo",
                withDismissAction = true,
                duration = SnackbarDuration.Short
            )
            if (result == SnackbarResult.ActionPerformed) {
                val toRestore = lastCleared ?: return@launch
                // restore preserving original insertion order (by createdAt)
                todos = (todos + toRestore).sortedBy { it.createdAt }
                lastCleared = null
            } else {
                lastCleared = null
            }
        }
    }

    Scaffold(
        topBar = {
            CenterAlignedTopAppBar(
                title = {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        modifier = Modifier.semantics { heading() }
                    ) {
                        Text("Tasks", style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold))
                        Text(
                            "$activeCount active • ${todos.size} total",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                },
                colors = TopAppBarDefaults.centerAlignedTopAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface
                )
            )
        },
        snackbarHost = {
            SnackbarHost(hostState = snackbarHostState) { data ->
                Snackbar(
                    snackbarData = data,
                    containerColor = MaterialTheme.colorScheme.inverseSurface,
                    contentColor = MaterialTheme.colorScheme.inverseOnSurface,
                    actionColor = MaterialTheme.colorScheme.inversePrimary,
                    dismissActionContentColor = MaterialTheme.colorScheme.inverseOnSurface
                )
            }
        },
        containerColor = MaterialTheme.colorScheme.background,
        contentWindowInsets = WindowInsets.safeDrawing
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .imePadding()
                .background(MaterialTheme.colorScheme.background)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .widthIn(max = 720.dp)
                    .align(Alignment.TopCenter)
                    .padding(horizontal = 16.dp)
            ) {
                // Input row
                Card(
                    modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow),
                    elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        OutlinedTextField(
                            value = input,
                            onValueChange = { if (it.length <= MAX_TODO_LENGTH) input = it },
                            modifier = Modifier.weight(1f).semantics { contentDescription = "New task input" },
                            placeholder = { Text("What needs to be done?") },
                            label = { Text("Task") },
                            singleLine = true,
                            shape = RoundedCornerShape(12.dp),
                            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
                            keyboardActions = KeyboardActions(onDone = { doAdd() }),
                            trailingIcon = {
                                if (input.isNotEmpty()) {
                                    IconButton(
                                        onClick = { input = "" },
                                        modifier = Modifier.size(48.dp)
                                    ) {
                                        Icon(
                                            Icons.Filled.Clear,
                                            contentDescription = "Clear input",
                                            modifier = Modifier.size(18.dp)
                                        )
                                    }
                                }
                            },
                            supportingText = {
                                if (input.length >= MAX_TODO_LENGTH - 20) {
                                    Text(
                                        "${input.length}/$MAX_TODO_LENGTH",
                                        color = if (input.length >= MAX_TODO_LENGTH) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.outline,
                                        fontSize = 11.sp
                                    )
                                }
                            },
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = MaterialTheme.colorScheme.primary,
                                unfocusedBorderColor = MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)
                            )
                        )
                        FilledButtonWithHeight(
                            onClick = { doAdd() },
                            enabled = input.trim().isNotEmpty(),
                            modifier = Modifier.height(56.dp)
                        ) {
                            Text("Add", fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(horizontal = 8.dp))
                        }
                    }
                }

                Spacer(Modifier.height(16.dp))

                // Filter chips row
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    FilterChip(
                        selected = filter == TodoFilter.ALL,
                        onClick = { filterName = TodoFilter.ALL.name },
                        label = { Text("All (${todos.size})") },
                        leadingIcon = if (filter == TodoFilter.ALL) {
                            { Icon(Icons.Filled.CheckCircle, contentDescription = null, modifier = Modifier.size(16.dp)) }
                        } else null,
                        modifier = Modifier.semantics { contentDescription = "Filter All, ${todos.size} items" }
                    )
                    FilterChip(
                        selected = filter == TodoFilter.ACTIVE,
                        onClick = { filterName = TodoFilter.ACTIVE.name },
                        label = { Text("Active ($activeCount)") },
                        modifier = Modifier.semantics { contentDescription = "Filter Active, $activeCount items" }
                    )
                    FilterChip(
                        selected = filter == TodoFilter.COMPLETED,
                        onClick = { filterName = TodoFilter.COMPLETED.name },
                        label = { Text("Completed ($completedCount)") },
                        modifier = Modifier.semantics { contentDescription = "Filter Completed, $completedCount items" }
                    )
                    Spacer(Modifier.weight(1f))
                    AnimatedVisibility(visible = completedCount > 0) {
                        TextButton(
                            onClick = { clearCompletedWithUndo() },
                            modifier = Modifier.height(48.dp)
                        ) {
                            Text("Clear completed", fontSize = 13.sp)
                        }
                    }
                }

                Spacer(Modifier.height(12.dp))

                if (todos.isEmpty()) {
                    // Empty state
                    EmptyState(modifier = Modifier.fillMaxWidth().padding(top = 32.dp))
                } else if (filtered.isEmpty()) {
                    // No results for filter – still useful and actionable
                    Box(
                        modifier = Modifier.fillMaxWidth().padding(top = 48.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Icon(Icons.Filled.CheckCircle, contentDescription = null, modifier = Modifier.size(48.dp), tint = MaterialTheme.colorScheme.outline.copy(alpha = 0.6f))
                            Spacer(Modifier.height(12.dp))
                            Text(
                                when (filter) {
                                    TodoFilter.ACTIVE -> "No active tasks — you’re all caught up!"
                                    TodoFilter.COMPLETED -> "No completed tasks yet"
                                    else -> "No tasks"
                                },
                                style = MaterialTheme.typography.titleMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            Text(
                                when (filter) {
                                    TodoFilter.ACTIVE -> "Completed tasks are hidden by this filter"
                                    TodoFilter.COMPLETED -> "Complete a task to see it here"
                                    else -> "Try another filter"
                                },
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.outline
                            )
                            Spacer(Modifier.height(12.dp))
                            FilledTonalButton(
                                onClick = { filterName = TodoFilter.ALL.name },
                                shape = RoundedCornerShape(10.dp)
                            ) {
                                Text("Show all tasks")
                            }
                        }
                    }
                } else {
                    // Completed-state banner: visible when everything is done (useful positive feedback)
                    AnimatedVisibility(visible = todos.isNotEmpty() && completedCount == todos.size) {
                        Card(
                            modifier = Modifier.fillMaxWidth().padding(bottom = 8.dp),
                            shape = RoundedCornerShape(12.dp),
                            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth().padding(12.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Icon(Icons.Filled.CheckCircle, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(20.dp))
                                Text("All tasks completed — great work!", style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.onPrimaryContainer)
                            }
                        }
                    }
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                        contentPadding = PaddingValues(top = 4.dp, bottom = 24.dp)
                    ) {
                        items(filtered, key = { it.id }) { item ->
                            val isEditing = editingId == item.id
                            SwipeToDismissBoxWithUndo(
                                modifier = Modifier.animateItem(),
                                enabled = !isEditing,
                                onDismiss = { deleteWithUndo(item.id) }
                            ) {
                                TodoRow(
                                    item = item,
                                    isEditing = isEditing,
                                    editingText = editingText,
                                    onEditingTextChange = { editingText = it },
                                    onToggle = { todos = toggleTodo(todos, item.id) },
                                    onDelete = { deleteWithUndo(item.id) },
                                    onStartEdit = {
                                        editingId = item.id
                                        editingText = item.text
                                    },
                                    onSaveEdit = {
                                        val t = editingText.trim()
                                        if (t.isNotEmpty()) {
                                            todos = updateTodoText(todos, item.id, t)
                                        }
                                        editingId = null
                                    },
                                    onCancelEdit = { editingId = null },
                                    onLongPress = {
                                        editingId = item.id
                                        editingText = item.text
                                    }
                                )
                            }
                        }
                        item {
                            Spacer(Modifier.height(8.dp))
                            Text(
                                "${filtered.size} ${if (filtered.size == 1) "item" else "items"} • $activeCount left",
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.outline,
                                modifier = Modifier.fillMaxWidth(),
                                textAlign = TextAlign.Center
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun SwipeToDismissBoxWithUndo(
    modifier: Modifier = Modifier,
    enabled: Boolean,
    onDismiss: () -> Unit,
    content: @Composable () -> Unit
) {
    // Use SwipeToDismissBox with confirmValueChange to trigger delete only on EndToStart swipe
    val dismissState = rememberSwipeToDismissBoxState(
        positionalThreshold = { it * 0.5f },
        confirmValueChange = { value ->
            if (value == SwipeToDismissBoxValue.EndToStart) {
                onDismiss()
                // Immediate removal via list filter with LazyColumn animation;
                // returning false resets swipe state so next item doesn't inherit dismissed state
                false
            } else false
        }
    )
    SwipeToDismissBox(
        modifier = modifier,
        state = dismissState,
        enableDismissFromStartToEnd = false,
        enableDismissFromEndToStart = enabled,
        backgroundContent = {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .clip(RoundedCornerShape(14.dp))
                    .background(MaterialTheme.colorScheme.errorContainer)
                    .padding(horizontal = 20.dp),
                contentAlignment = Alignment.CenterEnd
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Icon(
                        Icons.Filled.Delete,
                        contentDescription = "Delete",
                        tint = MaterialTheme.colorScheme.onErrorContainer,
                        modifier = Modifier.size(22.dp)
                    )
                    Text(
                        "Delete",
                        color = MaterialTheme.colorScheme.onErrorContainer,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 14.sp
                    )
                }
            }
        },
        content = { content() }
    )
}

@Composable
private fun FilledButtonWithHeight(
    onClick: () -> Unit,
    enabled: Boolean,
    modifier: Modifier = Modifier,
    content: @Composable RowScope.() -> Unit
) {
    Button(
        onClick = onClick,
        enabled = enabled,
        modifier = modifier,
        shape = RoundedCornerShape(12.dp),
        contentPadding = PaddingValues(horizontal = 20.dp),
        content = content
    )
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun TodoRow(
    item: TodoItem,
    isEditing: Boolean,
    editingText: String,
    onEditingTextChange: (String) -> Unit,
    onToggle: () -> Unit,
    onDelete: () -> Unit,
    onStartEdit: () -> Unit,
    onSaveEdit: () -> Unit,
    onCancelEdit: () -> Unit,
    onLongPress: () -> Unit
) {
    val alpha by animateFloatAsState(targetValue = if (item.done) 0.72f else 1f, label = "alpha")
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .alpha(alpha)
            .semantics(mergeDescendants = false) {
                contentDescription = "${if (item.done) "Completed" else "Active"} task: ${item.text}"
            },
        shape = RoundedCornerShape(14.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
        colors = CardDefaults.cardColors(
            containerColor = if (item.done) MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.45f) else MaterialTheme.colorScheme.surfaceContainerLowest
        ),
        border = null
    ) {
        if (isEditing) {
            Column(modifier = Modifier.fillMaxWidth().padding(12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedTextField(
                    value = editingText,
                    onValueChange = { if (it.length <= MAX_TODO_LENGTH) onEditingTextChange(it) },
                    modifier = Modifier.fillMaxWidth().semantics { contentDescription = "Edit task input" },
                    singleLine = false,
                    maxLines = 4,
                    shape = RoundedCornerShape(10.dp),
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
                    keyboardActions = KeyboardActions(onDone = { onSaveEdit() }),
                    placeholder = { Text("Edit task") },
                    supportingText = {
                        when {
                            editingText.trim().isEmpty() -> Text("Task cannot be empty", color = MaterialTheme.colorScheme.error, fontSize = 12.sp)
                            editingText.length >= MAX_TODO_LENGTH - 20 -> Text("${editingText.length}/$MAX_TODO_LENGTH", color = if (editingText.length >= MAX_TODO_LENGTH) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.outline, fontSize = 11.sp)
                            else -> Text("${editingText.length}/$MAX_TODO_LENGTH", color = MaterialTheme.colorScheme.outline, fontSize = 11.sp)
                        }
                    }
                )
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                    OutlinedButton(onClick = onCancelEdit, modifier = Modifier.weight(1f).height(44.dp), shape = RoundedCornerShape(10.dp)) {
                        Text("Cancel")
                    }
                    Button(onClick = onSaveEdit, enabled = editingText.trim().isNotEmpty(), modifier = Modifier.weight(1f).height(44.dp), shape = RoundedCornerShape(10.dp)) {
                        Text("Save")
                    }
                }
            }
        } else {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .combinedClickable(onClick = onToggle, onLongClick = onLongPress)
                    .padding(4.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Checkbox with large touch target
                Box(
                    modifier = Modifier.size(52.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Checkbox(
                        checked = item.done,
                        onCheckedChange = { onToggle() },
                        modifier = Modifier
                            .size(48.dp)
                            .padding(12.dp)
                            .semantics {
                                contentDescription = if (item.done) "Mark \"${item.text}\" as not done" else "Mark \"${item.text}\" as done"
                            }
                    )
                }
                Text(
                    text = item.text,
                    modifier = Modifier.weight(1f).padding(vertical = 14.dp),
                    style = MaterialTheme.typography.bodyLarge.copy(
                        textDecoration = if (item.done) TextDecoration.LineThrough else null,
                        color = if (item.done) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.onSurface
                    ),
                    maxLines = 4,
                    overflow = TextOverflow.Ellipsis
                )
                IconButton(onClick = onStartEdit, modifier = Modifier.size(48.dp)) {
                    Icon(Icons.Filled.Edit, contentDescription = "Edit task \"${item.text}\"", tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(20.dp))
                }
                // Delete is via swipe-left gesture (background Delete affordance + undo Snackbar);
                // removing persistent Delete button reduces per-row visual noise to match M3 Lists (Google Tasks).
            }
        }
    }
}

@Composable
private fun EmptyState(modifier: Modifier = Modifier) {
    Column(
        modifier = modifier.semantics(mergeDescendants = true) { contentDescription = "No tasks yet, add your first task above" },
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        // Illustration: concentric circles + check
        Box(
            modifier = Modifier.size(140.dp).clip(CircleShape).background(MaterialTheme.colorScheme.primaryContainer),
            contentAlignment = Alignment.Center
        ) {
            val primaryColor = MaterialTheme.colorScheme.primary
            Canvas(modifier = Modifier.size(100.dp)) {
                val c = center
                drawCircle(color = primaryColor.copy(alpha = 0.12f), radius = 46.dp.toPx(), center = c)
                drawCircle(color = primaryColor.copy(alpha = 0.16f), radius = 34.dp.toPx(), center = c, style = Stroke(width = 2.dp.toPx(), cap = StrokeCap.Round))
                // dashed outer
                drawCircle(color = primaryColor.copy(alpha = 0.22f), radius = 42.dp.toPx(), center = c, style = Stroke(width = 1.2.dp.toPx()))
            }
            Icon(
                imageVector = Icons.Filled.CheckCircle,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.primary,
                modifier = Modifier.size(56.dp)
            )
        }
        Spacer(Modifier.height(20.dp))
        Text(
            "All clear!",
            style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.Bold),
            textAlign = TextAlign.Center,
            modifier = Modifier.semantics { heading() }
        )
        Spacer(Modifier.height(6.dp))
        Text(
            "No tasks yet.\nAdd your first task above and stay productive.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            lineHeight = 20.sp
        )
        Spacer(Modifier.height(16.dp))
        // Non-interactive hint chip (was AssistChip with empty onClick – avoid fake click target)
        Surface(
            shape = RoundedCornerShape(8.dp),
            color = MaterialTheme.colorScheme.secondaryContainer,
            contentColor = MaterialTheme.colorScheme.onSecondaryContainer,
            modifier = Modifier.semantics(mergeDescendants = true) { contentDescription = "Hint: Tap Add or press Done on keyboard" }
        ) {
            Row(
                modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                Icon(Icons.Filled.CheckCircle, contentDescription = null, modifier = Modifier.size(16.dp))
                Text("Tap Add or press Done on keyboard", style = MaterialTheme.typography.labelMedium)
            }
        }
        Spacer(Modifier.height(12.dp))
        Text(
            "Tip: swipe a task left to delete • long-press to edit",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.outline,
            textAlign = TextAlign.Center
        )
    }
}
