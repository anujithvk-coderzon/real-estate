import ResetPassword from "@/components/ResetPassword";

type Props = { params: Promise<{ token: string }> };

// Step 2 of resetting a password: the link from the email lands here.
export default async function ResetPasswordPage({ params }: Props) {
  const { token } = await params;
  return <ResetPassword token={token} />;
}
