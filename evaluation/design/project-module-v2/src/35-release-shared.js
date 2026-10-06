const CURRENT_RELEASE = {
  version: "1.4.0",
  name: "图库重构",
  source: "master @ a1b2c3d",
};

const CANDIDATE_RELEASE = {
  order: "R1",
  version: "1.5.0",
  name: "图片压缩",
  source: "master @ b7c9e21",
  artifact: "picshare-web · 86.4 MB",
};

function createProjectMoment(name, x, options = {}) {
  const { root, main } = createScreen(name, x);
  const content = frame(main, { name: "Project moment content", width: "fill_container", height: "fill_container", layout: "vertical", padding: [20, 28], gap: 10 });
  projectTitle(content, options.primary ? { primary: options.primary, primaryIcon: options.primaryIcon } : {});
  projectTabs(content, options.tab || "发布");
  return { root, main, content };
}

function momentHeading(parent, options) {
  const row = frame(parent, { width: "fill_container", height: 58, layout: "horizontal", alignItems: "center", justifyContent: "space_between" });
  const copy = frame(row, { width: 760, height: "fit_content", layout: "vertical", gap: 4 });
  const titleLine = frame(copy, { width: "fit_content", height: 30, layout: "horizontal", gap: 10, alignItems: "center" });
  text(titleLine, options.title, { fontSize: 22, fontWeight: 700, fill: F(T.ink) });
  if (options.status) status(titleLine, options.status, options.tone || "blue");
  text(copy, options.description, { fontSize: 13, fill: F(T.muted) });
  if (options.meta) text(row, options.meta, { fontSize: 12, fill: F(T.muted) });
  if (options.primary) button(row, options.primary, { kind: "primary", icon: options.primaryIcon });
  return row;
}

function progressStyle(state) {
  if (state === "completed") return { line: "#93C5FD", fill: T.blue100, stroke: "#93C5FD", text: T.blue700, glyph: "check" };
  if (state === "current") return { line: T.blue, fill: T.blue, stroke: T.blue, text: T.blue, glyph: "current" };
  if (state === "blocked") return { line: T.red, fill: T.red50, stroke: T.red, text: T.red, glyph: "blocked" };
  if (state === "pending") return { line: T.faint, fill: T.bg, stroke: T.faint, text: T.muted, glyph: "pending" };
  return { line: T.lineStrong, fill: T.shell, stroke: T.lineStrong, text: T.faint, glyph: "disabled" };
}

function releaseProgress(parent, stages) {
  const chain = frame(parent, { name: "Current release progress", width: "fill_container", height: 56, layout: "horizontal", gap: 0, fill: F(T.bg) });
  stages.forEach(([label, state], index) => {
    const style = progressStyle(state);
    const nextStyle = progressStyle(stages[index + 1]?.[1] || state);
    const item = frame(chain, { name: `Release step: ${label} — ${state}`, width: "fill_container", height: 56, layout: "none" });
    if (index > 0) frame(item, { x: 0, y: 13, width: 144, height: 2, fill: F(style.line) });
    if (index < stages.length - 1) frame(item, { x: 143, y: 13, width: 144, height: 2, fill: F(nextStyle.line) });
    const node = frame(item, { x: 131, y: 2, width: 26, height: 26, layout: "horizontal", alignItems: "center", justifyContent: "center", cornerRadius: 13, fill: F(style.fill), stroke: S(style.stroke, state === "current" || state === "blocked" ? 2 : 1) });
    if (style.glyph === "check") icon(node, "check", { width: 14, height: 14, fill: F(T.blue700) });
    else if (style.glyph === "blocked") icon(node, "circle-alert", { width: 14, height: 14, fill: F(T.red) });
    else I(node, { type: "ellipse", width: state === "current" ? 8 : 6, height: state === "current" ? 8 : 6, fill: F(state === "current" ? T.bg : style.text) });
    text(item, label, { x: 0, y: 34, width: 287, textGrowth: "fixed-width", textAlign: "center", fontSize: 13, fontWeight: state === "current" || state === "blocked" ? 700 : 600, fill: F(style.text) });
  });
  return chain;
}

function arrowProgressStyle(state) {
  if (state === "completed") return { fill: "#DBEAFE", stroke: "#BFDBFE", text: "#1D4ED8", glyph: "check" };
  if (state === "current") return { fill: "#0F62FE", stroke: "#0F62FE", text: T.bg, glyph: "current" };
  if (state === "pending") return { fill: "#E4E7EC", stroke: "#D0D5DD", text: "#475467", glyph: "pending" };
  if (state === "blocked") return { fill: "#E5484D", stroke: "#E5484D", text: T.bg, glyph: "blocked" };
  return { fill: "#F8FAFC", stroke: "#EAECF0", text: "#98A2B3", glyph: "disabled" };
}

