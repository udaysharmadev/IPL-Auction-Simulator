import { SetupScreen } from "@/components/screens/AuctionScreen";
import { RouteGuard } from "@/components/navigation/RouteGuard";

export default function SetupPage() {
  return <RouteGuard><SetupScreen /></RouteGuard>;
}
