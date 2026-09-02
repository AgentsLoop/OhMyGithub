package com.example.moodtracker

import org.json.JSONArray
import org.json.JSONObject

data class MoodEntry(
    val id: Long,
    val mood: Int, // 0..4
    val note: String,
    val timestamp: Long
) {
    fun toJson(): JSONObject {
        return JSONObject().apply {
            put("id", id)
            put("mood", mood)
            put("note", note)
            put("timestamp", timestamp)
        }
    }

    companion object {
        val EMOJIS = arrayOf("😢", "😕", "😐", "🙂", "😄")
        val LABELS = arrayOf("Terrible", "Bad", "Okay", "Good", "Great")

        fun fromJson(obj: JSONObject): MoodEntry {
            return MoodEntry(
                id = obj.getLong("id"),
                mood = obj.getInt("mood"),
                note = obj.optString("note", ""),
                timestamp = obj.getLong("timestamp")
            )
        }

        fun listToJson(entries: List<MoodEntry>): String {
            val array = JSONArray()
            entries.forEach { array.put(it.toJson()) }
            return array.toString()
        }

        fun listFromJson(json: String): MutableList<MoodEntry> {
            if (json.isBlank()) return mutableListOf()
            return try {
                val array = JSONArray(json)
                val list = mutableListOf<MoodEntry>()
                for (i in 0 until array.length()) {
                    list.add(fromJson(array.getJSONObject(i)))
                }
                list
            } catch (e: Exception) {
                mutableListOf()
            }
        }
    }
}
