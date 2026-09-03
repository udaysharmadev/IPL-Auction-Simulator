import { IntroScreen } from "@/components/screens/AuctionScreen";
import { RouteGuard } from "@/components/navigation/RouteGuard";

export default function FranchiseIntroPage() {
  return <RouteGuard><IntroScreen /></RouteGuard>;
}
