import { Bell, GitDiff, SlidersHorizontal, UserCircle } from "@phosphor-icons/react";
import { environmentVersions, releaseRows, versionRecords } from "../view-models.js";

export function OperationContent({ action, selectedVersion, setSelectedVersion }) {
  if (action.type === "createRelease") return <ReleaseFields />;
  if (action.type === "editDomain") return <DomainFields />;
  if (action.type === "releaseFilter") return <FilterFields />;
  if (action.type === "selectEnvironmentVersion") return <VersionSelectFields action={action} value={selectedVersion} onChange={setSelectedVersion} />;
  if (action.type === "notifications") return <InfoRows icon={Bell} rows={["生产检查阻断 · R-1042", "预发验证通过 · R-1042", `Manifest 已锁定 · ${releaseRows[0].manifestId}`]} />;
  if (action.type === "account") return <InfoRows icon={UserCircle} rows={["赵行波 · 项目负责人", "Acme Lab · 团队工作区", "生产审批与部署权限已启用"]} />;
  if (action.type === "change") return <InfoRows icon={GitDiff} rows={["新增 IMAGE_PROXY_URL", "检测到新的数据库迁移", "等待项目负责人审核"]} />;
  if (action.type === "runLogs") return <LogRows />;
  if (action.type === "component") return <InfoRows icon={SlidersHorizontal} rows={[`${action.payload?.name ?? "—"} · ${action.payload?.runtime ?? "—"}`, `路径 ${action.payload?.path ?? "—"} · 端口 ${action.payload?.port ?? "—"}`, action.payload?.change ?? "暂无已审核变化"]} />;
  if (action.type === "versionMore") return <InfoRows icon={SlidersHorizontal} rows={["查看版本技术证据", "比较配置变更", "创建恢复运行"]} />;
  if (action.type === "editConfig") return <InfoRows icon={SlidersHorizontal} rows={[`${action.payload?.title ?? "环境配置"} · ${action.payload?.environment === "staging" ? "预发环境" : "生产环境"}`, "修改将生成新的配置修订", "敏感值仅保存引用，不显示明文"]} />;
  return <ConfirmSummary action={action} />;
}

function VersionSelectFields({ action, value, onChange }) {
  const current = environmentVersions[action.payload?.environment ?? "production"];
  const currentRecord = versionRecords.find((item) => item.version === current.version);
  return (
    <>
      <div className="operation-form">
        <label>
          目标环境
          <input value={current.label} readOnly />
        </label>
        <label>
          当前运行版本
          <input value={`${current.version} · ${currentRecord?.name ?? "—"}`} readOnly />
        </label>
        <label>
          选择已有版本
          <select value={value} onChange={(event) => onChange(event.target.value)}>
            {versionRecords
              .filter((item) => item.version !== current.version)
              .map((item) => (
                <option key={item.version} value={item.version}>
                  {item.version} · {item.name}
                </option>
              ))}
          </select>
        </label>
      </div>
      <div className="operation-callout">当前版本会保持运行，直到新的部署操作成功完成。</div>
    </>
  );
}

function ReleaseFields() {
  const release = releaseRows[0];
  const [branch, commit] = release.source.split(" · ");
  return (
    <div className="operation-form">
      <label>
        版本名称
        <input defaultValue={release.name} />
      </label>
      <label>
        版本号
        <input defaultValue={release.version} />
      </label>
      <label>
        来源分支
        <select defaultValue={branch}>
          <option>{branch}</option>
          <option>release/1.3</option>
        </select>
      </label>
      <label>
        来源提交
        <input className="mono" value={commit} readOnly />
      </label>
    </div>
  );
}

function DomainFields() {
  return (
    <>
      <div className="operation-form">
        <label>
          域名
          <input defaultValue="picshare.acme.dev" />
        </label>
        <label>
          目标组件
          <select defaultValue="web">
            <option>web</option>
            <option>api</option>
          </select>
        </label>
        <label>
          目标端口
          <input defaultValue="3000" />
        </label>
        <label>
          访问路径
          <input defaultValue="/" />
        </label>
      </div>
      <div className="operation-callout">保存后状态为“待验证”，不会提前解锁生产部署。</div>
    </>
  );
}

function FilterFields() {
  return (
    <div className="operation-form">
      <label>
        环境
        <select defaultValue="all">
          <option value="all">全部环境</option>
          <option>预发环境</option>
          <option>生产环境</option>
        </select>
      </label>
      <label>
        状态
        <select defaultValue="all">
          <option value="all">全部状态</option>
          <option>已阻断</option>
          <option>成功</option>
        </select>
      </label>
    </div>
  );
}

function ConfirmSummary({ action }) {
  const environment = action.payload?.environment === "staging" ? "预发环境" : "生产环境";
  return (
    <div className="confirmation-summary">
      <strong>{action.type === "switchVersion" ? `${environment} · 目标版本 ${action.payload?.version}` : "本操作会写入新的审计记录"}</strong>
      <p>当前页面只在服务端返回成功后更新状态；取消不会产生任何变更。</p>
    </div>
  );
}

function InfoRows({ icon: Icon, rows }) {
  return (
    <div className="operation-list">
      {rows.map((row) => (
        <div key={row}>
          <Icon size={17} />
          <span>{row}</span>
        </div>
      ))}
    </div>
  );
}

function LogRows() {
  return (
    <pre className="log-view">
      12:43:08 target server-01 ready{`\n`}12:43:19 artifact {releaseRows[0].manifestId} pulled{`\n`}12:43:36 api and postgres healthy{`\n`}12:43:42 waiting for web readiness
    </pre>
  );
}
