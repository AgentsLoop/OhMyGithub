package com.example.moodtracker

import com.example.moodtracker.data.MoodEntry
import com.example.moodtracker.data.Moods
import org.junit.Assert.*
import org.junit.Test

class MoodTest {
    @Test
    fun testMoodLevels() {
        assertEquals(5, Moods.all.size)
        assertEquals("😢", Moods.emojiFor(1))
        assertEquals("😄", Moods.emojiFor(5))
        assertEquals("😐", Moods.emojiFor(3))
        assertTrue(Moods.all.map { it.level }.containsAll(listOf(1,2,3,4,5)))
    }

    @Test
    fun testMoodEntryCreation() {
        val entry = MoodEntry(moodLevel = 4, emoji = "🙂", note = "Feeling good", timestamp = 123456L)
        assertEquals(4, entry.moodLevel)
        assertEquals("Feeling good", entry.note)
        assertEquals("🙂", entry.emoji)
    }

    @Test
    fun testMoodLabelsNotEmpty() {
        Moods.all.forEach { mood ->
            assertTrue(mood.label.isNotBlank())
            assertTrue(mood.emoji.isNotBlank())
            assertTrue(mood.level in 1..5)
        }
    }
}
