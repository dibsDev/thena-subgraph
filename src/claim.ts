import { Claim, PlatformClaim } from "../generated/Router/Dibs";
import { TotalNotClaimed } from "../generated/schema";

export function handleUserClaimed(event: Claim): void {
  const token = event.params._token;
  const totalNotClaimed = TotalNotClaimed.load(token.toHexString());
  if (!totalNotClaimed) {
    return;
  }
  totalNotClaimed.amount = totalNotClaimed.amount.minus(event.params._amount);
  totalNotClaimed.lastUpdate = event.block.timestamp;
  totalNotClaimed.save();
}
