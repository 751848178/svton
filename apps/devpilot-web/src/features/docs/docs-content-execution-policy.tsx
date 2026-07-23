/**
 * 文档正文（TSX）— 执行策略
 *
 * 内容来自 issue-17 研究报告第五节草稿，四节结构对齐 twgg 文档风格：
 * 页面介绍 / 何时配置 / 操作步骤 / 字段说明 / 判定规则 / 模块关联 / 常见误解。
 *
 * 关键：纠正「执行策略 = 入队/立即执行」的误解 —— 它是命令 allow/block 正则模板，
 * 入队/立即执行是「执行治理」模块的概念。
 *
 * 单一职责：渲染这一篇文档的正文 JSX。无 props、无状态。
 */

export function DocsContentExecutionPolicy() {
  return (
    <article className="space-y-8 text-sm leading-relaxed text-foreground/90">
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">页面介绍</h2>
        <p>
          「执行策略」用来管理<strong>服务器命令的白名单与黑名单模板</strong>。在平台向服务器下发命令之前，系统会按这些模板逐条匹配命令，决定该命令是<strong>放行</strong>还是<strong>阻断</strong>。可以把它理解成「服务器执行的命令级安全闸门」：默认危险命令会被内置规则挡下，你也可以在这里追加团队/项目/环境级别的自定义允许或阻断规则。
        </p>
        <blockquote className="border-l-4 border-primary/40 bg-muted/40 px-4 py-2 text-muted-foreground">
          一句话：执行策略管的是「这条命令能不能跑」，不是「这条命令什么时候跑」。
        </blockquote>
        <p>
          本页面展示当前团队下所有策略模板，并提供模板的<strong>新建、编辑、启停、删除</strong>，以及顶部的统计指标（模板总数 / 已启用 / 有作用域 / 阻断规则数 / 允许规则数）。
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">什么时候需要配置</h2>
        <ul className="list-disc space-y-1 pl-6">
          <li>想在<strong>生产环境</strong>禁止执行某些高风险命令（如 <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">docker exec ... sh</code>、<code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">rm -rf</code>）。</li>
          <li>想让某些命令<strong>只在特定项目或特定环境</strong>下被允许，其他地方默认不放行。</li>
          <li>团队需要在平台默认危险命令清单之外，补充自定义的合规要求。</li>
        </ul>
        <p className="text-muted-foreground">
          如果你只是想看「任务在排队还是已经在跑」，请改用 <strong>执行治理（execution-governance）</strong> 页面 —— 那是队列与租约的观测入口，与本页职责不同（见文末「常见误解」）。
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">操作步骤</h2>
        <ol className="list-decimal space-y-1 pl-6">
          <li>进入「执行策略」页面，查看现有模板列表。</li>
          <li>点击右上角「新建模板」打开新建表单。</li>
          <li>填写模板名称（必填），例如「生产命令白名单」。</li>
          <li>选择<strong>作用域</strong>：项目、环境都留空 = <strong>团队全局</strong>；只选项目 = 对该项目下所有环境生效；选到具体环境 = 仅对该环境生效。</li>
          <li>填写<strong>适配器键 / 操作键</strong>（逗号分隔，留空 = 匹配全部），用来把模板限定在某类执行场景，例如 <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">deployment-script-plan</code> 适配器、<code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">deploy</code> 操作。</li>
          <li>在<strong>允许模式</strong>里逐行填写要放行的命令正则（如 <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">^docker ps .*</code>）。</li>
          <li>在<strong>阻断模式</strong>里逐行填写要禁止的命令正则（如 <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">^docker exec .* sh</code>）。</li>
          <li>设置<strong>优先级</strong>（数字越大越优先；多模板同时命中时按优先级排序）。</li>
          <li>勾选「启用模板」并保存。</li>
          <li>如需临时停用，在列表里点该模板的「停用」即可（停用后不再参与匹配，但模板保留）。</li>
        </ol>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">字段说明</h2>
        <ul className="list-disc space-y-1 pl-6">
          <li><strong>名称 / 描述</strong>：模板的人类可读标识与用途说明。</li>
          <li><strong>启用状态</strong>：关闭的模板不会被加载，等于「这条策略暂时不生效」。</li>
          <li><strong>优先级</strong>：多模板命中同一作用域时的判定顺序（卡片上以 <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">P{'{优先级}'}</code> 显示）。</li>
          <li><strong>作用域（项目 / 环境）</strong>：决定模板在哪些范围内参与匹配。卡片标签会显示「团队全局 / 项目 X / 环境 Y」。</li>
          <li><strong>适配器键 / 操作键</strong>：限定模板只对特定的执行适配器与操作生效；留空表示对该维度不做限制。</li>
          <li><strong>允许模式（allowedPatterns）</strong>：每行一条正则，命中则放行。</li>
          <li><strong>阻断模式（blockedPatterns）</strong>：每行一条正则，命中则阻断，阻断原因会回传给执行日志。</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">判定规则</h2>
        <p>系统对一次执行里的每一条命令，按以下顺序判定：</p>
        <ol className="list-decimal space-y-1 pl-6">
          <li>命令为空 → 放行（交由执行器自身的可执行性检查处理）。</li>
          <li>命中平台<strong>内置危险命令清单</strong> → 直接阻断。</li>
          <li>命中任一<strong>启用模板</strong>的<strong>阻断模式</strong> → 阻断，并标注是哪个模板挡下的。</li>
          <li>其余情况 → 按内置规则 / 允许匹配放行。</li>
        </ol>
        <p>
          只要一次执行中有<strong>任意一条</strong>命令被阻断，整次执行的策略结果就是「已阻断（blocked）」，并带上所有阻断原因。
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">模块关联</h2>
        <ul className="list-disc space-y-1 pl-6">
          <li><strong>读取</strong>：模板作用域依赖「项目」与「环境」档案；适配器键 / 操作键对应各执行适配器注册的能力。</li>
          <li><strong>影响</strong>：策略结果会被「服务器执行器」在真正下发命令前消费；被阻断的执行不会进入实际运行。</li>
          <li><strong>受约束</strong>：模板按 teamId 隔离；删除项目 / 环境会级联删除其下的模板。</li>
          <li><strong>配套观测</strong>：被放行的任务进入执行后，其排队 / 运行 / 租约状态由「执行治理」页面展示。</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">常见误解</h2>
        <ul className="list-disc space-y-2 pl-6">
          <li><strong>「执行策略 = 让任务排队执行」—— 不是。</strong> 排队（入队）vs 立即执行是「执行治理 / 任务队列」的概念（任务的 <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">queueMode</code>）。本页只决定命令<strong>能不能</strong>跑，不决定它<strong>什么时候</strong>跑。</li>
          <li><strong>「关闭某个模板 = 队列立即执行」—— 不是。</strong> 关闭模板只是让它的允许/阻断规则不再参与匹配，不影响任务调度方式。</li>
          <li><strong>「允许模式留空 = 全部阻断」—— 不是。</strong> 留空表示对该维度不额外限制；是否阻断仍取决于内置危险命令清单与各模板的阻断模式。</li>
        </ul>
      </section>
    </article>
  );
}
