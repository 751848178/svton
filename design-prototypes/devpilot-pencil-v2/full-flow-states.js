const blockerTable = (rows) => table("cols-release", ["检查项", "状态", "证据", "影响", "动作"], rows);

screens.push(shell({
  id: "screen-preflight-manual", active: "delivery", title: "Production Preflight", description: "把可自动判定、需要人工确认和仅提示的事实分层。", scenario: "Preflight · Manual", headActions: `${status("1 项需确认", "purple")}${button("返回发布单")}`,
  inspector: inspector("检查上下文", [["发布单", demo.release], ["Commit", demo.commit], ["Manifest", demo.manifest], ["Checkpoint", "production_pre_execution"], ["刷新时间", "刚刚"]], button("导出检查证据")),
  content: `<div class="stack">${taskPanel({eyebrow:"当前唯一下一步",title:"确认 P03 人工业务验证",now:"19 项自动检查通过；P03 等待人工结论",why:"该项不能由技术探测自动替代",next:"由具备 capability 的审核人确认 exact candidate",after:"确认后由发布执行人重新尝试",action:"打开人工确认",secondary:"查看全部门禁"})}${blockerTable([["D01–D20 技术门禁",status("19 项通过","success"),"server-owned receipts","允许继续","查看"],["P03 业务验证",status("需人工","purple"),"candidate / evaluation","阻断","确认"],["D13 可观测性建议",status("待完善"),"配置快照","不阻断","稍后处理"]])}</div>`
}));

screens.push(shell({
  id: "screen-preflight-warning", active: "delivery", title: "Production Preflight", description: "Warning 不冒充阻断，也不与请求错误混在一起。", scenario: "Preflight · Warning", headActions: `${status("允许继续 · 有提醒", "warning")}${button("返回发布单")}`,
  content: `<div class="stack">${callout("Preflight 已通过。D13 尚未配置完整可观测性，但不阻断当前 standard 发布。", "info")}${truthGrid([{label:"通过",value:"20",detail:"required checks"},{label:"待完善",value:"1",detail:"D13 · 不阻断"},{label:"请求错误",value:"0",detail:"API 正常"}])}${blockerTable([["D13 可观测性",status("待完善"),"observability snapshot","不阻断","配置"],["D18 HTTP Probe",status("通过","success"),"fresh receipt","允许继续","证据"],["P01–P06 Post-deploy",status("尚未执行"),"运行后产生","无","说明"]])}</div>`
}));

screens.push(shell({
  id: "screen-preflight-integrity", active: "delivery", title: "Production Preflight", description: "完整性错误属于安全失败，不提供绕过按钮。", scenario: "Preflight · Integrity Error", headActions: `${status("完整性错误", "danger")}${button("返回发布单")}`,
  inspector: inspector("不可变事实", [["Release", demo.release], ["Expected Manifest", demo.manifest], ["Observed Manifest", "7fd1…991"], ["Commit", demo.commit], ["写入副作用", "0"]], button("复制审计编号")),
  content: `${taskPanel({eyebrow:"安全边界",title:"Manifest 与 Staging 证明不一致",now:"Production 输入与已验证 Staging candidate 不匹配",why:"exact Manifest 是发布主不变量",next:"回到 Build 或重新完成同一 candidate 的 Staging 验证",after:"重新生成 server-owned proof",action:"返回 Build 证据",secondary:"查看完整性详情",tone:"danger"})}${callout("不允许忽略、手动覆盖或继续审批。", "danger")}`
}));

screens.push(shell({
  id: "screen-approval-inbox", active: "delivery", title: "审批中心", description: "TARGET CONTRACT · 全局收件箱按 capability 展示可处理动作。", scenario: "Approval · Global Inbox", headActions: `${status("3 项待处理", "purple")}${button("刷新")}`,
  content: `<div class="stack"><div class="toolbar"><input class="search" value="搜索项目、版本或申请人" readonly><select class="select"><option>我可处理的审批</option></select><select class="select"><option>风险优先</option></select></div>${table("cols-release",["项目 / 操作","冻结对象","申请人","状态","下一步"],[[`<div class="row-title">Picshare · Production 发布</div><div class="row-meta">${demo.release}</div>`,demo.manifest,"Lin Chen",status("待决定","purple"),`<span class="link">审阅</span>`],[`<div class="row-title">Checkout API · Recovery</div><div class="row-meta">2.3.2 → 2.2.9</div>`,"manifest 8b2…","Mia Zhou",status("待决定","purple"),`<span class="link">审阅</span>`],[`<div class="row-title">Data Worker · Production</div><div class="row-meta">1.8.0</div>`,"输入已漂移","Kai Yu",status("已失效","warning"),`<span class="link">查看原因</span>`]])}${callout("TARGET CONTRACT：收件箱只能消费服务端 capabilities；无 capability 时不渲染批准或拒绝。", "info")}</div>`
}));

screens.push(intakeShell("screen-intake-failed", 2, "仓库分析失败", "保留已验证仓库身份和 exact commit；错误证据与重试动作分开。", `${taskPanel({eyebrow:"分析失败",title:"无法解析 api 的运行入口",now:"分析 Run anl_8f2a 已终止",why:"package.json 中存在两个互相冲突的 production script",next:"查看证据并选择要保留的入口",after:"使用同一 Draft 与 Commit 重新分析",action:"修正并重试",secondary:"下载失败证据",tone:"danger"})}${callout("项目 Draft 未丢失；不会新建仓库连接或身份。", "info")}`, "Intake · Failed"));

screens.push(intakeShell("screen-intake-cancelled", 2, "分析已取消", "取消停止当前 Run，但保留 Draft、仓库证明和继续接入入口。", `${truthGrid([{label:"Draft",value:"已保留",detail:"project draft"},{label:"仓库身份",value:"已锁定",detail:demo.repo},{label:"分析 Run",value:"cancelled",detail:"无后台写入"}])}<div class="spacer-16"></div><div class="task-actions">${button("继续接入","primary large")}${button("归档 Draft")}</div>`, "Intake · Cancelled"));

