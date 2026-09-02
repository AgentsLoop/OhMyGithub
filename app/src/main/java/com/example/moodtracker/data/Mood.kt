package com.example.moodtracker.data

data class Mood(
    val level: Int,
    val emoji: String,
    val label: String,
    val colorHex: Long
)

object Moods {
    val all = listOf(
        Mood(1, "😢", "Very Sad", 0xFFE57373),
        Mood(2, "😕", "Sad", 0xFFFFB74D),
        Mood(3, "😐", "Neutral", 0xFFFFD54F),
        Mood(4, "🙂", "Happy", 0xFF81C784),
        Mood(5, "😄", "Very Happy", 0xFF64B5F6)
    )
    fun byLevel(level: Int): Mood = all.firstOrNull { it.level == level } ?: all[2]
    fun emojiFor(level: Int): String = byLevel(level).emoji
    fun labelFor(level: Int): String = byLevel(level).label
}
