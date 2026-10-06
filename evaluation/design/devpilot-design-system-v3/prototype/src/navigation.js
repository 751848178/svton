import { Archive, BookmarkSimple, BookOpen, CheckSquare, Database, FilePlus, FileMagnifyingGlass, FolderPlus, FolderSimple, Gauge, GitBranch, Globe, HardDrives, House, Key, Lightning, ListChecks, Pulse, Scroll, ShieldCheck, ShieldWarning, SquaresFour, Stack, Tag, Users } from "@phosphor-icons/react";

/** Mirrors apps/devpilot-web/src/components/layout/navigation-items.ts. */
export const globalNavigation = [section("仪表盘", [item("仪表盘", House)]), section("项目", [item("我的项目", FolderSimple, "directory"), item("创建项目", FolderPlus), item("应用服务", SquaresFour)]), section("基础设施", [item("服务器", HardDrives), item("站点", Globe), item("CDN 配置管理", Lightning)]), section("资源", [item("申请资源", FilePlus), item("我的资源实例", Database), item("资源操作", Gauge), item("资源连接（高级）", Key), item("密钥中心", ShieldCheck)]), section("运维", [item("监控告警", Pulse), item("日志中心", Scroll), item("备份计划", Archive)]), section("治理", [item("命令执行策略", ShieldCheck), item("访问策略", ShieldWarning), item("操作审批", CheckSquare), item("任务队列治理", ListChecks), item("审计事件", FileMagnifyingGlass)]), section("配置", [item("配置预设", BookmarkSimple), item("Git 集成", GitBranch)]), section("团队", [item("团队管理", Users)]), section("管理", [item("资源池", Stack), item("资源类型", Tag)]), section("帮助", [item("平台文档", BookOpen)])];

function section(label, items) {
  return { label, items };
}

function item(label, icon, screen) {
  return { label, icon, screen };
}
