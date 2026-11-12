import type { VerificationStatus } from "../generated/prisma/enums.js";

const isVerified = (status: VerificationStatus) => status === "VERIFIED";

export const publicRera = <T>(status: VerificationStatus, value: T) =>
  isVerified(status) ? value : null;

export const publicReraStatus = (status: VerificationStatus): VerificationStatus =>
  isVerified(status) ? "VERIFIED" : "NONE";

export const publicAgentRera = (owner: {
  agentReraStatus: VerificationStatus;
  agentReraNumber: string | null;
  agentReraVerifiedReason: string | null;
  agentReraVerifiedAt: Date | null;
}) => ({
  agentReraStatus: publicReraStatus(owner.agentReraStatus),
  agentReraNumber: publicRera(owner.agentReraStatus, owner.agentReraNumber),
  agentReraVerifiedReason: publicRera(owner.agentReraStatus, owner.agentReraVerifiedReason),
  agentReraVerifiedAt: publicRera(owner.agentReraStatus, owner.agentReraVerifiedAt),
});
