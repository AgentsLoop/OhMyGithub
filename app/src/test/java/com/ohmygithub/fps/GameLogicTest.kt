package com.ohmygithub.fps

import org.junit.Assert.*
import org.junit.Test

class GameLogicTest {
    @Test
    fun addTodoTrimsAndIgnoresEmpty() {
        val list = emptyList<TodoItem>()
        val added = TodoLogic.add(list, "  Buy milk  ")
        assertEquals(1, added.size)
        assertEquals("Buy milk", added[0].text)
        val notAdded = TodoLogic.add(added, "   ")
        assertEquals(1, notAdded.size)
    }

    @Test
    fun toggleTodoFlipsCompleted() {
        val item = TodoItem(id = 1, text = "Test", completed = false)
        val toggled = TodoLogic.toggle(listOf(item), 1)
        assertTrue(toggled[0].completed)
        val toggledBack = TodoLogic.toggle(toggled, 1)
        assertFalse(toggledBack[0].completed)
    }

    @Test
    fun deleteTodoRemovesItem() {
        val a = TodoItem(id = 1, text = "A")
        val b = TodoItem(id = 2, text = "B")
        val result = TodoLogic.delete(listOf(a, b), 1)
        assertEquals(1, result.size)
        assertEquals(2L, result[0].id)
    }

    @Test
    fun updateTextTrimsAndIgnoresEmpty() {
        val item = TodoItem(id = 1, text = "Old")
        val updated = TodoLogic.updateText(listOf(item), 1, "  New text ")
        assertEquals("New text", updated[0].text)
        val ignored = TodoLogic.updateText(updated, 1, "   ")
        assertEquals("New text", ignored[0].text)
    }

    @Test
    fun clearCompletedRemovesOnlyCompleted() {
        val items = listOf(
            TodoItem(id = 1, text = "A", completed = true),
            TodoItem(id = 2, text = "B", completed = false),
            TodoItem(id = 3, text = "C", completed = true)
        )
        val cleared = TodoLogic.clearCompleted(items)
        assertEquals(1, cleared.size)
        assertEquals(2L, cleared[0].id)
    }

    @Test
    fun filterWorks() {
        val items = listOf(
            TodoItem(id = 1, text = "A", completed = false),
            TodoItem(id = 2, text = "B", completed = true)
        )
        assertEquals(2, TodoLogic.filter(items, Filter.ALL).size)
        assertEquals(1, TodoLogic.filter(items, Filter.ACTIVE).size)
        assertEquals(1, TodoLogic.filter(items, Filter.COMPLETED).size)
        assertEquals("A", TodoLogic.filter(items, Filter.ACTIVE)[0].text)
    }

    @Test
    fun remainingCountsActive() {
        val items = listOf(
            TodoItem(id = 1, text = "A", completed = false),
            TodoItem(id = 2, text = "B", completed = true),
            TodoItem(id = 3, text = "C", completed = false)
        )
        assertEquals(2, TodoLogic.remaining(items))
    }
}
