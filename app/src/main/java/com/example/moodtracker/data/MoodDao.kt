package com.example.moodtracker.data

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface MoodDao {
    @Query("SELECT * FROM mood_entries ORDER BY timestamp DESC")
    fun getAll(): Flow<List<MoodEntry>>

    @Query("SELECT * FROM mood_entries ORDER BY timestamp DESC")
    suspend fun getAllOnce(): List<MoodEntry>

    @Insert
    suspend fun insert(entry: MoodEntry): Long

    @Query("DELETE FROM mood_entries WHERE id = :id")
    suspend fun deleteById(id: Long)

    @Query("DELETE FROM mood_entries")
    suspend fun clearAll()
}
