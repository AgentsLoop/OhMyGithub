package com.ohmygithub.fps

import android.content.Context
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import com.ohmygithub.fps.ui.theme.AppTheme
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
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
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import org.json.JSONArray
import org.json.JSONObject

data class TodoItem(
    val id: Long,
    val text: String,
    val completed: Boolean = false,
    val createdAt: Long = System.currentTimeMillis()
)

enum class Filter { ALL, ACTIVE, COMPLETED }

object TodoStorage {
    private const val PREF = "todo_prefs"
    private const val KEY = "todo_list"

    fun load(context: Context): List<TodoItem> {
        val prefs = context.getSharedPreferences(PREF, Context.MODE_PRIVATE)
        val json = prefs.getString(KEY, null) ?: return emptyList()
        return try {
            val arr = JSONArray(json)
            (0 until arr.length()).map { i ->
                val o = arr.getJSONObject(i)
                TodoItem(
                    id = o.getLong("id"),
                    text = o.getString("text"),
                    completed = o.getBoolean("completed"),
                    createdAt = o.optLong("createdAt", System.currentTimeMillis())
                )
            }
        } catch (_: Exception) { emptyList() }
    }

    fun save(context: Context, items: List<TodoItem>) {
        val prefs = context.getSharedPreferences(PREF, Context.MODE_PRIVATE)
        val arr = JSONArray()
        items.forEach {
            val o = JSONObject()
            o.put("id", it.id)
            o.put("text", it.text)
            o.put("completed", it.completed)
            o.put("createdAt", it.createdAt)
            arr.put(o)
        }
        prefs.edit().putString(KEY, arr.toString()).apply()
    }
}

