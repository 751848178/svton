# shipkit 使用手册（实操剧本版）

> 本页保留早期实操记录，部分参数、HTTP 示例和输出已随修复变化。当前操作请使用 [图文使用手册](user-guide.md) 或 [浏览器阅读版](user-guide.html)，不要直接照搬本页的公网 HTTP 引导命令。

> 贯穿示例：把 `demo-web` 部署到你的一台服务器上，以后每次更新只跑 **1 条命令**。
> 所有"你会看到"的输出都摘自 2026-09-29 凌晨的真机验证，不是虚构。

## 全景：整个系统只有 4 样东西

```
你的 Mac(控制器)          一台"构建机"              镜像仓库            一台"运行服务器"
  ship 命令 ──HTTP──>  agent(builder角色) ──push──> ACR/TCR ──pull──> agent(runtime角色)
                        (动态开机用完销毁)                              (常驻,跑你的应用)
```

- 控制器只发 HTTP，**从不 SSH**
- 构建机默认动态创建（按量计费，用一次几毛钱），也可以换成你的一台常驻机器
- 运行服务器装一次 agent，以后再也不用管它

---

## 第一幕：装运行服务器（一次性，约 10 分钟）

**① 在你的 Mac 上：**

```bash
ship serve-bundle --host 203.0.113.10        # ← 换成你 Mac 的公网 IP
```

**你会看到**（安装命令是打印出来给你复制的）：

```
bundle server listening: http://203.0.113.10:7411/3f2a...  (auto-stops in 30 min)
agent token for ship.config.yaml: 9f2c...

runtime machine (run on that machine as root):
  curl -fsSL 'http://203.0.113.10:7411/3f2a.../install.sh?role=runtime&token=9f2c...&port=7410' | bash
```

**② SSH 到运行服务器，root 执行上面那条 curl。你会看到**：

```
[ship-install] package manager: apt
[ship-install] docker ok: Docker version 29.8.1      ← 已有 docker 则直接复用
[ship-install] node ok: v20.18.1
[ship-install] ship-agent healthy on port 7410 (role=runtime)
```

这台机器上发生了什么：装了 docker(已有则跳过)、node20、`/opt/shipkit`(agent 程序) + systemd 服务；数据目录 `/opt/shipkit-data`。**不会动你机器上已有的任何容器。**

**③ 回 Mac 验证**（把②里打印的 token 填进配置后）：

```bash
$ ship doctor
ok   runtime:prod   http://203.0.113.10:7410 role=runtime docker=true
```

---

## 第二幕：写配置（一次性，2 分钟）

新建 `ship.config.yaml`，只有两个必填块（完整模板见 `ship.config.example.yaml`）：

```yaml
registry:
  url: registry.cn-guangzhou.aliyuncs.com   # ← 你的仓库地址
  namespace: myteam                          # ← 仓库里的命名空间

runtime:
  targets:
    prod: { url: 'http://203.0.113.10:7410', token: '9f2c...' }   # ← 第一幕的机器+token

builder:
  mode: dynamic          # 每次构建临时开一台,用完销毁; 不想花钱开机器就改 static
  dynamic:
    provider: tencent
    tencent:             # ← 这些值在腾讯云控制台"私有网络"页各抄一个
      region: ap-guangzhou
      zone: ap-guangzhou-6
      instanceType: SA5.MEDIUM2        # 2核2G,构建小项目够用
      imageId: img-487zeit5            # Ubuntu 22.04
      vpcId / subnetId / securityGroupIds: ...
      advertiseHost: 203.0.113.10
```

使用前 `export TENCENTCLOUD_SECRET_ID=... TENCENTCLOUD_SECRET_KEY=...`。

---

## 第三幕：项目里放一个文件（每个项目 1 分钟）

项目根目录新建 `ship.yaml`（完整示例：`examples/demo-web/ship.yaml`）：

```yaml
name: demo-web          # 镜像名 = 仓库/命名空间/demo-web
ports: ['3000:3000']    # 服务器哪个端口 -> 容器哪个端口
envFile: deploy.env     # 运行时私密变量,部署时直传服务器,不经过构建机
healthcheck: { path: /health, hostPort: 3000, timeoutSeconds: 60 }
```

不用 Dockerfile？写一个 10 行的就够（见 examples/demo-web/Dockerfile）。

---

## 第四幕：日常——其实就 1 条命令

```bash
cd <项目目录> && ship release
```

**你会看到**（真实输出）：

```
INFO creating CVM builder instance {"zone":"ap-guangzhou-6",...}   ← 临时构建机开机
INFO build running   {"jobId":"93eff8de..."}                       ← docker build
INFO push running    {"jobId":"715c6bbe..."}                       ← 推到你的仓库
INFO releasing dynamic builder                                     ← 构建机当场销毁
{ "imageRef": ".../myteam/demo-web:202609290203", "digest": "sha256:5bed4da7..." }
INFO deploying {"app":"demo-web","target":"prod"}
INFO deploy complete
```

**此时世界上发生了什么：**

| 动作 | 耗时 | 花费 |
|---|---|---|
| 构建机开机→构建→推送→销毁 | 全程 ~2 分钟 | 按量计费约几毛钱 |
| 仓库多一个 tag（git sha/时间戳命名） | — | — |
| 运行服务器拉新镜像、compose 切换、健康检查 | ~10 秒 | — |
| 健康检查不过 → **自动恢复上一完整发布**(镜像+env),失败则退出码 6 显式告警 | 自动 | — |

浏览器打开 `http://203.0.113.10:3000/` —— 就是刚部署的应用。

---

## 第五幕：常用变体（按需记）

```bash
ship build                          # 只构建+推送,不部署(想先攒版本)
ship deploy --to staging            # 部署到指定机器(配置里多加一台就叫 staging)
ship deploy --ref <imageRef>        # 部署指定版本(不填默认用上次 build 的)
ship build --from-dir ./app         # 代码还没 commit/git 也能发(打包上传)
ship rollback demo-web              # 回滚: 页面 5xx / 发完发现问题,回到上一完整发布(镜像+env+配置)
ship status                         # 每台机器上每个应用的 当前/上一版本
ship gc                             # 预览可清理镜像(保护回滚引用); 加 --execute 执行
```

## 出问题看哪里（排障路径）

```
ship status                 → 版本对不对?
curl <机器IP>:7410/health   → agent 活着吗? docker 正常吗? (无需 token)
任务报错时: ship status 里的 jobId → curl <机器IP>:7410/api/jobs/<id>/log?tail=50 -H "Authorization: Bearer <token>"
```

## 一页速查

```bash
# ===== 一次性 =====
ship serve-bundle --host <Mac公网IP>    # 打印服务器安装命令,复制去服务器执行
# ===== 每天 =====
ship release                            # 构建+部署,一条命令
ship status                             # 看各机器版本
ship rollback <app>                     # 回滚
# ===== 原则 =====
# 控制器永不 SSH; 密钥走 .env 直传; 健康检查不过自动回滚
```
