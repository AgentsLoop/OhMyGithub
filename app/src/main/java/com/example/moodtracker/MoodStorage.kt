package com.example.moodtracker

import android.content.Context
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken

class MoodStorage(context: Context) {
    private val prefs = context.getSharedPreferences("mood_prefs", Context.MODE_PRIVATE)
    private val gson = Gson()
    private val key = "entries"

    fun load(): MutableList<MoodEntry> {
        val json = prefs.getString(key, null) ?: return mutableListOf()
        return try {
            val type = object : TypeToken<MutableList<MoodEntry>>() {}.type
            gson.fromJson<MutableList<MoodEntry>>(json, type) ?: mutableListOf()
        } catch (e: Exception) {
            mutableListOf()
        }
    }

    fun save(entries: List<MoodEntry>) {
        val json = gson.toJson(entries)
        prefs.edit().putString(key, json).commit()
    }

    fun add(entry: MoodEntry) {
        val list = load()
        list.add(0, entry)
        save(list)
    }

    fun delete(id: Long) {
        val list = load().filterNot { it.id == id }
        save(list)
    }

    fun clear() {
        prefs.edit().remove(key).commit()
    }
}
