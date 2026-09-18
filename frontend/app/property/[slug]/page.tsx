import ListSpecific from "@/components/public/ListSpecific";
import PublicFrame from "@/components/public/PublicFrame";

type Props = { params: Promise<{ slug: string }> };

// Public page for one listing. PublicFrame adds the sidebar for signed-in users
// and the top bar for visitors.
export default async function PropertyPage({ params }: Props) {
  const { slug } = await params;
  return (
    <PublicFrame>
      <ListSpecific slug={slug} />
    </PublicFrame>
  );
}
