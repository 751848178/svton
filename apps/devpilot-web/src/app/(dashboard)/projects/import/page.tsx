import { redirect } from 'next/navigation';

export default function LegacyImportProjectPage() {
  redirect('/projects/create?source=existing');
}
