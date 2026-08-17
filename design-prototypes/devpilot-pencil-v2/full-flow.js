const demo = {
  project: "Picshare",
  repo: "read-only-repositories/picshare",
  branch: "master",
  release: "2.4.0",
  commit: "a1b2c3d",
  manifest: "32bf…c4a",
};

const status = (label, tone = "") => `<span class="status ${tone}">${label}</span>`;
const button = (label, type = "", disabled = false) => `<button class="button ${type}"${disabled ? " disabled" : ""}>${label}</button>`;
const kv = (label, value) => `<div class="kv"><span class="kv-label">${label}</span><span class="kv-value">${value}</span></div>`;
const callout = (copy, tone = "") => `<div class="callout ${tone}">${copy}</div>`;

const globalRail = (active = "project") => `
  <aside class="global-rail">
    <div class="rail-item ${active === "home" ? "active" : ""}">首页</div>
    <div class="rail-item ${active === "project" ? "active" : ""}">项目</div>
    <div class="rail-item">资源</div>
    <div class="rail-item">治理</div>
    <div class="rail-spacer"></div>
    <div class="rail-item">帮助</div>
  </aside>`;

const projectNav = (active = "overview") => `
  <aside class="project-nav">
    <div class="project-identity">
      <div class="project-kicker">当前项目</div>
      <div class="project-name">${demo.project}</div>
      <div class="project-repo">${demo.repo}</div>
    </div>
    <div class="nav-section">
      <div class="nav-link ${active === "overview" ? "active" : ""}"><span>总览</span></div>
      <div class="nav-link ${active === "delivery" ? "active" : ""}"><span>交付</span><span class="nav-badge">1</span></div>
      <div class="nav-link ${active === "environment" ? "active" : ""}"><span>环境</span><span class="nav-badge">2</span></div>
    </div>
    <div class="nav-section">
      <div class="nav-section-title">项目管理</div>
      <div class="nav-link ${active === "repository" ? "active" : ""}"><span>仓库与组件</span></div>
      <div class="nav-link ${active === "policy" ? "active" : ""}"><span>发布规则</span></div>
      <div class="nav-link ${active === "settings" ? "active" : ""}"><span>设置</span></div>
    </div>
  </aside>`;

const topbar = () => `
  <header class="topbar">
    <div class="brand"><span class="brand-mark">DP</span>Devpilot</div>
    <div class="org-switcher">Test Org</div>
    <div class="topbar-spacer"></div>
    <div class="topbar-meta"><span>审批 2</span><span>System Administrator</span></div>
  </header>`;

const shell = ({ id, title, description, active = "overview", content, inspector = "", scenario = "示例场景", noProject = false, headActions = "" }) => `
  <section id="${id}" class="screen">
    <div class="scenario-label">${scenario}</div>
    ${topbar()}${globalRail("project")}${noProject ? directoryNav() : projectNav(active)}
    <div class="main">
      <div class="content ${inspector ? "with-inspector" : ""}">
        <div class="page-head">
          <div><div class="breadcrumbs">项目 / ${noProject ? "全部项目" : `${demo.project} / ${title}`}</div><h1 class="page-title">${title}</h1><p class="page-description">${description}</p></div>
          <div class="head-actions">${headActions}</div>
        </div>
        ${content}
      </div>
      ${inspector}
    </div>
  </section>`;

const directoryNav = () => `
  <aside class="project-nav">
    <div class="project-identity"><div class="project-kicker">项目空间</div><div class="project-name">Test Org</div><div class="project-repo">3 个活跃项目</div></div>
    <div class="nav-section">
      <div class="nav-link active"><span>全部项目</span><span class="nav-badge">3</span></div>
      <div class="nav-link"><span>继续接入</span><span class="nav-badge">1</span></div>
      <div class="nav-link"><span>已归档</span></div>
    </div>
  </aside>`;

const stageTrack = (current, blocked = false) => {
  const stages = [
    ["基线", "仓库与环境输入"],
    ["构建", "BuildRun 与 Manifest"],
    ["预发", "Staging 部署与验证"],
    ["生产", "预览、审批与发布"],
  ];
  return `<div class="stage-track">${stages.map(([name, meta], index) => {
    const position = index + 1;
    const klass = position < current ? "complete" : position === current ? (blocked ? "blocked" : "current") : "";
    return `<div class="stage ${klass}" data-step="${position}"><div class="stage-name">${name}</div><div class="stage-meta">${meta}</div></div>`;
  }).join("")}</div>`;
};

const taskPanel = ({ eyebrow = "当前唯一下一步", title, now, why, next, after, action = "继续处理", actionType = "primary", secondary = "查看证据", tone = "" }) => `
  <div class="task-panel ${tone}">
    <div class="task-eyebrow">${eyebrow}</div>
    <div class="task-title">${title}</div>
    <div class="task-facts">
      <div class="task-fact"><div class="task-label">现在</div><div class="task-value">${now}</div></div>
      <div class="task-fact"><div class="task-label">为什么</div><div class="task-value">${why}</div></div>
      <div class="task-fact"><div class="task-label">下一步</div><div class="task-value">${next}</div></div>
      <div class="task-fact"><div class="task-label">完成后</div><div class="task-value">${after}</div></div>
    </div>
    <div class="task-actions">${button(action, actionType)}${button(secondary)}</div>
  </div>`;

const truthGrid = (items) => `<div class="truth-grid">${items.map(item => `<div class="truth-cell"><div class="truth-label">${item.label}</div><div class="truth-value ${item.tone || ""}">${item.value}</div><div class="truth-detail">${item.detail}</div></div>`).join("")}</div>`;

const inspector = (title, rows, footer = "") => `
  <aside class="inspector">
    <div class="inspector-title">${title}</div>
    ${rows.map(([label, value]) => kv(label, value)).join("")}
    ${footer ? `<div class="inspector-section">${footer}</div>` : ""}
  </aside>`;

const table = (klass, headers, rows) => `
  <div class="table">
    <div class="table-row header ${klass}">${headers.map(x => `<div>${x}</div>`).join("")}</div>
    ${rows.map(row => `<div class="table-row ${klass}">${row.map(x => `<div>${x}</div>`).join("")}</div>`).join("")}
  </div>`;

const screens = [];

