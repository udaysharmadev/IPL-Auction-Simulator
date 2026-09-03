import { AuctionReportScreen } from "@/components/screens/AuctionScreen";
import { RouteGuard } from "@/components/navigation/RouteGuard";

export default function AuctionReportPage() {
  return <RouteGuard><AuctionReportScreen /></RouteGuard>;
}
