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
  const content = frame(main, {
    name: "Project moment content",
    width: "fill_container",
    height: "fill_container",
    layout: "vertical",
    padding: [20, 28],
    gap: 10,
  });
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

function releaseProgress(parent, stages) {
  const chain = frame(parent, { name: "Current release progress", width: "fill_container", height: 46, layout: "horizontal", gap: 0, alignItems: "center", cornerRadius: 7, clipContent: true, fill: F(T.bg), stroke: S(T.lineStrong) });
  for (const [label, state] of stages) {
    const palette = state === "done"
      ? ["check", T.green, T.green50]
      : state === "active"
        ? ["loader-circle", T.blue, T.blue50]
        : state === "blocked"
          ? ["circle-alert", T.red, T.red50]
          : ["clock-3", T.faint, T.shell];
    const item = frame(chain, { width: "fill_container", height: "fill_container", layout: "horizontal", gap: 8, alignItems: "center", justifyContent: "center", fill: F(palette[2]), stroke: S(T.line) });
    icon(item, palette[0], { width: 16, height: 16, fill: F(palette[1]) });
    text(item, label, { fontSize: 13, fontWeight: 600, fill: F(palette[1]) });
  }
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
