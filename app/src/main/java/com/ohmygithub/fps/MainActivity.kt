package com.ohmygithub.fps

import android.content.Context
import android.content.SharedPreferences
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
// ----- Pure logic for testing -----

data class TodoItem(
    val id: Long,
    val text: String,
    val done: Boolean = false,
    val createdAt: Long = System.currentTimeMillis()
)

enum class TodoFilter { ALL, ACTIVE, COMPLETED }

object TodoLogic {
    fun add(list: List<TodoItem>, text: String): List<TodoItem> {
        val t = text.trim()
        if (t.isEmpty()) return list
        val newId = maxOf(System.currentTimeMillis(), (list.maxOfOrNull { it.id } ?: 0L) + 1L)
        return list + TodoItem(id = newId, text = t, done = false, createdAt = System.currentTimeMillis())
    }
    fun toggle(list: List<TodoItem>, id: Long): List<TodoItem> =
        list.map { if (it.id == id) it.copy(done = !it.done) else it }

    fun delete(list: List<TodoItem>, id: Long): List<TodoItem> =
        list.filterNot { it.id == id }

    fun edit(list: List<TodoItem>, id: Long, newText: String): List<TodoItem> {
        val t = newText.trim()
        if (t.isEmpty()) return list
        return list.map { if (it.id == id) it.copy(text = t) else it }
    }

    fun clearCompleted(list: List<TodoItem>): List<TodoItem> =
        list.filterNot { it.done }

    fun filtered(list: List<TodoItem>, filter: TodoFilter): List<TodoItem> = when (filter) {
        TodoFilter.ALL -> list
        TodoFilter.ACTIVE -> list.filter { !it.done }
        TodoFilter.COMPLETED -> list.filter { it.done }
    }

    fun remainingCount(list: List<TodoItem>): Int = list.count { !it.done }

    private fun escapeJson(s: String): String = s
        .replace("\\", "\\\\")
        .replace("\"", "\\\"")
        .replace("\n", "\\n")
        .replace("\r", "\\r")
        .replace("\t", "\\t")

    private fun unescapeJson(s: String): String {
        val sb = StringBuilder()
        var i = 0
        while (i < s.length) {
            val c = s[i]
            if (c == '\\' && i + 1 < s.length) {
                when (s[i + 1]) {
                    '\\' -> sb.append('\\')
                    '"' -> sb.append('"')
                    'n' -> sb.append('\n')
                    'r' -> sb.append('\r')
                    't' -> sb.append('\t')
                    else -> sb.append(s[i + 1])
                }
                i += 2
            } else {
                sb.append(c); i++
            }
        }
        return sb.toString()
    }

    fun serialize(list: List<TodoItem>): String {
        return buildString {
            append("[")
            list.forEachIndexed { idx, item ->
                if (idx > 0) append(",")
                append("{\"id\":${item.id},")
                append("\"text\":\"${escapeJson(item.text)}\",")
                append("\"done\":${item.done},")
                append("\"createdAt\":${item.createdAt}}")
            }
            append("]")
        }
    }

    fun deserialize(json: String): List<TodoItem> {
        if (json.isBlank()) return emptyList()
        return try {
            val trimmed = json.trim()
            if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) return emptyList()
            val inner = trimmed.substring(1, trimmed.length - 1).trim()
            if (inner.isEmpty()) return emptyList()
            // Split top-level objects respecting string escapes and braces
            val objects = mutableListOf<String>()
            var depth = 0
            var inString = false
            var escape = false
            var start = -1
            for (i in inner.indices) {
                val c = inner[i]
                if (escape) { escape = false; continue }
                if (c == '\\' && inString) { escape = true; continue }
                if (c == '"') { inString = !inString; continue }
                if (inString) continue
                if (c == '{') {
                    if (depth == 0) start = i
                    depth++
                } else if (c == '}') {
                    depth--
                    if (depth == 0 && start != -1) {
                        objects.add(inner.substring(start, i + 1))
                        start = -1
                    }
                }
            }
            objects.mapNotNull { obj ->
                try {
                    val id = Regex("\"id\"\\s*:\\s*(-?\\d+)").find(obj)?.groupValues?.get(1)?.toLong() ?: return@mapNotNull null
                    val textRaw = Regex("\"text\"\\s*:\\s*\"((?:\\\\.|[^\"\\\\])*)\"").find(obj)?.groupValues?.get(1) ?: return@mapNotNull null
                    val text = unescapeJson(textRaw)
                    val done = Regex("\"done\"\\s*:\\s*(true|false)").find(obj)?.groupValues?.get(1)?.toBoolean() ?: false
                    val createdAt = Regex("\"createdAt\"\\s*:\\s*(-?\\d+)").find(obj)?.groupValues?.get(1)?.toLong() ?: System.currentTimeMillis()
                    TodoItem(id = id, text = text, done = done, createdAt = createdAt)
                } catch (_: Exception) { null }
            }
        } catch (_: Exception) { emptyList() }
    }
}

