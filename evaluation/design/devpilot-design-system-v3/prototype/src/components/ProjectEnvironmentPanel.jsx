import { environmentVersions, versionRecords } from "../view-models.js";
import { DataTableSurface } from "./DataTable.jsx";
import { Status } from "./ui.jsx";

export function EnvironmentVersions({ openAction, openVersionConfig }) {
  return (
    <DataTableSurface className="overview-section" label="环境运行版本" columns={["环境", "当前运行版本", "来源", "最近部署", "状态", "操作"]} tableClassName="environment-versions-table">
      {Object.entries(environmentVersions).map(([environment, current]) => {
        const record = versionRecords.find((item) => item.version === current.version);
        return (
          <tr key={environment}>
            <td>
              <strong>{current.label}</strong>
            </td>
            <td>
              <span className="version-cell">
                <b className="mono">{current.version}</b>
                {record?.name ?? "—"}
              </span>
            </td>
            <td className="mono">{current.source}</td>
            <td>{current.deployedAt}</td>
            <td>
              <Status value="success">{current.status}</Status>
            </td>
            <td>
              <span className="table-actions">
                <button
                  className="table-action"
                  onClick={() =>
                    openAction("selectEnvironmentVersion", {
                      environment,
                      currentVersion: current.version,
                    })
                  }
                >
                  切换版本
                </button>
                <button className="table-action" onClick={() => openVersionConfig(environment)}>
                  版本配置
                </button>
              </span>
            </td>
          </tr>
        );
      })}
    </DataTableSurface>
  );
}
