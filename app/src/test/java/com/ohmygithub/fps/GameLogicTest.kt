package com.ohmygithub.fps

import org.junit.Assert.*
import org.junit.Test

class GameLogicTest {
    @Test
    fun filterAllReturnsAll() {
        val todos = listOf(TodoItem(1, "A", false, 0), TodoItem(2, "B", true, 0))
        assertEquals(2, filterTodos(todos, TodoFilter.ALL).size)
    }

    @Test
    fun filterActiveReturnsOnlyActive() {
        val todos = listOf(TodoItem(1, "A", false, 0), TodoItem(2, "B", true, 0), TodoItem(3, "C", false, 0))
        val active = filterTodos(todos, TodoFilter.ACTIVE)
        assertEquals(2, active.size)
        assertTrue(active.all { !it.done })
    }

    @Test
    fun filterCompletedReturnsOnlyCompleted() {
        val todos = listOf(TodoItem(1, "A", false, 0), TodoItem(2, "B", true, 0))
        val comp = filterTodos(todos, TodoFilter.COMPLETED)
        assertEquals(1, comp.size)
        assertTrue(comp.all { it.done })
    }

    @Test
    fun addTodoAppendsAndTrims() {
        val todos = emptyList<TodoItem>()
        val next = addTodo(todos, "  hello  ", id = 100, createdAt = 1000)
        assertEquals(1, next.size)
        assertEquals("hello", next[0].text)
        assertEquals(100L, next[0].id)
        assertFalse(next[0].done)
    }

    @Test
    fun addTodoIgnoresBlank() {
        val todos = listOf(TodoItem(1, "A", false, 0))
        val next = addTodo(todos, "   ", id = 2)
        assertEquals(1, next.size)
    }

    @Test
    fun toggleTodoFlipsDone() {
        val todos = listOf(TodoItem(1, "A", false, 0), TodoItem(2, "B", true, 0))
        val toggled = toggleTodo(todos, 1)
        assertTrue(toggled.first { it.id == 1L }.done)
        assertTrue(toggled.first { it.id == 2L }.done) // unchanged still true
        val toggled2 = toggleTodo(toggled, 2)
        assertFalse(toggled2.first { it.id == 2L }.done)
    }

    @Test
    fun deleteTodoRemoves() {
        val todos = listOf(TodoItem(1, "A", false, 0), TodoItem(2, "B", false, 0))
        val next = deleteTodo(todos, 1)
        assertEquals(1, next.size)
        assertEquals(2L, next[0].id)
    }

    @Test
    fun updateTodoTextTrimsAndUpdates() {
        val todos = listOf(TodoItem(1, "old", false, 0))
        val next = updateTodoText(todos, 1, "  new text  ")
        assertEquals("new text", next[0].text)
    }

    @Test
    fun updateTodoTextIgnoresBlank() {
        val todos = listOf(TodoItem(1, "old", false, 0))
        val next = updateTodoText(todos, 1, "   ")
        assertEquals("old", next[0].text)
    }

    @Test
    fun clearCompletedRemovesDone() {
        val todos = listOf(TodoItem(1, "A", false, 0), TodoItem(2, "B", true, 0), TodoItem(3, "C", true, 0))
        val next = clearCompleted(todos)
        assertEquals(1, next.size)
        assertEquals(1L, next[0].id)
    }

    @Test
    fun countsAreCorrect() {
        val todos = listOf(TodoItem(1, "A", false, 0), TodoItem(2, "B", true, 0), TodoItem(3, "C", false, 0))
        assertEquals(2, countActive(todos))
        assertEquals(1, countCompleted(todos))
    }

    @Test
    fun jsonRoundTrip() {
        val todos = listOf(TodoItem(10, "hello \"world\"", false, 123), TodoItem(11, "second", true, 456))
        val json = todosToJson(todos)
        val back = todosFromJson(json)
        assertEquals(todos, back)
    }

    @Test
    fun jsonEmptyReturnsEmpty() {
        assertEquals(emptyList<TodoItem>(), todosFromJson(""))
        assertEquals(emptyList<TodoItem>(), todosFromJson("invalid"))
    }
}
