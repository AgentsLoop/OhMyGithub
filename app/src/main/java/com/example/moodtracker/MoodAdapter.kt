package com.example.moodtracker

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class MoodAdapter(
    private var entries: List<MoodEntry>,
    private val onDelete: (MoodEntry) -> Unit
) : RecyclerView.Adapter<MoodAdapter.ViewHolder>() {

    private val dateFormat = SimpleDateFormat("MMM d, yyyy • HH:mm", Locale.getDefault())

    class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val emojiText: TextView = view.findViewById(R.id.emojiText)
        val moodLabel: TextView = view.findViewById(R.id.moodLabel)
        val dateText: TextView = view.findViewById(R.id.dateText)
        val noteText: TextView = view.findViewById(R.id.noteText)
        val deleteButton: ImageView = view.findViewById(R.id.deleteButton)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val view = LayoutInflater.from(parent.context).inflate(R.layout.item_mood_entry, parent, false)
        return ViewHolder(view)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val entry = entries[position]
        holder.emojiText.text = MoodEntry.EMOJIS[entry.mood.coerceIn(0, 4)]
        holder.moodLabel.text = MoodEntry.LABELS[entry.mood.coerceIn(0, 4)]
        holder.dateText.text = dateFormat.format(Date(entry.timestamp))
        if (entry.note.isNotBlank()) {
            holder.noteText.visibility = View.VISIBLE
            holder.noteText.text = entry.note
        } else {
            holder.noteText.visibility = View.GONE
        }
        holder.deleteButton.setOnClickListener { onDelete(entry) }
    }

    override fun getItemCount(): Int = entries.size

    fun update(newEntries: List<MoodEntry>) {
        entries = newEntries
        notifyDataSetChanged()
    }
}
