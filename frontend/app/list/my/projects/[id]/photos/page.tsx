import ProjectPhotos from "@/components/ProjectPhotos";

type Props = { params: Promise<{ id: string }> };

export default async function ProjectPhotosPage({ params }: Props) {
  const { id } = await params;
  return <ProjectPhotos projectId={id} />;
}