screens.push(shell({
  id: "screen-project-directory",
  noProject: true,
  title: "项目",
  description: "TARGET CONTRACT · 目录恢复入口与 server-owned nextAction；当前 DTO 仅提供 online / needs_configuration。",
  scenario: "目录 · 多状态",
  headActions: button("创建项目", "primary large"),
  content: `
    <div class="toolbar"><input class="search" value="搜索项目、仓库或项目 ID" readonly><select class="select"><option>全部状态</option></select><select class="select"><option>最近活动优先</option></select></div>
    ${table("cols-project", ["项目", "接入状态", "发布基线", "Devpilot 可追溯生产版本", "下一步"], [
      [`<div class="row-title">Picshare</div><div class="row-meta">read-only-repositories/picshare · #f8lepik</div>`, status("待配置", "warning"), `Staging 通过<br><span class="muted">Production 2 个阻断</span>`, `尚无<br><span class="muted">不等于外部未上线</span>`, `<span class="link">修复 Production</span>`],
      [`<div class="row-title">Checkout API</div><div class="row-meta">commerce/checkout-api · #4k92mda</div>`, status("交付中", "info"), `Staging 通过<br><span class="muted">Production 就绪</span>`, `2.3.2<br><span class="muted">健康证据有效</span>`, `<span class="link">继续 2.4.0</span>`],
      [`<div class="row-title">Data Worker</div><div class="row-meta">analytics/data-worker · #7hs11pc</div>`, status("接入未完成", "purple"), `尚未创建`, `不适用`, `<span class="link">继续接入 · 目标契约</span>`],
      [`<div class="row-title">Legacy Admin</div><div class="row-meta">legacy/admin · #2f03axd</div>`, status("已归档"), `只读历史`, `1.8.7 · 历史`, `<span class="muted">查看历史</span>`],
    ])}
    <div class="spacer-12"></div>
    ${callout("目录只表达 Devpilot 可证实的当前状态。归档项目保留仓库身份与历史证据，但拒绝新的接入、分析和发布写入。", "info")}
  `,
}));

const intakeShell = (id, activeStep, title, description, body, scenario) => `
  <section id="${id}" class="screen">
    <div class="scenario-label">${scenario}</div>${topbar()}
    <div class="intake-shell">
      <div class="intake-top"><div><div class="breadcrumbs">项目 / 创建项目</div><h1 class="page-title">创建项目</h1><p class="page-description">连接仓库、确认识别结果，再生成最小发布基线。</p></div>${button("暂存并退出", "ghost")}</div>
      <div class="intake-steps">${[
        [1,"连接仓库"],[2,"确认识别"],[3,"创建基线"],
      ].map(([n, label]) => `<div class="intake-step ${n < activeStep ? "complete" : n === activeStep ? "active" : ""}"><div class="intake-step-index">步骤 0${n}</div><div class="intake-step-name">${label}</div></div>`).join("")}</div>
      <div class="intake-card"><h2 class="section-title">${title}</h2><p class="section-hint">${description}</p>${body}</div>
    </div>
  </section>`;

screens.push(intakeShell("screen-intake-connect", 1, "连接代码仓库", "平台只读取仓库、分支与本次识别所需 Commit；凭据不会展示在项目页面。", `
  <div class="form-grid">
    <label class="form-field full"><span class="form-label">仓库地址</span><input class="input" value="https://github.com/organization/repository.git" readonly><span class="form-help">支持公开仓库或使用团队凭据连接私有仓库。</span></label>
    <label class="form-field"><span class="form-label">仓库可见性</span><select class="input"><option>公开仓库</option></select></label>
    <label class="form-field"><span class="form-label">默认分支</span><select class="input"><option>由仓库解析</option></select></label>
  </div>
  <div class="spacer-20"></div>${callout("目标交互：服务端需补 resume_intake 契约；退出后保留 Draft，并恢复同一个项目和分析 Run。", "info")}
  <div class="spacer-20"></div><div class="task-actions">${button("验证并继续", "primary large")}${button("测试凭据")}</div>
`, "接入 · 空态与可恢复"));

screens.push(intakeShell("screen-intake-analysis", 2, "正在识别仓库", "Devpilot 正在锁定仓库身份、解析组件与依赖。分析完成前不需要填写运行配置。", `
  <div class="split equal">
    <div class="panel"><div class="panel-head"><div><div class="panel-title">仓库证明</div><div class="panel-subtitle">server-owned · exact commit</div></div>${status("已锁定", "success")}</div><div class="panel-body">${kv("仓库", "read-only-repositories/picshare")}${kv("分支", "master")}${kv("Commit", "a1b2c3d")}${kv("凭据", "团队凭据 · 不显示")}</div></div>
    <div class="panel"><div class="panel-head"><div><div class="panel-title">分析进度</div><div class="panel-subtitle">Run #anl_8f2a</div></div>${status("运行中", "info")}</div><div class="panel-body"><div class="timeline"><div class="timeline-item success"><div class="timeline-title">获取仓库树</div><div class="timeline-copy">已完成</div></div><div class="timeline-item current"><div class="timeline-title">识别构建与运行边界</div><div class="timeline-copy">正在核对 4 个候选组件</div></div><div class="timeline-item"><div class="timeline-title">生成结构化审核快照</div><div class="timeline-copy">等待</div></div></div></div></div>
  </div>
  <div class="spacer-16"></div>${callout("若分析失败，保留仓库证明和错误证据；重试不会创建新的项目 Draft。", "warning")}
`, "接入 · 分析运行中"));

screens.push(intakeShell("screen-intake-review", 2, "确认识别结果", "只处理会影响构建、运行与发布的决定；原始 JSON 放入技术证据。", `
  <div class="split">
    <div class="stack">
      <div class="panel"><div class="panel-head"><div><div class="panel-title">api · 后端服务</div><div class="panel-subtitle">apps/api · Node.js · 端口 3000</div></div>${status("需要确认", "warning")}</div><div class="panel-body"><div class="two-col"><div>${kv("构建", "pnpm build")}${kv("输出", "dist/")}</div><div>${kv("运行", "node dist/main.js")}${kv("健康检查", "/health")}</div></div><div class="spacer-12"></div>${callout("检测到两个启动脚本。当前建议来自 package.json 的 production script。", "warning")}</div></div>
      <div class="panel"><div class="panel-head"><div><div class="panel-title">web · 前端服务</div><div class="panel-subtitle">apps/web · Next.js · 端口 3000</div></div>${status("已确认", "success")}</div><div class="panel-body"><div class="two-col"><div>${kv("构建", "pnpm build")}${kv("输出", ".next/")}</div><div>${kv("运行", "pnpm start")}${kv("依赖", "api")}</div></div></div></div>
    </div>
    <div class="panel"><div class="panel-head"><div class="panel-title">本次审核</div>${status("1 个冲突", "warning")}</div><div class="panel-body">${kv("组件", "4")}${kv("外部依赖", "Postgres · Redis")}${kv("需确认", "api 启动命令")}${kv("快照", "尚未冻结")}<div class="spacer-16"></div>${button("采用建议并冻结", "primary large")}<div class="spacer-8"></div>${button("查看原始识别证据")}</div></div>
  </div>
`, "接入 · 结构化审核"));

screens.push(intakeShell("screen-intake-baseline", 3, "创建发布基线", "确认 Staging 与 Production 的最小结构。目标、资源和变量可以稍后逐项完善。", `
  <div class="two-col">
    <div class="environment-card"><div class="environment-head"><div><div class="environment-title">Staging · 预发验证</div><div class="environment-copy">默认使用全部 4 个发布组件</div></div>${status("可创建", "success")}</div>${["组件结构","配置修订","发布策略"].map((x,i)=>`<div class="readiness-row"><span>${x}</span><span>${i===0?"4 个组件":"默认值"}</span><span class="success-text">通过</span></div>`).join("")}</div>
    <div class="environment-card"><div class="environment-head"><div><div class="environment-title">Production · 生产上线</div><div class="environment-copy">与 Staging 共享同一组件结构</div></div>${status("可创建", "success")}</div>${["组件结构","审批策略","同制品晋级"].map((x,i)=>`<div class="readiness-row"><span>${x}</span><span>${i===0?"4 个组件":"标准策略"}</span><span class="success-text">通过</span></div>`).join("")}</div>
  </div>
  <div class="spacer-16"></div>${callout("完成后会创建项目、两套发布基线和第一版发布规则。不会自动构建或部署。", "info")}
  <div class="spacer-20"></div><div class="task-actions">${button("完成项目创建", "primary large")}${button("返回上一步")}</div>
