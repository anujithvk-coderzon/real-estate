import VerifyToken from "@/components/VerifyToken";

type TokenParams = {
  params: Promise<{ token: string }>;
};

const VerifyPage = async ({ params }: TokenParams) => {
  const { token } = await params;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-12">
      <VerifyToken token={token} />
    </main>
  );
};

export default VerifyPage;
