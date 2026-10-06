export type SiteProbeStatusTone = 'success' | 'danger' | 'neutral';

export function siteProbeStatusTone(status: string | null): SiteProbeStatusTone {
  switch (status) {
    case 'resolved':
    case 'valid':
    case 'passed':
    case 'switched':
      return 'success';
    case 'failed':
    case 'invalid':
      return 'danger';
    default:
      return 'neutral';
  }
}

export function siteProbeStatusTranslationKey(status: string | null): string {
  switch (status) {
    case 'resolved':
      return 'releaseSiteProbeResolved';
    case 'valid':
      return 'releaseSiteProbeValid';
    case 'passed':
      return 'releaseSiteProbePassed';
    case 'not_required':
      return 'releaseSiteProbeNotRequired';
    case 'failed':
      return 'releaseSiteProbeFailed';
    case 'invalid':
      return 'releaseSiteProbeInvalid';
    default:
      return 'releaseSiteProbeUnavailable';
  }
}
