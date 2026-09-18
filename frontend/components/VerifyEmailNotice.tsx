type Props = {
  email: string;
};

const VerifyEmailNotice = ({ email }: Props) => {
  return (
    <div className="rounded-lg border border-line bg-panel p-6">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-soft">
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 text-accent">
          <path
            d="M3 7l9 6 9-6M4 5h16a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V6a1 1 0 011-1z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      <h2 className="mt-4 text-[20px] font-semibold tracking-tight">
        Verify your email
      </h2>

      <p className="mt-2 text-[15px] leading-relaxed text-muted">
        We sent a verification link to{" "}
        <span className="font-medium text-ink">{email}</span>. Open it to activate
        your account.
      </p>

      <p className="mt-4 border-t border-line pt-4 text-[13px] leading-relaxed text-muted">
        Nothing yet? Check the spam folder, and make sure the address above is
        spelled correctly.
      </p>
    </div>
  );
};

export default VerifyEmailNotice;
