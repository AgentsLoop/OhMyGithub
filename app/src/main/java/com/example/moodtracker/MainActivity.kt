package com.example.moodtracker

import android.content.SharedPreferences
import android.graphics.Color
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.widget.CalendarView
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.google.android.material.button.MaterialButton
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale

class MainActivity : AppCompatActivity() {

    private lateinit var prefs: SharedPreferences
    private var entries: MutableList<MoodEntry> = mutableListOf()
    private var selectedMood: Int = 2

    private lateinit var noteInput: EditText
    private lateinit var addButton: MaterialButton
    private lateinit var clearButton: MaterialButton
    private lateinit var recyclerView: RecyclerView
    private lateinit var adapter: MoodAdapter
    private lateinit var emptyText: TextView
    private lateinit var historyCount: TextView
    private lateinit var statsContainer: LinearLayout
    private lateinit var averageText: TextView
    private lateinit var totalEntriesText: TextView
    private lateinit var streakText: TextView
    private lateinit var moodViews: List<LinearLayout>
    private lateinit var calendarView: CalendarView
    private lateinit var calendarInfo: TextView
    private lateinit var selectedDateText: TextView
    private var filterDate: Calendar? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        prefs = getSharedPreferences("mood_prefs", MODE_PRIVATE)
        loadEntries()

        noteInput = findViewById(R.id.noteInput)
        addButton = findViewById(R.id.addButton)
        clearButton = findViewById(R.id.clearButton)
        recyclerView = findViewById(R.id.recyclerView)
        emptyText = findViewById(R.id.emptyText)
        historyCount = findViewById(R.id.historyCount)
        statsContainer = findViewById(R.id.statsContainer)
        averageText = findViewById(R.id.averageText)
        totalEntriesText = findViewById(R.id.totalEntriesText)
        streakText = findViewById(R.id.streakText)
        calendarView = findViewById(R.id.calendarView)
        calendarInfo = findViewById(R.id.calendarInfo)
        selectedDateText = findViewById(R.id.selectedDateText)

        moodViews = listOf(
            findViewById(R.id.mood0),
            findViewById(R.id.mood1),
            findViewById(R.id.mood2),
            findViewById(R.id.mood3),
            findViewById(R.id.mood4)
        )

        moodViews.forEachIndexed { index, view ->
            view.setOnClickListener { selectMood(index) }
        }
        selectMood(selectedMood)

        adapter = MoodAdapter(entries) { entry ->
            entries.remove(entry)
            saveEntries()
            refreshUI()
        }
        recyclerView.layoutManager = LinearLayoutManager(this)
        recyclerView.adapter = adapter

        addButton.setOnClickListener { addEntry() }
        clearButton.setOnClickListener { clearAll() }

        calendarView.setOnDateChangeListener { _, year, month, dayOfMonth ->
            val cal = Calendar.getInstance().apply {
                set(year, month, dayOfMonth, 0, 0, 0)
                set(Calendar.MILLISECOND, 0)
            }
            filterDate = cal
            val sdf = SimpleDateFormat("MMM d, yyyy", Locale.getDefault())
            selectedDateText.text = "Showing: ${sdf.format(cal.time)}"
            refreshUI()
        }
        findViewById<MaterialButton>(R.id.showAllButton).setOnClickListener {
            filterDate = null
            selectedDateText.text = "Tap a date to filter"
            refreshUI()
        }

