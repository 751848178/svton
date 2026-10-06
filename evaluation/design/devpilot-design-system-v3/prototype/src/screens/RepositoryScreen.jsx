import { ArrowLeft, ArrowRight, CheckCircle, GitCommit, GitDiff, Play, WarningCircle } from "@phosphor-icons/react";
import { repositoryAnalysisRun } from "../data.js";
import { components, repositorySuggestionRows } from "../view-models.js";
import { DataTableSurface } from "../components/DataTable.jsx";
import { Button, ScreenTitle, SectionHeading, Status } from "../components/ui.jsx";

export function RepositoryScreen({ go, openDrawer, openAction }) {
  return (
    <>
      <ScreenTitle
        title="仓库接入与分析"
        description="每次分析绑定明确分支与提交；审核后的差异才会更新项目事实。"
        actions={
          <Button variant="secondary" onClick={() => openAction("rerunAnalysis")}>
            <Play size={16} />
            重新分析
          </Button>
        }
      />

      <section className="analysis-summary">
        <div>
          <span className="analysis-mark">
            <CheckCircle size={23} weight="fill" />
          </span>
          <div>
            <strong>分析完成，识别到 {components.length} 个组件</strong>
            <p>
              {repositoryAnalysisRun.branch} · {repositoryAnalysisRun.commitSha.slice(0, 8)} · {repositoryAnalysisRun.createdAt.slice(0, 16).replace("T", " ")}
            </p>
          </div>
        </div>
        <button className="text-action" onClick={() => openDrawer("commit")}>
          查看分析证据 <ArrowRight size={15} />
        </button>
      </section>

      <DataTableSurface title="项目组件" meta="审核中的建议不会静默修改当前配置。" columns={["组件", "路径", "运行时", "端口", "本次变化", "状态", "操作"]} tableClassName="components-table">
        {components.map((item) => {
          const suggestion = repositorySuggestionRows.find((candidate) => candidate.name === item.name);
          return (
            <tr key={item.id}>
              <td>
                <button className="table-link" onClick={() => openAction("component", item)}>
                  {item.name}
                </button>
              </td>
              <td className="mono">{item.path}</td>
              <td>{item.runtime}</td>
              <td className="mono">{item.port}</td>
              <td>
                <span className="cell-detail">
                  <GitDiff size={15} />
                  {suggestion?.change ?? item.change}
                </span>
              </td>
              <td>
                <Status value={suggestion ? "warning" : "success"}>{suggestion ? "待审核" : "已确认"}</Status>
              </td>
              <td>
                <button
                  className="table-action"
                  onClick={() =>
                    openAction("component", {
                      ...item,
                      change: suggestion?.change ?? item.change,
                    })
                  }
                >
                  查看组件
                </button>
              </td>
            </tr>
          );
        })}
      </DataTableSurface>

      <div className="two-column-detail">
        <section className="surface change-review">
          <SectionHeading title="待审核变化" meta="2 项来自本次仓库分析" />
          {repositorySuggestionRows.map((item) => (
            <div className="change-row" key={item.id}>
              <span>
                <WarningCircle size={18} />
              </span>
              <div>
                <strong>{item.name} · 配置建议</strong>
                <p>{item.change}</p>
              </div>
              <button onClick={() => openAction("change")}>查看差异</button>
            </div>
          ))}
        </section>
        <section className="surface source-facts">
          <SectionHeading title="分析来源" />
          <dl>
            <dt>分支</dt>
            <dd>{repositoryAnalysisRun.branch}</dd>
            <dt>提交</dt>
            <dd className="mono">
              <GitCommit size={14} />
              {repositoryAnalysisRun.commitSha}
            </dd>
            <dt>运行状态</dt>
            <dd>已完成</dd>
            <dt>运行 ID</dt>
            <dd className="mono">{repositoryAnalysisRun.id}</dd>
          </dl>
        </section>
      </div>

      <button className="back-action" onClick={() => go("overview")}>
        <ArrowLeft size={15} />
        返回项目信息
      </button>
    </>
  );
}
