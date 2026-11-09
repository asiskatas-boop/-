package app.filaki.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.text.format.DateUtils
import android.view.View
import android.widget.RemoteViews
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.Worker
import androidx.work.WorkerParameters
import java.util.concurrent.TimeUnit

class FilakiWidget : AppWidgetProvider() {

    override fun onUpdate(ctx: Context, mgr: AppWidgetManager, ids: IntArray) {
        Render.all(ctx)            // draw from cache straight away
        schedule(ctx)
        val pending = goAsync()
        Thread {
            try { Feed.refresh(ctx); Render.all(ctx) } finally { pending.finish() }
        }.start()
    }

    override fun onEnabled(ctx: Context) = schedule(ctx)

    override fun onDisabled(ctx: Context) {
        WorkManager.getInstance(ctx).cancelUniqueWork(WORK)
    }

    override fun onReceive(ctx: Context, intent: Intent) {
        super.onReceive(ctx, intent)
        when (intent.action) {
            ACTION_SEND -> {
                val type = intent.getStringExtra("type") ?: return
                val word = if (type == "hug") "hug" else "kiss"
                Render.all(ctx, status = "Sending a $word…")
                val pending = goAsync()
                Thread {
                    try {
                        val problem = Feed.send(ctx, type)
                        Feed.refresh(ctx)
                        Render.all(ctx, status = if (problem == null) "You sent a $word just now" else "Not sent: $problem")
                    } finally { pending.finish() }
                }.start()
            }
            ACTION_REFRESH -> {
                Render.all(ctx, status = "Refreshing…")
                val pending = goAsync()
                Thread {
                    try {
                        val ok = Feed.refresh(ctx) != null
                        Render.all(ctx, status = if (ok) null else "Couldn't refresh, no connection")
                    } finally { pending.finish() }
                }.start()
            }
        }
    }

    companion object {
        const val ACTION_SEND = "app.filaki.widget.SEND"
        const val ACTION_REFRESH = "app.filaki.widget.REFRESH"
        private const val WORK = "filaki-refresh"

        fun schedule(ctx: Context) {
            val req = PeriodicWorkRequestBuilder<RefreshWorker>(15, TimeUnit.MINUTES).build()
            WorkManager.getInstance(ctx).enqueueUniquePeriodicWork(WORK, ExistingPeriodicWorkPolicy.KEEP, req)
        }

        fun refreshNow(ctx: Context) {
            ctx.sendBroadcast(Intent(ctx, FilakiWidget::class.java).setAction(ACTION_REFRESH))
        }
    }
}

/** Background refresh every ~15 minutes (Android decides the exact timing). */
class RefreshWorker(ctx: Context, params: WorkerParameters) : Worker(ctx, params) {
    override fun doWork(): Result {
        Feed.refresh(applicationContext)
        Render.all(applicationContext)
        return Result.success()
    }
}

object Render {
    fun all(ctx: Context, status: String? = null) {
        val mgr = AppWidgetManager.getInstance(ctx)
        val ids = mgr.getAppWidgetIds(ComponentName(ctx, FilakiWidget::class.java))
        if (ids.isEmpty()) return
        val views = build(ctx, status)
        ids.forEach { mgr.updateAppWidget(it, views) }
    }

    private fun build(ctx: Context, status: String?): RemoteViews {
        val v = RemoteViews(ctx.packageName, R.layout.widget_filaki)
        val name = Feed.name(ctx)
        val feed = Feed.cached(ctx)

        if (name.isEmpty()) {
            v.setTextViewText(R.id.debt, "Tap to pick your name")
            v.setTextViewText(R.id.last, "So the widget knows whose tab this is")
            v.setTextViewText(R.id.agenda_title, "")
            v.setTextViewText(R.id.items, "")
            v.setViewVisibility(R.id.drawing_frame, View.GONE)
            v.setOnClickPendingIntent(R.id.root, setupIntent(ctx))
            v.setOnClickPendingIntent(R.id.body, setupIntent(ctx))
        } else {
            v.setTextViewText(R.id.debt, feed?.optString("debtLine")?.takeIf { it.isNotEmpty() } ?: "Loading the tab")

            val last = feed?.optJSONObject("last")
            val lastText = last?.let {
                val ago = DateUtils.getRelativeTimeSpanString(it.optLong("time"), System.currentTimeMillis(), DateUtils.MINUTE_IN_MILLIS)
                "${it.optString("text")}, ${ago.toString().lowercase()}"
            } ?: ""
            v.setTextViewText(R.id.last, status ?: lastText)

            val agenda = feed?.optJSONObject("agenda")
            val open = agenda?.optInt("open") ?: 0
            val items = agenda?.optJSONArray("items")
            v.setTextViewText(R.id.agenda_title, when {
                feed == null -> ""
                open == 0 -> "Couch agenda: all done"
                else -> "Couch agenda ($open)"
            })
            val lines = (0 until minOf(3, items?.length() ?: 0)).map { "- " + items!!.getJSONObject(it).optString("text") }
            v.setTextViewText(R.id.items, lines.joinToString("\n"))

            val bmp = if (feed?.optJSONObject("drawing") != null) Feed.drawing(ctx) else null
            if (bmp != null) {
                v.setImageViewBitmap(R.id.drawing, bmp)
                v.setViewVisibility(R.id.drawing_frame, View.VISIBLE)
            } else {
                v.setViewVisibility(R.id.drawing_frame, View.GONE)
            }

            v.setOnClickPendingIntent(R.id.body, openApp(ctx))
            v.setOnClickPendingIntent(R.id.drawing_frame, openApp(ctx))
        }

        v.setOnClickPendingIntent(R.id.btn_kiss, sendIntent(ctx, "kiss", 1))
        v.setOnClickPendingIntent(R.id.btn_hug, sendIntent(ctx, "hug", 2))
        v.setOnClickPendingIntent(R.id.btn_refresh, broadcast(ctx, Intent(ctx, FilakiWidget::class.java).setAction(FilakiWidget.ACTION_REFRESH), 3))
        return v
    }

    private fun broadcast(ctx: Context, intent: Intent, code: Int) =
        PendingIntent.getBroadcast(ctx, code, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

    private fun sendIntent(ctx: Context, type: String, code: Int) = broadcast(
        ctx,
        Intent(ctx, FilakiWidget::class.java).setAction(FilakiWidget.ACTION_SEND).putExtra("type", type),
        code
    )

    private fun openApp(ctx: Context) = PendingIntent.getActivity(
        ctx, 10,
        Intent(Intent.ACTION_VIEW, Uri.parse(Feed.BASE + "/")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )

    private fun setupIntent(ctx: Context) = PendingIntent.getActivity(
        ctx, 11,
        Intent(ctx, SetupActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
}
