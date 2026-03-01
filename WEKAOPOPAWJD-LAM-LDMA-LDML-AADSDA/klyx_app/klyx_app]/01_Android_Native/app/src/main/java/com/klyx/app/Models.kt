package com.klyx.app

data class Movie(
    val title: String, 
    val poster: String, 
    val url: String,
    val isSeries: Boolean = false
)