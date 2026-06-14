// Block components — atomic, self-contained UI blocks for ContentBlock rendering.
// Each follows the "Props interface + Component" pattern with zero cross-dependencies.

export { BlockIcon } from './BlockIcon';
export type { BlockType, BlockStatus } from './BlockIcon';

export { PlanBlockView } from './PlanBlockView';
export type { PlanInfo, PlanStepInfo } from './PlanBlockView';

export { FileChangeView } from './FileChangeView';
export type { FileChangeEntry } from './FileChangeView';

export { SubagentBlockView } from './SubagentBlockView';

export { WarningBlockView } from './WarningBlockView';

export { ReferenceBlockView } from './ReferenceBlockView';
export type { ReferenceEntry } from './ReferenceBlockView';

export { WebSearchBlockView } from './WebSearchBlockView';
export type { SearchResultEntry } from './WebSearchBlockView';

export { ProgressBlockView } from './ProgressBlockView';

export { TurnDiffView } from './TurnDiffView';

export { CommandBlockView } from './CommandBlockView';

export { FileTreeBlockView } from './FileTreeBlockView';
export type { FileTreeNode } from './FileTreeBlockView';

export { RedactedThinkingView } from './RedactedThinkingView';
