import { ArrowRight, CheckCircle, CircleNotch, Clock, Pulse, TerminalWindow } from "@phosphor-icons/react";
import { deploymentRows, pendingDeploymentRow } from "../view-models.js";
import { DataTableSurface } from "../components/DataTable.jsx";
import { Button, ProgressLine, ScreenTitle, Status } from "../components/ui.jsx";

export function DeploymentsScreen({ openDrawer, openAction, deploymentStarted }) {
  const rows = deploymentStarted ? [pendingDeploymentRow, ...deploymentRows] : deploymentRows;
  return (
    <>
      <ScreenTitle
        title="部署记录"
        description="运行进度、日志、验证和恢复证据绑定到同一次 DeploymentRun。"
        actions={
          deploymentStarted && (
            <Button variant="secondary" onClick={() => openDrawer("verified")}>
              <Pulse size={16} />
              查看验证
            </Button>
          )
        }
      />

      {deploymentStarted && (
        <section className="running-deployment">
          <div className="running-head">
            <span className="running-icon">
              <CircleNotch size={23} weight="bold" className="spin" />
            </span>
            <div>
              <span>
                {pendingDeploymentRow.environment} · {pendingDeploymentRow.id}
              </span>
              <h3>
                {pendingDeploymentRow.name} {pendingDeploymentRow.version} 正在发布
              </h3>
              <p>复用预发通过的 Manifest · {pendingDeploymentRow.manifestId}</p>
            </div>
            <Status value="running">部署中 · {pendingDeploymentRow.duration}</Status>
          </div>
          <ProgressLine value={68} />
          <div className="run-stages">
            <RunStage icon={CheckCircle} label="准备目标" meta="server-01" done />
            <RunStage icon={CheckCircle} label="拉取制品" meta="42b8…c19e" done />
            <RunStage icon={CircleNotch} label="启动服务" meta="2/3 组件就绪" active />
            <RunStage icon={Clock} label="入口验证" meta="等待服务就绪" />
          </div>
          <div className="run-actions">
            <button className="text-action" onClick={() => openAction("runLogs")}>
              <TerminalWindow size={16} />
              查看运行日志
            </button>
            <button className="text-action" onClick={() => openDrawer("verified")}>
              查看验证计划 <ArrowRight size={15} />
            </button>
          </div>
        </section>
      )}

      <DataTableSurface title="部署运行" meta="生产与预发环境的真实运行历史" columns={["运行", "版本", "环境", "状态", "耗时", "发起人", "操作"]} tableClassName="deployment-table">
        {rows.map((row) => (
          <tr key={row.id}>
            <td>
              <button className="table-link mono" onClick={() => openDrawer(row.status === "running" ? "verified" : "manifest")}>
                {row.id}
              </button>
            </td>
            <td className="mono">{row.version}</td>
            <td>{row.environment}</td>
            <td>
              <Status value={row.status === "running" ? "running" : "success"}>{row.status === "running" ? "部署中" : "成功"}</Status>
            </td>
            <td className="mono">{row.duration}</td>
            <td>{row.actor}</td>
            <td>
              <button className="table-action" onClick={() => openDrawer(row.status === "running" ? "verified" : "manifest")}>
                查看证据 <ArrowRight size={14} />
              </button>
            </td>
          </tr>
        ))}
      </DataTableSurface>
    </>
  );
}

function RunStage({ icon: Icon, label, meta, done, active }) {
  return (
    <div className={done ? "done" : active ? "active" : ""}>
      <span>
        <Icon size={18} weight={done || active ? "fill" : "regular"} />
      </span>
      <strong>{label}</strong>
      <small>{meta}</small>
    </div>
  );
}