`, "接入 · Finalize"));

screens.push(shell({
  id: "screen-overview-blocked", active: "overview", title: "项目总览", description: "TARGET CONTRACT · 把当前基线、正在交付与 server-owned nextAction 分开呈现。", scenario: "总览 · 当前基线阻断", headActions: `${status("2 个阻断", "warning")}${button("管理项目")}`,
  inspector: inspector("当前发布上下文", [["发布单",demo.release],["阶段","Production 准备"],["Commit",demo.commit],["Manifest",demo.manifest],["审批","未申请"]], button("打开发布单")),
  content: `<div class="stack">
    ${taskPanel({title:"配置 Production 部署目标",now:"Staging 已验证；Production 预览尚未通过",why:"生产环境没有绑定可验证的运行目标",next:"为 api 与 web 选择服务器和运行策略",after:"重新预览并申请 Production 审批",action:"修复部署目标"})}
    ${truthGrid([{label:"当前 Production",value:"Devpilot 尚无可追溯版本",detail:"不推断外部环境是否上线"},{label:"正在交付",value:`${demo.release} · Production 准备`,detail:"同一 Manifest 已通过 Staging"},{label:"当前基线",value:"2 个阻断",detail:"目标 1 · 变量 1",tone:"warning-text"}])}
    <div class="two-col"><div class="environment-card"><div class="environment-head"><div><div class="environment-title">Staging</div><div class="environment-copy">配置、运行、证据三轴</div></div>${status("可执行", "success")}</div><div class="readiness-row"><span>配置就绪</span><span>5 / 5</span><span class="success-text">通过</span></div><div class="readiness-row"><span>当前版本</span><span>${demo.release}</span><span class="success-text">可追溯</span></div><div class="readiness-row"><span>发布可执行</span><span>证据有效</span><span class="success-text">通过</span></div></div><div class="environment-card"><div class="environment-head"><div><div class="environment-title">Production</div><div class="environment-copy">配置、运行、证据三轴</div></div>${status("有阻断", "warning")}</div><div class="readiness-row"><span>配置就绪</span><span>3 / 5</span><span class="warning-text">目标缺失</span></div><div class="readiness-row"><span>当前版本</span><span>—</span><span>无可追溯版本</span></div><div class="readiness-row"><span>发布可执行</span><span>预览未通过</span><span class="warning-text">阻断</span></div></div></div>
  </div>`
}));

screens.push(shell({
  id: "screen-overview-active", active: "overview", title: "项目总览", description: "TARGET CONTRACT · 当前版本、正在交付和唯一下一步保持独立。", scenario: "总览 · 正在交付", headActions: `${status("运行正常", "success")}${button("管理项目")}`,
  inspector: inspector("当前发布上下文", [["线上版本","2.3.2"],["正在交付","2.4.0"],["当前阶段","Staging 验证"],["负责人","Lin Chen"],["更新时间","2 分钟前"]], button("查看交付详情")),
  content: `<div class="stack">
    ${taskPanel({title:"等待 Staging 健康验证完成",now:"DeploymentRun 正在执行健康检查",why:"api 已启动；web 的 HTTP 探测仍在采样",next:"无需操作，预计 2 分钟内完成",after:"验证通过后可生成 Production 预览",action:"查看实时日志",secondary:"取消部署"})}
    ${truthGrid([{label:"当前 Production",value:"2.3.2 · 运行正常",detail:"技术证据有效 · 8 分钟前"},{label:"正在交付",value:`${demo.release} · Staging 验证`,detail:`同一 Manifest ${demo.manifest}`},{label:"当前风险",value:"无阻断",detail:"1 项待完善，不影响发布"}])}
    <div class="panel"><div class="panel-head"><div><div class="panel-title">交付进度</div><div class="panel-subtitle">发布单 2.4.0</div></div><span class="link">打开完整发布单</span></div><div class="panel-body">${stageTrack(3)}</div></div>
  </div>`
}));

screens.push(shell({
  id: "screen-releases", active: "delivery", title: "交付", description: "发布单与环境版本分开管理；默认继续当前交付。", scenario: "交付 · 发布单列表", headActions: `${button("环境版本")}${button("创建发布单", "primary large")}`,
  content: `<div class="tabs"><div class="tab active">发布单</div><div class="tab">环境版本</div></div><div class="spacer-12"></div>${table("cols-release",["发布版本","当前阶段","当前结论","创建人 / 时间","下一步"],[
    [`<div class="row-title">2.4.0</div><div class="row-meta">master · ${demo.commit}</div>`,`Staging 验证<br><span class="muted">DeploymentRun 运行中</span>`,status("进行中","info"),`Lin Chen<br><span class="muted">12 分钟前</span>`,`<span class="link">继续交付</span>`],
    [`<div class="row-title">2.3.2</div><div class="row-meta">master · b9f20dd</div>`,`Production 完成<br><span class="muted">EnvironmentVersion 已创建</span>`,status("成功","success"),`Mia Zhou<br><span class="muted">2 天前</span>`,`<span class="link">查看证据</span>`],
    [`<div class="row-title">2.3.1</div><div class="row-meta">master · 08cc111</div>`,`Build 失败<br><span class="muted">Run #4</span>`,status("失败","danger"),`Lin Chen<br><span class="muted">3 天前</span>`,`<span class="link">查看失败</span>`],
  ])}<div class="spacer-12"></div>${callout("创建发布单只冻结版本意图和当前基线引用；Artifact Manifest 在 Build 成功后生成。", "info")}`
}));

const releaseContent = ({ step, blocked = false, task, body }) => `<div class="stack">${stageTrack(step, blocked)}${task}${body}</div>`;

screens.push(shell({
  id: "screen-release-baseline", active: "delivery", title: "发布单 2.4.0", description: "步骤 01 · 本发布单冻结快照与当前项目基线分层。", scenario: "发布详情 · 基线已变化", headActions: `${status("需要重新检查", "warning")}${button("返回列表")}`,
  inspector: inspector("本发布单快照", [["创建于","12 分钟前"],["Commit",demo.commit],["配置修订","cfg_17"],["策略修订","policy_4"],["当前变化","目标绑定已变化"]], button("展开快照证据")),
  content: releaseContent({step:1,blocked:true,task:taskPanel({title:"重新检查当前基线",now:"发布单创建后，Production 目标绑定发生变化",why:"冻结快照不能代表当前仍可执行",next:"刷新权威配置并重新生成基线结论",after:"允许进入 Build；当前变化写入新证据",action:"重新检查"}),body:`<div class="two-col"><div class="panel"><div class="panel-head"><div class="panel-title">冻结快照</div>${status("历史有效","success")}</div><div class="panel-body">${kv("Staging","5 / 5 通过")}${kv("Production","5 / 5 通过")}${kv("证据时间","12 分钟前")}</div></div><div class="panel"><div class="panel-head"><div class="panel-title">当前项目基线</div>${status("已变化","warning")}</div><div class="panel-body">${kv("Staging","5 / 5 通过")}${kv("Production","目标绑定已更新")}${kv("结论","必须重新检查")}</div></div></div>`})
}));

screens.push(shell({
  id: "screen-release-build", active: "delivery", title: "发布单 2.4.0", description: "步骤 02 · 构建只产生一个可晋级的 Artifact Manifest。", scenario: "发布详情 · Build 运行与历史", headActions: `${status("构建中", "info")}${button("返回列表")}`,
  inspector: inspector("候选制品", [["Commit",demo.commit],["BuildRun","#11 · running"],["Manifest","构建成功后生成"],["依赖缓存","generation 1"],["触发人","Lin Chen"]], button("查看实时日志")),
  content: releaseContent({step:2,task:taskPanel({eyebrow:"当前运行",title:"BuildRun #11 正在构建",now:"依赖已恢复；正在执行 api 与 web 构建",why:"发布单需要不可变 Manifest 才能进入 Staging",next:"等待构建完成，或在失败时查看首个错误",after:"成功后冻结组件摘要与 Manifest Digest",action:"查看实时日志",secondary:"取消构建"}),body:`${table("cols-run",["Run","来源","状态","耗时","结果","操作"],[
    [`#11`,`master · ${demo.commit}`,status("运行中","info"),`01:42`,`—`,`<span class="link">查看日志</span>`],
    [`#10`,`master · 6e2bbd0`,status("成功","success"),`03:18`,`Manifest 18c4…02f`,`<span class="link">查看证据</span>`],
    [`#9`,`master · 4ab1092`,status("失败","danger"),`00:48`,`api 构建失败`,`<span class="link">查看错误</span>`],
  ])}`})
}));

screens.push(shell({
  id: "screen-release-staging", active: "delivery", title: "发布单 2.4.0", description: "步骤 03 · 使用同一 Manifest 部署 Staging，并区分部署成功、技术证据与业务验证。", scenario: "发布详情 · Staging 已验证", headActions: `${status("技术验证通过", "success")}${button("返回列表")}`,
  inspector: inspector("Staging 证据", [["Manifest",demo.manifest],["DeploymentRun","dep_8h2"],["进程检查","2 / 2 通过"],["HTTP 探测","2 / 2 通过"],["业务验证","待完成 · 不阻断"]], button("查看完整证据")),
  content: releaseContent({step:3,task:taskPanel({eyebrow:"当前结论",title:"Staging 技术验证已通过",now:"部署完成；进程与 HTTP 探测均通过",why:"Production 预览只接受同一 Manifest 的有效 Staging 证明",next:"进入 Production 预览，检查生产输入",after:"预览通过后可发起审批",action:"生成 Production 预览",secondary:"查看部署日志"}),body:`<div class="two-col"><div class="panel"><div class="panel-head"><div class="panel-title">部署结果</div>${status("成功","success")}</div><div class="panel-body">${kv("api","运行 · 健康")}${kv("web","运行 · 健康")}${kv("路由","预发域名可访问")}${kv("完成时间","4 分钟前")}</div></div><div class="panel"><div class="panel-head"><div class="panel-title">验证分层</div>${status("可用于预览","success")}</div><div class="panel-body">${kv("DeploymentRun","完成")}${kv("技术证据","有效")}${kv("业务验收","待完成 · attention")}${kv("证据新鲜度","剩余 11 分钟")}</div></div></div>`})
}));

screens.push(shell({
  id: "screen-production-blocked", active: "delivery", title: "发布单 2.4.0", description: "步骤 04 · 正常前置阻断只显示一个领域任务，不使用“操作失败”。", scenario: "Production · 预览阻断", headActions: `${status("预览未通过", "warning")}${button("返回列表")}`,
  inspector: inspector("Production 输入", [["Manifest",demo.manifest],["Staging 证明","有效"],["目标绑定","缺失"],["审批","未申请"],["Production ReleaseRun","尚未创建"]], button("展开门禁证据")),
  content: releaseContent({step:4,blocked:true,task:taskPanel({title:"配置 Production 部署目标",now:"Production 预览未通过",why:"api 组件没有绑定当前环境的可验证目标",next:"进入 Production / 部署目标，绑定服务器与运行策略",after:"重新生成预览；通过后才能申请审批",action:"修复 Production 目标",secondary:"查看预览证据"}),body:`<div class="panel"><div class="panel-head"><div><div class="panel-title">生产预览</div><div class="panel-subtitle">当前权威结论 · 30 秒前</div></div>${status("1 个阻断", "warning")}</div><div class="panel-body">${callout("D05 · api 缺少 Production Deployment Target。该项是正常领域阻断，不是请求错误。", "warning")}<div class="spacer-12"></div><div class="two-col"><div>${kv("已通过","19 项")}${kv("待完善","1 项 · 不阻断")}</div><div>${kv("已阻断","1 项")}${kv("请求错误","0 项")}</div></div></div></div>`})
}));

screens.push(shell({
  id: "screen-production-approval", active: "delivery", title: "发布单 2.4.0", description: "目标交互 · 需服务端 capability 与 self-approval 契约；请求人只看到等待状态。", scenario: "Production · Requester 等待审批", headActions: `${status("待审批", "purple")}${button("返回列表")}`,
  inspector: inspector("审批上下文", [["申请人","Lin Chen"],["审批类型","Production 发布"],["冻结输入","input_9ad…"],["审批能力","需要独立 Reviewer"],["失效条件","输入或 Provider 漂移"]], button("前往审批中心")),
  content: releaseContent({step:4,task:taskPanel({eyebrow:"TARGET CONTRACT · 当前阶段",title:"等待另一位审批人处理",now:"Production 输入已冻结；审批请求已创建",why:"申请人不能批准自己的发布请求",next:"等待具备权限的 Reviewer 批准或拒绝",after:"批准后由发布执行人继续部署",action:"查看审批进度",actionType:"",secondary:"撤回申请"}),body:`<div class="approval-layout"><div class="approval-card"><div class="approval-hero"><div><div class="approval-title">Production 发布审批</div><div class="approval-meta">${demo.release} · Manifest ${demo.manifest}<br>申请人 Lin Chen · 2 分钟前</div></div>${status("等待 Reviewer", "warning")}</div><div class="spacer-16"></div>${callout("TARGET CONTRACT：申请人动作需由服务端权限决定；审批通过不等于已发布。", "info")}</div><div class="panel"><div class="panel-head"><div class="panel-title">冻结输入</div></div><div class="panel-body">${kv("目标","Production")}${kv("策略","standard")}${kv("Staging 证明","有效")}${kv("Provider","local-filesystem-v1")}</div></div></div>`})
}));

screens.push(shell({
  id: "screen-approval-reviewer", active: "delivery", title: "审批 Production 发布", description: "Reviewer 只审批服务端冻结的输入，并能看到拒绝后果。", scenario: "审批 · Reviewer 视图", headActions: `${status("需要你的审批", "purple")}${button("返回审批中心")}`,
  inspector: inspector("TARGET CONTRACT · 权限", [["当前角色","Reviewer"],["申请人","Lin Chen"],["执行人","Mia Zhou"],["动作来源","capabilities.review"],["输入漂移","自动失效"]], callout("目标交互需补服务端独立审批契约；当前稿不把自审限制伪装成已实现事实。", "info")),
  content: `<div class="approval-layout"><div class="approval-card"><div class="approval-hero"><div><div class="approval-title">允许 ${demo.release} 发布到 Production？</div><div class="approval-meta">Manifest ${demo.manifest} · Staging 技术证明有效 · 标准发布策略</div></div>${status("待审批", "purple")}</div><div class="spacer-16"></div><h3 class="section-title">本次变更摘要</h3>${table("cols-release",["范围","当前","本次","证明","结论"],[
    [`组件`,`4`,`4`,`同一 Manifest`,status("匹配","success")],[`部署目标`,`prod-server-01`,`prod-server-01`,`锁内重验`,status("匹配","success")],[`变量密钥`,`revision 7`,`revision 7`,`冻结引用`,status("匹配","success")],
  ])}<div class="spacer-16"></div><label class="form-field"><span class="form-label">审批意见</span><input class="input" value="确认 Staging 证明与 Production 输入一致" readonly></label><div class="spacer-16"></div><div class="task-actions">${button("批准发布", "primary large")}${button("拒绝", "")}${button("查看完整证据", "ghost")}</div></div><div class="panel"><div class="panel-head"><div class="panel-title">审批前确认</div></div><div class="panel-body"><div class="timeline"><div class="timeline-item success"><div class="timeline-title">输入已冻结</div><div class="timeline-copy">inputHash 与 Provider 已记录</div></div><div class="timeline-item success"><div class="timeline-title">独立性通过</div><div class="timeline-copy">你不是申请人或执行人</div></div><div class="timeline-item current"><div class="timeline-title">等待你的决定</div><div class="timeline-copy">批准或拒绝都会写入审计</div></div></div></div></div></div>`
}));

screens.push(shell({
  id: "screen-production-running", active: "delivery", title: "发布单 2.4.0", description: "步骤 04 · 审批通过后由执行人继续，部署与验证分别呈现。", scenario: "Production · 部署运行中", headActions: `${status("部署中", "info")}${button("返回列表")}`,
  inspector: inspector("Production 运行", [["ReleaseRun","rel_01"],["DeploymentRun","dep_21"],["执行人","Mia Zhou"],["审批","已批准"],["当前阶段","健康验证"]], button("查看实时日志")),
  content: releaseContent({step:4,task:taskPanel({eyebrow:"当前运行",title:"Production 健康验证进行中",now:"部署命令已完成；正在采集进程、HTTP 与可观测性证据",why:"只有真实 post-deploy 证据通过后才创建 EnvironmentVersion",next:"等待验证，失败时回到精确修复入口",after:"通过后提交 EnvironmentVersion 并推进当前指针",action:"查看实时日志",secondary:"查看审批"}),body:`<div class="panel"><div class="panel-head"><div><div class="panel-title">执行进度</div><div class="panel-subtitle">server-owned evidence</div></div>${status("4 / 6", "info")}</div><div class="panel-body"><div class="timeline"><div class="timeline-item success"><div class="timeline-title">冻结输入复验</div><div class="timeline-copy">Provider、workload 与 Manifest 精确匹配</div></div><div class="timeline-item success"><div class="timeline-title">部署命令完成</div><div class="timeline-copy">api、web 已启动</div></div><div class="timeline-item current"><div class="timeline-title">技术证据采集</div><div class="timeline-copy">HTTP 通过；可观测性采样中</div></div><div class="timeline-item"><div class="timeline-title">创建 EnvironmentVersion</div><div class="timeline-copy">等待</div></div></div></div></div>`})
}));

screens.push(shell({
  id: "screen-production-complete", active: "delivery", title: "发布单 2.4.0", description: "步骤 04 · 完成态区分真实 Production 与本地技术验收。", scenario: "Production · 完成", headActions: `${status("发布完成", "success")}${button("返回列表")}`,
  inspector: inspector("最终证据", [["EnvironmentVersion",demo.release],["Manifest",demo.manifest],["版本提交","completed"],["证据时间","1 分钟前"],["审批","已批准 · reviewer-01"]], button("导出审计摘要")),
  content: releaseContent({step:4,task:`${callout(`Production 版本 ${demo.release} 已创建，技术证据有效。当前状态来自 Devpilot 可追溯运行，不推断平台外部事实。`, "success")}`,body:`${truthGrid([{label:"当前 Production",value:demo.release,detail:"EnvironmentVersion 已推进"},{label:"发布结果",value:"成功",detail:"部署与 post-deploy 证据通过",tone:"success-text"},{label:"回退基点",value:"2.3.2",detail:"历史版本保留，可发起 Recovery"}])}<div class="two-col"><div class="panel"><div class="panel-head"><div class="panel-title">制品与输入</div>${status("不可变", "success")}</div><div class="panel-body">${kv("Commit",demo.commit)}${kv("Manifest",demo.manifest)}${kv("配置修订","cfg_19")}${kv("策略","standard")}</div></div><div class="panel"><div class="panel-head"><div class="panel-title">执行与审批</div>${status("可审计", "success")}</div><div class="panel-body">${kv("申请人","Lin Chen")}${kv("Reviewer","reviewer-01")}${kv("执行人","Mia Zhou")}${kv("耗时","08:41")}</div></div></div>`})
}));

screens.push(shell({
  id: "screen-environments", active: "environment", title: "环境", description: "发布基线默认展开；自定义与遗留环境进入高级区域。", scenario: "环境 · 基线总览", headActions: button("新建高级环境"),
  content: `<div class="two-col"><div class="environment-card"><div class="environment-head"><div><div class="environment-title">Staging · 预发验证</div><div class="environment-copy">当前版本 ${demo.release} · 证据有效</div></div>${status("可执行", "success")}</div>${[["部署目标","2 / 2 绑定","通过"],["资源绑定","2 项","通过"],["变量密钥","revision 7","通过"],["域名入口","staging.picshare.test","通过"],["保护规则","standard","通过"]].map(x=>`<div class="readiness-row"><span>${x[0]}</span><span>${x[1]}</span><span class="success-text">${x[2]}</span></div>`).join("")}<div class="spacer-12"></div>${button("打开 Staging")}</div><div class="environment-card"><div class="environment-head"><div><div class="environment-title">Production · 生产上线</div><div class="environment-copy">Devpilot 尚无可追溯版本</div></div>${status("2 个阻断", "warning")}</div>${[["部署目标","api 未绑定","修复"],["资源绑定","2 项","通过"],["变量密钥","缺少 API_KEY","修复"],["域名入口","prod.picshare.test","通过"],["保护规则","需审批","通过"]].map((x,i)=>`<div class="readiness-row"><span>${x[0]}</span><span>${x[1]}</span><span class="${i===0||i===2?"warning-text":"success-text"}">${x[2]}</span></div>`).join("")}<div class="spacer-12"></div>${button("继续修复", "primary")}</div></div><div class="spacer-16"></div><div class="panel"><div class="panel-head"><div><div class="panel-title">高级环境</div><div class="panel-subtitle">自定义与遗留环境不参与默认 Staging → Production 主链</div></div>${status("3 个")}</div><div class="panel-body"><div class="three-col">${["dev · 开发","test · 测试","prod · 遗留生产"].map(x=>`<div class="callout"><strong>${x}</strong><br><span class="muted">点击查看配置与运行历史</span></div>`).join("")}</div></div></div>`
}));

const envConfigContent = (tab, intro, form, scenario, headActionsOverride = "") => shell({
  id: `screen-env-${tab}`, active: "environment", title: `Production · ${scenario}`, description: intro, scenario: `环境配置 · ${scenario}`, headActions: headActionsOverride || `${status("未保存的修订", "warning")}${button("放弃更改")}${button("保存修订", "primary")}`,
  inspector: inspector("环境上下文", [["环境","Production"],["当前修订","cfg_17"],["基线角色","production"],["服务","api · web"],["返回任务",`发布单 ${demo.release}`]], callout("保存后返回发布单重新生成 Production 预览。", "info")),
  content: `<div class="tabs">${[["target","部署目标"],["resources","资源"],["variables","变量密钥"],["routes","域名入口"],["protection","保护规则"]].map(([id,label])=>`<div class="tab ${tab===id?"active":""}">${label}</div>`).join("")}</div><div class="spacer-12"></div>${form}`
});

screens.push(envConfigContent("target","为每个发布组件绑定可验证的运行位置与 Provider。",`<div class="panel"><div class="panel-head"><div><div class="panel-title">部署目标</div><div class="panel-subtitle">阻断来源：发布单 ${demo.release} / D05</div></div>${status("1 个阻断", "warning")}</div><div class="panel-body">${table("cols-release",["组件","当前目标","Provider","状态","操作"],[
  [`<div class="row-title">api</div><div class="row-meta">Node.js · port 3000</div>`,`未绑定`,`—`,status("阻断","warning"),`<span class="link">选择目标</span>`],
  [`<div class="row-title">web</div><div class="row-meta">Next.js · port 3000</div>`,`prod-server-01`,`local-filesystem-v1`,status("有效","success"),`<span class="link">调整</span>`],
])}<div class="spacer-16"></div>${callout("选择目标后将重新验证服务器、绑定、Provider 与工作负载输入；不会直接触发部署。", "info")}</div></div>`,"部署目标"));

screens.push(envConfigContent("resources","按组件绑定运行资源与容量证据。",`<div class="panel"><div class="panel-head"><div><div class="panel-title">资源绑定</div><div class="panel-subtitle">当前配置修订 cfg_17</div></div>${status("就绪", "success")}</div><div class="panel-body"><div class="form-grid"><label class="form-field"><span class="form-label">api · 计算资源</span><select class="input"><option>prod-server-01 / 2C 4G</option></select><span class="form-help">容量快照将在发布前刷新。</span></label><label class="form-field"><span class="form-label">web · 计算资源</span><select class="input"><option>prod-server-01 / 2C 4G</option></select></label><label class="form-field"><span class="form-label">api · Postgres</span><select class="input"><option>managed-postgres-main</option></select></label><label class="form-field"><span class="form-label">api · Redis</span><select class="input"><option>managed-redis-main</option></select></label></div></div></div>`,"资源"));

screens.push(envConfigContent("variables","变量与密钥只展示键、来源和版本，不展示密文。",`<div class="panel"><div class="panel-head"><div><div class="panel-title">变量与密钥</div><div class="panel-subtitle">Production · 2 个服务</div></div>${status("1 个阻断", "warning")}</div><div class="panel-body">${table("cols-release",["键","作用域","来源","状态","操作"],[
  [`DATABASE_URL`,`api`,`KeyCenter · revision 12`,status("有效","success"),`<span class="link">查看引用</span>`],
  [`REDIS_URL`,`api`,`KeyCenter · revision 8`,status("有效","success"),`<span class="link">查看引用</span>`],
  [`API_KEY`,`web`,`未配置`,status("阻断","warning"),`<span class="link">选择密钥</span>`],
])}<div class="spacer-16"></div>${callout("密钥内容不会进入发布快照；快照只冻结 server-owned revision 与引用。", "info")}</div></div>`,"变量密钥"));

screens.push(envConfigContent("routes","域名、端口和 TLS 由服务端探测证据绑定当前路由。",`<div class="panel"><div class="panel-head"><div><div class="panel-title">域名与入口</div><div class="panel-subtitle">server-owned DNS / HTTP probe</div></div>${status("就绪", "success")}</div><div class="panel-body"><div class="form-grid"><label class="form-field"><span class="form-label">主域名</span><input class="input" value="prod.picshare.test" readonly><span class="form-help">变更域名将使旧 DNS/TLS 证据失效。</span></label><label class="form-field"><span class="form-label">入口组件</span><select class="input"><option>web · port 3000</option></select></label><label class="form-field"><span class="form-label">TLS 模式</span><select class="input"><option>外部终止 / none</option></select></label><label class="form-field"><span class="form-label">最近探测</span><input class="input" value="DNS 通过 · HTTP 通过 · 2 分钟前" readonly></label></div></div></div>`,"域名入口"));

screens.push(envConfigContent("protection","保护规则决定审批、备份和恢复边界，不与发布策略混为一谈。",`<div class="panel"><div class="panel-head"><div><div class="panel-title">保护规则</div><div class="panel-subtitle">Production only</div></div>${status("已启用", "success")}</div><div class="panel-body"><div class="form-grid"><label class="form-field"><span class="form-label">Production 发布审批</span><select class="input"><option>必须独立 Reviewer 审批</option></select></label><label class="form-field"><span class="form-label">恢复审批</span><select class="input"><option>必须审批</option></select></label><label class="form-field"><span class="form-label">并发保护</span><input class="input" value="同一环境只允许 1 个活动运行" readonly></label><label class="form-field"><span class="form-label">有状态资源备份</span><input class="input" value="外部 Provider 未配置 · 阻断" readonly></label></div><div class="spacer-16"></div>${callout("当前 Provider 不支持真实 BackupRun，因此包含 stateful resource 的 Production 发布会 fail-closed。", "warning")}</div></div>`,"保护规则"));

screens.push(shell({
  id: "screen-versions-empty", active: "delivery", title: "环境版本", description: "没有 Devpilot 版本时，解释证据边界并返回当前活动发布单。", scenario: "环境版本 · Production 空态", headActions: button("查看当前发布单", "primary"),
  content: `<div class="tabs"><div class="tab">发布单</div><div class="tab active">环境版本</div></div><div class="spacer-12"></div><div class="split"><div class="panel"><div class="panel-body" style="padding:38px"><div class="task-eyebrow">Production</div><h2 class="task-title">Devpilot 尚无可追溯 Production 版本</h2><p class="task-copy">这不等于外部环境未上线。只有完成受管发布并生成 EnvironmentVersion 后，Devpilot 才能显示当前版本、升级与恢复链。</p><div class="spacer-16"></div>${button("查看当前发布单", "primary large")}</div></div><div class="panel"><div class="panel-head"><div class="panel-title">如何生成版本</div></div><div class="panel-body"><div class="timeline"><div class="timeline-item success"><div class="timeline-title">Build once</div><div class="timeline-copy">生成不可变 Manifest</div></div><div class="timeline-item success"><div class="timeline-title">Staging 验证</div><div class="timeline-copy">同一 Manifest 技术验证通过</div></div><div class="timeline-item current"><div class="timeline-title">Production 发布</div><div class="timeline-copy">预览、审批、部署和版本提交</div></div></div></div></div></div>`
}));

screens.push(shell({
  id: "screen-versions-history", active: "delivery", title: "环境版本", description: "当前版本、历史链与恢复入口保持可追溯。", scenario: "环境版本 · 历史链", headActions: `${button("发布单")}${button("升级版本", "primary")}`,
  content: `<div class="tabs"><div class="tab">发布单</div><div class="tab active">环境版本</div></div><div class="spacer-12"></div>${truthGrid([{label:"Production 当前版本",value:"2.4.0",detail:"运行正常 · 证据有效"},{label:"上一版本",value:"2.3.2",detail:"可作为恢复目标"},{label:"当前活动运行",value:"无",detail:"可发起升级或恢复"}])}<div class="spacer-12"></div>${table("cols-version",["版本","Manifest","来源运行","状态","操作"],[
  [`<div class="row-title">${demo.release} · 当前</div><div class="row-meta">1 小时前</div>`,demo.manifest,`ReleaseRun rel_01`,status("运行正常","success"),`<span class="link">查看证据</span>`],
  [`<div class="row-title">2.3.2</div><div class="row-meta">2 天前</div>`,`19c0…ee4`,`ReleaseRun rel_98`,status("历史版本"),`<span class="link">恢复到此版本</span>`],
  [`<div class="row-title">2.3.1</div><div class="row-meta">5 天前</div>`,`817d…a21`,`ReleaseRun rel_83`,status("历史版本"),`<span class="link">查看证据</span>`],
])}`
}));

screens.push(shell({
  id: "screen-recovery-preview", active: "delivery", title: "恢复 Production", description: "恢复会创建新的 ReleaseRun、DeploymentRun 和 EnvironmentVersion，不覆盖历史版本。", scenario: "Recovery · Preview", headActions: `${status("预览待确认", "warning")}${button("取消")}`,
  inspector: inspector("恢复范围", [["当前版本","2.4.0"],["目标版本","2.3.2"],["目标 Manifest","19c0…ee4"],["Provider","local-filesystem-v1"],["审批","必须"]], button("查看技术差异")),
  content: `<div class="stack">${callout("恢复不是直接切换指针。系统会重新验证当前目标、变量、资源与历史 Manifest，并创建新的受管运行。", "warning")}${truthGrid([{label:"当前版本",value:demo.release,detail:`Manifest ${demo.manifest}`},{label:"恢复目标",value:"2.3.2",detail:"Manifest 19c0…ee4"},{label:"执行结果",value:"新建 2.4.1-recovery",detail:"历史版本与审计均保留"}])}<div class="two-col"><div class="panel"><div class="panel-head"><div class="panel-title">恢复前检查</div>${status("4 / 5 通过", "warning")}</div><div class="panel-body">${kv("部署目标","匹配")}${kv("Provider","匹配")}${kv("备份证明","无 stateful resource · N/A")}${kv("审批","尚未申请")}</div></div><div class="panel"><div class="panel-head"><div class="panel-title">预计变化</div></div><div class="panel-body">${kv("api image","32bf… → 19c0…")}${kv("web image","32bf… → 19c0…")}${kv("配置修订","保留当前 cfg_19")}${kv("环境版本","新增，不覆盖")}</div></div></div><div class="task-actions">${button("申请恢复审批", "primary large")}${button("返回版本列表")}</div></div>`
}));

screens.push(shell({
  id: "screen-recovery-approval", active: "delivery", title: "恢复 Production", description: "目标交互 · 需服务端 capability 与独立审批契约；等待态显示冻结 Provider 与目标版本。", scenario: "Recovery · 待审批", headActions: `${status("待审批", "purple")}${button("返回版本列表")}`,
  content: `${taskPanel({eyebrow:"当前阶段",title:"等待另一位审批人处理恢复",now:"恢复输入已冻结；目标版本为 2.3.2",why:"申请人不能批准自己的 Production Recovery",next:"Reviewer 核对目标 Manifest 与当前配置",after:"批准后由执行人启动新的 Recovery Run",action:"查看审批进度",actionType:"",secondary:"撤回恢复"})}<div class="spacer-12"></div>${callout("若审批等待期间 Provider、目标绑定或工作负载漂移，执行前会安全阻断，并要求重新预览。", "info")}`
}));

screens.push(shell({
  id: "screen-recovery-running", active: "delivery", title: "恢复 Production", description: "恢复运行复用相同的锁序、证据与完成边界。", scenario: "Recovery · 运行中", headActions: `${status("恢复中", "info")}${button("查看审批")}`,
  inspector: inspector("Recovery Run", [["ReleaseRun","rec_rel_02"],["DeploymentRun","rec_dep_02"],["目标版本","2.3.2"],["审批","已批准"],["执行人","Mia Zhou"]], button("查看实时日志", "primary")),
  content: `<div class="stack">${taskPanel({eyebrow:"当前运行",title:"正在部署历史 Manifest",now:"输入复验通过；api 已完成，web 正在健康验证",why:"恢复必须产生新的运行与版本证据",next:"等待 post-deploy 证据完成",after:"创建新的 EnvironmentVersion 并推进当前指针",action:"查看实时日志",secondary:"查看冻结输入"})}<div class="panel"><div class="panel-body"><div class="timeline"><div class="timeline-item success"><div class="timeline-title">审批与输入复验</div><div class="timeline-copy">provider / workload / manifest 匹配</div></div><div class="timeline-item success"><div class="timeline-title">api 部署完成</div><div class="timeline-copy">进程与 HTTP 通过</div></div><div class="timeline-item current"><div class="timeline-title">web 健康验证</div><div class="timeline-copy">HTTP 探测中</div></div><div class="timeline-item"><div class="timeline-title">创建恢复版本</div><div class="timeline-copy">等待</div></div></div></div></div></div>`
}));

screens.push(shell({
  id: "screen-recovery-complete", active: "delivery", title: "恢复 Production", description: "恢复完成后创建新版本；历史目标仍保留原始审计链。", scenario: "Recovery · 完成", headActions: `${status("恢复完成", "success")}${button("返回版本列表")}`,
  content: `<div class="stack">${callout("恢复完成。Production 当前指针已推进到新版本 2.4.1-recovery，内容来自历史 Manifest 19c0…ee4。", "success")}${truthGrid([{label:"新当前版本",value:"2.4.1-recovery",detail:"Recovery Run 新生成"},{label:"恢复来源",value:"2.3.2",detail:"历史版本未被覆盖"},{label:"恢复前版本",value:"2.4.0",detail:"仍可追溯与再次恢复"}])}${table("cols-version",["版本","来源 Manifest","运行","状态","操作"],[
    [`<div class="row-title">2.4.1-recovery · 当前</div>`,`19c0…ee4`,`Recovery rec_rel_02`,status("运行正常","success"),`<span class="link">查看恢复证据</span>`],
    [`<div class="row-title">${demo.release}</div>`,demo.manifest,`Release rel_01`,status("历史版本"),`<span class="link">查看证据</span>`],
    [`<div class="row-title">2.3.2 · 恢复来源</div>`,`19c0…ee4`,`Release rel_98`,status("历史版本"),`<span class="link">查看证据</span>`],
  ])}</div>`
}));

screens.push(shell({
  id: "screen-repository-identity", active: "repository", title: "仓库与组件", description: "仓库身份保持不可变，组件修订通过结构化审核生成新 revision。", scenario: "项目管理 · 仓库与组件", headActions: `${status("身份已锁定", "success")}${button("发起仓库修订")}`,
  inspector: inspector("仓库身份", [["Canonical Key","github.com/org/picshare"],["默认分支","master"],["当前 Revision","rev_4"],["分析状态","succeeded"],["归档后","永久保留 claim"]], button("查看身份审计")),
  content: `<div class="stack"><div class="panel"><div class="panel-head"><div><div class="panel-title">锁定身份</div><div class="panel-subtitle">连接、分支和 verified commit</div></div>${status("已验证", "success")}</div><div class="panel-body"><div class="three-col"><div>${kv("仓库","read-only-repositories/picshare")}${kv("分支","master")}</div><div>${kv("当前 Commit",demo.commit)}${kv("连接","verified")}</div><div>${kv("凭据","团队引用")}${kv("最后校验","8 分钟前")}</div></div></div></div><div class="panel"><div class="panel-head"><div><div class="panel-title">组件模型</div><div class="panel-subtitle">默认隐藏原始 JSON</div></div>${status("4 个组件", "success")}</div><div class="panel-body">${table("cols-release",["组件","路径 / 类型","构建","运行","状态"],[
    [`api`,`apps/api · Node.js`,`pnpm build`,`node dist/main.js`,status("已确认","success")],[`web`,`apps/web · Next.js`,`pnpm build`,`pnpm start`,status("已确认","success")],[`worker`,`apps/worker · Node.js`,`pnpm build`,`node worker.js`,status("已确认","success")],[`db`,`prisma · schema`,`generate`,`managed resource`,status("外部依赖")],
  ])}</div></div></div>`
}));

screens.push(shell({
  id: "screen-release-policy", active: "policy", title: "发布规则", description: "只把可执行的标准路径作为主配置；高级能力按 Provider capability 呈现。", scenario: "项目管理 · 发布规则", headActions: `${status("revision 4", "success")}${button("创建新修订", "primary")}`,
  content: `<div class="split"><div class="stack"><div class="panel"><div class="panel-head"><div><div class="panel-title">标准发布路径</div><div class="panel-subtitle">当前生效</div></div>${status("可执行", "success")}</div><div class="panel-body">${kv("环境顺序","Staging → Production")}${kv("制品策略","Build once · 同一 Manifest")}${kv("Production 审批","TARGET CONTRACT · capability 决定")}${kv("并发保护","每环境 1 个活动运行")}${kv("恢复审批","必须")}</div></div><div class="panel"><div class="panel-head"><div><div class="panel-title">门禁与证据</div><div class="panel-subtitle">server-owned · fail-closed</div></div></div><div class="panel-body">${table("cols-release",["类别","来源","Freshness","失败语义","详情"],[
    [`部署输入`,`绑定 / 资源 / 密钥`,`事务内重验`,`阻断`,`<span class="link">D01–D12</span>`],[`入口证据`,`DNS / HTTP / TLS probe`,`TTL`,`阻断`,`<span class="link">D14–D18</span>`],[`部署后证据`,`进程 / HTTP / 可观测性`,`候选绑定`,`阻断`,`<span class="link">P01–P06</span>`],
  ])}</div></div></div><div class="panel"><div class="panel-head"><div class="panel-title">高级发布能力</div>${status("Provider 未就绪", "warning")}</div><div class="panel-body">${callout("蓝绿、金丝雀和自动放量未接入当前 Provider，因此不作为可选发布策略展示。", "warning")}<div class="spacer-12"></div>${kv("外部 Backup Provider","未配置")}${kv("流量切换 Provider","未配置")}${kv("自动回滚","未开放")}</div></div></div>`
}));

screens.push(shell({
  id: "screen-evidence-drawer", active: "evidence", title: "发布单 2.4.0", description: "业务决策保持在主画面；完整 ID、哈希、门禁与日志进入可恢复的证据抽屉。", scenario: "证据 · Drawer", headActions: `${status("技术证据有效", "success")}${button("关闭证据")}`,
  content: `<div class="stack">${stageTrack(4)}${taskPanel({title:"Production 目标未配置",now:"生产预览被 D05 阻断",why:"api 未绑定可验证的运行目标",next:"在 Production / 部署目标完成绑定",after:"返回并重新生成预览",action:"修复目标",secondary:"证据已展开"})}</div>`,
  inspector: `<aside class="drawer"><div class="drawer-head"><div><div class="drawer-title">技术证据 · D05</div><div class="drawer-copy">TARGET CONTRACT · scoped evidence focus</div></div>${button("关闭", "ghost")}</div><div class="spacer-16"></div>${kv("结论","unavailable")}${kv("Reason","deployment_target_missing")}${kv("Scope","Production / api")}${kv("采样时间","刚刚")}${kv("证据来源","server-owned preflight")}${kv("修复入口","environment / target / api")}<div class="spacer-16"></div><h3 class="section-title">冻结输入</h3><div class="code-block">releaseOrderId: rel_order_01\nenvironmentId: env_prod_01\nserviceId: svc_api_01\nmanifestDigest: sha256:32bf…c4a\nproviderKey: local-filesystem-v1\ncheckpoint: production_pre_execution</div><div class="spacer-16"></div><h3 class="section-title">相关证据</h3><div class="timeline"><div class="timeline-item success"><div class="timeline-title">Staging proof</div><div class="timeline-copy">同一 Manifest · checked</div></div><div class="timeline-item warning"><div class="timeline-title">Deployment target</div><div class="timeline-copy">api · missing</div></div><div class="timeline-item"><div class="timeline-title">Production preview</div><div class="timeline-copy">未生成</div></div></div></aside>`
}));

const mobileScreen = (id, title, body, scenario) => `<section id="${id}" class="screen mobile"><div class="scenario-label">${scenario}</div><header class="mobile-top"><div class="mobile-brand">Devpilot · ${demo.project}</div><div class="status info">项目</div></header><div class="mobile-content"><div class="breadcrumbs">项目 / ${title}</div><h1 class="page-title">${title}</h1><div class="spacer-12"></div>${body}</div></section>`;

screens.push(mobileScreen("screen-mobile-overview","项目总览",`${taskPanel({title:"配置 Production 部署目标",now:"Staging 已验证",why:"api 未绑定生产目标",next:"选择服务器与运行策略",after:"重新预览并申请审批",action:"修复目标",secondary:"证据"})}<div class="spacer-12"></div>${truthGrid([{label:"当前 Production",value:"尚无可追溯版本",detail:"不推断外部是否上线"},{label:"正在交付",value:`${demo.release} · Production 准备`,detail:"同一 Manifest 已通过 Staging"},{label:"当前基线",value:"2 个阻断",detail:"目标 1 · 变量 1",tone:"warning-text"}])}`,"390 · 总览"));

screens.push(mobileScreen("screen-mobile-production",`发布单 ${demo.release}`,`${taskPanel({title:"Production 预览未通过",now:"D05 正常领域阻断",why:"api 没有部署目标",next:"进入精确配置页修复",after:"重新预览并申请审批",action:"修复 Production",secondary:"证据"})}<div class="spacer-12"></div>${stageTrack(4,true)}<div class="spacer-12"></div>${callout("已通过 19 项 · 阻断 1 项 · 请求错误 0 项", "warning")}`,"390 · Production 阻断"));

screens.push(mobileScreen("screen-mobile-env-target","Production · 部署目标",`${callout(`来自发布单 ${demo.release} / D05；完成后返回重新预览。`, "info")}<div class="spacer-12"></div><div class="panel"><div class="panel-body"><div class="form-field"><span class="form-label">api</span><select class="input"><option>选择运行目标</option></select><span class="form-help">Node.js · port 3000</span></div><div class="spacer-16"></div><div class="form-field"><span class="form-label">Provider</span><input class="input" value="由目标决定" readonly></div><div class="spacer-16"></div><div class="task-actions">${button("保存并返回", "primary large")}${button("取消")}</div></div></div>`,"390 · 精确修复"));

screens.push(mobileScreen("screen-mobile-approval","审批 Production",`<div class="approval-card"><div class="approval-hero"><div><div class="approval-title">允许 ${demo.release} 发布？</div><div class="approval-meta">TARGET CONTRACT · Reviewer capability<br>Manifest ${demo.manifest}</div></div>${status("待审批", "purple")}</div><div class="spacer-16"></div>${kv("申请人","Lin Chen")}${kv("执行人","Mia Zhou")}${kv("输入","已冻结")}${kv("漂移","自动失效")}<div class="spacer-16"></div><label class="form-field"><span class="form-label">审批意见</span><input class="input" value="核对 Staging 证明与生产输入" readonly></label><div class="spacer-16"></div><div class="task-actions">${button("批准", "primary large")}${button("拒绝")}</div></div>`,"390 · Reviewer"));

document.getElementById("app").innerHTML = screens.join("");