screens.push(intakeShell("screen-intake-stale-conflict", 2, "接入快照已变化", "CAS 冲突要求重新读取最新建议，不能覆盖其他审核人的修订。", `${taskPanel({eyebrow:"版本冲突",title:"结构化审核已被更新",now:"你打开的是 revision 4；当前已是 revision 5",why:"另一名成员已经确认了 api 运行命令",next:"加载最新审核快照并重新核对差异",after:"基于 revision 5 继续冻结",action:"加载最新版本",secondary:"查看修改人",tone:"warning"})}`, "Intake · Revision Conflict"));

screens.push(shell({
  id: "screen-build-empty", active: "delivery", title: `发布单 ${demo.release}`, description: "Build 尚未开始时说明前置条件，而不是显示空白日志。", scenario: "Build · Empty", headActions: `${status("等待开始")}${button("返回列表")}`,
  content: releaseContent({step:2,task:taskPanel({title:"开始构建不可变 Manifest",now:"发布基线已通过；尚无 BuildRun",why:"Build success 才能生成 server-owned Artifact Manifest",next:"确认 commit 与构建策略后开始",after:"进入并发构建与依赖复用",action:"开始构建",secondary:"查看冻结基线"}),body:callout(`将构建 Commit ${demo.commit}；成功后生成候选 Manifest，不接受客户端提供 digest。`,"info")})
}));

screens.push(shell({
  id: "screen-build-failed", active: "delivery", title: `发布单 ${demo.release}`, description: "构建失败保留失败阶段、日志和可重试边界。", scenario: "Build · Failed", headActions: `${status("构建失败", "danger")}${button("返回列表")}`,
  content: releaseContent({step:2,blocked:true,task:taskPanel({eyebrow:"构建失败",title:"api 编译未完成",now:"BuildRun build_21 在 compile 阶段失败",why:"TypeScript 编译返回 exit 2",next:"查看 exact log 并修复 Commit；不可修改本次冻结输入",after:"使用新 Commit 创建新的发布候选",action:"查看失败日志",secondary:"关闭发布单",tone:"danger"}),body:blockerTable([["依赖获取",status("通过","success"),"shared store","完成","证据"],["api compile",status("失败","danger"),"exit 2","阻断","日志"],["Manifest",status("未生成"),"—","无候选","说明"]])})
}));

screens.push(shell({
  id: "screen-build-cancelled", active: "delivery", title: `发布单 ${demo.release}`, description: "取消构建是终态，不与失败混淆。", scenario: "Build · Cancelled", headActions: `${status("已取消")}${button("返回列表")}`,
  content: releaseContent({step:2,task:taskPanel({eyebrow:"构建已取消",title:"没有生成 Artifact Manifest",now:"执行人取消 BuildRun build_21",why:"取消发生在 artifact finalize 前",next:"使用相同冻结基线重新发起 BuildRun",after:"新 Run 独立记录；旧 Run 保留审计",action:"重新构建",secondary:"查看取消记录"}),body:callout("已取消的 BuildRun 不可恢复为 running，也不会被 Production 使用。","info")})
}));

screens.push(shell({
  id: "screen-staging-blocked", active: "delivery", title: `发布单 ${demo.release}`, description: "Staging 前置缺目标时给精确配置入口。", scenario: "Staging · Blocked", headActions: `${status("预发阻断","warning")}${button("返回列表")}`,
  content: releaseContent({step:3,blocked:true,task:taskPanel({title:"绑定 Staging 的 web 部署目标",now:"Manifest 已生成；Staging 预检未通过",why:"web 没有与当前环境匹配的运行目标",next:"进入 Staging / 部署目标选择服务器",after:"重新运行 Staging preflight",action:"修复 Staging 目标",secondary:"查看 D05 证据"}),body:callout("Build 事实仍有效；修复环境配置不会重建 Manifest。","warning")})
}));

screens.push(shell({
  id: "screen-staging-failed", active: "delivery", title: `发布单 ${demo.release}`, description: "部署命令失败与健康验证失败分别定位。", scenario: "Staging · Failed", headActions: `${status("部署失败","danger")}${button("返回列表")}`,
  inspector: inspector("DeploymentRun", [["Run","dep_stg_23"],["Manifest",demo.manifest],["失败组件","web"],["阶段","health probe"],["副作用","api running · web unhealthy"]], button("查看完整日志")),
  content: releaseContent({step:3,blocked:true,task:taskPanel({eyebrow:"部署失败",title:"web HTTP 健康检查失败",now:"进程已启动；连续 3 次 /health 返回 503",why:"P02 需要 passed 的真实 HTTP 证据",next:"检查启动参数与健康端点",after:"由受管执行器清理失败工作负载后重试同一 Manifest",action:"打开 web 日志",secondary:"查看清理证据",tone:"danger"}),body:callout("Production 仍不可预览；Staging proof 尚未生成。","danger")})
}));

screens.push(shell({
  id: "screen-production-drift", active: "delivery", title: `发布单 ${demo.release}`, description: "预览后的输入漂移必须失效旧结论。", scenario: "Production · Preview Drift", headActions: `${status("输入已漂移","warning")}${button("返回列表")}`,
  content: releaseContent({step:4,blocked:true,task:taskPanel({eyebrow:"重新预览",title:"Production 输入在审批前发生变化",now:"target binding 从 prod-server-01 更新为 prod-server-02",why:"旧预览不再代表当前部署输入",next:"读取当前配置并重新生成 Production 预览",after:"旧审批不能继续使用；由用户生成新 candidate",action:"重新生成预览",secondary:"比较输入差异"}),body:callout("不会沿用旧审批、容量或 DNS 证据。","warning")})
}));

