# E2E 阻塞记录 (2026-09-28)

## 现象
- API: SecretId/SecretKey 在 cvm.tencentcloudapi.com 与 cvm.intl.tencentcloudapi.com 均返回
  AuthFailure.SecretIdNotFound（签名链路正常，是密钥 ID 不被账号体系识别）
- 凭证字节检查干净（36/32 字符，无隐形字符）
- 控制台: ego-browser 打开 console.cloud.tencent.com 跳转登录页（未登录态）

## 推测
- 密钥已超过 90 天未使用被平台自动禁用（登录页公告），或复制时有误

## 已完成的准备工作（密钥修复后可立即执行）
- install.sh 强化: 腾讯内网 docker-ce 源 / npmmirror node20 tarball 兜底 / TARBALL 本地包 / SHIP_PUSH_* 透传
- provider 强化: installUrl(自托管引导源) + preInstallScript(cloud-init 预置 daemon.json)
- tencent.ts 修复 SDK ESM 互操作(cvm.v20170312.Client + 纯对象凭证)
- 28/28 单测全绿; SSH expect 助手与探测脚本就绪
- 云上未创建任何资源，无需清理

## 恢复路径（二选一）
1. 控制台-访问管理-API密钥管理: 确认/新建密钥发我 → 全自动 API 路径
2. 傲驰浏览器已打开登录页(微信扫码) → 扫码后告知 → 走控制台创建路径
