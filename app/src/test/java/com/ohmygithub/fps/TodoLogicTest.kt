package com.ohmygithub.fps

import org.junit.Assert.*
import org.junit.Test

class TodoLogicTest {
    @Test fun add_trimsAndIgnoresEmpty() {
        val base = emptyList<TodoItem>()
        assertEquals(0, TodoLogic.add(base, "   ").size)
        assertEquals(1, TodoLogic.add(base, "  Buy milk  ").size)
        assertEquals("Buy milk", TodoLogic.add(base, "  Buy milk  ")[0].text)
    }

    @Test fun toggle_flipsDone() {
        val item = TodoItem(1, "Task", false)
        val toggled = TodoLogic.toggle(listOf(item), 1)
        assertTrue(toggled[0].done)
        assertFalse(TodoLogic.toggle(toggled, 1)[0].done)
    }

    @Test fun delete_removes() {
        val list = listOf(TodoItem(1, "A"), TodoItem(2, "B"))
        assertEquals(1, TodoLogic.delete(list, 1).size)
        assertEquals(2L, TodoLogic.delete(list, 1)[0].id)
    }

    @Test fun edit_updatesText() {
        val list = listOf(TodoItem(1, "Old"))
        val edited = TodoLogic.edit(list, 1, " New ")
        assertEquals("New", edited[0].text)
        // empty edit ignored
        assertEquals("New", TodoLogic.edit(edited, 1, "   ")[0].text)
    }

    @Test fun clearCompleted_removesDone() {
        val list = listOf(TodoItem(1, "A", true), TodoItem(2, "B", false), TodoItem(3, "C", true))
        val cleared = TodoLogic.clearCompleted(list)
        assertEquals(1, cleared.size)
        assertEquals(2L, cleared[0].id)
    }

    @Test fun filtered_returnsCorrectSubset() {
        val list = listOf(TodoItem(1, "A", false), TodoItem(2, "B", true))
        assertEquals(2, TodoLogic.filtered(list, TodoFilter.ALL).size)
        assertEquals(1, TodoLogic.filtered(list, TodoFilter.ACTIVE).size)
        assertEquals(1, TodoLogic.filtered(list, TodoFilter.COMPLETED).size)
        assertEquals(2L, TodoLogic.filtered(list, TodoFilter.COMPLETED)[0].id)
    }

    @Test fun remainingCount_countsActive() {
        assertEquals(2, TodoLogic.remainingCount(listOf(TodoItem(1, "A", false), TodoItem(2, "B", true), TodoItem(3, "C", false))))
    }

    @Test fun serialize_deserialize_roundTrip() {
        val list = listOf(TodoItem(42, "Hello, world!", true, 123456789L), TodoItem(43, "Second", false, 987654321L))
        val json = TodoLogic.serialize(list)
        val restored = TodoLogic.deserialize(json)
        assertEquals(2, restored.size)
        assertEquals(42L, restored[0].id)
        assertEquals("Hello, world!", restored[0].text)
        assertTrue(restored[0].done)
        assertEquals(123456789L, restored[0].createdAt)
        assertEquals("Second", restored[1].text)
    }

    @Test fun deserialize_empty_returnsEmpty() {
        assertTrue(TodoLogic.deserialize("").isEmpty())
        assertTrue(TodoLogic.deserialize("   ").isEmpty())
        assertTrue(TodoLogic.deserialize("{{invalid").isEmpty())
    }
}