for (const state of [
  ["rejected","审批已拒绝","Reviewer 拒绝了当前 Production candidate","根据拒绝意见修正后重新预览","重新处理","danger"],
  ["expired","审批条件 · 已过期","等待期间冻结输入的有效期已结束","重新生成预览并创建新审批","重新预览","warning"],
  ["consumed","审批条件 · 已消费","该 approval 已用于一次受管执行","查看对应 ReleaseRun；不得再次执行","查看 ReleaseRun","success"],
]) {
  const [id,title,now,next,action,tone]=state;
  screens.push(shell({id:`screen-approval-${id}`,active:"delivery",title:`发布单 ${demo.release}`,description:"审批终态提供唯一可恢复动作。",scenario:`Approval · ${title}`,headActions:`${status(title,tone)}${button("返回列表")}`,content:releaseContent({step:4,blocked:id!=="consumed",task:taskPanel({eyebrow:"审批状态",title,now,why:"审批对象与 exact candidate 绑定",next,after:id==="consumed"?"保持审计只读":"产生新的审批对象",action,secondary:"查看审批证据",tone:tone==="danger"?"danger":""}),body:callout("申请人、Reviewer、时间、输入哈希与原因均保留在审计记录。",tone==="danger"?"danger":"info")})}));
}

screens.push(shell({
  id: "screen-production-deploy-failed", active: "delivery", title: `发布单 ${demo.release}`, description: "Production 执行失败不推进 EnvironmentVersion。", scenario: "Production · Deployment Failed", headActions: `${status("部署失败","danger")}${button("返回列表")}`,
  content: releaseContent({step:4,blocked:true,task:taskPanel({eyebrow:"执行失败",title:"web 启动命令失败",now:"审批与输入复验通过；deploy command exit 1",why:"目标服务器缺少受管运行目录",next:"打开 exact server 目标并修复 runtime path",after:"修复后重新生成预览并申请新的审批；当前版本不移动",action:"修复并重新预览",secondary:"查看失败证据",tone:"danger"}),body:truthGrid([{label:"Production 指针",value:"2.3.2",detail:"未移动"},{label:"失败 Run",value:"dep_prod_24",detail:"已终止"},{label:"审批",value:"已消费",detail:"重试需新决策"}])})
}));

screens.push(shell({
  id: "screen-route-compensation", active: "delivery", title: `发布单 ${demo.release}`, description: "TARGET CONTRACT · 当前未提供独立补偿控制台；以下定义执行人的补偿任务与回流。", scenario: "Route · Compensation Required", headActions: `${status("需要补偿","danger")}${button("返回列表")}`,
  inspector: inspector("Route Switch Saga", [["Saga","route_18"],["旧目标","2.3.2"],["新目标",demo.release],["失败步骤","readback"],["补偿状态","required"]], button("导出 Saga 证据")),
  content: `${taskPanel({eyebrow:"人工恢复",title:"路由切换结果无法确认",now:"Provider apply 已返回成功；readback 与目标不一致",why:"系统无法证明当前流量指向",next:"由运维核对 Provider 状态并执行受管补偿",after:"写入 compensation receipt 后重新评估",action:"查看补偿要求",actionType:"",secondary:"查看 Provider 回执",tone:"danger"})}${callout("在确认前不显示“已上线”或“运行正常”。","danger")}`
}));

screens.push(shell({
  id: "screen-evidence-mismatch", active: "delivery", title: `发布单 ${demo.release}`, description: "证据与 candidate 不匹配时 fail-closed。", scenario: "Evidence · Mismatch", headActions: `${status("证据不匹配","danger")}${button("关闭")}`,
  content: `${taskPanel({eyebrow:"完整性边界",title:"P03 证据属于旧 DeploymentRun",now:"当前 candidate dep_24；证据引用 dep_21",why:"人工确认不能跨 candidate 重放",next:"刷新当前 candidate 的 evidence identity",after:"重新由 Reviewer 确认 exact evidence",action:"刷新当前证据",secondary:"查看 identity 差异",tone:"danger"})}`
}));

screens.push(envConfigContent("revision-conflict","保存配置时检测到更新。",`${taskPanel({eyebrow:"配置冲突",title:"Production 配置已被其他成员更新",now:"你编辑 cfg_17；当前已是 cfg_18",why:"CAS 防止覆盖服务器、密钥和路由变更",next:"加载 cfg_18 并重新应用你的修改",after:"保存为新的 cfg_19",action:"加载最新修订",secondary:"比较修改",tone:"warning"})}`,"Revision CAS 409",`${status("配置冲突","warning")}${button("放弃更改")}${button("保存修订","primary",true)}`));

screens.push(shell({
  id: "screen-project-read-only", active: "overview", title: "项目只读", description: "TARGET CONTRACT · 归档详情保留历史与证据，并拒绝所有新增写入。", scenario: "403 · Archived Read-only", headActions: `${status("已归档")}${button("返回项目目录")}`,
  content: `${taskPanel({eyebrow:"只读边界",title:"该项目已归档",now:"仓库身份、运行、版本与证据可查看",why:"归档项目不允许接入、分析、发布或修订写入",next:"返回目录选择活跃项目",after:"不会改变任何历史记录",action:"返回项目目录",secondary:"查看历史证据"})}`
}));

screens.push(shell({
  id: "screen-scope-mismatch", active: "overview", title: "找不到该项目上下文", description: "404 与 scope mismatch 不泄露其他团队资源。", scenario: "404 · Scope Mismatch", headActions: button("返回项目目录"),
  content: `<div class="split equal"><div class="panel"><div class="panel-body" style="padding:38px"><div class="task-eyebrow">PROJECT_NOT_FOUND</div><h2 class="task-title">项目不存在或不属于当前团队</h2><p class="task-copy">链接可能已失效，或你切换到了不同团队。系统不会展示资源是否真实存在。</p><div class="spacer-16"></div>${button("返回项目目录","primary large")}</div></div><div class="panel"><div class="panel-head"><div class="panel-title">可以检查</div></div><div class="panel-body">${kv("当前团队","Test Org")}${kv("项目 ID","不可验证")}${kv("写入副作用","0")}</div></div></div>`
}));

