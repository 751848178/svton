import { ArrowRight, Funnel, MagnifyingGlass, Plus } from "@phosphor-icons/react";
import { useState } from "react";
import { releaseRows } from "../view-models.js";
import { DataTableSurface } from "../components/DataTable.jsx";
import { Button, ScreenTitle, Status } from "../components/ui.jsx";

export function ReleasesScreen({ openAction, openRelease, go, embedded = false }) {
  const [query, setQuery] = useState("");
  const rows = releaseRows.filter((row) => `${row.name} ${row.version} ${row.id}`.toLowerCase().includes(query.toLowerCase()));
  return (
    <>
      {!embedded && <ScreenTitle
        title="发布"
        description="发布单把来源、版本、策略、制品与环境阶段保留在同一条可审计记录中。"
        actions={
          <Button onClick={() => openAction("createRelease")}>
            <Plus size={16} />
            创建发布
          </Button>
        }
      />}

      <DataTableSurface
        title={embedded ? undefined : "发布记录"}
        meta={embedded ? undefined : `共 ${rows.length} 条`}
        columns={["版本", "状态", "来源", "当前阶段", "最近更新", "操作"]}
        tableClassName="releases-table"
        actions={
          <div className="table-tools">
            <label>
              <MagnifyingGlass size={15} />
              <input aria-label="搜索发布" placeholder="搜索版本或 ID" value={query} onChange={(e) => setQuery(e.target.value)} />
            </label>
            <span>共 {rows.length} 条</span>
            <button onClick={() => go("deployments")}>查看部署记录</button>
          </div>
        }
      >
        {rows.map((row) => (
          <tr key={row.id} className="clickable-row" onClick={() => openRelease(row.id)}>
            <td>
              <button
                className="release-name"
                aria-label={`打开发布 ${row.id} 详情`}
                onClick={(event) => {
                  event.stopPropagation();
                  openRelease(row.id);
                }}
              >
                <strong>
                  {row.name} {row.version}
                </strong>
                <small>{row.id}</small>
              </button>
            </td>
            <td>
              <Status value={row.status}>{row.status === "blocked" ? "已阻断" : "成功"}</Status>
            </td>
            <td className="mono">{row.source}</td>
            <td>{row.stage}</td>
            <td>{row.updated}</td>
            <td>
              <button
                className="table-action"
                onClick={(event) => {
                  event.stopPropagation();
                  openRelease(row.id);
                }}
              >
                查看详情 <ArrowRight size={14} />
              </button>
            </td>
          </tr>
        ))}
        {rows.length === 0 && <tr><td colSpan={6}>没有匹配的发布记录</td></tr>}
      </DataTableSurface>
    </>
  );
}
