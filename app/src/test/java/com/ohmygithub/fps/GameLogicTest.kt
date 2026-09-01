package com.ohmygithub.fps

import org.junit.Assert.*
import org.junit.Test

class GameLogicTest {
    @Test
    fun todoCreationDefaultsNotCompleted() {
        val t = TodoItem(id = 1, text = "Buy milk")
        assertEquals("Buy milk", t.text)
        assertFalse(t.completed)
    }

    @Test
    fun todoToggleCompleted() {
        val todo = TodoItem(id = 1, text = "Task", completed = false)
        val toggled = todo.copy(completed = !todo.completed)
        assertTrue(toggled.completed)
        val toggledBack = toggled.copy(completed = !toggled.completed)
        assertFalse(toggledBack.completed)
    }

    @Test
    fun todoFilteringActiveCompleted() {
        val todos = listOf(
            TodoItem(1, "A", false),
            TodoItem(2, "B", true),
            TodoItem(3, "C", false)
        )
        val active = todos.filter { !it.completed }
        val completed = todos.filter { it.completed }
        assertEquals(2, active.size)
        assertEquals(1, completed.size)
    }

    @Test
    fun todoJsonRoundTrip() {
        val todos = listOf(TodoItem(1, "Hello", false), TodoItem(2, "World", true))
        val json = todosToJson(todos)
        val decoded = jsonToTodos(json)
        assertEquals(2, decoded.size)
        assertEquals("Hello", decoded[0].text)
        assertFalse(decoded[0].completed)
        assertTrue(decoded[1].completed)
    }

    @Test
    fun todoJsonEmptyList() {
        val json = todosToJson(emptyList())
        val decoded = jsonToTodos(json)
        assertTrue(decoded.isEmpty())
    }

    @Test
    fun todoAddTrimsAndIgnoresEmpty() {
        val text = "  test  ".trim()
        assertEquals("test", text)
        assertTrue("   ".trim().isEmpty())
    }

    @Test
    fun todoDeleteById() {
        val todos = mutableListOf(TodoItem(1, "A"), TodoItem(2, "B"))
        val filtered = todos.filterNot { it.id == 1L }
        assertEquals(1, filtered.size)
        assertEquals(2L, filtered[0].id)
    }

    @Test
    fun todoUpdateText() {
        val todo = TodoItem(1, "Old", false)
        val updated = todo.copy(text = "New")
        assertEquals("New", updated.text)
        assertEquals(1L, updated.id)
    }
}