        refreshUI()
    }

    private fun selectMood(index: Int) {
        selectedMood = index
        moodViews.forEachIndexed { i, view ->
            view.setBackgroundResource(
                if (i == index) R.drawable.bg_mood_selected else R.drawable.bg_mood_unselected
            )
        }
    }

    private fun addEntry() {
        val note = noteInput.text.toString().trim()
        val entry = MoodEntry(
            id = System.currentTimeMillis(),
            mood = selectedMood,
            note = note,
            timestamp = System.currentTimeMillis()
        )
        entries.add(0, entry)
        saveEntries()
        noteInput.text.clear()
        // keep selected mood or reset to Okay? Keep selection for convenience but ensure next add works
        refreshUI()
        Toast.makeText(this, "Mood saved!", Toast.LENGTH_SHORT).show()
    }

    private fun clearAll() {
        if (entries.isEmpty()) return
        entries.clear()
        saveEntries()
        refreshUI()
        Toast.makeText(this, "All entries cleared", Toast.LENGTH_SHORT).show()
    }

    private fun loadEntries() {
        val json = prefs.getString("entries", "") ?: ""
        entries = MoodEntry.listFromJson(json)
        // sort newest first
        entries.sortByDescending { it.timestamp }
    }

    private fun saveEntries() {
        prefs.edit().putString("entries", MoodEntry.listToJson(entries)).apply()
    }

    private fun getFilteredEntries(): List<MoodEntry> {
        val f = filterDate ?: return entries
        return entries.filter { isSameDay(it.timestamp, f) }
    }

    private fun isSameDay(timestamp: Long, cal: Calendar): Boolean {
        val c = Calendar.getInstance().apply { timeInMillis = timestamp }
        return c.get(Calendar.YEAR) == cal.get(Calendar.YEAR) &&
                c.get(Calendar.DAY_OF_YEAR) == cal.get(Calendar.DAY_OF_YEAR)
    }

    private fun refreshUI() {
        val filtered = getFilteredEntries()
        adapter.update(filtered)
        val isEmpty = filtered.isEmpty()
        emptyText.visibility = if (isEmpty) View.VISIBLE else View.GONE
        recyclerView.visibility = if (isEmpty) View.GONE else View.VISIBLE
        if (filterDate != null) {
            historyCount.text = "${filtered.size} / ${entries.size} entries"
            emptyText.text = if (entries.isEmpty()) getString(R.string.no_entries) else "No entries for this day"
        } else {
            historyCount.text = "${entries.size} ${if (entries.size == 1) "entry" else "entries"}"
            emptyText.text = getString(R.string.no_entries)
        }
        updateStats()
        updateCalendarInfo()
    }

    private fun updateCalendarInfo() {
        if (entries.isEmpty()) {
            calendarInfo.text = "No data"
            return
        }
        val dayCount = entries.map { dayKey(it.timestamp) }.toSet().size
        calendarInfo.text = "$dayCount ${if (dayCount == 1) "day" else "days"} tracked"
    }

    private fun dayKey(ts: Long): String {
        val c = Calendar.getInstance().apply { timeInMillis = ts }
        return "${c.get(Calendar.YEAR)}-${c.get(Calendar.DAY_OF_YEAR)}"
    }

    private fun updateStats() {
        statsContainer.removeAllViews()
        val counts = IntArray(5)
        entries.forEach { counts[it.mood.coerceIn(0, 4)]++ }
        val maxCount = (counts.maxOrNull() ?: 0).coerceAtLeast(1)
        val colors = intArrayOf(
            Color.parseColor("#FF8A9D"),
            Color.parseColor("#FFB088"),
            Color.parseColor("#FFD68A"),
            Color.parseColor("#A8E6CF"),
            Color.parseColor("#88D8FF")
        )

        for (i in 0..4) {
            val col = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                gravity = Gravity.CENTER_HORIZONTAL or Gravity.BOTTOM
                layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply {
                    marginEnd = 4
                    marginStart = 4
                }
            }
            val countLabel = TextView(this).apply {
                text = counts[i].toString()
                textSize = 11f
                setTextColor(Color.parseColor("#2D2A4A"))
                gravity = Gravity.CENTER
            }
            val barHeight = (32 + (counts[i].toFloat() / maxCount * 72)).toInt()
            val bar = View(this).apply {
                setBackgroundColor(colors[i])
                layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, barHeight * 2).apply {
                    // Use dp conversion approximation: already in px scaled
                    topMargin = 4
                    bottomMargin = 4
                }
                // rounded corners via background drawable would be better but keep simple
            }
            // Use custom background with rounded corners for bar
            val barBg = android.graphics.drawable.GradientDrawable().apply {
                shape = android.graphics.drawable.GradientDrawable.RECTANGLE
                cornerRadius = 8f * resources.displayMetrics.density
                setColor(colors[i])
            }
            bar.background = barBg
            // fix height in dp
            val lp = bar.layoutParams
            lp.height = (barHeight * resources.displayMetrics.density).toInt()
            bar.layoutParams = lp

            val emojiLabel = TextView(this).apply {
                text = MoodEntry.EMOJIS[i]
                textSize = 14f
                gravity = Gravity.CENTER
            }
            val moodAbbr = TextView(this).apply {
                text = MoodEntry.LABELS[i].take(3)
                textSize = 9f
                setTextColor(Color.parseColor("#6B6B8A"))
                gravity = Gravity.CENTER
            }
            col.addView(countLabel)
            col.addView(bar)
            col.addView(emojiLabel)
            col.addView(moodAbbr)
            statsContainer.addView(col)
        }

        if (entries.isEmpty()) {
            averageText.text = "Avg: --"
            totalEntriesText.text = "0 entries • Keep tracking!"
            streakText.text = "🔥 0 day streak"
        } else {
            val avg = entries.map { it.mood }.average()
            val avgLabel = when {
                avg < 0.8 -> "Terrible"
                avg < 1.8 -> "Bad"
                avg < 2.5 -> "Okay"
                avg < 3.5 -> "Good"
                else -> "Great"
            }
            averageText.text = "Avg: $avgLabel (${String.format("%.1f", avg + 1)}/5)"
            totalEntriesText.text = "${entries.size} ${if (entries.size == 1) "entry" else "entries"} • ${avgLabel} average"
            val streak = calculateStreak()
            streakText.text = "🔥 $streak day streak"
        }
    }

    private fun calculateStreak(): Int {
        if (entries.isEmpty()) return 0
        // Collect unique day start millis (local midnight) sorted descending
        val dayStarts = entries.map {
            val c = Calendar.getInstance().apply {
                timeInMillis = it.timestamp
                set(Calendar.HOUR_OF_DAY, 0); set(Calendar.MINUTE, 0); set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0)
            }
            c.timeInMillis
        }.toSortedSet(Comparator.reverseOrder()).toList()
        var streak = 1
        var prev = dayStarts[0]
        for (i in 1 until dayStarts.size) {
            val cur = dayStarts[i]
            val diff = ((prev - cur) / (24 * 60 * 60 * 1000)).toInt()
            if (diff == 1) {
                streak++
                prev = cur
            } else break
        }
        return streak
    }
}
