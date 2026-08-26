const T = {
  bg: "#FFFFFF",
  shell: "#F8FAFC",
  surface: "#F9FBFF",
  blue50: "#EFF6FF",
  blue100: "#DBEAFE",
  blue: "#0F62FE",
  blue700: "#1D4ED8",
  ink: "#101828",
  body: "#344054",
  muted: "#667085",
  faint: "#98A2B3",
  line: "#E4E7EC",
  lineStrong: "#D0D5DD",
  green: "#12A150",
  green50: "#ECFDF3",
  orange: "#D97706",
  orange50: "#FFF7ED",
  red: "#E5484D",
  red50: "#FFF1F2",
  font: "Noto Sans SC",
};

const F = (color) => [{ type: "solid", color }];
const S = (color = T.line, thickness = 1) => ({
  thickness,
  align: "inside",
  fill: F(color),
});

const SHADOW = [{
  type: "shadow",
  offsetX: 0,
  offsetY: 4,
  blur: 16,
  spread: -4,
  color: "rgba(16,24,40,0.10)",
}];
