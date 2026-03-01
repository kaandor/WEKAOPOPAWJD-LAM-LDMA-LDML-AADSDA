package com.klyx.app.api

import retrofit2.Call
import retrofit2.http.Body
import retrofit2.http.POST

data class LoginRequest(
    val email: String,
    val password: String,
    val mac: String,
    val key: String
)

data class LoginResponse(
    val ok: Boolean,
    val token: String?,
    val error: String?
)

interface ApiService {
    @POST("/auth/login")
    fun login(@Body request: LoginRequest): Call<LoginResponse>
}
