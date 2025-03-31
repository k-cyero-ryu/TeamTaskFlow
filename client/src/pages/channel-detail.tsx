import React from 'react';
import { useRoute } from 'wouter';
import { GroupChannelDetail } from '@/components/group-channel-detail';
import { Card } from '@/components/ui/card';

export default function ChannelDetailPage() {
  // Extract channelId from the route
  const [, params] = useRoute<{ id: string }>('/channels/:id');
  const channelId = params?.id ? parseInt(params.id) : -1;

  if (channelId < 0) {
    return (
      <div className="container mx-auto py-6 max-w-5xl">
        <h1 className="text-3xl font-bold mb-6">Channel Not Found</h1>
        <p>The requested channel could not be found.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 max-w-5xl h-[calc(100vh-120px)]">
      <h1 className="text-3xl font-bold mb-6">Channel Details</h1>
      <Card className="h-[calc(100%-80px)] flex flex-col">
        <GroupChannelDetail channelId={channelId} />
      </Card>
    </div>
  );
}