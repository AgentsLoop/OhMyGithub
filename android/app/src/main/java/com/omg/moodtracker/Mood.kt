package com.omg.moodtracker

enum class Mood(val displayName: String, val emoji: String, val value: Int, val colorRes: Int) {
    TERRIBLE("Terrible", "😭", 1, android.R.color.holo_red_light),
    BAD("Bad", "😕", 2, android.R.color.holo_orange_light),
    OKAY("Okay", "😐", 3, android.R.color.holo_orange_dark),
    GOOD("Good", "🙂", 4, android.R.color.holo_green_light),
    GREAT("Great", "😄", 5, android.R.color.holo_green_dark);

    companion object {
        fun fromValue(v: Int): Mood = entries.find { it.value == v } ?: OKAY
        fun fromName(n: String): Mood = entries.find { it.name == n } ?: OKAY
    }
}