private const val PREFS_NAME = "todo_prefs"
private const val KEY_TODOS = "todos_json"

private fun loadTodos(prefs: SharedPreferences): List<TodoItem> =
    TodoLogic.deserialize(prefs.getString(KEY_TODOS, "") ?: "")

private fun saveTodos(prefs: SharedPreferences, list: List<TodoItem>) {
    prefs.edit().putString(KEY_TODOS, TodoLogic.serialize(list)).apply()
}

// ----- Activity -----

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme(
                colorScheme = lightColorScheme(
                    primary = Color(0xFF3DDC84),
                    secondary = Color(0xFF0A7A42),
                    background = Color(0xFFF6F8FB),
                    surface = Color.White,
                    onSurface = Color(0xFF0A0F1A)
                )
            ) {
                TodoScreen()
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TodoScreen() {
    val context = LocalContext.current
    val prefs = remember { context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE) }

    var todos by remember { mutableStateOf(loadTodos(prefs)) }
    var input by remember { mutableStateOf("") }
    var filter by remember { mutableStateOf(TodoFilter.ALL) }
    var editingId by remember { mutableStateOf<Long?>(null) }
    var editingText by remember { mutableStateOf("") }

    // Persist on change
    LaunchedEffect(todos) { saveTodos(prefs, todos) }
    // If edited item was deleted/cleared, exit edit mode
    LaunchedEffect(todos, editingId) {
        if (editingId != null && todos.none { it.id == editingId }) {
            editingId = null
            editingText = ""
        }
    }

    val filtered = remember(todos, filter) { TodoLogic.filtered(todos, filter) }
    val remaining = remember(todos) { TodoLogic.remainingCount(todos) }
    val completedCount = todos.count { it.done }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("Todo List", fontWeight = FontWeight.Black, fontSize = 20.sp)
                        Text(
                            if (todos.isEmpty()) "No tasks yet" else "$remaining left • ${todos.size} total",
                            fontSize = 11.sp,
                            color = Color.White.copy(alpha = 0.85f)
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = Color(0xFF0A0F1A),
                    titleContentColor = Color.White
                )
            )
        },
        containerColor = Color(0xFFF6F8FB)
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 16.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            // Input row
            Card(
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    OutlinedTextField(
                        value = input,
                        onValueChange = { input = it },
                        placeholder = { Text("What needs to be done?") },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
                        keyboardActions = KeyboardActions(onDone = {
                            val updated = TodoLogic.add(todos, input)
                            if (updated.size != todos.size) { todos = updated; input = "" }
                        }),
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(12.dp)
                    )
                    Button(
                        onClick = {
                            val updated = TodoLogic.add(todos, input)
                            if (updated.size != todos.size) { todos = updated; input = "" }
                        },
                        enabled = input.trim().isNotEmpty(),
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF0A0F1A), contentColor = Color.White),
                        contentPadding = PaddingValues(horizontal = 18.dp, vertical = 14.dp)
                    ) { Text("Add", fontWeight = FontWeight.Bold) }
                }
            }

            // Filter chips
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FilterChip(
                    selected = filter == TodoFilter.ALL,
                    onClick = { filter = TodoFilter.ALL },
                    label = { Text("All (${todos.size})") }
                )
                FilterChip(
                    selected = filter == TodoFilter.ACTIVE,
                    onClick = { filter = TodoFilter.ACTIVE },
                    label = { Text("Active ($remaining)") }
                )
                FilterChip(
                    selected = filter == TodoFilter.COMPLETED,
                    onClick = { filter = TodoFilter.COMPLETED },
                    label = { Text("Done ($completedCount)") }
                )
                Spacer(modifier = Modifier.weight(1f))
                if (completedCount > 0) {
                    TextButton(onClick = { todos = TodoLogic.clearCompleted(todos) }) {
                        Text("Clear done", color = Color(0xFFCC1A00), fontWeight = FontWeight.Bold, fontSize = 12.sp)
                    }
                }
            }

            // List
            if (filtered.isEmpty()) {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = Color.White)
                ) {
                    Column(
                        modifier = Modifier.fillMaxWidth().padding(32.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Box(
                            modifier = Modifier.size(56.dp).clip(CircleShape).background(Color(0xFFEFF6FF)),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(Icons.Filled.Check, contentDescription = null, tint = Color(0xFF3DDC84), modifier = Modifier.size(28.dp))
                        }
                        Text(
                            when (filter) {
                                TodoFilter.ACTIVE -> "No active tasks"
                                TodoFilter.COMPLETED -> "No completed tasks"
                                else -> "Add your first task above"
                            },
                            fontWeight = FontWeight.SemiBold, color = Color(0xFF0A0F1A)
                        )
                        Text(
                            when (filter) {
                                TodoFilter.ALL -> "Stay organized — add, check off, and clear tasks. Tasks are saved automatically."
                                TodoFilter.ACTIVE -> "All caught up!"
                                TodoFilter.COMPLETED -> "Complete a task to see it here."
                            },
                            fontSize = 12.sp, color = Color(0xFF6A7A95), lineHeight = 16.sp
                        )
                        if (filter != TodoFilter.ALL) {
                            TextButton(onClick = { filter = TodoFilter.ALL }) { Text("Show all") }
                        }
                    }
                }
                Spacer(modifier = Modifier.weight(1f))
            } else {
                LazyColumn(
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.weight(1f)
                ) {
                    items(filtered, key = { it.id }) { item ->
                        val isEditing = editingId == item.id
                        Card(
                            shape = RoundedCornerShape(14.dp),
                            colors = CardDefaults.cardColors(containerColor = Color.White),
                            elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth().padding(10.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Checkbox(
                                    checked = item.done,
                                    onCheckedChange = { todos = TodoLogic.toggle(todos, item.id) },
                                    colors = CheckboxDefaults.colors(checkedColor = Color(0xFF0A7A42))
                                )
                                if (isEditing) {
                                    OutlinedTextField(
                                        value = editingText,
                                        onValueChange = { editingText = it },
                                        singleLine = true,
                                        modifier = Modifier.weight(1f),
                                        shape = RoundedCornerShape(10.dp),
                                        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
                                        keyboardActions = KeyboardActions(onDone = {
                                            val trimmed = editingText.trim()
                                            if (trimmed.isNotEmpty()) {
                                                todos = TodoLogic.edit(todos, item.id, editingText)
                                                editingId = null
                                                editingText = ""
                                            }
                                        })
                                    )
                                    IconButton(
                                        onClick = {
                                            val trimmed = editingText.trim()
                                            if (trimmed.isNotEmpty()) {
                                                todos = TodoLogic.edit(todos, item.id, editingText)
                                                editingId = null
                                                editingText = ""
                                            }
                                        },
                                        enabled = editingText.trim().isNotEmpty()
                                    ) { Icon(Icons.Filled.Check, contentDescription = "Save", tint = if (editingText.trim().isNotEmpty()) Color(0xFF0A7A42) else Color(0xFFB0BEC5)) }
                                    IconButton(onClick = { editingId = null; editingText = "" }) { Icon(Icons.Filled.Close, contentDescription = "Cancel") }
                                } else {
                                    Text(
                                        text = item.text,
                                        modifier = Modifier.weight(1f),
                                        fontSize = 15.sp,
                                        fontWeight = if (item.done) FontWeight.Normal else FontWeight.Medium,
                                        color = if (item.done) Color(0xFF8A9BB5) else Color(0xFF0A0F1A),
                                        textDecoration = if (item.done) TextDecoration.LineThrough else null,
                                        lineHeight = 20.sp
                                    )
                                    IconButton(onClick = {
                                        editingId = item.id
                                        editingText = item.text
                                    }) { Icon(Icons.Filled.Edit, contentDescription = "Edit", tint = Color(0xFF6A7A95), modifier = Modifier.size(18.dp)) }
                                    IconButton(onClick = { todos = TodoLogic.delete(todos, item.id) }) {
                                        Icon(Icons.Filled.Delete, contentDescription = "Delete", tint = Color(0xFFFF3B30), modifier = Modifier.size(18.dp))
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // Bottom summary bar
            Card(
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = Color(0xFF0A0F1A))
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 10.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("$remaining ${if (remaining == 1) "item" else "items"} left", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    Text("${todos.size} total • $completedCount done", color = Color(0xFF8A9BB5), fontSize = 11.sp)
                }
            }
        }
    }
}
