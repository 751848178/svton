function frame(parent, props = {}) {
  return I(parent, { type: "frame", ...props });
}

function text(parent, content, props = {}) {
  return I(parent, {
    type: "text",
    content,
    fontFamily: T.font,
    fontSize: 14,
    fontWeight: 400,
    lineHeight: 1.4,
    fill: F(T.body),
    ...props,
  });
}

function icon(parent, name, props = {}) {
  return I(parent, {
    type: "icon_font",
    iconFontName: name,
    width: 18,
    height: 18,
    fill: F(T.muted),
    ...props,
  });
}

function divider(parent, props = {}) {
  return frame(parent, {
    name: "Divider",
    width: "fill_container",
    height: 1,
    fill: F(T.line),
    ...props,
  });
}

function button(parent, label, options = {}) {
  const kind = options.kind || "secondary";
  const filled = kind === "primary";
  const node = frame(parent, {
    name: `${filled ? "Primary" : "Secondary"} action: ${label}`,
    role: "button",
    width: options.width || "fit_content",
    height: options.height || 44,
    layout: "horizontal",
    padding: [0, options.paddingX || 16],
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
    cornerRadius: 6,
    fill: F(filled ? T.blue : T.bg),
    stroke: filled ? undefined : S(T.lineStrong),
  });
  if (options.icon) icon(node, options.icon, {
    width: 16,
    height: 16,
    fill: F(filled ? T.bg : T.body),
  });
  text(node, label, {
    fontSize: 14,
    fontWeight: 600,
    fill: F(filled ? T.bg : T.body),
  });
  return node;
}

function textAction(parent, label, options = {}) {
  const node = frame(parent, {
    name: `Row action: ${label}`,
    role: "button",
    width: "fit_content",
    height: 44,
    layout: "horizontal",
    gap: 5,
    alignItems: "center",
  });
  text(node, label, { fontSize: 13, fontWeight: 500, fill: F(options.color || T.blue) });
  if (options.arrow) icon(node, "arrow-right", { width: 14, height: 14, fill: F(options.color || T.blue) });
  return node;
}

function iconAction(parent, name, label) {
  const node = frame(parent, {
    name: `Icon action: ${label}`,
    role: "icon-button",
    width: 44,
    height: 44,
    layout: "horizontal",
    alignItems: "center",
    justifyContent: "center",
    cornerRadius: 6,
  });
  icon(node, name, { width: 18, height: 18, fill: F(T.body) });
  return node;
}

function status(parent, label, tone = "green") {
  const colors = tone === "red"
    ? [T.red, T.red50]
    : tone === "orange"
      ? [T.orange, T.orange50]
      : tone === "blue"
        ? [T.blue, T.blue50]
        : [T.green, T.green50];
  const node = frame(parent, {
    name: `Status: ${label}`,
    role: "badge",
    width: "fit_content",
    height: 28,
    layout: "horizontal",
    padding: [0, 10],
    gap: 7,
    alignItems: "center",
    cornerRadius: 14,
    fill: F(colors[1]),
  });
  I(node, { type: "ellipse", width: 7, height: 7, fill: F(colors[0]) });
  text(node, label, { fontSize: 13, fontWeight: 600, fill: F(colors[0]) });
  return node;
}

function cell(parent, width, content, props = {}) {
  const node = frame(parent, {
    width,
    height: "fill_container",
    layout: "horizontal",
    alignItems: "center",
    gap: 8,
  });
  if (content !== undefined) text(node, content, {
    width: Math.max(20, width - 4),
    textGrowth: "fixed-width",
    fontSize: props.fontSize || 13,
    fontWeight: props.fontWeight || 400,
    fill: F(props.color || T.body),
  });
  return node;
}
