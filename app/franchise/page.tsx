import { FranchiseScreen } from "@/components/screens/AuctionScreen";
import { RouteGuard } from "@/components/navigation/RouteGuard";

export default function FranchisePage() {
  return <RouteGuard><FranchiseScreen /></RouteGuard>;
}
