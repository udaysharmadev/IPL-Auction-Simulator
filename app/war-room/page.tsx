import { WarRoomScreen } from "@/components/screens/AuctionScreen";
import { RouteGuard } from "@/components/navigation/RouteGuard";

export default function WarRoomPage() {
  return <RouteGuard><WarRoomScreen /></RouteGuard>;
}
