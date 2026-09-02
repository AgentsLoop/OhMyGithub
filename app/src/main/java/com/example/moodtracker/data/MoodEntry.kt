package com.example.moodtracker.data

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "mood_entries")
data class MoodEntry(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val moodLevel: Int,
    val emoji: String,
    val note: String,
    val timestamp: Long
)
