package com.example.moodtracker

import org.junit.Assert.*
import org.junit.Test

class MoodStorageTest {
    @Test fun moodColorValid() {
        for (i in 1..5) {
            val c = MoodEntry.moodColor(i)
            assertTrue(c.startsWith("#"))
            assertEquals(7, c.length)
        }
    }
    @Test fun edgeMoodDefaultsToOkay() {
        assertEquals("😐", MoodEntry.moodEmoji(99))
        assertEquals("Okay", MoodEntry.moodLabel(0))
    }
}
