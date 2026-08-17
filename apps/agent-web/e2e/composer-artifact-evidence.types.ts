import type { BrowserDiagnostics, ZoomEvidence } from './responsive-evidence.helpers';

export type ArtifactLayoutName = 'chat' | 'artifact' | 'split';
export type ResponsiveBandName = 'compact' | 'medium' | 'wide';

export interface PreservedUiState {
  composerValue?: string;
  selectedTab?: string;
  editorValue?: string;
  chatScrollTop?: number;
  chatScrollFromBottom?: number;
  chatAtBottom?: boolean;
  artifactScrollTop?: number;
  attachmentCount?: number;
  focusPane?: 'chat' | 'artifact' | 'outside';
  popupVisible?: boolean;
}

export interface ComposerArtifactCaptureOptions {
  expectedBand: ResponsiveBandName;
  expectedLayout: ArtifactLayoutName;
  diagnostics: BrowserDiagnostics;
  expectedState?: PreservedUiState;
  zoom?: ZoomEvidence;
  knownRectSelectors?: string[];
}
