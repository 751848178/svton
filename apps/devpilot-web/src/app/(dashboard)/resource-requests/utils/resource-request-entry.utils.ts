export interface ResourceRequestEntry {
  shouldCreate: boolean;
  projectId?: string;
  environmentId?: string;
  returnTo?: string;
}

/** 只接受站内回跳地址，避免把项目引导参数变成开放重定向。 */
export function readResourceRequestEntry(
  searchParams: Pick<URLSearchParams, 'get'>,
): ResourceRequestEntry {
  const rawReturnTo = searchParams.get('returnTo') ?? '';
  const returnTo =
    rawReturnTo.startsWith('/') && !rawReturnTo.startsWith('//') ? rawReturnTo : undefined;
  return {
    shouldCreate: searchParams.get('create') === '1',
    projectId: clean(searchParams.get('projectId')),
    environmentId: clean(searchParams.get('environmentId')),
    returnTo,
  };
}

function clean(value: string | null): string | undefined {
  const next = value?.trim();
  return next || undefined;
}
