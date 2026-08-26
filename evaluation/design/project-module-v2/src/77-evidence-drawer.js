function evidenceFact(parent, label, value, tone) {
  const row = frame(parent, { width: "fill_container", height: 30, layout: "horizontal", alignItems: "center", justifyContent: "space_between" });
  text(row, label, { fontSize: 12, fill: F(T.muted) });
  text(row, value, { fontSize: 12, fontWeight: 600, fill: F(tone || T.body) });
}

function successEvidenceDrawer(root) {
  const drawer = frame(root, { name: "Deployment evidence drawer overlay", role: "dialog", x: 944, y: 64, width: 496, height: 960, layout: "vertical", padding: 22, gap: 14, fill: F(T.bg), stroke: S(T.lineStrong), effects: SHADOW });
  const head = frame(drawer, { width: "fill_container", height: 44, layout: "horizontal", alignItems: "center", justifyContent: "space_between" });
  const headCopy = frame(head, { width: "fit_content", height: "fit_content", layout: "vertical", gap: 2 });
  text(headCopy, "部署证据", { fontSize: 18, fontWeight: 700, fill: F(T.ink) });
  text(headCopy, "Picshare R1 · 生产发布", { fontSize: 12, fill: F(T.muted) });
  iconAction(head, "x", "关闭部署证据");
  divider(drawer);
  status(drawer, "已完成", "green");
  const deployment = frame(drawer, { width: "fill_container", height: "fit_content", layout: "vertical", padding: 14, gap: 8, cornerRadius: 7, fill: F(T.surface), stroke: S(T.line) });
  text(deployment, "生产部署记录", { fontSize: 13, fontWeight: 700, fill: F(T.ink) });
  evidenceFact(deployment, "DeploymentRun", "deploy-prod-r1-20260826-112508");
  evidenceFact(deployment, "执行提供方", "ssh-v1");
  evidenceFact(deployment, "开始时间", "2026-08-26 11:25:08");
  evidenceFact(deployment, "结束时间", "2026-08-26 11:31:44");
  evidenceFact(deployment, "持续时间", "6 分 36 秒");
  const artifact = frame(drawer, { width: "fill_container", height: "fit_content", layout: "vertical", padding: 14, gap: 8, cornerRadius: 7, fill: F(T.bg), stroke: S(T.lineStrong) });
  text(artifact, "制品清单", { fontSize: 13, fontWeight: 700, fill: F(T.ink) });
  evidenceFact(artifact, "制品", "picshare-web · 86.4 MB");
  evidenceFact(artifact, "摘要", "sha256:9d276c7a…8c41");
  evidenceFact(artifact, "模式", "生产");
  const result = frame(drawer, { width: "fill_container", height: "fit_content", layout: "vertical", padding: 14, gap: 8, cornerRadius: 7, fill: F(T.bg), stroke: S(T.lineStrong) });
  text(result, "结果", { fontSize: 13, fontWeight: 700, fill: F(T.ink) });
  evidenceFact(result, "审批决定", "Lin · 11:24:18 通过", T.green);
  evidenceFact(result, "技术结果", "执行完成 · 退出码 0", T.green);
  evidenceFact(result, "入口探测", "200 · 11:31:20", T.green);
  evidenceFact(result, "业务结果", "环境版本 1.5.0 · 11:31:47 当前", T.green);
  const logs = frame(drawer, { name: "Controlled logs disclosure", role: "button", width: "fill_container", height: 62, layout: "horizontal", padding: [0, 12], gap: 10, alignItems: "center", justifyContent: "space_between", cornerRadius: 7, fill: F(T.surface), stroke: S(T.line) });
  const logCopy = frame(logs, { width: "fit_content", height: "fit_content", layout: "vertical", gap: 2 });
  text(logCopy, "受控日志 · 12 条", { fontSize: 13, fontWeight: 700, fill: F(T.ink) });
  text(logCopy, "敏感值已脱敏，按日志策略保留", { fontSize: 12, fill: F(T.muted) });
  icon(logs, "chevron-down", { width: 17, height: 17, fill: F(T.muted) });
  const raw = frame(drawer, { name: "Raw deployment evidence disclosure", role: "button", width: "fill_container", height: 62, layout: "horizontal", padding: [0, 12], gap: 10, alignItems: "center", justifyContent: "space_between", cornerRadius: 7, fill: F(T.surface), stroke: S(T.line) });
  const rawCopy = frame(raw, { width: "fit_content", height: "fit_content", layout: "vertical", gap: 2 });
  text(rawCopy, "原始证据", { fontSize: 13, fontWeight: 700, fill: F(T.ink) });
  text(rawCopy, "完整 DeploymentRun 结果 · 默认收起", { fontSize: 12, fill: F(T.muted) });
  icon(raw, "chevron-down", { width: 17, height: 17, fill: F(T.muted) });
  frame(root, { name: "Drawer scrim", x: 236, y: 64, width: 1204, height: 960, opacity: 0.16, fill: F(T.ink) });
}

function buildDeploymentEvidenceDrawer() {
  const root = frame(null, { name: "V2-10 Deployment Evidence Drawer", x: 13680, y: 0, width: 1440, height: 1024, layout: "none", clipContent: true, fill: F(T.bg) });
  successEvidenceDrawer(root);
  drawHeader(root);
  const body = frame(root, { x: 0, y: 64, width: 1440, height: 960, layout: "horizontal", fill: F(T.bg) });
  drawSidebar(body);
  const main = frame(body, { name: "Page content", width: "fill_container", height: "fill_container", layout: "vertical", fill: F(T.bg) });
  drawProductionSuccess(main);
}
