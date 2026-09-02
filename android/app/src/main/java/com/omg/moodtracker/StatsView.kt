package com.omg.moodtracker

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.util.AttributeSet
import android.view.View
import kotlin.math.max

class StatsView @JvmOverloads constructor(
    context: Context, attrs: AttributeSet? = null
) : View(context, attrs) {

    private var counts: Map<Mood, Int> = emptyMap()
    private val barPaint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val textPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.DKGRAY
        textSize = 30f
        textAlign = Paint.Align.CENTER
    }
    private val labelPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.DKGRAY
        textSize = 28f
        textAlign = Paint.Align.CENTER
    }

    fun setData(counts: Map<Mood, Int>) {
        this.counts = counts
        invalidate()
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        if (counts.isEmpty()) {
            textPaint.textSize = 36f
            canvas.drawText("No data yet", width / 2f, height / 2f, textPaint)
            return
        }
        val moods = Mood.entries
        val maxCount = max(1, counts.values.maxOrNull() ?: 1)
        val barWidth = width / (moods.size * 2f)
        val chartHeight = height * 0.65f
        val bottom = height * 0.85f
        val leftPad = barWidth

        moods.forEachIndexed { idx, mood ->
            val count = counts[mood] ?: 0
            val barH = (count.toFloat() / maxCount) * chartHeight
            val x = leftPad + idx * barWidth * 2
            val top = bottom - barH

            // color per mood
            val col = when (mood) {
                Mood.TERRIBLE -> Color.parseColor("#EF5350")
                Mood.BAD -> Color.parseColor("#FF8A65")
                Mood.OKAY -> Color.parseColor("#FFD54F")
                Mood.GOOD -> Color.parseColor("#AED581")
                Mood.GREAT -> Color.parseColor("#66BB6A")
            }
            barPaint.color = col
            canvas.drawRoundRect(x, top, x + barWidth, bottom, 12f, 12f, barPaint)

            // emoji label
            labelPaint.textSize = 36f
            canvas.drawText(mood.emoji, x + barWidth / 2, bottom + 40, labelPaint)
            // count label on top
            textPaint.textSize = 30f
            if (count > 0) canvas.drawText(count.toString(), x + barWidth / 2, top - 12, textPaint)
            // name small
            labelPaint.textSize = 22f
            canvas.drawText(mood.displayName, x + barWidth / 2, bottom + 68, labelPaint)
        }
    }

    override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
        val h = 280 // dp-ish px; let parent decide but default 280
        val w = MeasureSpec.getSize(widthMeasureSpec)
        setMeasuredDimension(w, h)
    }
}
