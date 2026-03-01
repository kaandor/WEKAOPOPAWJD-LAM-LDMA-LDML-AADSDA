package com.klyx.app

import android.content.Intent
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.GridLayout
import android.widget.ImageView
import android.widget.TextView
import androidx.fragment.app.Fragment
import com.bumptech.glide.Glide

class SeriesFragment : Fragment() {

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        return inflater.inflate(R.layout.fragment_grid, container, false)
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        
        val title = view.findViewById<TextView>(R.id.gridTitle)
        title.text = "Séries"
        
        val grid = view.findViewById<GridLayout>(R.id.gridContainer)
        loadSeries(grid)
    }

    private fun loadSeries(grid: GridLayout) {
        val series = IptvRepository.series

        if (series.isEmpty()) {
            // Optional: Show empty state
        }

        series.forEach { item ->
            addCardToGrid(grid, item)
        }
    }

    private fun addCardToGrid(grid: GridLayout, item: IptvContent) {
        val view = layoutInflater.inflate(R.layout.item_movie_card, grid, false)
        val img = view.findViewById<ImageView>(R.id.moviePoster)
        
        Glide.with(this)
            .load(item.poster)
            .centerCrop()
            .into(img)
        
        view.setOnClickListener {
            playVideo(item.stream_url)
        }
        
        // Grid Layout Params
        val params = GridLayout.LayoutParams()
        val marginPx = (8 * resources.displayMetrics.density).toInt()
        params.width = (100 * resources.displayMetrics.density).toInt() // Fixed width for grid
        params.height = (150 * resources.displayMetrics.density).toInt()
        params.setMargins(marginPx, marginPx, marginPx, marginPx)
        view.layoutParams = params
        
        grid.addView(view)
    }

    private fun playVideo(url: String) {
        val intent = Intent(requireContext(), PlayerActivity::class.java)
        intent.putExtra("STREAM_URL", url)
        startActivity(intent)
    }
}