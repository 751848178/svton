# 仓库项目与运行配置版本

此说明对应本轮两个模块。配置版本的保存和冻结不会修改线上容器；只有执行发布任务才生效。

## 部署准备

先停止平台进程，备份 SQLite 与归档日志，运行已有 `prisma:migrate`。旧目录项目、任务和发布记录保持原身份；不要把目录项目直接改成仓库身份。升级 Runtime/Builder Agent 到本轮版本，Runtime 需要 `group-config-ref-v1` 能力才能记录配置版本。

平台服务的私密 EnvironmentFile 新增 `SHIPKIT_SECRET_KEY_FILE`，值为绝对路径。首次使用新秘密模块时，显式初始化：

```sh
SHIPKIT_DATA_DIR=/absolute/platform-data \
SHIPKIT_SECRET_KEY_FILE=/absolute/private/keys/key.json \
pnpm --filter @svton/shipkit-api secret:init
```

命令只创建不存在的密钥文件，权限为 0600。已有配置或仓库凭据密文但密钥丢失时，命令会拒绝生成替代密钥；应恢复原密钥。平台数据库只保存密文，密钥必须独立安全备份，恢复时一起演练。Runtime 的运行 env 与回滚快照仍有 0600 明文文件，也需要独立保护与备份。

## Git 仓库接入

在“项目 → 接入项目”选择 Git 仓库，填写 HTTPS 地址、分支/标签/提交、定义路径（默认 `ship.yaml`）和平台服务器上的连接配置路径。公开仓库无需 token；私有仓库使用只读 token，保存后页面只显示已配置状态。仓库内连接文件不会覆盖平台连接 profile。

GitHub/GitLab 的元数据 API 需要同时具备仓库读取与 API 读取能力的访问令牌。GitLab deploy token 只读取 Git、不能访问公开 REST API，应选择 generic 并填写它的访问用户名。Gitea 使用账号用户名配合令牌；用户名也作为私密凭据保存，不进入仓库 URL。依据：[GitLab deploy tokens](https://docs.gitlab.com/user/project/deploy_tokens/)、[GitLab personal access tokens](https://docs.gitlab.com/user/profile/personal_access_tokens/)、[GitHub personal access tokens](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)。

平台只读取固定提交与发布定义。GitHub、GitLab、Gitea 使用元数据 API；generic HTTPS Git 使用独立临时目录，限制时间/大小并在结束后清理。完整源码由 Builder Agent 拉取。无需在平台服务器长期保存业务项目或提前 clone。

平台与 Builder 的服务环境均配置 `SHIPKIT_GIT_ALLOWED_HOSTS`（默认 github.com、gitlab.com）。自建服务需添加准确主机名；只有管理员还配置 `SHIPKIT_GIT_ALLOW_PRIVATE_HOSTS` 时才允许该主机解析到私网。使用正常可信 HTTPS；不要关闭 TLS 校验。

在“项目 → 连接与配置 → 仓库”维护默认 ref、定义路径或凭据。更新会保留已登记服务并登记定义中的新服务；服务删除与应用名改变需要显式迁移。先预览再保存，分支在两次操作之间变化会要求重新核对。

发布时临时选择其他 ref 适用于相同的服务结构；该 ref 新增服务时，先在仓库设置预览并保存以登记服务，再创建发布计划。

首期范围：HTTPS Git，分支/标签/commit，多服务 schemaVersion 2 和仓库相对路径。不支持 SSH Git、OAuth 安装、Webhook 自动发布、submodule 或 LFS。

## 运行配置版本

在“项目 → 连接与配置 → 环境变量”选择已有运行目标，创建草稿。公共变量与服务覆盖在冻结时合并；每个服务必须有完整配置，或明确选择“无需变量”。秘密值保存后不返回明文；省略值表示保留，删除需要显式操作。

冻结为 `x.y.z` 后不可修改。修改从版本创建新草稿；归档后禁止创建新计划，已有任务和历史回滚仍保留原绑定。配置版本与发布版本分别编号。

发布时明确选择“应用配置版本 / 继承当前配置 / 旧文件”。Git 项目不读取仓库里的运行秘密。配置版本需要覆盖本次选中的全部服务；未选服务完整继承当前镜像、定义、来源与配置。

“仅更新运行配置”复用当前摘要镜像与服务定义，跳过构建机、构建、推送和释放阶段，仍执行健康检查、任务审计与回滚快照。首次部署或来源不明的镜像不可用；该模式不读取最新 Git ref。

运行配置不会修改前端镜像中构建时固化的 `NEXT_PUBLIC_*` / `VITE_*` 等值。这类修改需要重新构建；本轮没有新增秘密 buildArgs 注入。

## 验收与恢复

仓库、配置版本及启用密钥后的目录计划会固定源码/定义、连接快照及配置输入，私密正文加密存储。执行及重启对账沿旧快照工作；配置文件修改或新冻结版本不会改变这些任务。旧目录计划继续走原兼容路径；运行基线或仓库设置修订改变会阻止不适用的旧计划。

TLS CA 文件和腾讯云环境凭据目前使用可信摘要固定；变动时拒绝执行、对账或释放旧任务，需恢复原材料或为新发布重新核对。平台不会在任务中自动切换控制身份；已有云资源仍按原 leaseRef 处理。

故障恢复需要平台 DB、正确历史密钥和 Runtime 回滚快照；仅恢复 DB 不代表业务容器或业务数据库已恢复。本轮开发验收使用隔离数据库、HTTPS Git fixture 与本机 Docker，正式环境发布需选定目标另行执行。

隔离验收可重复执行，需本机 Git/OpenSSL 与可用 Docker：

```sh
pnpm --filter shipkit build
node shipkit/scripts/git-source-acceptance.mjs
node shipkit/scripts/runtime-config-acceptance.mjs
```

脚本在临时目录和随机端口运行，使用测试凭据，结束后清理临时 Git 服务、Agent 与容器。摘要默认写入 `/tmp/codex-tool-runs/svton/git-config/`，可通过 `SHIPKIT_ACCEPTANCE_OUTPUT_DIR` 指定。Runtime fixture 使用公开 nginx 摘要镜像与明确的测试来源；该检查证明配置发布与恢复，不作为业务 Git 镜像构建后发布的全链路证明。
