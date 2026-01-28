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
            movies = loadMovies(context)
            series = loadSeries(context)
            channels = loadChannels(context)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun loadMovies(context: Context): List<IptvContent> {
        return try {
            val stream = context.assets.open("data/movies.json")
            val response = Gson().fromJson(InputStreamReader(stream), MovieResponse::class.java)
            response.movies.map { it.apply { type = ContentType.MOVIE } }
        } catch (e: Exception) {
            emptyList()
        }
    }

    private fun loadSeries(context: Context): List<IptvContent> {
        return try {
            val stream = context.assets.open("data/series.json")
            val response = Gson().fromJson(InputStreamReader(stream), SeriesResponse::class.java)
            response.series.map { it.apply { type = ContentType.SERIES } }
        } catch (e: Exception) {
            emptyList()
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