// Pure logic for testing
object TodoLogic {
    fun add(todos: List<TodoItem>, text: String): List<TodoItem> {
        val trimmed = text.trim()
        if (trimmed.isEmpty()) return todos
        val newItem = TodoItem(id = System.currentTimeMillis(), text = trimmed)
        return todos + newItem
    }
    fun toggle(todos: List<TodoItem>, id: Long): List<TodoItem> =
        todos.map { if (it.id == id) it.copy(completed = !it.completed) else it }
    fun delete(todos: List<TodoItem>, id: Long): List<TodoItem> =
        todos.filterNot { it.id == id }
    fun updateText(todos: List<TodoItem>, id: Long, newText: String): List<TodoItem> {
        val t = newText.trim()
        if (t.isEmpty()) return todos
        return todos.map { if (it.id == id) it.copy(text = t) else it }
    }
    fun clearCompleted(todos: List<TodoItem>): List<TodoItem> =
        todos.filterNot { it.completed }
    fun filter(todos: List<TodoItem>, filter: Filter): List<TodoItem> = when (filter) {
        Filter.ALL -> todos
        Filter.ACTIVE -> todos.filter { !it.completed }
        Filter.COMPLETED -> todos.filter { it.completed }
    }
    fun remaining(todos: List<TodoItem>): Int = todos.count { !it.completed }
}

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            AppTheme {
                Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
                    TodoScreen()
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TodoScreen() {
    val context = LocalContext.current
    var todos by remember { mutableStateOf(TodoStorage.load(context)) }
    var input by rememberSaveable { mutableStateOf("") }
    var filterIndex by rememberSaveable { mutableIntStateOf(0) }
    val filter = Filter.entries[filterIndex.coerceIn(0, Filter.entries.size - 1)]
    fun setFilter(f: Filter) { filterIndex = f.ordinal }
    var editingId by rememberSaveable { mutableStateOf<Long?>(null) }
    var editingText by rememberSaveable { mutableStateOf("") }
    var pendingDeleteId by rememberSaveable { mutableStateOf<Long?>(null) }
    val keyboardController = LocalSoftwareKeyboardController.current

    // persist whenever todos changes
    LaunchedEffect(todos) {
        TodoStorage.save(context, todos)
    }

    val filtered = TodoLogic.filter(todos, filter)
    val remaining = TodoLogic.remaining(todos)
    val completedCount = todos.count { it.completed }

    fun doAdd() {
        if (input.isBlank()) return
        todos = TodoLogic.add(todos, input)
        input = ""
        keyboardController?.hide()
    }

    // Confirm-delete dialog
    if (pendingDeleteId != null) {
        AlertDialog(
            onDismissRequest = { pendingDeleteId = null },
            title = { Text("Delete task?") },
            text = { Text("This action cannot be undone.") },
            confirmButton = {
                TextButton(onClick = {
                    pendingDeleteId?.let { id -> todos = TodoLogic.delete(todos, id) }
                    pendingDeleteId = null
                }) { Text("Delete", color = MaterialTheme.colorScheme.error) }
            },
            dismissButton = {
                TextButton(onClick = { pendingDeleteId = null }) { Text("Cancel") }
            }
        )
    }

    Scaffold(
        topBar = {
            CenterAlignedTopAppBar(
                title = {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("Todo List", fontWeight = FontWeight.Bold, fontSize = 20.sp)
                        Text(
                            "$remaining remaining • ${todos.size} total",
                            fontSize = 12.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                },
                colors = TopAppBarDefaults.centerAlignedTopAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface
                )
            )
        },
        bottomBar = {
            if (todos.isNotEmpty()) {
                Surface(tonalElevation = 2.dp, shadowElevation = 4.dp) {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 10.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            "$remaining items left",
                            fontSize = 13.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            fontWeight = FontWeight.Medium
                        )
                        if (completedCount > 0) {
                            TextButton(onClick = { todos = TodoLogic.clearCompleted(todos) }) {
                                Text("Clear completed ($completedCount)", fontSize = 13.sp)
                            }
                        }
                    }
                }
            }
        }
    ) { padding ->
        Column(
            modifier = Modifier.fillMaxSize().padding(padding).padding(horizontal = 16.dp)
        ) {
            // Input row — supports Enter/Done key
            Row(
                modifier = Modifier.fillMaxWidth().padding(vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                OutlinedTextField(
                    value = input,
                    onValueChange = { input = it },
                    modifier = Modifier.weight(1f),
                    placeholder = { Text("What needs to be done?", fontSize = 15.sp) },
                    singleLine = true,
                    shape = RoundedCornerShape(24.dp),
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
                    keyboardActions = KeyboardActions(onDone = { doAdd() }),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = MaterialTheme.colorScheme.primary,
                        unfocusedBorderColor = MaterialTheme.colorScheme.outline
                    )
                )
                Button(
                    onClick = { doAdd() },
                    enabled = input.isNotBlank(),
                    shape = CircleShape,
                    contentPadding = PaddingValues(horizontal = 20.dp, vertical = 12.dp),
                    modifier = Modifier.height(56.dp)
                ) {
                    Text("Add", fontWeight = FontWeight.Bold, fontSize = 15.sp)
                }
            }

            // Filter chips
            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.padding(bottom = 12.dp)
            ) {
                FilterChip(
                    selected = filter == Filter.ALL,
                    onClick = { setFilter(Filter.ALL) },
                    label = { Text("All (${todos.size})") }
                )
                FilterChip(
                    selected = filter == Filter.ACTIVE,
                    onClick = { setFilter(Filter.ACTIVE) },
                    label = { Text("Active ($remaining)") }
                )
                FilterChip(
                    selected = filter == Filter.COMPLETED,
                    onClick = { setFilter(Filter.COMPLETED) },
                    label = { Text("Completed ($completedCount)") }
                )
            }

            HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant, thickness = 1.dp)

            // List
            if (filtered.isEmpty()) {
                Box(
                    modifier = Modifier.fillMaxSize().padding(top = 40.dp),
                    contentAlignment = Alignment.TopCenter
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text(
                            when {
                                todos.isEmpty() -> "No todos yet"
                                filter == Filter.COMPLETED -> "No completed tasks"
                                filter == Filter.ACTIVE -> "No active tasks"
                                else -> "No tasks"
                            },
                            fontSize = 18.sp, fontWeight = FontWeight.Medium, color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Text(
                            when {
                                todos.isEmpty() -> "Add a task above to get started"
                                filter == Filter.COMPLETED -> "Complete a task to see it here"
                                else -> "All caught up!"
                            },
                            fontSize = 14.sp, color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f)
                        )
                        if (todos.isEmpty()) {
                            FilledTonalButton(
                                onClick = { input = "Buy groceries" },
                                modifier = Modifier.padding(top = 8.dp)
                            ) { Text("Try: Buy groceries, Walk the dog") }
                        }
                    }
                }
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                    contentPadding = PaddingValues(vertical = 12.dp, horizontal = 2.dp)
                ) {
                    items(filtered, key = { it.id }) { item ->
                        AnimatedVisibility(
                            visible = true,
                            enter = fadeIn() + expandVertically(),
                            exit = fadeOut() + shrinkVertically(),
                            modifier = Modifier.animateItem()
                        ) {
                            TodoRow(
                                item = item,
                                isEditing = editingId == item.id,
                                editingText = editingText,
                                onEditingTextChange = { editingText = it },
                                onToggle = { todos = TodoLogic.toggle(todos, item.id) },
                                onDelete = { pendingDeleteId = item.id },
                                onStartEdit = {
                                    editingId = item.id
                                    editingText = item.text
                                },
                                onSaveEdit = {
                                    todos = TodoLogic.updateText(todos, item.id, editingText)
                                    editingId = null
                                },
                                onCancelEdit = { editingId = null }
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun TodoRow(
    item: TodoItem,
    isEditing: Boolean,
    editingText: String,
    onEditingTextChange: (String) -> Unit,
    onToggle: () -> Unit,
    onDelete: () -> Unit,
    onStartEdit: () -> Unit,
    onSaveEdit: () -> Unit,
    onCancelEdit: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(
            containerColor = if (item.completed) MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.6f) else MaterialTheme.colorScheme.surface
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
        border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Checkbox(
                checked = item.completed,
                onCheckedChange = { onToggle() },
                colors = CheckboxDefaults.colors(
                    checkedColor = MaterialTheme.colorScheme.primary,
                    uncheckedColor = MaterialTheme.colorScheme.outline
                )
            )

            if (isEditing) {
                OutlinedTextField(
                    value = editingText,
                    onValueChange = onEditingTextChange,
                    modifier = Modifier.weight(1f),
                    singleLine = true,
                    placeholder = { Text("Task") },
                    shape = RoundedCornerShape(8.dp),
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
                    keyboardActions = KeyboardActions(onDone = { onSaveEdit() })
                )
                IconButton(onClick = onSaveEdit) {
                    Icon(Icons.Filled.Check, contentDescription = "Save", tint = MaterialTheme.colorScheme.primary)
                }
                IconButton(onClick = onCancelEdit) {
                    Icon(Icons.Filled.Close, contentDescription = "Cancel", tint = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            } else {
                Text(
                    text = item.text,
                    modifier = Modifier.weight(1f),
                    fontSize = 15.sp,
                    fontWeight = if (item.completed) FontWeight.Normal else FontWeight.Medium,
                    color = if (item.completed) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.onSurface,
                    textDecoration = if (item.completed) TextDecoration.LineThrough else null,
                    maxLines = 3,
                    overflow = TextOverflow.Ellipsis
                )
                IconButton(onClick = onStartEdit) {
                    Icon(Icons.Filled.Edit, contentDescription = "Edit todo", tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(20.dp))
                }
                IconButton(onClick = onDelete) {
                    Icon(Icons.Filled.Delete, contentDescription = "Delete todo", tint = MaterialTheme.colorScheme.error, modifier = Modifier.size(20.dp))
                }
            }
        }
    }
}
