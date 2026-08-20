import { redirect } from 'next/navigation';

export default async function LegacyPublishProgressPage({
  params,
}: {
  params: Promise<{ id: string; releaseOrderId: string }>;
}) {
  const { id, releaseOrderId } = await params;
  redirect(
    `/projects/${encodeURIComponent(id)}?releaseOrderId=${encodeURIComponent(releaseOrderId)}`,
  );
}
