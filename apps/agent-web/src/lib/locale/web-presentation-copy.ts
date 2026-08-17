import type { Translator } from '@svton/ui';

export interface BrowserSettingsPresentationCopy {
  storageDescription: () => string;
}

export interface WebComposerFilePresentationCopy {
  fileHandleUnavailable: () => string;
  fileReadFailed: () => string;
}

export interface WebArtifactPresentationCopy {
  exportDownloaded: (filename: string) => string;
  exportFailed: () => string;
  popupBlocked: () => string;
  openSucceeded: () => string;
  openFailed: () => string;
  localFileUnsupported: () => string;
  localPathUnsupported: () => string;
  httpOnly: () => string;
}

export function createBrowserSettingsPresentationCopy(
  t: Translator,
): BrowserSettingsPresentationCopy {
  return { storageDescription: () => t('web.settings.browserStorageDescription') };
}

export function createWebComposerFilePresentationCopy(
  t: Translator,
): WebComposerFilePresentationCopy {
  return {
    fileHandleUnavailable: () => t('web.composer.file.handleUnavailable'),
    fileReadFailed: () => t('web.composer.file.readFailed'),
  };
}

export function createWebArtifactPresentationCopy(
  t: Translator,
): WebArtifactPresentationCopy {
  return {
    exportDownloaded: (filename) => t('web.artifact.export.downloaded', { filename }),
    exportFailed: () => t('web.artifact.export.failed'),
    popupBlocked: () => t('web.artifact.open.popupBlocked'),
    openSucceeded: () => t('web.artifact.open.succeeded'),
    openFailed: () => t('web.artifact.open.failed'),
    localFileUnsupported: () => t('web.artifact.open.localFileUnsupported'),
    localPathUnsupported: () => t('web.artifact.open.localPathUnsupported'),
    httpOnly: () => t('web.artifact.open.httpOnly'),
  };
}
