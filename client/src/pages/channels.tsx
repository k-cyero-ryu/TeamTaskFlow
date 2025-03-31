import React from 'react';
import { GroupChannelList } from '@/components/group-channel-list';
import { Card } from '@/components/ui/card';

export default function ChannelsPage() {
  return (
    <div className="container mx-auto py-6 max-w-5xl">
      <h1 className="text-3xl font-bold mb-6">Group Channels</h1>
      <Card>
        <GroupChannelList />
      </Card>
    </div>
  );
}