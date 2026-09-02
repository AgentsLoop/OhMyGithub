package com.omg.moodtracker

data class MoodEntry(
    val id: Long,
    val mood: Mood,
    val note: String,
    val timestamp: Long
) {
    val dateString: String
        get() = java.text.SimpleDateFormat("yyyy-MM-dd HH:mm", java.util.Locale.getDefault())
            .format(java.util.Date(timestamp))

    val dayString: String
        get() = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.getDefault())
            .format(java.util.Date(timestamp))
}
