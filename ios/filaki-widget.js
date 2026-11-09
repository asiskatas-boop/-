// Filaki widget for iPhone, made for the free Scriptable app.
// 1. Install Scriptable from the App Store.
// 2. In Scriptable, tap +, paste this whole file, and name the script "Filaki".
// 3. On the home screen: long-press, tap Edit, Add Widget, Scriptable, choose Medium, Add.
// 4. Long-press the new widget, Edit Widget:
//      Script: Filaki
//      When Interacting: Open URL, URL: https://filaki.pages.dev
//      Parameter: your name exactly as in the app (for example Athinara)

const BASE = "https://filaki.pages.dev";
const NAME = (args.widgetParameter || "Athinara").trim();

const C = {
  paper: new Color("#FAF3E3"),
  ink: new Color("#1B1512"),
  soft: new Color("#5C4F45"),
  tomato: new Color("#E04A2A"),
  pool: new Color("#2E7FA4"),
  white: Color.white(),
};

async function getJSON(url) {
  const r = new Request(url);
  r.timeoutInterval = 15;
  return await r.loadJSON();
}

async function getImage(url) {
  try {
    const r = new Request(url);
    r.timeoutInterval = 15;
    return await r.loadImage();
  } catch (e) {
    return null;
  }
}

function ago(t) {
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? "yesterday" : `${d} days ago`;
}

function addText(stack, text, font, color, lines = 1) {
  const t = stack.addText(text);
  t.font = font;
  t.textColor = color;
  t.lineLimit = lines;
  return t;
}

async function build() {
  const w = new ListWidget();
  w.backgroundColor = C.paper;
  w.setPadding(14, 14, 14, 14);
  w.url = BASE + "/";
  // ask iOS to refresh again in about 15 minutes (it may wait longer)
  w.refreshAfterDate = new Date(Date.now() + 15 * 60 * 1000);

  let data;
  try {
    data = await getJSON(`${BASE}/api/widget?name=${encodeURIComponent(NAME)}`);
  } catch (e) {
    addText(w, "Can't reach filaki", Font.boldSystemFont(16), C.ink);
    addText(w, "It will try again soon.", Font.systemFont(12), C.soft);
    return w;
  }

  const size = config.widgetFamily || "medium";
  const row = w.addStack();
  row.layoutHorizontally();
  row.topAlignContent();

  const left = row.addStack();
  left.layoutVertically();

  if (data.names && data.names.length && !data.names.includes(NAME)) {
    addText(left, `"${NAME}" isn't on the tab`, Font.boldSystemFont(15), C.tomato, 2);
    addText(left, "Edit the widget and set Parameter to your name as it appears in the app.", Font.systemFont(11), C.soft, 3);
    return w;
  }

  addText(left, data.debtLine || "All square", new Font("Georgia-Bold", size === "small" ? 16 : 19), data.owes > 0 ? C.tomato : C.ink, 2);

  if (data.last) {
    left.addSpacer(2);
    addText(left, `${data.last.text}, ${ago(data.last.time)}`, new Font("Menlo-Regular", 10), C.soft);
  }

  if (size !== "small") {
    left.addSpacer(8);
    const open = data.agenda ? data.agenda.open : 0;
    addText(left, open ? `Couch agenda (${open})` : "Couch agenda: all done", new Font("Georgia-Bold", 13), C.tomato);
    const items = (data.agenda && data.agenda.items) || [];
    items.slice(0, size === "large" ? 5 : 3).forEach(i => {
      addText(left, "- " + i.text, new Font("Georgia", 13), C.ink);
    });
  }

  if (data.drawing) {
    const img = await getImage(data.drawing.image);
    if (img) {
      row.addSpacer(10);
      const frame = row.addStack();
      frame.layoutVertically();
      frame.backgroundColor = C.white;
      frame.cornerRadius = 3;
      frame.setPadding(4, 4, 12, 4);
      const pic = frame.addImage(img);
      const s = size === "small" ? 46 : size === "large" ? 120 : 82;
      pic.imageSize = new Size(s, s);
      pic.applyFillingContentMode();
    }
  } else {
    row.addSpacer();
  }

  w.addSpacer();
  return w;
}

const widget = await build();
if (config.runsInWidget) {
  Script.setWidget(widget);
} else {
  await widget.presentMedium();
}
Script.complete();
