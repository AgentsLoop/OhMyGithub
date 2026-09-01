package com.ohmygithub.fps

import android.content.Context
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import org.json.JSONArray
import org.json.JSONObject

data class TodoItem(
    val id: Long,
    val text: String,
    val completed: Boolean = false
)

enum class TodoFilter { All, Active, Completed }

private const val PREFS_NAME = "todo_prefs"
private const val KEY_TODOS_JSON = "todos_json"

private fun todosToJson(todos: List<TodoItem>): String {
    val arr = JSONArray()
    for (t in todos) {
        val obj = JSONObject()
        obj.put("id", t.id)
        obj.put("text", t.text)
        obj.put("completed", t.completed)
        arr.put(obj)
    }
    return arr.toString()
}

private fun jsonToTodos(json: String): List<TodoItem> {
    try {
        val arr = JSONArray(json)
        val list = mutableListOf<TodoItem>()
        for (i in 0 until arr.length()) {
            val o = arr.getJSONObject(i)
            val id = o.optLong("id", System.currentTimeMillis() + i)
            val text = o.optString("text", "")
            val completed = o.optBoolean("completed", false)
            if (text.isNotEmpty()) {
                list.add(TodoItem(id = id, text = text, completed = completed))
            }
        }
        return list
    } catch (_: Exception) {
        return emptyList()
    }
}

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme(
                colorScheme = MaterialTheme.colorScheme
            ) {
                TodoApp()
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TodoApp() {
    val context = LocalContext.current
    val prefs = remember { context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE) }

    var todos by remember { mutableStateOf<List<TodoItem>>(emptyList()) }
    var inputText by remember { mutableStateOf("") }
    var filter by remember { mutableStateOf(TodoFilter.All) }
    var loaded by remember { mutableStateOf(false) }

    // Load on launch
    LaunchedEffect(Unit) {
        val json = prefs.getString(KEY_TODOS_JSON, null)
        if (json != null) {
            todos = jsonToTodos(json)
        }
        loaded = true
    }

    // Save on every change (after initial load)
    LaunchedEffect(todos, loaded) {
        if (loaded) {
            prefs.edit().putString(KEY_TODOS_JSON, todosToJson(todos)).apply()
        }
    }

    val filteredTodos = when (filter) {
        TodoFilter.All -> todos
        TodoFilter.Active -> todos.filter { !it.completed }
        TodoFilter.Completed -> todos.filter { it.completed }
    }

    val activeCount = todos.count { !it.completed }
    val completedCount = todos.count { it.completed }

    fun addTodo() {
        val trimmed = inputText.trim()
        if (trimmed.isEmpty()) return
        val newItem = TodoItem(
            id = System.currentTimeMillis(),
            text = trimmed,
            completed = false
        )
        todos = todos + newItem
        inputText = ""
    }

    fun toggleTodo(id: Long) {
        todos = todos.map { if (it.id == id) it.copy(completed = !it.completed) else it }
    }

    fun deleteTodo(id: Long) {
        todos = todos.filterNot { it.id == id }
    }

    fun clearCompleted() {
        todos = todos.filterNot { it.completed }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Todo List") },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primaryContainer,
                    titleContentColor = MaterialTheme.colorScheme.onPrimaryContainer
                )
            )
        }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .padding(horizontal = 16.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.Top
        ) {
            // Input row: TextField with placeholder + Add button
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                OutlinedTextField(
                    value = inputText,
                    onValueChange = { inputText = it },
                    modifier = Modifier.weight(1f),
                    placeholder = { Text("What needs to be done?") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
                    keyboardActions = KeyboardActions(onDone = { addTodo() })
                )
                Button(
                    onClick = { addTodo() },
                    enabled = inputText.trim().isNotEmpty()
                ) {
                    Text("Add")
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Filter chips
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                FilterChip(
                    selected = filter == TodoFilter.All,
                    onClick = { filter = TodoFilter.All },
                    label = { Text("All (${todos.size})") }
                )
                FilterChip(
                    selected = filter == TodoFilter.Active,
                    onClick = { filter = TodoFilter.Active },
                    label = { Text("Active ($activeCount)") }
                )
                FilterChip(
                    selected = filter == TodoFilter.Completed,
                    onClick = { filter = TodoFilter.Completed },
                    label = { Text("Completed ($completedCount)") }
                )
            }

            Spacer(modifier = Modifier.height(4.dp))

            // Stats + clear completed row
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = if (todos.isEmpty()) "No todos yet"
                    else "$activeCount items left",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                TextButton(
                    onClick = { clearCompleted() },
                    enabled = completedCount > 0
                ) {
                    Text("Clear completed")
                }
            }

            Spacer(modifier = Modifier.height(4.dp))

            // Todo list - scrollable LazyColumn portrait friendly
            if (filteredTodos.isEmpty()) {
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 24.dp),
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.surfaceVariant
                    )
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(24.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text(
                            text = when {
                                todos.isEmpty() -> "Add your first todo above"
                                filter == TodoFilter.Active -> "No active todos"
                                filter == TodoFilter.Completed -> "No completed todos"
                                else -> "No todos"
                            },
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            } else {
                LazyColumn(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(top = 4.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(filteredTodos, key = { it.id }) { todo ->
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            colors = CardDefaults.cardColors(
                                containerColor = MaterialTheme.colorScheme.surfaceVariant
                            ),
                            elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
                        ) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(horizontal = 8.dp, vertical = 4.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Checkbox(
                                    checked = todo.completed,
                                    onCheckedChange = { toggleTodo(todo.id) }
                                )
                                Text(
                                    text = todo.text,
                                    modifier = Modifier.weight(1f).padding(horizontal = 8.dp),
                                    style = MaterialTheme.typography.bodyLarge.copy(
                                        textDecoration = if (todo.completed) TextDecoration.LineThrough else TextDecoration.None
                                    ),
                                    color = if (todo.completed) MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f)
                                    else MaterialTheme.colorScheme.onSurface,
                                    maxLines = 3,
                                    overflow = TextOverflow.Ellipsis
                                )
                                TextButton(onClick = { deleteTodo(todo.id) }) {
                                    Text("Delete")
                                }
                            }
                        }
                    }
                    item {
                        Spacer(modifier = Modifier.height(12.dp))
                    }
                }
            }
        }
    }
}
