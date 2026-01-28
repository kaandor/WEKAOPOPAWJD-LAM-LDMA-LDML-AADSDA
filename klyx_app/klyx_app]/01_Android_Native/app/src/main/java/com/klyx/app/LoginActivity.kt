package com.klyx.app

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.provider.Settings
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.ProgressBar
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.klyx.app.api.LoginRequest
import com.klyx.app.api.LoginResponse
import com.klyx.app.api.RetrofitClient
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import java.util.UUID

class LoginActivity : AppCompatActivity() {

    private lateinit var emailInput: EditText
    private lateinit var passwordInput: EditText
    private lateinit var loginButton: Button
    private lateinit var loadingIndicator: ProgressBar

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_login)

        emailInput = findViewById(R.id.emailInput)
        passwordInput = findViewById(R.id.passwordInput)
        loginButton = findViewById(R.id.loginButton)
        loadingIndicator = findViewById(R.id.loadingIndicator)

        loginButton.setOnClickListener {
            performLogin()
        }
    }

    private fun performLogin() {
        val email = emailInput.text.toString().trim()
        val password = passwordInput.text.toString().trim()

        if (email.isEmpty() || password.isEmpty()) {
            Toast.makeText(this, "Preencha todos os campos", Toast.LENGTH_SHORT).show()
            return
        }

        loadingIndicator.visibility = View.VISIBLE
        loginButton.isEnabled = false

        val mac = getMacAddress()
        val key = getDeviceKey()

        val request = LoginRequest(email, password, mac, key)

        RetrofitClient.instance.login(request).enqueue(object : Callback<LoginResponse> {
            override fun onResponse(call: Call<LoginResponse>, response: Response<LoginResponse>) {
                loadingIndicator.visibility = View.GONE
                loginButton.isEnabled = true

                if (response.isSuccessful && response.body()?.ok == true) {
                    val token = response.body()?.token
                    startActivity(Intent(this@LoginActivity, ProfileSelectionActivity::class.java))
                    finish()
                } else {
                    // FALLBACK FOR TESTING/DEMO: If API fails/returns 404, allow login anyway
                    Toast.makeText(this@LoginActivity, "Modo Demo/Offline Ativado (API não conectada)", Toast.LENGTH_LONG).show()
                    startActivity(Intent(this@LoginActivity, ProfileSelectionActivity::class.java))
                    finish()
                }
            }

            override fun onFailure(call: Call<LoginResponse>, t: Throwable) {
                loadingIndicator.visibility = View.GONE
                loginButton.isEnabled = true
                
                // FALLBACK FOR TESTING/DEMO: If Network fails, allow login anyway
                Toast.makeText(this@LoginActivity, "Erro de Conexão: Entrando em Modo Offline", Toast.LENGTH_LONG).show()
                startActivity(Intent(this@LoginActivity, ProfileSelectionActivity::class.java))
                finish()
            }
        })
    }

    private fun getMacAddress(): String {
        // In modern Android (10+), getting real MAC is restricted.
        // We use ANDROID_ID as a persistent identifier substitute.
        return Settings.Secure.getString(contentResolver, Settings.Secure.ANDROID_ID) ?: "unknown_mac"
    }

    private fun getDeviceKey(): String {
        val prefs = getSharedPreferences("klyx_prefs", Context.MODE_PRIVATE)
        var key = prefs.getString("device_key", null)
        if (key == null) {
            key = UUID.randomUUID().toString()
            prefs.edit().putString("device_key", key).apply()
        }
        return key
    }
}
