import { useState } from 'react';
import { ReleaseStepDetail } from './ReleaseStepDetail.jsx';
import { ReleaseStepStateIcon } from './ReleaseStepState.jsx';
import { buildReleaseStages } from './releaseStageModel.js';

const navigationKeys = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'];

function nextIndexForKey(key, index, length) {
  if (key === 'Home') return 0;
  if (key === 'End') return length - 1;
  if (key === 'ArrowRight' || key === 'ArrowDown') return (index + 1) % length;
  return (index - 1 + length) % length;
}

function preferredStep(stage) {
  return stage.children.find((step) => step.state === 'blocked' || step.state === 'current') ?? stage.children.find((step) => step.state !== 'disabled');
}

export function ReleaseStageNavigator({ completed, stagingCompleted, domainFixed, preflightVerified, productionPublished, validationCompleted, stageNotices, openDrawer }) {
  const stages = buildReleaseStages({ completed, stagingCompleted, domainFixed, preflightVerified, productionPublished, validationCompleted });
  const initialStage = completed ? 'complete' : stages.find((stage) => stage.state === 'current')?.key ?? 'staging';
  const [activeStage, setActiveStage] = useState(initialStage);
  const [activeSubsteps, setActiveSubsteps] = useState({});
  const selectedStage = stages.find((stage) => stage.key === activeStage && stage.state !== 'disabled') ?? stages.find((stage) => stage.state !== 'disabled');
  const selectedStep = selectedStage.children.find((step) => step.key === activeSubsteps[selectedStage.key]) ?? preferredStep(selectedStage);

  const moveFocus = (event, items, index, select, idForItem) => {
    if (!navigationKeys.includes(event.key)) return;
    event.preventDefault();
    const enabledItems = items.filter((item) => item.state !== 'disabled');
    const enabledIndex = enabledItems.findIndex((item) => item.key === items[index].key);
    const next = enabledItems[nextIndexForKey(event.key, Math.max(enabledIndex, 0), enabledItems.length)];
    select(next.key);
    document.getElementById(idForItem(next.key))?.focus();
  };

  const selectSubstep = (stepKey) => {
    setActiveSubsteps((current) => ({ ...current, [selectedStage.key]: stepKey }));
  };

  return (
    <section className="release-stage-navigation" aria-label="发布执行阶段">
      <nav className="release-major-steps" role="tablist" aria-label="发布一级阶段">
        {stages.map((stage, index) => (
          <button
            key={stage.key}
            id={`release-stage-tab-${stage.key}`}
            role="tab"
            className={`${stage.state} ${stage.key === activeStage ? 'selected' : ''}`}
            aria-selected={stage.key === activeStage}
            aria-controls={`release-stage-panel-${stage.key}`}
            aria-current={stage.state === 'current' ? 'step' : undefined}
            aria-disabled={stage.state === 'disabled' || undefined}
            disabled={stage.state === 'disabled'}
            tabIndex={stage.key === activeStage && stage.state !== 'disabled' ? 0 : -1}
            onKeyDown={(event) => moveFocus(event, stages, index, setActiveStage, (key) => `release-stage-tab-${key}`)}
            onClick={() => setActiveStage(stage.key)}
          >
            <span>{stage.label}</span><small>{stage.summary}</small>
          </button>
        ))}
      </nav>

      <div id={`release-stage-panel-${selectedStage.key}`} className="release-substep-panel" role="tabpanel" aria-labelledby={`release-stage-tab-${selectedStage.key}`} tabIndex={0}>
        {stageNotices?.[selectedStage.key]}
        <header><div><h3>{selectedStage.label}阶段</h3><p>{selectedStage.description}</p></div><strong>{selectedStage.progress}</strong></header>
        <ol className="release-substeps" role="tablist" aria-label={`${selectedStage.label}阶段子步骤`}>
          {selectedStage.children.map((step, index) => (
            <li key={step.key} className={step.state}>
              <button
                id={`release-substep-tab-${selectedStage.key}-${step.key}`}
                className={`release-substep-button ${step.key === selectedStep.key ? 'selected' : ''}`}
                role="tab"
                aria-selected={step.key === selectedStep.key}
                aria-controls={`release-substep-panel-${selectedStage.key}-${step.key}`}
                aria-disabled={step.state === 'disabled' || undefined}
                disabled={step.state === 'disabled'}
                tabIndex={step.key === selectedStep.key && step.state !== 'disabled' ? 0 : -1}
                onKeyDown={(event) => moveFocus(event, selectedStage.children, index, selectSubstep, (key) => `release-substep-tab-${selectedStage.key}-${key}`)}
                onClick={() => selectSubstep(step.key)}
              >
                <span><ReleaseStepStateIcon state={step.state} /></span>
                <div><strong>{step.label}</strong><small>{step.detail}</small></div>
              </button>
            </li>
          ))}
        </ol>
        <ReleaseStepDetail stageKey={selectedStage.key} step={selectedStep} openDrawer={openDrawer} />
      </div>
    </section>
  );
}
