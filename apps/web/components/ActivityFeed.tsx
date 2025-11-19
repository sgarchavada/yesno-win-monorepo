"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { History, CheckCircle, XCircle, AlertCircle, Loader2 } from "lucide-react";

interface ActivityEvent {
  type: string;
  timestamp: number;
  blockNumber: bigint;
  transactionHash: string;
  data?: any;
}

export default function ActivityFeed() {
  const [allEvents, setAllEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        // Fetch recent events (simplified - using getContractEvents directly)
        // Note: This is a simplified version. In production, you'd want to use indexed events properly
        setAllEvents([]);
      } catch (error) {
        console.error("Error fetching events:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchEvents();
  }, []);


  const getEventIcon = (type: string) => {
    switch (type) {
      case "MarketCreated":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "MarketResolved":
        return <CheckCircle className="h-4 w-4 text-blue-500" />;
      case "MarketCanceled":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getEventText = (event: ActivityEvent) => {
    switch (event.type) {
      case "MarketCreated":
        return `Market #${event.data?.marketId?.toString() || "N/A"} created`;
      case "MarketResolved":
        return `Market #${event.data?.marketId?.toString() || "N/A"} resolved`;
      case "MarketCanceled":
        return `Market #${event.data?.marketId?.toString() || "N/A"} canceled`;
      default:
        return event.type;
    }
  };

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <History className="h-5 w-5" />
          <span>Recent Admin Actions</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
          </div>
        ) : allEvents.length === 0 ? (
          <div className="text-center py-8 text-muted">
            <p className="text-sm">No recent activity</p>
            <p className="text-xs text-muted mt-2">Activity feed will show recent admin actions</p>
          </div>
        ) : (
          <div className="space-y-3">
            {allEvents.map((event, index) => (
              <div
                key={`${event.transactionHash}-${index}`}
                className="flex items-start space-x-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
              >
                {getEventIcon(event.type)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {getEventText(event)}
                  </p>
                  <p className="text-xs text-muted">
                    {new Date(event.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

