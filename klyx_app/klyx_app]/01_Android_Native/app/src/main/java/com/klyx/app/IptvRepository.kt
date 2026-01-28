package com.klyx.app

import android.content.Context
import com.google.gson.Gson
import com.google.gson.annotations.SerializedName
import java.io.InputStreamReader

data class IptvContent(
    @SerializedName("id") val id: String,
    @SerializedName("title") val title: String,
    @SerializedName("description") val description: String = "",
    @SerializedName("poster") val posterUrl: String? = null,
    @SerializedName("logo") val logoUrl: String? = null,
    @SerializedName("stream_url") val streamUrl: String,
    @SerializedName("category") val category: String = "Geral",
    var type: ContentType = ContentType.MOVIE
) {
    val poster: String
        get() = posterUrl ?: logoUrl ?: ""
        
    val logo: String
        get() = logoUrl ?: posterUrl ?: ""
        
    val stream_url: String
        get() = streamUrl

    fun getImage(): String {
        return posterUrl ?: logoUrl ?: ""
    }
}

enum class ContentType {
    MOVIE,
    SERIES,
    LIVE
}

data class MovieResponse(val movies: List<IptvContent>)
data class SeriesResponse(val series: List<IptvContent>)
data class LiveResponse(val channels: List<IptvContent>)

object IptvRepository {
    var movies: List<IptvContent> = emptyList()
    var series: List<IptvContent> = emptyList()
    var channels: List<IptvContent> = emptyList()

    fun initialize(context: Context) {
        try {
            android.util.Log.d("IptvRepository", "Initializing...")
            movies = loadMovies(context)
            series = loadSeries(context)
            // channels = loadChannels(context) // Disabled as per request
            android.util.Log.d("IptvRepository", "Loaded: ${movies.size} movies, ${series.size} series")
        } catch (e: Exception) {
            android.util.Log.e("IptvRepository", "Error initializing", e)
            e.printStackTrace()
        }
    }

    private fun loadMovies(context: Context): List<IptvContent> {
        return try {
            val stream = context.assets.open("data/movies.json")
            val reader = InputStreamReader(stream)
            val response = Gson().fromJson(reader, MovieResponse::class.java)
            response?.movies?.map { it.apply { type = ContentType.MOVIE } } ?: emptyList()
        } catch (e: Exception) {
            android.util.Log.e("IptvRepository", "Error loading movies", e)
            // Fallback for debugging if file fails
            listOf(IptvContent("debug1", "Debug Movie", "Debug Desc", null, null, "", "Debug"))
        }
    }

    private fun loadSeries(context: Context): List<IptvContent> {
        return try {
            val stream = context.assets.open("data/series.json")
            val reader = InputStreamReader(stream)
            val response = Gson().fromJson(reader, SeriesResponse::class.java)
            response?.series?.map { it.apply { type = ContentType.SERIES } } ?: emptyList()
        } catch (e: Exception) {
            android.util.Log.e("IptvRepository", "Error loading series", e)
             // Fallback for debugging
             listOf(IptvContent("debug2", "Debug Series", "Debug Desc", null, null, "", "Debug"))
        }
    }

    private fun loadChannels(context: Context): List<IptvContent> {
        return try {
            val stream = context.assets.open("data/live.json")
            val response = Gson().fromJson(InputStreamReader(stream), LiveResponse::class.java)
            response.channels.map { it.apply { type = ContentType.LIVE } }
        } catch (e: Exception) {
            emptyList()
        }
    }

    fun getAllContent(): List<IptvContent> = movies + series + channels
}
