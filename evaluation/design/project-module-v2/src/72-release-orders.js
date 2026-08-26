const RELEASE_ORDERS = [
  ["R1", "图片压缩 1.5.0", "master @ b7c9e21", "进行中", "blue", "构建", "08-26 10:48", ["查看发布单", "查看构建", "构建证据"], false],
  ["R0", "图库重构 1.4.0", "master @ a1b2c3d", "已完成", "green", "生产", "08-20 09:06", ["查看发布单", "查看构建", "查看部署"], true],
  ["S18", "搜索修复 1.4.2", "hotfix/search @ c8d7e62", "已完成", "green", "预发验证", "08-18 17:32", ["查看发布单", "查看构建", "查看部署"], true],
  ["S17", "头像裁切 1.4.1", "feature/avatar @ 93ad181", "已取消", "orange", "预发部署", "08-16 13:10", ["查看发布单", "查看构建", "查看部署"], true],
  ["R14", "登录修复 1.3.1", "hotfix/login @ 3c2b1a0", "已完成", "green", "生产", "08-03 11:42", ["查看发布单", "查看构建", "查看部署"], true],
  ["S15", "缩略图优化 1.3.0", "feature/thumb @ 9f31c20", "已完成", "green", "预发验证", "07-28 16:18", ["查看发布单", "查看构建", "查看部署"], true],
];

function releaseOrdersToolbar(parent) {
  const toolbar = frame(parent, { width: "fill_container", height: 54, layout: "horizontal", alignItems: "center", justifyContent: "space_between" });
  const filters = frame(toolbar, { width: "fit_content", height: 44, layout: "horizontal", gap: 10, alignItems: "center" });
  const search = frame(filters, { name: "Search release orders", role: "search-bar", width: 340, height: 44, layout: "horizontal", padding: [0, 12], gap: 8, alignItems: "center", cornerRadius: 6, fill: F(T.bg), stroke: S(T.lineStrong) });
  icon(search, "search", { width: 17, height: 17, fill: F(T.muted) });
  text(search, "搜索发布版本或来源", { fontSize: 13, fill: F(T.muted) });
  const filter = frame(filters, { name: "Release status filter", role: "button", width: 140, height: 44, layout: "horizontal", padding: [0, 12], alignItems: "center", justifyContent: "space_between", cornerRadius: 6, fill: F(T.bg), stroke: S(T.lineStrong) });
  text(filter, "全部状态", { fontSize: 13, fontWeight: 500, fill: F(T.body) });
  icon(filter, "chevron-down", { width: 15, height: 15, fill: F(T.muted) });
  text(toolbar, "6 个发布单 · 最近更新优先", { fontSize: 12, fill: F(T.muted) });
}

function releaseOrdersTable(parent) {
  const table = frame(parent, { name: "Release orders table", role: "table", width: "fill_container", height: 394, layout: "vertical", clipContent: true, cornerRadius: 7, fill: F(T.bg), stroke: S(T.lineStrong) });
  const widths = [70, 190, 190, 125, 135, 130, 280];
  const head = frame(table, { role: "table-header", width: "fill_container", height: 46, layout: "horizontal", padding: [0, 14], alignItems: "center", fill: F(T.surface) });
  ["发布单", "版本", "来源", "状态", "当前阶段", "最近执行", "操作"].forEach((label, index) => cell(head, widths[index], label, { fontSize: 12, fontWeight: 600, color: T.muted }));
  for (const order of RELEASE_ORDERS) {
    const row = frame(table, { name: `Release order ${order[0]}`, role: "table-row", width: "fill_container", height: 58, layout: "horizontal", padding: [0, 14], alignItems: "center", fill: F(order[0] === "R1" ? T.blue50 : T.bg), stroke: S(T.line) });
    const idCell = cell(row, widths[0]);
    text(idCell, order[0], { fontSize: 13, fontWeight: 700, fill: F(T.blue) });
    cell(row, widths[1], order[1], { fontSize: 13, fontWeight: 600, color: T.ink });
    cell(row, widths[2], order[2], { fontSize: 12, color: T.body });
    const stateCell = cell(row, widths[3]);
    status(stateCell, order[3], order[4]);
    cell(row, widths[4], order[5], { fontSize: 13, fontWeight: order[0] === "R1" ? 600 : 400, color: order[0] === "R1" ? T.blue : T.body });
    cell(row, widths[5], order[6], { fontSize: 12, color: T.muted });
    const actions = cell(row, widths[6]);
    for (const label of order[7]) textAction(actions, label);
    if (order[8]) iconAction(actions, "ellipsis", `${order[0]} 更多操作`);
  }
}

function buildReleaseOrders() {
  const { content } = createProjectMoment("V2-05 Release Orders", 6080, { tab: "发布", primary: "创建发布", primaryIcon: "plus" });
  momentHeading(content, {
    title: "发布单",
    description: "查看每次发布的版本、来源、当前阶段与可执行操作。",
    meta: "最近更新  2026-08-26 10:48",
  });
  releaseOrdersToolbar(content);
  releaseOrdersTable(content);
}
