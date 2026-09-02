package com.example.moodtracker

import org.junit.Assert.*
import org.junit.Test

class MoodEntryTest {
    @Test fun moodEmojiMapsCorrectly() {
        assertEquals("😭", MoodEntry.moodEmoji(1))
        assertEquals("😔", MoodEntry.moodEmoji(2))
        assertEquals("😐", MoodEntry.moodEmoji(3))
        assertEquals("😊", MoodEntry.moodEmoji(4))
        assertEquals("🤩", MoodEntry.moodEmoji(5))
    }
    @Test fun moodLabelMapsCorrectly() {
        assertEquals("Awful", MoodEntry.moodLabel(1))
        assertEquals("Great", MoodEntry.moodLabel(5))
    }
    @Test fun averageCalculation() {
        val entries = listOf(
            MoodEntry(1,5,"",0),
            MoodEntry(2,3,"",0),
            MoodEntry(3,4,"",0)
        )
        val avg = entries.map { it.mood }.average()
        assertEquals(4.0, avg, 0.01)
    }
    @Test fun entryCreation() {
        val e = MoodEntry(123, 4, "feeling good", 1000L)
        assertEquals(4, e.mood)
        assertEquals("feeling good", e.note)
    }
}
