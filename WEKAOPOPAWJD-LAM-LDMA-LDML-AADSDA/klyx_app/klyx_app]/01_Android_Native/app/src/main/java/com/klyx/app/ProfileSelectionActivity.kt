package com.klyx.app

import android.content.Intent
import android.os.Bundle
import android.widget.LinearLayout
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity

class ProfileSelectionActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_profile_selection)

        val profile1 = findViewById<LinearLayout>(R.id.profile1)
        val profile2 = findViewById<LinearLayout>(R.id.profile2)

        profile1.setOnClickListener {
            selectProfile("Kaandro")
        }

        profile2.setOnClickListener {
            selectProfile("Criança")
        }
    }

    private fun selectProfile(name: String) {
        Toast.makeText(this, "Bem-vindo, $name", Toast.LENGTH_SHORT).show()
        val intent = Intent(this, DashboardActivity::class.java)
        startActivity(intent)
        finish()
    }
}