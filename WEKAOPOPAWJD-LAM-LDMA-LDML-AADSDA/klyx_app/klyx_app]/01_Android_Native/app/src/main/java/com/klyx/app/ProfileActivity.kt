package com.klyx.app

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.provider.Settings
import android.widget.ArrayAdapter
import android.widget.Button
import android.widget.Spinner
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity

class ProfileActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_profile)

        setupPreferences()
        setupDeviceInfo()
        setupLogout()
    }

    private fun setupPreferences() {
        val spinner = findViewById<Spinner>(R.id.languageSpinner)
        val languages = arrayOf("Português (Brasil)", "English (US)", "Español")
        val adapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, languages)
        spinner.adapter = adapter
    }

    private fun setupDeviceInfo() {
        val macText = findViewById<TextView>(R.id.macAddressText)
        val keyText = findViewById<TextView>(R.id.deviceKeyText)

        val androidId = Settings.Secure.getString(contentResolver, Settings.Secure.ANDROID_ID) ?: "unknown"
        // Mock MAC format from Android ID for visual parity
        val mockMac = androidId.chunked(2).joinToString(":").take(17)
        
        macText.text = mockMac
        
        val prefs = getSharedPreferences("klyx_prefs", Context.MODE_PRIVATE)
        val key = prefs.getString("device_key", "UNKNOWN")
        keyText.text = key
    }

    private fun setupLogout() {
        val logoutButton = findViewById<Button>(R.id.logoutButton)
        logoutButton.setOnClickListener {
            val intent = Intent(this, LoginActivity::class.java)
            intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
            startActivity(intent)
            finish()
        }
    }
}