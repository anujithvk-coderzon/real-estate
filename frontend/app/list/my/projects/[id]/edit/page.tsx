import ProjectEdit from "@/components/ProjectEdit";

type Props = { params: Promise<{ id: string }> };

export default async function EditProjectPage({ params }: Props) {
  const { id } = await params;
  return <ProjectEdit projectId={id} />;
}
