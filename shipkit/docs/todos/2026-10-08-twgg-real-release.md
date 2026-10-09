# TWGG 真实平台发布

路由：direct。用户选择已提交的 c788de3，并授权继续浏览器验收。

- done：登记干净 HEAD 快照，复用 prod 私有配置及原部署身份。
- done：运行 Agent 事务升级，凭据保留，七个业务容器身份未变。
- done：48 表、5 迁移、14 业务指纹基线及私有完整数据库备份。
- done：平台 build/push 每任务超时设为 20 分钟，与 TWGG 原发布入口一致；部署和回滚仍为 60 分钟。180 分钟云兜底预算及执行器回归 8/8；重建并重启无活动任务的平台。
- done：平台真实发布 backend/admin/mobile；任务 cmuzi71n00004x84w03xr4xtu 成功，release muzihzxx-64466737，运行端版本与任务一致。临时实例 ins-00ky8l5u 及定时器均按精确 ID 回读为已删除。
- done：数据库、受保护容器、归档权限比对通过；HTTP/API 16/16，浏览器平台结果与管理端三条实际库存通过。H5 缓存登录刷新只显示日期和退出，独立源码核对确认是用户所选 c788de3 已有的初始上下文加载缺陷，记录为该版本的产品问题；本轮没有更改用户指定的 TWGG 源码。

源码责任：platform/execute-task.ts 是执行编排层，向 CLI 管线传递任务期限；CLI 管线计算整轮租约预算，provider 在创建实例前校验定时销毁覆盖。依赖方向保持 platform → CLI → provider。

首轮 cmuzhxl1n000cygtyr5b71eg5 在创建实例前因 60 分钟单任务期限导致 375+38 分钟预算而失败，未切换应用。保留 maxLifetimeMinutes=180；20 分钟期限对应 135+38=173 分钟预算。
