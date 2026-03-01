package com.klyx.app

import android.content.Intent
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import androidx.fragment.app.Fragment
import com.bumptech.glide.Glide

class HomeFragment : Fragment() {

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        return inflater.inflate(R.layout.fragment_home, container, false)
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        loadContent(view)
    }

    private fun loadContent(view: View) {
        val recentMoviesContainer = view.findViewById<LinearLayout>(R.id.recentMoviesContainer)
        val trendingSeriesContainer = view.findViewById<LinearLayout>(R.id.trendingSeriesContainer)
        val heroImage = view.findViewById<ImageView>(R.id.heroImage)
        val heroTitle = view.findViewById<TextView>(R.id.heroTitle)
        val heroPlayButton = view.findViewById<Button>(R.id.heroPlayButton)

        // --- Hero Content (Random Movie or Series) ---
        val heroContent = IptvRepository.movies.shuffled().firstOrNull() 
            ?: IptvRepository.series.shuffled().firstOrNull()

        heroContent?.let { content ->
             Glide.with(this).load(content.poster).centerCrop().into(heroImage)
             heroTitle.text = content.title
             heroPlayButton.setOnClickListener {
                 playVideo(content.stream_url)
             }
        }

        // --- Recent Movies List ---
        IptvRepository.movies.take(10).forEach { movie ->
            addCardToContainer(recentMoviesContainer, movie)
        }

        // --- Trending Series List ---
        IptvRepository.series.take(10).forEach { series ->
            addCardToContainer(trendingSeriesContainer, series)
        }
    }

    private fun addCardToContainer(container: LinearLayout, item: IptvContent) {
        val view = layoutInflater.inflate(R.layout.item_movie_card, container, false)
        val img = view.findViewById<ImageView>(R.id.moviePoster)
        
        Glide.with(this)
            .load(item.poster)
            .centerCrop()
            .into(img)
        
        view.setOnClickListener {
            playVideo(item.stream_url)
        }
        
        // Add margin between items (convert 12dp to pixels)
        val marginPx = (12 * resources.displayMetrics.density).toInt()
        val params = LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT, 
            LinearLayout.LayoutParams.WRAP_CONTENT
        )
        params.marginEnd = marginPx
        view.layoutParams = params
        
        container.addView(view)
    }

    private fun playVideo(url: String) {
        val intent = Intent(requireContext(), PlayerActivity::class.java)
        intent.putExtra("STREAM_URL", url)
        startActivity(intent)
    }
}