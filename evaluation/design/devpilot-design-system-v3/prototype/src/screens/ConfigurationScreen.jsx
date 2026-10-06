import { DotsThree, GitCommit } from "@phosphor-icons/react";
import { useState } from "react";
import { DomainsScreen } from "./DomainsScreen.jsx";
import { configSections } from "../data.js";
import { environmentVersions, versionRecords } from "../view-models.js";
import { DataTableSurface } from "../components/DataTable.jsx";
import { KeyValue, ScreenTitle, SectionHeading, Status } from "../components/ui.jsx";

const genericConfigs = {
  targets: {
    title: "部署目标",
    description: "当前环境使用 server-01，通过 Docker Compose 部署到 /srv/picshare。",
    columns: ["目标", "方式", "目录 / 引用", "状态"],
    rows: [["server-01", "Docker Compose", "/srv/picshare", "连接正常"]],
  },
  resources: {
    title: "资源绑定",
    description: "组件只引用已纳管的环境资源实例。",
    columns: ["组件", "绑定实例", "类型", "状态"],
    rows: [
      ["api", "postgres-prod-01", "PostgreSQL 16", "已就绪"],
      ["web", "s3-picshare-prod", "S3 compatible", "已就绪"],
    ],
  },
  secrets: {
    title: "变量与密钥",
    description: "仅显示引用元数据，不暴露密钥值。",
    columns: ["变量", "来源引用", "作用域", "状态"],
    rows: [
      ["DATABASE_URL", "secret/db-primary", "项目环境", "已同步"],
      ["IMAGE_PROXY_URL", "环境变量", "web", "待审核"],
    ],
  },
  access: {
    title: "访问权限",
    description: "生产修改、部署和审批使用独立权限。",
    columns: ["角色", "权限", "成员", "状态"],
    rows: [
      ["项目负责人", "修改配置、创建发布", "3 位成员", "生效中"],
      ["生产审批者", "批准生产部署", "2 位成员", "生效中"],
    ],
  },
  checks: {
    title: "验证与监控",
    description: "部署后由服务端运行检查并保留证据。",
    columns: ["检查", "规则", "对象", "状态"],
    rows: [
      ["健康检查", "/api/health · 30s", "api", "已启用"],
      ["入口探测", "HTTPS 200 · 60s", "web", "缺少入口"],
    ],
  },
};

export function ConfigurationScreen({ configSection, setConfigSection, openDrawer, openAction, environment, setEnvironment, domainFixed, go }) {
  return (
    <>
      <ScreenTitle title="项目配置" description="选择一个已有环境，再管理它的版本、部署目标、资源、变量与治理配置。" />
      <div className="config-layout">
        <aside className="config-rail">
          <label className="environment-select">
            <span>当前环境</span>
            <select value={environment} onChange={(event) => setEnvironment(event.target.value)} aria-label="选择当前环境">
              <option value="production">生产环境</option>
              <option value="staging">预发环境</option>
            </select>
          </label>
          <nav>
            {configSections.map(([key, label]) => (
              <button key={key} className={configSection === key ? "active" : ""} onClick={() => setConfigSection(key)}>
                {label}
              </button>
            ))}
          </nav>
        </aside>
        <section className="config-main">{configSection === "domains" ? <DomainsScreen go={go} openAction={openAction} domainFixed={domainFixed} environment={environment} /> : configSection === "versions" ? <Versions key={environment} openDrawer={openDrawer} openAction={openAction} environment={environment} /> : <GenericConfig item={genericConfigs[configSection]} openAction={openAction} environment={environment} />}</section>
      </div>
    </>
  );
}

function Versions({ openDrawer, openAction, environment }) {
  const current = environmentVersions[environment];
  const currentRecord = versionRecords.find((item) => item.version === current.version);
  const [selected, setSelected] = useState(current.version);
  return (
    <>
      <SectionHeading title="版本配置" meta={`${environment === "staging" ? "预发环境" : "生产环境"} · 切换版本会创建一次受审计的部署操作，不会直接覆盖运行状态。`} />
      <div className="version-current">
        <div>
          <span>当前版本</span>
          <strong>
            {currentRecord.name} <b>{current.version}</b>
          </strong>
        </div>
        <Status value="success">{current.status}</Status>
        <KeyValue label="来源">
          <span className="inline-icon">
            <GitCommit size={14} />
            {currentRecord.source}
          </span>
        </KeyValue>
        <KeyValue label="最近部署">{current.deployedAt}</KeyValue>
      </div>
      <div className="version-workspace">
        <DataTableSurface className="embedded" title="已有版本" meta="选择版本查看配置差异与来源" columns={["版本", "名称", "变更来源", "环境状态", "操作"]} tableClassName="versions-table">
          {versionRecords.map(({ version, name, source }) => (
            <tr key={version} className={selected === version ? "selected" : ""} onClick={() => setSelected(version)}>
              <td>
                <button className="table-link mono" onClick={() => setSelected(version)}>
                  {version}
                </button>
              </td>
              <td>{name}</td>
              <td>{source}</td>
              <td>
                <Status value="success">{version === current.version ? current.status : "可部署"}</Status>
              </td>
              <td>
                <span className="table-actions">
                  {version === current.version ? (
                    <button className="table-action" onClick={() => openDrawer("manifest")}>
                      技术证据
                    </button>
                  ) : (
                    <>
                      <button className="table-action" onClick={() => openAction("switchVersion", { version, environment })}>
                        切换版本
                      </button>
                      <button className="icon-button compact" aria-label={`${version} 更多操作`} onClick={() => openAction("versionMore", { version, environment })}>
                        <DotsThree size={18} />
                      </button>
                    </>
                  )}
                </span>
              </td>
            </tr>
          ))}
        </DataTableSurface>
        <VersionInspector version={selected} />
      </div>
    </>
  );
}

function VersionInspector({ version }) {
  const record = versionRecords.find((item) => item.version === version) ?? versionRecords[0];
  return (
    <aside className="version-inspector" aria-label={`${version} 版本详情`}>
      <span>已选版本</span>
      <h3>
        {record.name} <b>{record.version}</b>
      </h3>
      <Status value="success">可部署</Status>
      <dl>
        <dt>变更来源</dt>
        <dd className="mono">{record.source}</dd>
        <dt>制品摘要</dt>
        <dd className="mono">{record.digest}</dd>
        <dt>创建时间</dt>
        <dd>{record.createdAt}</dd>
      </dl>
    </aside>
  );
}

function GenericConfig({ item, openAction, environment }) {
  const environmentLabel = environment === "staging" ? "预发环境" : "生产环境";
  return (
    <>
      <DataTableSurface title={item.title} meta={`${environmentLabel} · ${item.description}`} columns={[...item.columns, "操作"]} tableClassName="config-table">
        {item.rows.map((row) => (
          <tr key={row[0]}>
            <td>
              <strong>{row[0]}</strong>
            </td>
            <td>{row[1]}</td>
            <td>{row[2]}</td>
            <td>
              <Status value={row[3] === "缺少入口" ? "blocked" : row[3] === "待审核" ? "warning" : "success"}>{row[3]}</Status>
            </td>
            <td>
              <button
                className="table-action"
                onClick={() =>
                  openAction("editConfig", {
                    title: item.title,
                    object: row[0],
                    environment,
                  })
                }
              >
                编辑
              </button>
            </td>
          </tr>
        ))}
      </DataTableSurface>
      <p className="config-footnote">更改会生成新的配置修订；生产发布只读取已确认的修订。</p>
    </>
  );
}
