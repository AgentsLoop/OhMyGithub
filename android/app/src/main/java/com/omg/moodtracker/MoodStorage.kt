package com.omg.moodtracker

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONArray
import org.json.JSONObject

class MoodStorage(context: Context) {
    private val prefs: SharedPreferences =
        context.getSharedPreferences("mood_prefs", Context.MODE_PRIVATE)

    companion object {
        private const val KEY_ENTRIES = "entries_json"
    }

    fun getAll(): MutableList<MoodEntry> {
        val json = prefs.getString(KEY_ENTRIES, null) ?: return mutableListOf()
        return try {
            val arr = JSONArray(json)
            val list = mutableListOf<MoodEntry>()
            for (i in 0 until arr.length()) {
                val obj = arr.getJSONObject(i)
                list.add(
                    MoodEntry(
                        id = obj.getLong("id"),
                        mood = Mood.fromName(obj.getString("mood")),
                        note = obj.getString("note"),
                        timestamp = obj.getLong("ts")
                    )
                )
            }
            list.sortByDescending { it.timestamp }
            list
        } catch (e: Exception) {
            mutableListOf()
        }
    }

    fun saveAll(entries: List<MoodEntry>) {
        val arr = JSONArray()
        for (e in entries) {
            val obj = JSONObject()
            obj.put("id", e.id)
            obj.put("mood", e.mood.name)
            obj.put("note", e.note)
            obj.put("ts", e.timestamp)
            arr.put(obj)
        }
        prefs.edit().putString(KEY_ENTRIES, arr.toString()).apply()
    }

    fun add(entry: MoodEntry) {
        val list = getAll()
        list.add(0, entry)
        saveAll(list)
    }

    fun delete(id: Long) {
        val list = getAll().filterNot { it.id == id }
        saveAll(list)
    }

    fun update(entry: MoodEntry) {
        val list = getAll().toMutableList()
        val idx = list.indexOfFirst { it.id == entry.id }
        if (idx >= 0) {
            list[idx] = entry
            saveAll(list)
        }
    }

    fun stats(): MoodStats {
        val entries = getAll()
        if (entries.isEmpty()) return MoodStats(0, 0.0, 0, emptyMap())
        val avg = entries.map { it.mood.value }.average()
        val weekAgo = System.currentTimeMillis() - 7 * 24 * 60 * 60 * 1000L
        val weekCount = entries.count { it.timestamp >= weekAgo }
        val counts = entries.groupingBy { it.mood }.eachCount()
        return MoodStats(entries.size, avg, weekCount, counts)
    }
}

data class MoodStats(
    val total: Int,
    val average: Double,
    val weekCount: Int,
    val counts: Map<Mood, Int>
)
