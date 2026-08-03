# Devpilot V13 Project Delivery User Guide / 项目交付用户指南

## 中文

### 1. 先记住六个对象

| 中文术语 | English | 用户含义 |
|---|---|---|
| 项目 | Project | 仓库识别、环境、资源和交付历史的长期边界。 |
| 发布单 | Release order | 一个发布版本号的工作容器；创建发布单不会自动构建或部署。 |
| 构建运行 | BuildRun | 服务端解析受信分支并锁定精确 Commit 后的一次独立构建。 |
| 制品清单 | Artifact Manifest | 成功 BuildRun 产生的不可变制品及 Digest；后续环境只消费它。 |
| 发布运行 | ReleaseRun | Production 冻结 Manifest、配置、策略与审批输入后形成的受控运行。 |
| 环境版本 | EnvironmentVersion | 一次成功 DeploymentRun 派生的只追加版本记录和 current 指针。 |

“发布单”不是旧的“发布计划”。“发布版本号”是用户输入的版本标识；Build #N 是同一发布单下独立递增的构建编号，二者不能混称。

### 2. 日常标准发布

1. 在项目目录进入项目；普通入口默认显示发布单和环境版本。
2. 新建发布单时只填写唯一发布版本号和可选说明。
3. 在“构建制品”触发 Build。每次点击都创建新的 BuildRun；失败运行不会产生伪造 Manifest。
4. 在“预发发布”选择某个成功 Build 的精确 Manifest。重复部署会创建新的 DeploymentRun，不重新 checkout、pull 或 build。
5. Production 只接受同一项目、同一发布单、已在 Staging 成功部署的同一 Manifest。确认页会冻结环境、版本号、Build/Commit、Manifest/Digest、配置和发布策略。
6. 审批通过后才执行 Production；成功后追加 EnvironmentVersion。升级和回退也创建新运行，不改写旧版本。

### 3. 管理项目

“管理项目”承载低频设置：仓库与识别、环境、资源、Webhook、发布策略和项目资料。环境配置每次保存创建不可变修订；Secret 只保存引用，不把明文写入配置快照、门禁证据或日志。

当前唯一可执行策略是“标准发布”。金丝雀、蓝绿和自动放量会显示“能力未就绪”以及缺失的真实流量、双工作负载、指标分析、暂停/终止和自动回滚 Provider；这些状态不是功能开关，也不会被人工证据伪装成技术通过。

### 4. 门禁状态

- `已检查 / checked`：真实 Provider 证据仍新鲜并得出通过结论。
- `阻断 / blocked`：真实证据得出失败结论。
- `未检查 / unchecked`：存在检查路径，但证据缺失、过期或仍待结论。
- `需人工 / manual`：只能记录人工业务判断，不能替代技术门禁。
- `不适用 / not_applicable`：有明确规则证明当前目标不适用。
- `不可用 / unavailable`：没有真实 Provider；绝不视为通过。

缺失或过期证据不会通过。业务验证可以作为证据保留，但不会替代 Manifest、审批、DNS/TLS/HTTP、可观测性或恢复兼容性等技术结论。

### 5. 历史、归档和兼容

旧部署深链保留为专业只读视图。缺少 Manifest 证明的旧运行标记为 `legacy_unverified`；即使旧结果里出现类似 Digest 的文本，也不会合成 ArtifactManifest。受管项目的旧 branch/commit 部署入口会被服务端拒绝。

“归档项目”不会物理删除数据：项目、环境和应用停止新写入，已有发布单、BuildRun、Manifest、ReleaseRun、DeploymentRun、EnvironmentVersion、审计和日志继续保留。归档不是回退，恢复生产版本请使用环境版本里的受控 recovery。

## English quick reference

1. A release order contains a user-visible release version; creating it performs no build or deployment.
2. Every build creates an independent BuildRun and, only on success, an immutable Artifact Manifest.
3. Staging and Production consume the exact persisted Manifest. Deployment never checks out, pulls, or builds source.
4. Production freezes environment, release version, Build/Commit, Manifest/Digest, configuration and release-policy revision into one approval hash.
5. Successful deployment appends an EnvironmentVersion. Upgrade and recovery create new runs and never rewrite history.
6. Standard release is executable. Canary, blue-green and automatic traffic ramp remain unavailable until real traffic, metrics, pause/abort and rollback providers exist.
7. Archived projects and legacy deployment links remain read-only and auditable; unproven legacy digests never become synthetic Manifests.

