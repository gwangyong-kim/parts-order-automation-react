import { redirect } from "next/navigation";

export default async function PickingSessionPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = await params;
  redirect(`/floor-map?task=${taskId}`);
}
