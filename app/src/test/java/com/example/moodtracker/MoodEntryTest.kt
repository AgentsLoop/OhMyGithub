package com.example.moodtracker

import org.junit.Assert.*
import org.junit.Test

class MoodEntryTest {

    @Test
    fun testSerialization() {
        val entry = MoodEntry(123L, 3, "Feeling good", 1700000000000L)
        val json = entry.toJson()
        val restored = MoodEntry.fromJson(json)
        assertEquals(entry.id, restored.id)
        assertEquals(entry.mood, restored.mood)
        assertEquals(entry.note, restored.note)
        assertEquals(entry.timestamp, restored.timestamp)
    }

    @Test
    fun testListSerialization() {
        val list = listOf(
            MoodEntry(1L, 0, "Terrible day", 1000L),
            MoodEntry(2L, 4, "Great day!", 2000L),
            MoodEntry(3L, 2, "", 3000L)
        )
        val json = MoodEntry.listToJson(list)
        val restored = MoodEntry.listFromJson(json)
        assertEquals(3, restored.size)
        assertEquals("Terrible day", restored[0].note)
        assertEquals(4, restored[1].mood)
        assertEquals("", restored[2].note)
    }

    @Test
    fun testEmptyJson() {
        val restored = MoodEntry.listFromJson("")
        assertTrue(restored.isEmpty())
        val restored2 = MoodEntry.listFromJson("[]")
        assertTrue(restored2.isEmpty())
    }

    @Test
    fun testEmojisLabels() {
        assertEquals(5, MoodEntry.EMOJIS.size)
        assertEquals(5, MoodEntry.LABELS.size)
        assertEquals("😢", MoodEntry.EMOJIS[0])
        assertEquals("😄", MoodEntry.EMOJIS[4])
        assertEquals("Terrible", MoodEntry.LABELS[0])
        assertEquals("Great", MoodEntry.LABELS[4])
    }

    @Test
    fun testPersistenceSpecialChars() {
        val entry = MoodEntry(99L, 2, "Note with emoji 😊 and \"quotes\"", 9999L)
        val json = MoodEntry.listToJson(listOf(entry))
        val restored = MoodEntry.listFromJson(json)
        assertEquals(1, restored.size)
        assertEquals(entry.note, restored[0].note)
    }
}
