package com.example.moodtracker

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageButton
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class MoodAdapter(
    private var entries: MutableList<MoodEntry>,
    private val onDelete: (Long) -> Unit
) : RecyclerView.Adapter<MoodAdapter.VH>() {

    private val dateFmt = SimpleDateFormat("MMM dd, yyyy  hh:mm a", Locale.getDefault())

    inner class VH(view: View) : RecyclerView.ViewHolder(view) {
        val tvEmoji: TextView = view.findViewById(R.id.tvEmoji)
        val tvMoodLabel: TextView = view.findViewById(R.id.tvMoodLabel)
        val tvNote: TextView = view.findViewById(R.id.tvNote)
        val tvDate: TextView = view.findViewById(R.id.tvDate)
        val btnDelete: ImageButton = view.findViewById(R.id.btnDelete)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): VH {
        val v = LayoutInflater.from(parent.context).inflate(R.layout.item_mood, parent, false)
        return VH(v)
    }

    override fun onBindViewHolder(holder: VH, position: Int) {
        val e = entries[position]
        holder.tvEmoji.text = MoodEntry.moodEmoji(e.mood)
        holder.tvEmoji.contentDescription = "${MoodEntry.moodLabel(e.mood)} emoji"
        holder.tvMoodLabel.text = MoodEntry.moodLabel(e.mood)
        val displayNote = if (e.note.isBlank()) MoodEntry.moodLabel(e.mood) else e.note
        holder.tvNote.text = displayNote
        holder.tvNote.contentDescription = "Note: $displayNote"
        holder.tvDate.text = dateFmt.format(Date(e.timestamp))
        holder.tvDate.contentDescription = "Date ${dateFmt.format(Date(e.timestamp))}"
        holder.btnDelete.contentDescription = "Delete entry ${MoodEntry.moodLabel(e.mood)}"
        holder.btnDelete.setOnClickListener { onDelete(e.id) }
        holder.itemView.contentDescription = "${MoodEntry.moodLabel(e.mood)} entry: $displayNote"
    }

    override fun getItemCount(): Int = entries.size

    fun update(newList: List<MoodEntry>) {
        entries = newList.toMutableList()
        notifyDataSetChanged()
    }
}
