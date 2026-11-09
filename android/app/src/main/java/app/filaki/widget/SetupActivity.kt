package app.filaki.widget

import android.app.Activity
import android.appwidget.AppWidgetManager
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Bundle
import android.text.InputType
import android.util.TypedValue
import android.view.Gravity
import android.view.ViewGroup.LayoutParams.MATCH_PARENT
import android.view.ViewGroup.LayoutParams.WRAP_CONTENT
import android.view.inputmethod.EditorInfo
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast

/**
 * Opens from the app icon, and when the widget is added: pick your name once,
 * so the widget can show *your* debt and send as you.
 */
class SetupActivity : Activity() {

    private var widgetId = AppWidgetManager.INVALID_APPWIDGET_ID
    private lateinit var input: EditText
    private lateinit var chips: LinearLayout

    private val ink = Color.parseColor("#1B1512")
    private val inkSoft = Color.parseColor("#5C4F45")
    private val paper = Color.parseColor("#FAF3E3")
    private val cream = Color.parseColor("#F2E8D5")
    private val tomato = Color.parseColor("#E04A2A")

    private fun dp(v: Int) = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v.toFloat(), resources.displayMetrics).toInt()
    private fun rounded(color: Int, r: Int = 10) = GradientDrawable().apply { setColor(color); cornerRadius = dp(r).toFloat() }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        widgetId = intent?.extras?.getInt(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID)
            ?: AppWidgetManager.INVALID_APPWIDGET_ID
        // if the person backs out while adding the widget, don't add it
        if (widgetId != AppWidgetManager.INVALID_APPWIDGET_ID) setResult(RESULT_CANCELED)

        window.statusBarColor = cream
        val col = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(24), dp(40), dp(24), dp(24))
        }

        col.addView(TextView(this).apply {
            text = "Who's this phone?"
            setTextColor(ink); textSize = 28f
            typeface = Typeface.create(Typeface.SERIF, Typeface.BOLD)
        })
        col.addView(TextView(this).apply {
            text = "The widget shows your debt and sends kisses and hugs as you. Use the same name as in the app."
            setTextColor(inkSoft); textSize = 16f
            setPadding(0, dp(8), 0, dp(18))
        })

        chips = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        col.addView(chips)

        input = EditText(this).apply {
            hint = "Or type your name"
            setText(Feed.name(this@SetupActivity))
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_CAP_WORDS
            imeOptions = EditorInfo.IME_ACTION_DONE
            setSingleLine()
            textSize = 18f
            setTextColor(ink)
            background = rounded(paper, 8)
            setPadding(dp(14), dp(12), dp(14), dp(12))
            setOnEditorActionListener { _, id, _ -> if (id == EditorInfo.IME_ACTION_DONE) { save(text.toString()); true } else false }
        }
        col.addView(input, LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT).apply { topMargin = dp(10) })

        col.addView(Button(this).apply {
            text = "That's me"
            isAllCaps = false
            setTextColor(paper); textSize = 18f
            typeface = Typeface.create(Typeface.SERIF, Typeface.BOLD)
            background = rounded(tomato)
            setOnClickListener { save(input.text.toString()) }
        }, LinearLayout.LayoutParams(MATCH_PARENT, dp(54)).apply { topMargin = dp(16) })

        col.addView(TextView(this).apply {
            text = "Open filaki"
            setTextColor(Color.parseColor("#2E7FA4")); textSize = 16f
            paintFlags = paintFlags or android.graphics.Paint.UNDERLINE_TEXT_FLAG
            gravity = Gravity.CENTER
            setPadding(0, dp(18), 0, dp(8))
            setOnClickListener { startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(Feed.BASE + "/"))) }
        })

        col.addView(TextView(this).apply {
            text = "To add the widget: long-press your home screen, tap Widgets, find Filaki and drag it out."
            setTextColor(inkSoft); textSize = 14f
            setPadding(0, dp(18), 0, 0)
        })

        setContentView(ScrollView(this).apply {
            setBackgroundColor(cream)
            addView(col)
        })

        Thread {
            val names = Feed.names()
            runOnUiThread { showNames(names) }
        }.start()
    }

    private fun showNames(names: List<String>) {
        chips.removeAllViews()
        if (names.isEmpty()) return
        chips.addView(TextView(this).apply {
            text = "Names on the tab"
            setTextColor(inkSoft); textSize = 14f
            setPadding(0, 0, 0, dp(6))
        })
        names.forEach { n ->
            chips.addView(Button(this).apply {
                text = n
                isAllCaps = false
                setTextColor(ink); textSize = 17f
                typeface = Typeface.MONOSPACE
                gravity = Gravity.START or Gravity.CENTER_VERTICAL
                background = rounded(paper, 8)
                setPadding(dp(14), 0, dp(14), 0)
                setOnClickListener { save(n) }
            }, LinearLayout.LayoutParams(MATCH_PARENT, dp(50)).apply { bottomMargin = dp(8) })
        }
    }

    private fun save(raw: String) {
        val name = raw.trim().replace(Regex("\\s+"), " ").take(20)
        if (name.isEmpty()) {
            Toast.makeText(this, "Pick or type your name", Toast.LENGTH_SHORT).show()
            return
        }
        Feed.setName(this, name)
        FilakiWidget.schedule(this)
        FilakiWidget.refreshNow(this)
        if (widgetId != AppWidgetManager.INVALID_APPWIDGET_ID) {
            setResult(RESULT_OK, Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId))
        } else {
            Toast.makeText(this, "Saved. Now add the Filaki widget to your home screen.", Toast.LENGTH_LONG).show()
        }
        finish()
    }
}
