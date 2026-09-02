package com.example.moodtracker.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.example.moodtracker.data.MoodDatabase
import com.example.moodtracker.data.MoodEntry
import com.example.moodtracker.data.Moods
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

class MoodViewModel(application: Application) : AndroidViewModel(application) {
    private val dao = MoodDatabase.getInstance(application).moodDao()

    val entries: StateFlow<List<MoodEntry>> = dao.getAll()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val selectedMood = MutableStateFlow(3)
    val noteText = MutableStateFlow("")

    fun selectMood(level: Int) {
        selectedMood.value = level
    }

    fun updateNote(text: String) {
        noteText.value = text
    }

    fun addEntry() {
        val level = selectedMood.value
        val note = noteText.value.trim()
        // Allow empty note? require at least mood, but save note as is
        val entry = MoodEntry(
            moodLevel = level,
            emoji = Moods.emojiFor(level),
            note = note,
            timestamp = System.currentTimeMillis()
        )
        viewModelScope.launch {
            dao.insert(entry)
            noteText.value = ""
        }
    }

    fun deleteEntry(id: Long) {
        viewModelScope.launch {
            dao.deleteById(id)
        }
    }
}
