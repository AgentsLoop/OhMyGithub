package com.omg.moodtracker

import android.os.Bundle
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.recyclerview.widget.LinearLayoutManager
import com.google.android.material.chip.Chip
import com.google.android.material.chip.ChipGroup
import com.omg.moodtracker.databinding.ActivityMainBinding

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private lateinit var storage: MoodStorage
    private lateinit var adapter: MoodAdapter
    private var selectedMood: Mood? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        storage = MoodStorage(this)
        setupMoodSelector()
        setupRecycler()
        setupSave()
        refreshAll()

        binding.editNote.setOnFocusChangeListener { _, _ -> }
    }

    private fun setupMoodSelector() {
        val group: ChipGroup = binding.chipGroupMoods
        Mood.entries.forEach { mood ->
            val chip = Chip(this).apply {
                text = "${mood.emoji} ${mood.displayName}"
                isCheckable = true
                isClickable = true
                chipStrokeWidth = 2f
            }
            chip.setOnClickListener {
                selectedMood = mood
                // uncheck others visually handled by ChipGroup single selection
                // ensure only one selected
                for (i in 0 until group.childCount) {
                    val c = group.getChildAt(i) as Chip
                    if (c != chip) c.isChecked = false
                }
                chip.isChecked = true
            }
            group.addView(chip)
        }
        group.isSingleSelection = true
        group.isSelectionRequired = false
    }

    private fun setupRecycler() {
        adapter = MoodAdapter(mutableListOf()) { entry ->
            storage.delete(entry.id)
            refreshAll()
            Toast.makeText(this, "Deleted", Toast.LENGTH_SHORT).show()
        }
        binding.recyclerHistory.layoutManager = LinearLayoutManager(this)
        binding.recyclerHistory.adapter = adapter
    }

    private fun setupSave() {
        binding.btnSave.setOnClickListener {
            val mood = selectedMood
            if (mood == null) {
                Toast.makeText(this, getString(R.string.select_mood), Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            val note = binding.editNote.text?.toString()?.trim() ?: ""
            val entry = MoodEntry(
                id = System.currentTimeMillis(),
                mood = mood,
                note = note,
                timestamp = System.currentTimeMillis()
            )
            storage.add(entry)
            binding.editNote.text?.clear()
            // clear selection
            binding.chipGroupMoods.clearCheck()
            selectedMood = null
            // uncheck chips manually
            for (i in 0 until binding.chipGroupMoods.childCount) {
                (binding.chipGroupMoods.getChildAt(i) as Chip).isChecked = false
            }
            refreshAll()
            Toast.makeText(this, getString(R.string.saved), Toast.LENGTH_SHORT).show()
        }
    }

    private fun refreshAll() {
        val entries = storage.getAll()
        adapter.update(entries)
        binding.emptyView.visibility = if (entries.isEmpty()) View.VISIBLE else View.GONE
        binding.recyclerHistory.visibility = if (entries.isEmpty()) View.GONE else View.VISIBLE
        refreshStats()
    }

    private fun refreshStats() {
        val stats = storage.stats()
        binding.txtTotal.text = getString(R.string.stats_total, stats.total)
        binding.txtAvg.text = getString(R.string.stats_avg, if (stats.total == 0) 0.0 else stats.average)
        binding.txtWeek.text = getString(R.string.stats_streak, stats.weekCount)
        binding.statsChart.setData(stats.counts)
    }
}
