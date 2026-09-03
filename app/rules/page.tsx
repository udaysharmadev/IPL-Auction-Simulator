import { RulesScreen } from "@/components/screens/AuctionScreen";
import { RouteGuard } from "@/components/navigation/RouteGuard";

export default function RulesPage() {
  return <RouteGuard><RulesScreen /></RouteGuard>;
}
