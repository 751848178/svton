/**
 * Compatibility re-export for Chrome CDP tools.
 */

export {
  __setCdpClientForTesting,
} from './chrome-cdp-client';

export {
  chromeNavigateDef,
  ChromeNavigateExecutor,
  chromeScreenshotDef,
  ChromeScreenshotExecutor,
} from './chrome-page';

export {
  chromeClickDef,
  ChromeClickExecutor,
  chromeTypeDef,
  ChromeTypeExecutor,
} from './chrome-interaction';

export {
  chromeEvaluateDef,
  ChromeEvaluateExecutor,
  chromeGetContentDef,
  ChromeGetContentExecutor,
} from './chrome-runtime';
