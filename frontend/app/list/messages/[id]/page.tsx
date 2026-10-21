import ChatThread from "@/components/chat/ChatThread";

type Params = {
  params: Promise<{ id: string }>;
};

const page = async ({ params }: Params) => {
  const { id } = await params;
  return <ChatThread id={id} />;
};

export default page;
