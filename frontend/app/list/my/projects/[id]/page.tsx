import ProjectDetail from "@/components/ProjectDetail";

type Props = { params: Promise<{ id: string }> };

export default async function ProjectPage({ params }: Props) {
  const { id } = await params;
  return <ProjectDetail projectId={id} />;
}
