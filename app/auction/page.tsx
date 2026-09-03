import AuctionScreen from "@/components/screens/AuctionScreen";
import { RouteGuard } from "@/components/navigation/RouteGuard";

export default function AuctionPage() {
  return <RouteGuard><AuctionScreen /></RouteGuard>;
}