screens.push(shell({
  id: "screen-technical-deployment", active: "delivery", title: "Technical Deployment", description: "技术部署详情只证明受管执行，不等于 Production online。", scenario: "Technical Deployment · Detail", headActions: `${status("技术验收完成")}${button("返回运行")}`,
  inspector: inspector("Technical-only", [["Provider","local-filesystem-v1"],["Environment","Production"],["Manifest",demo.manifest],["Acceptance","technical_acceptance"],["External Ready","未证明"]], callout("不显示“线上运行正常”。","warning")),
  content: `<div class="stack">${callout("本地技术验收完成；未证明外部 Production 上线。", "warning")}${truthGrid([{label:"进程",value:"2 / 2",detail:"passed"},{label:"HTTP",value:"2 / 2",detail:"passed"},{label:"可观测性",value:"local receipt",detail:"technical only"}])}<div class="panel"><div class="panel-head"><div class="panel-title">DeploymentRun dep_24</div>${status("completed","success")}</div><div class="panel-body"><div class="timeline"><div class="timeline-item success"><div class="timeline-title">Workload ready</div><div class="timeline-copy">server-owned status command</div></div><div class="timeline-item success"><div class="timeline-title">HTTP probe</div><div class="timeline-copy">healthCheckUrl passed</div></div><div class="timeline-item success"><div class="timeline-title">Technical acceptance</div><div class="timeline-copy">local provider boundary</div></div></div></div></div></div>`
}));

screens.push(shell({
  id: "screen-staging-recovery", active: "delivery", title: "恢复 Staging", description: "Staging 恢复保留同样的候选、运行与证据边界。", scenario: "Staging Recovery · Preview", headActions: `${status("预览通过","success")}${button("取消")}`,
  content: `<div class="stack">${truthGrid([{label:"当前 Staging",value:demo.release,detail:demo.manifest},{label:"恢复目标",value:"2.3.2",detail:"19c0…ee4"},{label:"结果",value:"新建受管运行",detail:"不直接切指针"}])}${taskPanel({eyebrow:"恢复预览",title:"恢复 Staging 到 2.3.2 内容",now:"目标、Provider 与历史 Manifest 已验证",why:"用于验证历史候选或恢复预发环境",next:"启动新的 Staging Recovery Run",after:"创建新的 Staging EnvironmentVersion",action:"开始恢复",secondary:"查看技术差异"})}</div>`
}));

screens.push(mobileScreen("screen-mobile-recovery","恢复 Production",`${callout("恢复会创建新的 Run 与 EnvironmentVersion，不覆盖历史。","warning")}<div class="spacer-12"></div>${truthGrid([{label:"当前",value:demo.release,detail:demo.manifest},{label:"目标",value:"2.3.2",detail:"19c0…ee4"},{label:"审批",value:"必须",detail:"TARGET CONTRACT"}])}<div class="spacer-12"></div>${button("申请恢复审批","primary large")}`,"390 · Recovery"));

screens.push(shell({
  id:"screen-approval-cancelled",active:"delivery",title:`发布单 ${demo.release}`,description:"申请人撤回尚未消费的审批后，冻结对象保留只读。",scenario:"Approval · Cancelled",headActions:`${status("审批已取消")}${button("返回列表")}`,
  content:releaseContent({step:4,blocked:true,task:taskPanel({eyebrow:"审批终态",title:"审批申请已取消",now:"申请人在 Reviewer 决定前撤回申请",why:"取消后的 approval 不可批准、拒绝或执行",next:"重新生成 Production 预览",after:"按当前输入创建新的审批对象",action:"重新预览",secondary:"查看取消记录"}),body:callout("旧 candidate、申请人和取消原因继续保留在审计记录。","info")})
}));

screens.push(shell({
  id:"screen-release-withdrawn",active:"delivery",title:`发布单 ${demo.release}`,description:"撤回或取消发布单是终态，不删除 Build、Manifest 与部署历史。",scenario:"Release · Withdrawn",headActions:`${status("已撤回")}${button("返回列表")}`,
  content:releaseContent({step:2,blocked:true,task:taskPanel({eyebrow:"发布终态",title:"该发布单已撤回",now:"执行人在 Production 审批前终止本次交付",why:"ReleaseRun canceled / lifecycle withdrawn 均不可继续推进",next:"返回交付列表或基于新基线创建发布单",after:"旧证据保持只读，不复用 approval",action:"创建新发布单",secondary:"查看撤回证据"}),body:callout("撤回不会删除已完成的 BuildRun、Staging DeploymentRun 或 Artifact Manifest。","info")})
}));

for(const targetState of [
  ["duplicated","部署目标重复绑定","同一组件存在两个当前目标","保留唯一 active binding，归档其余重复项","处理重复绑定"],
  ["provider-mismatch","Provider 与目标不匹配","冻结输入要求 local-filesystem-v1，目标记录为 ssh-external","选择与当前 Provider capability 一致的目标","重新选择目标"],
  ["ssh-root-invalid","工作目录不受信任","SSH root 不满足绝对路径与受管目录约束","配置受管绝对路径并重新验证所有权","修复工作目录"],
  ["ssh-connection-invalid","无法验证 SSH 连接","最新 server-owned connection probe 未通过","更新凭据或网络后重新执行连接探测","重新探测连接"],
]){
  const [id,title,now,next,action]=targetState;
  screens.push(envConfigContent(`target-${id}`,"部署目标就绪度必须给出精确原因和唯一修复动作。",`${taskPanel({eyebrow:"TARGET READINESS",title,now,why:"Production 只消费与环境、组件和 Provider 精确绑定的 server-owned 事实",next,after:"重新生成 target readiness 与 Production preview",action,secondary:"查看验证证据",tone:"warning"})}`,title,`${status("目标未就绪","warning")}${button("返回发布单")}`));
}

screens.push(shell({
  id:"screen-capability-read-only",active:"overview",title:"项目只读",description:"当前成员没有项目写 capability；页面隐藏写动作并保留可查看证据。",scenario:"Capability · Read-only",headActions:`${status("只读访问")}${button("返回项目目录")}`,
  content:`${taskPanel({eyebrow:"权限边界",title:"你可以查看，但不能修改该项目",now:"capabilities.write = false",why:"项目写入由团队角色与服务端 capability 共同决定",next:"联系团队管理员调整角色，或继续查看发布与证据",after:"权限变化后重新读取 capabilities",action:"查看发布历史",secondary:"查看所需权限"})}${callout("页面不渲染创建、保存、批准、部署或恢复按钮；服务端仍会再次校验。","info")}`
}));

