import { ArrowLeft, CaretRight } from "@phosphor-icons/react";
import { projectHeader as project } from "../view-models.js";

export function ReleaseDetailFrame({ releaseId, go, children }) {
  return (
    <main className="release-detail-page">
      <nav className="release-detail-breadcrumb" aria-label="发布详情面包屑">
        <button onClick={() => go("overview")}>项目</button>
        <CaretRight size={12} />
        <button onClick={() => go("overview")}>{project.name}</button>
        <CaretRight size={12} />
        <button onClick={() => go("releases")}>发布</button>
        <CaretRight size={12} />
        <strong aria-current="page">{releaseId}</strong>
      </nav>

      <button className="back-action release-detail-back" onClick={() => go("releases")}>
        <ArrowLeft size={15} />
        返回发布列表
      </button>

      <div className="release-detail-content">{children}</div>
    </main>
  );
}
