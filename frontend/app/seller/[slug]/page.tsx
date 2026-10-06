import PublicFrame from "@/components/public/PublicFrame";
import SellerProfile from "@/components/public/SellerProfile";

type Props = { params: Promise<{ slug: string }> };

// The seller behind a listing: /seller/anujith-vk-7f3a2c
export default async function SellerPage({ params }: Props) {
  const { slug } = await params;
  return (
    <PublicFrame>
      <SellerProfile slug={slug} />
    </PublicFrame>
  );
}