screens.push(shell({
  id:"screen-state-closure",active:"delivery",title:"状态闭合附录",description:"把服务端权威状态映射到画板与组件变体，供产品、设计和研发共同验收。",scenario:"Appendix · State Closure",headActions:`${status("权威映射","success")}${button("返回索引")}`,
  content:`<div class="stack">${table("cols-release",["权威状态域","状态 / 原因","对应画板","主恢复动作","边界"],[["OperationApproval","pending / approved / rejected / expired / consumed / cancelled","14–15 · 49–51 · 61","审阅 / 重新预览","exact candidate"],["Release lifecycle","draft / running / awaiting_validation / succeeded / failed / canceled / withdrawn","08–16 · 43–54 · 62","继续 / 修复 / 新建","不复用终态"],["Target readiness","ready / missing / duplicated / provider_mismatch / ssh_root_invalid / ssh_connection_invalid","18 · 46 · 63–66","精确环境配置","server-owned"],["Project access","writable / capability read-only / archived / scope mismatch","06–07 · 56–57 · 67","申请权限 / 返回目录","fail-closed"],["EnvironmentVersion","empty / current / history / recovery preview / approval / running / completed","23–28 · 59–60","发布 / 恢复","新版本不覆盖历史"]])}${callout("每个状态只允许一个主动作；完整 ID、哈希、日志和 gate receipt 继续进入上下文证据抽屉。","info")}</div>`
}));

screens.push(mobileScreen("screen-mobile-preflight","Production Preflight",`${status("1 项需确认","purple")}<div class="spacer-12"></div>${taskPanel({eyebrow:"当前唯一下一步",title:"确认 P03 人工业务验证",now:"19 项自动检查通过",why:"P03 不能由技术探测替代",next:"由独立 Reviewer 确认 exact candidate",after:"执行人重新尝试",action:"打开人工确认",secondary:"查看门禁"})}`,"390 · Preflight"));

screens.push(mobileScreen("screen-mobile-error-recovery","发布未完成",`${callout("Production 版本未移动；失败 Run 与已消费审批保持只读。","danger")}<div class="spacer-12"></div>${taskPanel({eyebrow:"执行失败",title:"修复后重新预览",now:"web 启动命令失败",why:"审批已消费，不能直接重试执行",next:"修复服务器目标并重新生成预览",after:"申请新的审批",action:"修复并重新预览",secondary:"查看失败证据",tone:"danger"})}`,"390 · Error Recovery"));

screens.push(shell({
  id:"screen-sites",active:"environment",title:"站点与域名",description:"按项目与环境管理域名配置；DNS/TLS 事实只消费服务端探测。",scenario:"Deep Link · Sites",headActions:`${status("Production")}${button("添加站点","primary")}`,
  inspector:inspector("路由上下文",[["projectId","prj_picshare"],["environmentId","env_prod"],["返回任务",`发布单 ${demo.release} / D14–D16`],["写入能力","environment.write"]],button("返回阻断任务")),
  content:`<div class="stack">${table("cols-release",["域名","入口组件","DNS","TLS","动作"],[["prod.picshare.test","web · 3000",status("通过","success"),status("不适用"),"查看探测"],["api.picshare.test","api · 3000",status("待探测","warning"),status("不适用"),"运行探测"]])}${callout("域名、别名或 TLS 配置变化会使旧 probe receipt 失效；页面不接受客户端伪造探测状态。","info")}</div>`
}));

screens.push(shell({
  id:"screen-keys",active:"environment",title:"密钥与变量",description:"只显示键、作用域、来源与修订；密文从不回显。",scenario:"Deep Link · Keys",headActions:`${status("1 项缺失","warning")}${button("创建密钥","primary")}`,
  inspector:inspector("路由上下文",[["projectId","prj_picshare"],["environmentId","env_prod"],["返回任务",`发布单 ${demo.release} / D17`],["当前修订","secret-rev-8"]],button("返回阻断任务")),
  content:`${table("cols-release",["键","作用域","来源","修订","状态"],[["DATABASE_URL","api","KeyCenter","8",status("有效","success")],["REDIS_URL","api","KeyCenter","8",status("有效","success")],["API_KEY","web","未配置","—",status("缺失","warning")]])}${callout("编辑只创建新 revision；部署输入锁定 exact key revision。","info")}`
}));

screens.push(shell({
  id:"screen-resource-instances",active:"environment",title:"资源实例",description:"展示环境内受管资源与工作负载组件的精确绑定。",scenario:"Deep Link · Resource Instances",headActions:`${status("2 个实例","success")}${button("绑定资源","primary")}`,
  inspector:inspector("路由上下文",[["projectId","prj_picshare"],["environmentId","env_prod"],["返回任务",`发布单 ${demo.release} / D08–D12`],["Provider","managed-resource"]],button("返回阻断任务")),
  content:`${table("cols-release",["资源","组件","Provider","最近运行","状态"],[["postgres-main","api","managed-postgres","backup unsupported",status("发布阻断","warning")],["redis-main","api","managed-redis","connection passed",status("有效","success")]])}${callout("无真实 non-dry-run BackupRun 时，stateful Production 发布保持 fail-closed。","warning")}`
}));

screens.push(shell({
  id:"screen-resource-control",active:"environment",title:"资源控制",description:"容量、配额与资源请求按环境和组件展示，不使用虚构健康分数。",scenario:"Deep Link · Resource Control",headActions:`${status("1 项待处理","warning")}${button("新建资源请求","primary")}`,
  inspector:inspector("路由上下文",[["projectId","prj_picshare"],["environmentId","env_prod"],["返回任务",`发布单 ${demo.release} / D05`],["容量快照","cap_31 · fresh"]],button("返回阻断任务")),
  content:`<div class="stack">${truthGrid([{label:"CPU 请求",value:"4 C",detail:"可用 6 C"},{label:"内存请求",value:"8 GiB",detail:"可用 12 GiB"},{label:"磁盘请求",value:"24 GiB",detail:"配额 20 GiB"}])}${taskPanel({eyebrow:"资源阻断",title:"web 磁盘请求超过环境配额",now:"当前需要 24 GiB；配额 20 GiB",why:"Production 预检必须使用新鲜容量快照",next:"调整工作负载需求或提交配额请求",after:"刷新容量证据并返回发布单",action:"提交配额请求",secondary:"调整需求",tone:"warning"})}</div>`
}));

