package com.example.moodtracker

import android.content.Context
import android.graphics.Color
import android.os.Bundle
import android.view.View
import android.view.inputmethod.InputMethodManager
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.recyclerview.widget.LinearLayoutManager
import com.google.android.material.button.MaterialButton
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class MainActivity : AppCompatActivity() {

    private lateinit var storage: MoodStorage
    private lateinit var adapter: MoodAdapter
    private var selectedMood = 3
    private lateinit var moodButtons: List<LinearLayout>
    private lateinit var etNote: EditText
    private lateinit var tvEmpty: TextView
    private lateinit var tvStats: TextView
    private lateinit var statsBar: LinearLayout
    private lateinit var tvDate: TextView
    private var entries: MutableList<MoodEntry> = mutableListOf()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        storage = MoodStorage(this)
        entries = storage.load()

        etNote = findViewById(R.id.etNote)
        tvEmpty = findViewById(R.id.tvEmpty)
        tvStats = findViewById(R.id.tvStats)
        statsBar = findViewById(R.id.statsBar)
        tvDate = findViewById(R.id.tvDate)

        val fmt = SimpleDateFormat("EEEE, MMMM dd, yyyy", Locale.getDefault())
        tvDate.text = fmt.format(Date())
        tvDate.contentDescription = "Date: ${fmt.format(Date())}"

        moodButtons = listOf(
            findViewById(R.id.btnMood1),
            findViewById(R.id.btnMood2),
            findViewById(R.id.btnMood3),
            findViewById(R.id.btnMood4),
            findViewById(R.id.btnMood5)
        )

        moodButtons.forEachIndexed { idx, btn ->
            val mood = idx + 1
            btn.setOnClickListener { selectMood(mood) }
            // ensure accessibility: already set in XML, keep as fallback
            if (btn.contentDescription == null) {
                btn.contentDescription = "${MoodEntry.moodLabel(mood)}, mood $mood of 5"
            }
        }
        selectMood(selectedMood)

        val recycler = findViewById<androidx.recyclerview.widget.RecyclerView>(R.id.recyclerHistory)
        recycler.layoutManager = LinearLayoutManager(this)
        adapter = MoodAdapter(entries) { id ->
            storage.delete(id)
            entries = storage.load()
            refresh()
        }
        recycler.adapter = adapter

        findViewById<MaterialButton>(R.id.btnAdd).setOnClickListener { addEntry() }

        refresh()
    }

    private fun selectMood(mood: Int) {
        selectedMood = mood
        moodButtons.forEachIndexed { idx, btn ->
            val isSelected = idx + 1 == mood
            btn.setBackgroundResource(
                if (isSelected) R.drawable.bg_mood_selected else R.drawable.bg_mood_unselected
            )
            btn.isSelected = isSelected
            // update accessibility to reflect selection
            val label = MoodEntry.moodLabel(idx + 1)
            btn.contentDescription = if (isSelected) "$label, mood ${idx + 1} of 5, selected" else "$label, mood ${idx + 1} of 5"
        }
    }

    private fun addEntry() {
        // trim note, empty allowed – explicitly handle empty case
        val note = etNote.text?.toString()?.trim() ?: ""
        val entry = MoodEntry(
            id = System.currentTimeMillis(),
            mood = selectedMood,
            note = note,
            timestamp = System.currentTimeMillis()
        )
        storage.add(entry)
        entries = storage.load()
        etNote.setText("")
        etNote.clearFocus()
        hideKeyboard()
        refresh()
        Toast.makeText(this, "Mood saved: ${MoodEntry.moodLabel(selectedMood)}", Toast.LENGTH_SHORT).show()
    }

    private fun hideKeyboard() {
        val imm = getSystemService(Context.INPUT_METHOD_SERVICE) as? InputMethodManager
        imm?.hideSoftInputFromWindow(etNote.windowToken, 0)
    }

    private fun refresh() {
        adapter.update(entries)
        val empty = entries.isEmpty()
        tvEmpty.visibility = if (empty) View.VISIBLE else View.GONE
        findViewById<androidx.recyclerview.widget.RecyclerView>(R.id.recyclerHistory).visibility =
            if (empty) View.GONE else View.VISIBLE
        updateStats()
    }

    private fun updateStats() {
        if (entries.isEmpty()) {
            tvStats.text = "Track your mood daily to see insights."
            tvStats.contentDescription = "No mood entries yet"
            statsBar.removeAllViews()
            statsBar.contentDescription = "No data"
            return
        }
        val count = entries.size
        val best = entries.maxByOrNull { it.mood }?.mood ?: 3
        val worst = entries.minByOrNull { it.mood }?.mood ?: 3

        // Day-based aggregation: group by calendar day, average per day, last 7 days
        val dayFormatter = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
        val grouped = entries.groupBy { dayFormatter.format(Date(it.timestamp)) }
        val dailyAvg = grouped.mapValues { (_, list) -> list.map { it.mood }.average() }
        val sortedDays = dailyAvg.keys.sorted()
        val last7Days = sortedDays.takeLast(7)
        val avg7day = if (last7Days.isEmpty()) 0.0 else last7Days.map { dailyAvg[it]!! }.average()
        // fallback to entry-based if less than 7 days of data but entries > days
        val displayAvg = if (last7Days.size < 7 && entries.size >= 7) entries.take(7).map { it.mood }.average() else avg7day

        val recentEntries = entries.take(7).reversed()
        val emojiRow = recentEntries.joinToString(" ") { MoodEntry.moodEmoji(it.mood) }
        val dayCount = grouped.size
        val statsText = "Entries: $count  \u2022  Days: $dayCount  \u2022  7-day avg: ${String.format(Locale.US, "%.1f", displayAvg)}/5  \u2022  Range: ${MoodEntry.moodLabel(worst)} \u2192 ${MoodEntry.moodLabel(best)}\n$emojiRow"
        tvStats.text = statsText
        tvStats.contentDescription = "Total entries $count, days $dayCount, 7 day average ${String.format(Locale.US, "%.1f", displayAvg)} out of 5, range from ${MoodEntry.moodLabel(worst)} to ${MoodEntry.moodLabel(best)}, recent moods $emojiRow"

        // Build bar chart: height proportional to mood (1=>14dp, 5=>40dp), bottom-aligned
        statsBar.removeAllViews()
        val density = resources.displayMetrics.density
        for (e in recentEntries) {
            val bar = View(this)
            val heightDp = 10 + e.mood * 6 // 16..40 dp
            val heightPx = (heightDp * density).toInt()
            val lp = LinearLayout.LayoutParams(0, heightPx, 1f)
            lp.setMargins((2 * density).toInt(), 0, (2 * density).toInt(), 0)
            bar.layoutParams = lp
            bar.setBackgroundColor(Color.parseColor(MoodEntry.moodColor(e.mood)))
            bar.contentDescription = "${MoodEntry.moodLabel(e.mood)} mood level ${e.mood}"
            statsBar.addView(bar)
        }
        statsBar.contentDescription = "Mood chart for last ${recentEntries.size} entries over $dayCount days: $emojiRow"
    }
}
