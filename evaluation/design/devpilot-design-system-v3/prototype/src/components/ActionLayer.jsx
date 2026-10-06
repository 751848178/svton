import { X } from "@phosphor-icons/react";
import { useState } from "react";
import { projectHeader, versionRecords } from "../view-models.js";
import { useDialogFocus } from "../hooks/useDialogFocus.js";
import { Button } from "./ui.jsx";
import { OperationContent } from "./OperationContent.jsx";

const copy = {
  createRelease: ["创建发布", "锁定来源和版本后运行预发阶段。", "创建并运行预发"],
  editDomain: ["配置生产入口", "保存只创建配置修订，生产检查仍需重新运行。", "保存入口草案"],
  rerunPreflight: ["重新运行生产检查", "服务端将重新核对入口、TLS、组件目标与探测结果。", "开始检查"],
  startDeployment: ["开始生产部署", "将复用预发验证通过的同一 Manifest，并创建新的 DeploymentRun。", "确认开始部署"],
  rerunAnalysis: ["重新分析仓库", `新运行会绑定当前 ${projectHeader.branch} 分支与 ${projectHeader.commit} 提交。`, "创建分析运行"],
  switchVersion: ["切换环境版本", "这会创建受审计的发布与部署操作，不会直接改写运行状态。", "创建切换操作"],
  selectEnvironmentVersion: ["切换环境版本", "选择已有版本；确认后创建受审计的发布与部署操作。", "创建切换操作"],
  releaseFilter: ["筛选发布记录", "按环境和状态收敛当前发布列表。", "应用筛选"],
  editConfig: ["编辑环境配置", "保存后生成新的配置修订，发布只读取已确认版本。", "保存配置草案"],
  versionMore: ["版本更多操作", "技术证据和受审计操作保持在版本上下文中。", null],
  component: ["组件详情", "查看本次分析识别的组件事实和审核状态。", null],
  change: ["查看仓库差异", "建议在人工审核前不会写入项目事实。", null],
  notifications: ["通知", "与当前项目和发布相关的运行事件。", null],
  account: ["账户与团队", "当前使用 Acme Lab 团队工作区。", null],
  runLogs: ["部署运行日志", "日志绑定当前 DeploymentRun，并按步骤持续追加。", null],
};

const drawerTypes = new Set(["createRelease", "editDomain", "releaseFilter", "selectEnvironmentVersion", "editConfig", "versionMore", "component", "change", "notifications", "account", "runLogs"]);

export function ActionLayer({ action, close, confirm }) {
  const dialogRef = useDialogFocus(Boolean(action), close);
  const initialVersion = versionRecords.find((item) => item.version !== action?.payload?.currentVersion)?.version ?? versionRecords[0].version;
  const [selectedVersion, setSelectedVersion] = useState(action?.payload?.version ?? initialVersion);
  if (!action) return null;
  const [title, description, confirmLabel] = copy[action.type] ?? ["操作详情", "检查本次操作的影响与结果。", null];
  const drawer = drawerTypes.has(action.type);
  const submittedAction = action.type === "selectEnvironmentVersion" ? { ...action, payload: { ...action.payload, version: selectedVersion } } : action;
  return (
    <div className={`operation-layer ${drawer ? "drawer-mode" : "dialog-mode"}`} role="presentation" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <section ref={dialogRef} className={`operation-panel ${drawer ? "operation-drawer" : "operation-dialog"}`} role="dialog" aria-modal="true" aria-labelledby="operation-title" aria-describedby="operation-description" tabIndex={-1}>
        <header>
          <div>
            <h2 id="operation-title">{title}</h2>
            <p id="operation-description">{description}</p>
          </div>
          <button className="icon-button" onClick={close} aria-label={`关闭${title}`}>
            <X size={19} />
          </button>
        </header>
        <div className="operation-body">
          <OperationContent action={action} selectedVersion={selectedVersion} setSelectedVersion={setSelectedVersion} />
        </div>
        <footer>
          {confirmLabel ? (
            <>
              <Button variant="secondary" onClick={close}>
                取消
              </Button>
              <Button onClick={() => confirm(submittedAction)}>{confirmLabel}</Button>
            </>
          ) : (
            <Button variant="secondary" onClick={close}>
              关闭
            </Button>
          )}
        </footer>
      </section>
    </div>
  );
}