screens.push(shell({
  id:"screen-servers",active:"repository",title:"服务器",description:"服务器能力、连接状态和受管路径为部署目标提供服务端事实。",scenario:"Deep Link · Servers",headActions:`${status("2 台服务器")}${button("添加服务器","primary")}`,
  inspector:inspector("路由上下文",[["projectId","prj_picshare"],["返回任务",`Production / 部署目标`],["要求 capability","server.write"],["最近探测","刚刚"]],button("返回部署目标")),
  content:`${table("cols-release",["服务器","连接","受管根目录","Provider","动作"],[["prod-server-01",status("通过","success"),"/srv/devpilot","local-filesystem-v1","查看"],["prod-server-02",status("失败","danger"),"/opt/app","ssh-external","修复连接"]])}${callout("部署目标只可选择与组件、环境和 Provider capability 匹配的服务器。","info")}`
}));

screens.push(shell({
  id:"screen-monitoring",active:"environment",title:"服务监控",description:"按 applicationServiceId 展示已配置的信号与最近采样；无数据时诚实空态。",scenario:"Deep Link · Monitoring",headActions:`${status("api")}${button("配置可观测性","primary")}`,
  inspector:inspector("路由上下文",[["applicationServiceId","svc_api"],["项目","Picshare"],["环境","Production"],["返回任务",`发布单 ${demo.release} / D13`]],button("返回阻断任务")),
  content:`<div class="stack">${truthGrid([{label:"HTTP Probe",value:"已配置",detail:"/health"},{label:"日志采集",value:"未配置",detail:"无采样"},{label:"告警规则",value:"未配置",detail:"不阻断 standard"}])}${callout("当前没有可展示的时序样本；此处不生成 success rate、SLA 或健康分数。","info")}</div>`
}));

screens.push(shell({
  id:"screen-logs",active:"delivery",title:"运行日志",description:"日志按 Run、组件、阶段和时间范围查询；默认不加载跨项目数据。",scenario:"Deep Link · Logs",headActions:`${status("dep_prod_24")}${button("导出日志")}`,
  inspector:inspector("查询上下文",[["Release",demo.release],["DeploymentRun","dep_prod_24"],["组件","web"],["阶段","deploy"],["时间范围","最近 30 分钟"]],button("返回失败任务")),
  content:`<div class="stack"><div class="toolbar"><input class="search" value="搜索当前 Run 日志" readonly><select class="select"><option>web</option></select><select class="select"><option>deploy</option></select></div><div class="code-block">14:42:11  start managed command\n14:42:12  ensure /srv/devpilot/releases/2.4.0\n14:42:13  ERROR runtime path is not writable\n14:42:13  exit 1</div>${callout("日志只解释失败；重试仍需回到拥有业务动作的 Production 任务。","info")}</div>`
}));

screens.push(shell({
  id:"screen-appendix-system",active:"overview",title:"状态附录 · 系统与列表",description:"通用状态不重复创造业务动作；每种状态都规定恢复入口。",scenario:"Appendix · System States",headActions:button("返回索引"),
  content:`${table("cols-release",["页面族","状态","显示规则","唯一动作","证据边界"],[["认证","401","会话失效，不展示业务数据","重新登录","无资源泄露"],["权限","403 / capability=false","隐藏写动作，保留可读事实","查看权限说明","服务端再校验"],["请求","loading / error","骨架与错误分离","重试当前请求","不推断领域状态"],["列表","empty / no-match","空业务数据与筛选无结果分离","创建 / 清除筛选","总数来自服务端"],["范围","404 / scope mismatch","不泄露其他团队资源","返回目录","写入副作用 0"]])}`
}));

screens.push(shell({
  id:"screen-appendix-delivery",active:"delivery",title:"状态附录 · Build / Staging / Production",description:"交付阶段状态映射到已有全页或局部组件变体。",scenario:"Appendix · Delivery States",headActions:button("返回索引"),
  content:`${table("cols-release",["阶段","权威状态","画板 / 变体","当前任务","不可做"],[["BuildRun","queued / running / succeeded / failed / canceled","10 · 43–45 · 同页 queued","开始 / 查看 / 新建候选","客户端提供 digest"],["DeploymentRun · Staging","running / completed / failed / blocked","11 · 46–47 · 同页 running","配置 / 等待 / 查看日志","绕过 proof"],["Production Preview view","no candidate / loading / blocked / allowed / drift / error","12 · 36–38 · 48","刷新 / 修复 / 申请审批","将领域阻断当请求失败"],["ReleaseRun persisted","pending / awaiting_approval / running / succeeded / failed / canceled","13–16 · 52–54","申请 / 等待 / 执行 / 修复","复用 consumed approval"]])}`
}));

screens.push(shell({
  id:"screen-appendix-gates",active:"delivery",title:"状态附录 · Gate 与审批",description:"技术门禁、人工确认、审批持久化状态和条件分开。",scenario:"Appendix · Gate States",headActions:button("返回索引"),
  content:`${table("cols-release",["对象","状态","含义","动作","画板"],[["Gate persisted status","pending / running / passed / warning / failed / skipped / unavailable / needs_human","服务端持久化评估状态","重新评估 / 查看运行","12 · 36–38 · 54"],["Gate view / Manual","checked / unchecked / blocked / warning / manual / unavailable","视图结论与人工确认分开呈现","确认 / 刷新","14–15 · 36"],["OperationApproval","pending / approved / rejected / cancelled","持久化审批状态","审阅 / 新建","13–15 · 49"],["Approval condition","expired / consumed","不可再次决定或执行的条件","重新预览 / 查看 Run","50–51"]])}`
}));

