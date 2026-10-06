import { redirect } from 'next/navigation';

/** The legacy wizard now funnels into the single basic release entry. */
export default async function PublishWizardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/projects/${encodeURIComponent(id)}?create=true`);
}
