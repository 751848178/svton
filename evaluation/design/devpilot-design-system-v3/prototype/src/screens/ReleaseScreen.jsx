import { useState } from 'react';
import { DeliveryScenarioFlow } from '../components/DeliveryScenarioFlow.jsx';
import { Button, KeyValue, ScreenTitle, SectionHeading, Status } from "../components/ui.jsx";
import { ProductionStageNotice } from "../components/ProductionStageNotice.jsx";
import { ReleaseStageNavigator } from "../components/ReleaseStageNavigator.jsx";
import { projectFacts, releaseRows } from "../view-models.js";

export function ReleaseScreen({ openDrawer, openAction, domainFixed, preflightVerified, selectedReleaseId }) {
  const [experience, setExperience] = useState(selectedReleaseId === 'R-1042' ? 'planned' : 'original');
  const release = releaseRows.find((item) => item.id === selectedReleaseId) ?? releaseRows[0];
  const completed = release.status === "success";
  const effectiveVerified = completed || preflightVerified;
  const stagingCompleted = completed || release.stage !== "预发";
  const productionPublished = completed;
  const validationCompleted = completed;
  const stageNotices = completed
    ? {}
    : {
        production: <ProductionStageNotice releaseId={release.id} domainFixed={domainFixed} preflightVerified={preflightVerified} openDrawer={openDrawer} openAction={openAction} />,
      };
  return (
    <>
      {selectedReleaseId === 'R-1042' && <div className="release-experience-choice" aria-label="原型体验版本">
        <Button variant={experience === 'planned' ? 'secondary' : 'ghost'} aria-pressed={experience === 'planned'} onClick={() => setExperience('planned')}>改进后发布流程</Button>
        <Button variant={experience === 'original' ? 'secondary' : 'ghost'} aria-pressed={experience === 'original'} onClick={() => setExperience('original')}>原有入口配置流程</Button>
      </div>}
      {experience === 'planned' ? <>
        <ScreenTitle as="h1" title={`${release.name} ${release.version}`} description={`发布 ${release.id} · ${release.source}`} />
        <DeliveryScenarioFlow releaseId={release.id} />
      </> : <>
      <ScreenTitle as="h1" title={`${release.name} ${release.version}`} description={`发布 ${release.id} · ${release.source} · 最近执行 ${release.updated}`} actions={<Status value={effectiveVerified ? "success" : domainFixed ? "warning" : "blocked"}>{completed ? "发布已完成" : preflightVerified ? "生产检查已通过" : domainFixed ? "等待重新检查" : "生产已阻断"}</Status>} />

      <ReleaseStageNavigator completed={completed} stagingCompleted={stagingCompleted} domainFixed={domainFixed} preflightVerified={preflightVerified} productionPublished={productionPublished} validationCompleted={validationCompleted} stageNotices={stageNotices} openDrawer={openDrawer} />

      <aside className="release-facts release-facts-wide">
        <SectionHeading title="发布输入" />
        <KeyValue label="候选版本">
          {release.name} {release.version}
        </KeyValue>
        <KeyValue label="目标环境">生产环境</KeyValue>
        <KeyValue label="Manifest">
          <button className="link-button" onClick={() => openDrawer("manifest")}>
            {release.manifestId}
          </button>
        </KeyValue>
        <KeyValue label="发布策略">
          {projectFacts.releasePolicy} · {projectFacts.releasePolicyDetail}
        </KeyValue>
      </aside>
      </>}
    </>
  );
}
