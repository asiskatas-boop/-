package app.filaki.widget

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

/** Talks to filaki.pages.dev and keeps the last answer so the widget can draw instantly. */
object Feed {
    const val BASE = "https://filaki.pages.dev"
    private const val PREFS = "filaki"

    fun prefs(ctx: Context) = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    fun name(ctx: Context): String = prefs(ctx).getString("name", "") ?: ""
    fun setName(ctx: Context, name: String) = prefs(ctx).edit().putString("name", name).apply()
    fun cached(ctx: Context): JSONObject? =
        prefs(ctx).getString("feed", null)?.let { runCatching { JSONObject(it) }.getOrNull() }

    private fun open(url: String, method: String = "GET"): HttpURLConnection =
        (URL(url).openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = 10_000
            readTimeout = 15_000
            setRequestProperty("accept", "application/json")
        }

    /** Fetch the feed for this phone's name, cache it, and cache the latest drawing too. */
    fun refresh(ctx: Context): JSONObject? {
        val name = name(ctx)
        val conn = open("$BASE/api/widget?name=" + URLEncoder.encode(name, "UTF-8"))
        return try {
            if (conn.responseCode != 200) return null
            val text = conn.inputStream.bufferedReader().use { it.readText() }
            val json = JSONObject(text)
            prefs(ctx).edit().putString("feed", text).apply()
            json.optJSONObject("drawing")?.let { cacheDrawing(ctx, it.optString("id"), it.optString("image")) }
            json
        } catch (e: Exception) {
            null
        } finally {
            conn.disconnect()
        }
    }

    private fun drawingFile(ctx: Context) = File(ctx.filesDir, "drawing.jpg")

    private fun cacheDrawing(ctx: Context, id: String, url: String) {
        if (id.isEmpty() || url.isEmpty()) return
        val p = prefs(ctx)
        if (p.getString("drawingId", "") == id && drawingFile(ctx).exists()) return
        val conn = open(url)
        try {
            if (conn.responseCode != 200) return
            val bytes = conn.inputStream.use { it.readBytes() }
            drawingFile(ctx).writeBytes(bytes)
            p.edit().putString("drawingId", id).apply()
        } catch (_: Exception) {
        } finally {
            conn.disconnect()
        }
    }

    /** The cached drawing, shrunk so it fits a widget comfortably. */
    fun drawing(ctx: Context): Bitmap? {
        val f = drawingFile(ctx)
        if (!f.exists()) return null
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeFile(f.path, bounds)
        var sample = 1
        while (bounds.outWidth / (sample * 2) >= 260 && bounds.outHeight / (sample * 2) >= 260) sample *= 2
        return BitmapFactory.decodeFile(f.path, BitmapFactory.Options().apply { inSampleSize = sample })
    }

    /** Send a kiss or hug. Returns null when it worked, otherwise a short reason. */
    fun send(ctx: Context, type: String): String? {
        val name = name(ctx)
        if (name.isEmpty()) return "pick your name first"
        val conn = open("$BASE/api/send", "POST")
        return try {
            conn.doOutput = true
            conn.setRequestProperty("content-type", "application/json")
            val body = JSONObject().put("type", type).put("from", name).toString()
            conn.outputStream.use { it.write(body.toByteArray()) }
            val code = conn.responseCode
            if (code == 200) null else {
                val err = runCatching {
                    JSONObject(conn.errorStream.bufferedReader().use { it.readText() }).optString("error")
                }.getOrNull()
                when {
                    code == 403 -> "your name isn't on the tab yet"
                    !err.isNullOrEmpty() -> err
                    else -> "error $code"
                }
            }
        } catch (e: Exception) {
            "no connection"
        } finally {
            conn.disconnect()
        }
    }

    /** Names already on the tab, for the name picker. */
    fun names(): List<String> {
        val conn = open("$BASE/api/widget")
        return try {
            val json = JSONObject(conn.inputStream.bufferedReader().use { it.readText() })
            val arr = json.optJSONArray("names") ?: return emptyList()
            (0 until arr.length()).map { arr.getString(it) }
        } catch (_: Exception) {
            emptyList()
        } finally {
            conn.disconnect()
        }
    }
}
