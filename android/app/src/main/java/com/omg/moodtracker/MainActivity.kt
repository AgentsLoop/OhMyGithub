package com.omg.moodtracker

import android.app.DatePickerDialog
import android.app.TimePickerDialog
import android.os.Bundle
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.recyclerview.widget.LinearLayoutManager
import com.google.android.material.chip.Chip
import com.google.android.material.chip.ChipGroup
import com.google.android.material.textfield.TextInputEditText
import com.omg.moodtracker.databinding.ActivityMainBinding
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private lateinit var storage: MoodStorage
    private lateinit var adapter: MoodAdapter
    private var selectedMood: Mood? = null
    private var selectedTimestamp: Long = System.currentTimeMillis()
    private var filterDay: String? = null // yyyy-MM-dd or null for all
    private val dateFormat = SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.getDefault())
    private val dayFormat = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        storage = MoodStorage(this)
        setupMoodSelector()
        setupRecycler()
        setupSave()
        setupDatePickers()
        setupCalendar()
        refreshAll()
        updateDateLabel()
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
        adapter = MoodAdapter(mutableListOf(),
            onEdit = { entry -> showEditDialog(entry) },
            onDelete = { entry ->
                storage.delete(entry.id)
                refreshAll()
                Toast.makeText(this, "Deleted", Toast.LENGTH_SHORT).show()
            })
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
                timestamp = selectedTimestamp
            )
            storage.add(entry)
            binding.editNote.text?.clear()
            binding.chipGroupMoods.clearCheck()
            selectedMood = null
            for (i in 0 until binding.chipGroupMoods.childCount) {
                (binding.chipGroupMoods.getChildAt(i) as Chip).isChecked = false
            }
            // reset timestamp to now for next entry
            selectedTimestamp = System.currentTimeMillis()
            updateDateLabel()
            refreshAll()
            Toast.makeText(this, getString(R.string.saved), Toast.LENGTH_SHORT).show()
        }
    }

    private fun setupDatePickers() {
        binding.btnPickDate.setOnClickListener { showDatePicker(selectedTimestamp) { ts ->
            selectedTimestamp = ts
            updateDateLabel()
        }}
        binding.btnPickTime.setOnClickListener { showTimePicker(selectedTimestamp) { ts ->
            selectedTimestamp = ts
            updateDateLabel()
        }}
    }

    private fun setupCalendar() {
        binding.calendarView.setOnDateChangeListener { _, year, month, dayOfMonth ->
            val cal = Calendar.getInstance().apply { set(year, month, dayOfMonth, 0,0,0); set(Calendar.MILLISECOND,0) }
            val dayStr = dayFormat.format(cal.time)
            filterDay = dayStr
            binding.txtFilterLabel.text = getString(R.string.filtering, dayStr)
            refreshHistoryFiltered()
        }
        binding.btnShowAll.setOnClickListener {
            filterDay = null
            binding.txtFilterLabel.text = getString(R.string.filtering, "All")
            refreshHistoryFiltered()
        }
        binding.txtFilterLabel.text = getString(R.string.filtering, "All")
    }

    private fun updateDateLabel() {
        binding.txtSelectedDate.text = getString(R.string.date_label, dateFormat.format(java.util.Date(selectedTimestamp)))
    }

    private fun showDatePicker(current: Long, onPicked: (Long) -> Unit) {
        val c = Calendar.getInstance().apply { timeInMillis = current }
        DatePickerDialog(this, { _, y, m, d ->
            val cal = Calendar.getInstance().apply {
                timeInMillis = current
                set(Calendar.YEAR, y)
                set(Calendar.MONTH, m)
                set(Calendar.DAY_OF_MONTH, d)
            }
            onPicked(cal.timeInMillis)
        }, c.get(Calendar.YEAR), c.get(Calendar.MONTH), c.get(Calendar.DAY_OF_MONTH)).show()
    }

    private fun showTimePicker(current: Long, onPicked: (Long) -> Unit) {
        val c = Calendar.getInstance().apply { timeInMillis = current }
        TimePickerDialog(this, { _, h, min ->
            val cal = Calendar.getInstance().apply {
                timeInMillis = current
                set(Calendar.HOUR_OF_DAY, h)
                set(Calendar.MINUTE, min)
            }
            onPicked(cal.timeInMillis)
        }, c.get(Calendar.HOUR_OF_DAY), c.get(Calendar.MINUTE), true).show()
    }

    private fun showEditDialog(entry: MoodEntry) {
        // Build edit dialog with mood chips, note, date/time pickers
        val container = layoutInflater.inflate(R.layout.dialog_edit_mood, null)
        val chipGroup = container.findViewById<ChipGroup>(R.id.editChipGroup)
        val editNote = container.findViewById<TextInputEditText>(R.id.editNoteDialog)
        val txtDate = container.findViewById<View>(R.id.txtEditDate) as android.widget.TextView
        val btnDate = container.findViewById<View>(R.id.btnEditPickDate)
        val btnTime = container.findViewById<View>(R.id.btnEditPickTime)

        var editMood: Mood = entry.mood
        var editTs: Long = entry.timestamp
        editNote.setText(entry.note)
        txtDate.text = dateFormat.format(java.util.Date(editTs))

        // populate chips
        Mood.entries.forEach { mood ->
            val chip = Chip(this).apply {
                text = "${mood.emoji} ${mood.displayName}"
                isCheckable = true
                isChecked = mood == editMood
            }
            chip.setOnClickListener {
                editMood = mood
                for (i in 0 until chipGroup.childCount) {
                    (chipGroup.getChildAt(i) as Chip).isChecked = false
                }
                chip.isChecked = true
            }
            chipGroup.addView(chip)
        }
        chipGroup.isSingleSelection = true

        btnDate.setOnClickListener {
            showDatePicker(editTs) { ts -> editTs = ts; txtDate.text = dateFormat.format(java.util.Date(editTs)) }
        }
        btnTime.setOnClickListener {
            showTimePicker(editTs) { ts -> editTs = ts; txtDate.text = dateFormat.format(java.util.Date(editTs)) }
        }

        AlertDialog.Builder(this)
            .setTitle("Edit entry")
            .setView(container)
            .setPositiveButton("Save") { _, _ ->
                val newEntry = entry.copy(mood = editMood, note = editNote.text?.toString()?.trim() ?: "", timestamp = editTs)
                storage.update(newEntry)
                refreshAll()
                Toast.makeText(this, getString(R.string.updated), Toast.LENGTH_SHORT).show()
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun refreshAll() {
        refreshHistoryFiltered()
        refreshStats()
    }

    private fun refreshHistoryFiltered() {
        val all = storage.getAll()
        val filtered = if (filterDay == null) all else all.filter { it.dayString == filterDay }
        adapter.update(filtered)
        binding.emptyView.visibility = if (filtered.isEmpty()) View.VISIBLE else View.GONE
        binding.recyclerHistory.visibility = if (filtered.isEmpty()) View.GONE else View.VISIBLE
        if (filtered.isEmpty() && all.isNotEmpty() && filterDay != null) {
            binding.emptyView.text = "No entries for $filterDay"
        } else {
            binding.emptyView.text = getString(R.string.empty_history)
        }
    }

    private fun refreshStats() {
        val stats = storage.stats()
        binding.txtTotal.text = getString(R.string.stats_total, stats.total)
        binding.txtAvg.text = getString(R.string.stats_avg, if (stats.total == 0) 0.0 else stats.average)
        binding.txtWeek.text = getString(R.string.stats_streak, stats.weekCount)
        binding.statsChart.setData(stats.counts)
    }
}
