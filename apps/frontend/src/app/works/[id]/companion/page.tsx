import { redirect } from 'next/navigation';

export default async function CompanionRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/works/${id}/character-talk`);
}
