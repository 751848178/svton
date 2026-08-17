export type PromotionActionResult = {
  status?: string;
  errorCode?: string | null;
  errorMessage?: string | null;
};

export function promotionActionDomainError(result: PromotionActionResult) {
  if (result.status !== 'blocked') return null;
  return result.errorMessage?.trim() || result.errorCode?.trim() ||
    'Production promotion is blocked';
}
