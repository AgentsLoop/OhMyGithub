package com.example.moodtracker

data class MoodEntry(
    val id: Long,
    val mood: Int, // 1-5
    val note: String,
    val timestamp: Long
) {
    companion object {
        fun moodEmoji(mood: Int): String = when (mood) {
            1 -> "😭"
            2 -> "😔"
            3 -> "😐"
            4 -> "😊"
            5 -> "🤩"
            else -> "😐"
        }
        fun moodLabel(mood: Int): String = when (mood) {
            1 -> "Awful"
            2 -> "Bad"
            3 -> "Okay"
            4 -> "Good"
            5 -> "Great"
            else -> "Okay"
        }
        fun moodColor(mood: Int): String = when (mood) {
            1 -> "#FF5252"
            2 -> "#FF8A65"
            3 -> "#FFD740"
            4 -> "#66BB6A"
            5 -> "#26C6DA"
            else -> "#FFD740"
        }
    }
}
