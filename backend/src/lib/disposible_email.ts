import { isDisposableEmail } from "@visulima/disposable-email-domains";

export const checkDisposableEmail = async (email: string) => {
  const isDisposable = await isDisposableEmail(email);
  return isDisposable;
};
