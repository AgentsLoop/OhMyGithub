package com.omg.moodtracker

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageButton
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView

class MoodAdapter(
    private var entries: MutableList<MoodEntry>,
    private val onDelete: (MoodEntry) -> Unit
) : RecyclerView.Adapter<MoodAdapter.VH>() {

    class VH(v: View) : RecyclerView.ViewHolder(v) {
        val emoji: TextView = v.findViewById(R.id.itemEmoji)
        val moodName: TextView = v.findViewById(R.id.itemMoodName)
        val date: TextView = v.findViewById(R.id.itemDate)
        val note: TextView = v.findViewById(R.id.itemNote)
        val del: ImageButton = v.findViewById(R.id.btnDelete)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): VH {
        val v = LayoutInflater.from(parent.context).inflate(R.layout.item_mood_entry, parent, false)
        return VH(v)
    }

    override fun onBindViewHolder(holder: VH, position: Int) {
        val e = entries[position]
        holder.emoji.text = e.mood.emoji
        holder.moodName.text = e.mood.displayName
        holder.date.text = e.dateString
        if (e.note.isBlank()) {
            holder.note.visibility = View.GONE
        } else {
            holder.note.visibility = View.VISIBLE
            holder.note.text = e.note
        }
        holder.del.setOnClickListener { onDelete(e) }
    }

    override fun getItemCount(): Int = entries.size

    fun update(newList: List<MoodEntry>) {
        entries = newList.toMutableList()
        notifyDataSetChanged()
    }
}