function arrowProgressGlyph(parent, style) {
  if (style.glyph === "check") icon(parent, "check", { width: 14, height: 14, fill: F(style.text) });
  else if (style.glyph === "blocked") icon(parent, "circle-alert", { width: 14, height: 14, fill: F(style.text) });
  else if (style.glyph === "disabled") icon(parent, "minus", { width: 14, height: 14, fill: F(style.text) });
  else if (style.glyph === "pending") I(parent, { type: "ellipse", width: 12, height: 12, fill: F("#00000000"), stroke: S(style.text, 2) });
  else I(parent, { type: "ellipse", width: 8, height: 8, fill: F(style.text) });
}

function releaseArrowProgress(parent, stages) {
  const chain = frame(parent, {
    name: "V2-06 segmented chevron rail — selectable stages need hover/focus; current uses aria-current=step; disabled uses aria-disabled=true",
    width: "fill_container",
    height: 40,
    layout: "none",
    clipContent: true,
    cornerRadius: 6,
    fill: F(T.bg),
    stroke: S("#D0D5DD"),
  });
  // OpenPencil 0.8.4 paints earlier layout:none children above later siblings.
  for (let index = 1; index < stages.length; index += 1) {
    const adjacent = [stages[index - 1][1], stages[index][1]];
    const color = adjacent.some((state) => state === "current" || state === "blocked") ? T.bg : "#CBD5E1";
    icon(chain, "chevron-right", { x: index * 287 - 7.5, y: 12.5, width: 15, height: 15, fill: F(color) });
  }
  stages.forEach(([label, state], index) => {
    const style = arrowProgressStyle(state);
    const interaction = state === "current" || state === "blocked"
      ? "aria-current=step"
      : state === "disabled"
        ? "aria-disabled=true"
        : "selectable; hover+focus required";
    const segment = frame(chain, {
      name: `Chevron rail segment: ${label} — ${state} — ${interaction}`,
      role: "button",
      x: index * 287,
      y: 0,
      width: 287,
      height: 40,
      layout: "horizontal",
      padding: [0, 16],
      gap: 8,
      alignItems: "center",
      justifyContent: "center",
      fill: F(style.fill),
    });
    arrowProgressGlyph(segment, style);
    text(segment, label, { fontSize: 13, fontWeight: state === "current" || state === "blocked" ? 700 : 600, fill: F(style.text) });
  });
  return chain;
}

function releaseFacts(parent, fields, options = {}) {
  const strip = frame(parent, { name: options.name || "Release facts", width: "fill_container", height: options.height || 86, layout: "horizontal", cornerRadius: 7, fill: F(T.bg), stroke: S(T.lineStrong) });
  fields.forEach(([label, value, tone], index) => {
    const field = frame(strip, { width: "fill_container", height: "fill_container", layout: "vertical", gap: 7, justifyContent: "center", padding: [0, 16], stroke: index === 0 ? undefined : S(T.line) });
    text(field, label, { fontSize: 12, fontWeight: 500, fill: F(T.muted) });
    text(field, value, { fontSize: 13, fontWeight: 600, fill: F(tone || T.ink) });
  });
  return strip;
}

function sectionHeading(parent, titleLabel, meta) {
  const row = frame(parent, { width: "fill_container", height: 34, layout: "horizontal", alignItems: "center", justifyContent: "space_between" });
  text(row, titleLabel, { fontSize: 15, fontWeight: 700, fill: F(T.ink) });
  if (meta) text(row, meta, { fontSize: 12, fill: F(T.muted) });
  return row;
}

function checkLine(parent, glyph, label, detail, tone = "green") {
  const color = tone === "red" ? T.red : tone === "blue" ? T.blue : T.green;
  const row = frame(parent, { width: "fill_container", height: 48, layout: "horizontal", gap: 10, alignItems: "center" });
  icon(row, glyph, { width: 17, height: 17, fill: F(color) });
  const copy = frame(row, { width: "fill_container", height: "fit_content", layout: "vertical", gap: 2 });
  text(copy, label, { fontSize: 13, fontWeight: 600, fill: F(T.ink) });
  text(copy, detail, { fontSize: 12, fill: F(T.muted) });
  return row;
}