screens.push(shell({
  id:"screen-appendix-environment",active:"environment",title:"状态附录 · 环境配置",description:"配置页采用局部状态变体，不把每个表单状态伪装成独立业务页面。",scenario:"Appendix · Environment States",headActions:button("返回索引"),
  content:`${table("cols-release",["配置域","状态","显示","恢复动作","画板"],[["部署目标","ready / missing / duplicated / provider mismatch / SSH invalid","行级 reason + exact binding","选择 / 去重 / 探测","18 · 46 · 63–66"],["资源","empty / collision / invalid / ready","组件与实例绑定","绑定 / 解决冲突","19 · 73–74"],["变量","draft / missing / collision / ready","键与 revision，不回显密文","创建 revision","20 · 72"],["路由","empty / DNS fail / TLS fail / probe fail / ready","server-owned receipt","配置 / 重探测","21 · 71"],["保护","none / invalid / editing / saving / present / copying / syncing","policy refs 与 capability","编辑 / 同步","22"],["修订","current / draft-invalid / saving / CAS 409","保留本地 draft","加载 / 比较 / 重应用","55"]])}`
}));

screens.push(shell({
  id:"screen-appendix-version-recovery",active:"delivery",title:"状态附录 · 版本与恢复",description:"Production 与 Staging 的版本链、候选与恢复状态显式分离。",scenario:"Appendix · Version & Recovery",headActions:button("返回索引"),
  content:`${table("cols-release",["对象","状态","画板 / 组件变体","结果","边界"],[["Production Version","empty / current / history / candidate / upgrade","23–24","新 EnvironmentVersion","不覆盖历史"],["Production Recovery","preview / awaiting approval / running / completed / failed / blocked","25–28 · 60","新 Recovery Run + Version","Provider / workload 冻结"],["Staging Version","current / history / candidate / upgrade","11 · 24 的 Staging tab","Staging EnvironmentVersion","同一 Manifest"],["Staging Recovery","selected / executing / succeeded / failed / blocked","59 + 同页状态变体","新 Staging EnvironmentVersion","无审批链"]])}`
}));

screens.push(shell({
  id:"screen-production-approved-executor",active:"delivery",title:`发布单 ${demo.release}`,description:"审批完成后先交给发布执行人，不自动把 Reviewer 动作变成部署。",scenario:"Production · Approved / Executor",headActions:`${status("已批准","success")}${button("返回列表")}`,
  inspector:inspector("角色交接",[["申请人","Lin Chen"],["Reviewer","Kai Yu"],["执行人","Mia Zhou"],["审批","approved"],["输入","仍有效"]],button("查看审批证据")),
  content:releaseContent({step:4,task:taskPanel({eyebrow:"等待发布执行人",title:"审批已通过，可以开始 Production 部署",now:"Reviewer 已批准 exact candidate；尚未创建 DeploymentRun",why:"审批决定与生产执行是两个独立责任",next:"由发布执行人再次复验输入并开始部署",after:"进入受管执行与 post-deploy 验证",action:"开始 Production 部署",secondary:"查看冻结输入"}),body:callout("若 Provider、目标、密钥或资源事实漂移，开始执行前会安全阻断并要求重新预览。","info")})
}));

screens.push(shell({
  id:"screen-recovery-reviewer",active:"delivery",title:"审批 Production Recovery",description:"TARGET CONTRACT · Reviewer 只决定冻结的恢复目标，不能代替执行人启动恢复。",scenario:"Recovery · Reviewer",headActions:`${status("需要决定","warning")}${button("返回审批中心")}`,
  inspector:inspector("恢复权限",[["当前角色","Reviewer"],["申请人","Lin Chen"],["执行人","Mia Zhou"],["目标版本","2.3.2"],["Provider","local-filesystem-v1"]],callout("当前产品文案；inputHash 与 capability 放在证据层。","info")),
  content:`<div class="approval-layout"><div class="approval-card"><div class="approval-title">允许恢复到 2.3.2 的内容？</div><div class="approval-meta">将创建新的 Recovery Run 与 EnvironmentVersion；不会覆盖历史。</div><div class="spacer-16"></div>${truthGrid([{label:"当前",value:demo.release,detail:demo.manifest},{label:"目标",value:"2.3.2",detail:"19c0…ee4"},{label:"有状态资源",value:"无",detail:"backup N/A"}])}<div class="spacer-16"></div><div class="task-actions">${button("批准恢复","primary large")}${button("拒绝")}${button("查看证据","ghost")}</div></div><div class="panel"><div class="panel-head"><div class="panel-title">审批前确认</div></div><div class="panel-body">${kv("目标 Manifest","历史证明有效")}${kv("当前配置","保留 cfg_19")}${kv("Provider","已冻结")}${kv("漂移","执行前重验")}</div></div></div>`
}));

screens.push(shell({
  id:"screen-recovery-approved-executor",active:"delivery",title:"恢复 Production",description:"恢复审批通过后等待执行人启动新的 Recovery Run。",scenario:"Recovery · Approved / Executor",headActions:`${status("已批准","success")}${button("返回版本列表")}`,
  content:`${taskPanel({eyebrow:"等待恢复执行人",title:"恢复审批已通过",now:"目标版本 2.3.2 与 Provider 已冻结；尚未开始执行",why:"Reviewer 只做风险决定，执行人负责最终输入复验",next:"由执行人启动新的 Recovery Run",after:"进入恢复运行与 post-deploy 验证",action:"开始恢复",secondary:"查看审批证据"})}${callout("任何部署输入漂移都会在预留资源前失败，不产生部分恢复。","info")}`
}));

screens.push(mobileScreen("screen-mobile-intake-resume","继续项目接入",`${callout("TARGET CONTRACT · 目录恢复入口需要 projectId + runId。","info")}<div class="spacer-12"></div>${taskPanel({title:"继续确认仓库识别结果",now:"Draft 已保留；分析 Run anl_8f2a 已完成",why:"尚未冻结接入审核快照",next:"核对 api 启动命令冲突",after:"生成项目基线",action:"继续接入",secondary:"归档 Draft"})}`,"390 · Intake Resume"));

