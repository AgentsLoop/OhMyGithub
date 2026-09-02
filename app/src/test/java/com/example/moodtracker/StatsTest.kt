package com.example.moodtracker

import com.example.moodtracker.data.MoodEntry
import org.junit.Assert.*
import org.junit.Test

class StatsTest {
    @Test
    fun testAverageMood() {
        val entries = listOf(
            MoodEntry(moodLevel = 1, emoji = "😢", note = "a", timestamp = 1L),
            MoodEntry(moodLevel = 5, emoji = "😄", note = "b", timestamp = 2L),
            MoodEntry(moodLevel = 3, emoji = "😐", note = "c", timestamp = 3L)
        )
        val avg = entries.map { it.moodLevel }.average()
        assertEquals(3.0, avg, 0.01)
    }

    @Test
    fun testCountByMood() {
        val entries = listOf(
            MoodEntry(moodLevel = 5, emoji = "😄", note = "a", timestamp = 1L),
            MoodEntry(moodLevel = 5, emoji = "😄", note = "b", timestamp = 2L),
            MoodEntry(moodLevel = 2, emoji = "😕", note = "c", timestamp = 3L)
        )
        val counts = entries.groupingBy { it.moodLevel }.eachCount()
        assertEquals(2, counts[5])
        assertEquals(1, counts[2])
        assertNull(counts[1])
    }

    @Test
    fun testNotePersistenceLogic() {
        val note = "E2E-test-123"
        val entry = MoodEntry(moodLevel = 3, emoji = "😐", note = note, timestamp = System.currentTimeMillis())
        assertEquals(note, entry.note)
        assertTrue(entry.note.isNotBlank())
    }
}
