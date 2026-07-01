# Devpilot 项目纳管、Webhook 与站点管控演进 — 总览

> 本文件是产品判断与接入形态的总览,**几乎不变**,首次进入项目时读一次即可。
> 进度信息不要写在这里,统一放 `progress/`。
> 路线骨架见 `05-phases.md`,竞品见 `03-competitors.md`,缺口见 `04-gaps.md`。

## 1. 本次产品判断

`Project` 不应该只代表"由 Devpilot 初始化生成的新项目",而应该是一个项目管控容器。它可以有三种来源:

| 来源 | 含义 | 是否必须有技术栈 | 是否必须初始化 |
| --- | --- | --- | --- |
| `generated` | 通过 Devpilot 向导生成的新项目 | 是,来自生成器配置 | 是 |
| `imported` | 已有 Git 仓库或已有部署接入纳管 | 否,可后补或自动检测 | 否 |
| `external` | 只作为服务器、站点、云资源的归属容器 | 否 | 否 |

当前第一步已经按这个方向打开:已有项目可以通过 `/projects/import` 接入,不再强制绑定技术栈、子项目或初始化器;仅构建部署项目也可以保存部署配置,并在详情页生成 dry-run 部署执行计划。

项目来源只说明项目从哪里来,不能完整表达用户想让 Devpilot 管什么。因此新增 `managementScope` 作为管理范围:

| 管理范围 | 含义 | 典型场景 |
| --- | --- | --- |
| `full` | 项目完整纳管 | 项目既要关联仓库,也要逐步绑定服务器、站点、数据库、云资源和 Webhook |
| `deployment` | 仅构建部署 | 项目只希望接入仓库、构建命令、部署命令、部署目标和健康检查 |
| `resources` | 资源归属 | 项目不关心代码,只作为服务器、站点、云资源、密钥的归属容器 |

## 2. 已有项目接入的产品形态

已有项目接入不应该复用"创建新项目"的完整向导,而应该是一条轻量路径:

1. 选择接入方式:已有代码项目、仅构建部署或外部管控项目。
2. 填写基础信息:项目名、描述、默认环境。
3. 可选填写仓库信息:Git Provider、仓库地址、默认分支。
4. 可选填写技术栈:语言、框架、包管理器。
5. 若管理范围包含部署,填写部署目标、工作目录、构建命令、部署命令、健康检查地址。
6. 保存后进入项目详情,再按管理范围逐步绑定部署、服务器、Docker、数据库、Redis、RDS、SLS、COS、域名、证书、CDN、密钥。

这个流程的关键是"先纳管,再补齐",避免因为技术栈不清楚、初始化配置不存在,就无法把线上项目纳入 Devpilot。

仅构建部署场景要被正式支持,而不是隐藏在完整纳管里。它的第一阶段数据形态如下:

```json
{
  "origin": "imported",
  "managementScope": "deployment",
  "source": {
    "type": "git",
    "provider": "github",
    "repository": "https://github.com/acme/app",
    "branch": "main"
  },
  "deployment": {
    "enabled": true,
    "targetType": "docker-compose",
    "workingDirectory": "/srv/apps/acme-app",
    "buildCommand": "pnpm build",
    "deployCommand": "docker compose up -d --build",
    "rollbackCommand": "docker compose up -d",
    "healthCheckUrl": "https://example.com/health"
  }
}
```