screens.push(mobileScreen("screen-mobile-requester-waiting","等待发布审批",`${status("等待另一位审批人","warning")}<div class="spacer-12"></div>${taskPanel({eyebrow:"当前阶段",title:"申请已提交",now:"Production candidate 已冻结",why:"申请人不能批准自己的发布",next:"等待 Reviewer 决定",after:"由发布执行人开始部署",action:"查看审批进度",actionType:"",secondary:"撤回申请"})}`,"390 · Requester Waiting"));

screens.push(mobileScreen("screen-mobile-production-running","Production 部署中",`${taskPanel({eyebrow:"当前运行",title:"正在采集技术证据",now:"部署命令已完成；HTTP 探测中",why:"只有受管证据通过才创建版本",next:"等待 post-deploy 验证",after:"推进 EnvironmentVersion",action:"查看实时日志",secondary:"查看审批"})}<div class="spacer-12"></div>${truthGrid([{label:"进程",value:"2 / 2",detail:"通过"},{label:"HTTP",value:"1 / 2",detail:"探测中"},{label:"版本",value:"2.3.2",detail:"尚未移动"}])}`,"390 · Executor Running"));

screens.push(mobileScreen("screen-mobile-production-success","Production 已完成",`${callout(`Devpilot EnvironmentVersion ${demo.release} 已创建；不推断平台外部事实。`,"success")}<div class="spacer-12"></div>${truthGrid([{label:"当前版本",value:demo.release,detail:demo.manifest},{label:"结果",value:"完成",detail:"证据通过"},{label:"回退基点",value:"2.3.2",detail:"可发起恢复"}])}<div class="spacer-12"></div>${button("查看完整证据","primary large")}`,"390 · Production Success"));

screens.push(mobileScreen("screen-mobile-evidence-log","运行证据",`${status("dep_prod_24")}${callout("技术证据与业务动作分开；关闭后返回原失败任务。","info")}<div class="spacer-12"></div><div class="code-block">14:42:11 start managed command\n14:42:13 ERROR runtime path is not writable\n14:42:13 exit 1</div><div class="spacer-12"></div>${button("返回失败任务","primary large")}`,"390 · Evidence / Log"));

screens.push(mobileScreen("screen-mobile-recovery-approved","恢复审批已通过",`${taskPanel({eyebrow:"等待执行人",title:"可以开始恢复",now:"目标 2.3.2 已批准",why:"Reviewer 与执行人职责分离",next:"复验输入并启动 Recovery Run",after:"创建新的 EnvironmentVersion",action:"开始恢复",secondary:"审批证据"})}`,"390 · Recovery Executor"));

screens.push(mobileScreen("screen-mobile-recovery-complete","恢复已完成",`${callout("已创建新版本 2.4.1-recovery；历史版本未被覆盖。","success")}<div class="spacer-12"></div>${truthGrid([{label:"当前",value:"2.4.1-recovery",detail:"Recovery Run"},{label:"恢复内容",value:"2.3.2",detail:"19c0…ee4"},{label:"原版本",value:demo.release,detail:"保留历史"}])}<div class="spacer-12"></div>${button("返回版本列表","primary large")}`,"390 · Recovery Complete"));

screens.push(shell({
  id:"screen-staging-target-repair",active:"environment",title:"Staging · 部署目标",description:"TARGET CONTRACT · 目标态从 Staging preflight 进入并保留返回上下文；当前只展示协议设计。",scenario:"Staging · Target Repair",headActions:`${status("来自 Staging / D05","warning")}${button("取消")}${button("保存并返回","primary")}`,
  inspector:inspector("返回上下文",[["环境","Staging"],["目标态来源",`release ${demo.release} / staging preflight`],["阻断组件","web"],["目标态返回","Staging step"],["Provider","由目标决定"]],callout("当前服务端尚未提供完整回流绑定。","info")),
  content:`<div class="panel"><div class="panel-head"><div><div class="panel-title">为 web 选择 Staging 运行目标</div><div class="panel-subtitle">不会修改 Production 配置</div></div>${status("缺失","warning")}</div><div class="panel-body"><div class="form-grid"><label class="form-field"><span class="form-label">组件</span><input class="input" value="web · port 3000" readonly></label><label class="form-field"><span class="form-label">运行目标</span><select class="input"><option>staging-server-01</option></select></label><label class="form-field"><span class="form-label">Provider</span><input class="input" value="local-filesystem-v1" readonly></label><label class="form-field"><span class="form-label">保存后</span><input class="input" value="重新运行 Staging preflight" readonly></label></div></div></div>${callout("修复环境配置不会重建 Manifest；回流后继续同一 candidate。","info")}`
}));

screens.push(shell({
  id:"screen-route-compensation-task",active:"delivery",title:`发布单 ${demo.release}`,description:"TARGET CONTRACT · 发布执行人核对 saga、失败节点、补偿命令与回执。",scenario:"Route · Compensation Task",headActions:`${status("补偿任务","danger")}${button("返回列表")}`,
  content:`${taskPanel({eyebrow:"发布执行人任务",title:"完成路由补偿检查",now:"readback 与目标不一致；当前流量指向未证明",why:"补偿必须绑定原 ReleaseRun 与 Route Switch Saga",next:"核对 Provider 状态并执行受管补偿",after:"写入 compensation receipt 后重新评估",action:"开始补偿检查",secondary:"查看 Saga 证据",tone:"danger"})}`
}));

screens.push(shell({
  id:"screen-route-compensation-resolved",active:"delivery",title:`发布单 ${demo.release}`,description:"TARGET CONTRACT · 补偿回执绑定原 ReleaseRun，并回到同一发布单。",scenario:"Route · Compensation Resolved",headActions:`${status("补偿完成","success")}${button("返回列表")}`,
  content:`${taskPanel({eyebrow:"补偿已完成",title:"路由状态已恢复可验证",now:"compensation receipt 已绑定原 Saga",why:"Provider readback 与恢复目标一致",next:"返回原发布单重新读取状态",after:"重新执行 post-deploy 结论，不复用旧证据",action:"返回原发布单",secondary:"查看补偿回执"})}`
}));

document.getElementById("app").innerHTML = screens.join("");
