import { useState, useEffect } from 'react';
import { useSocket } from '@/lib/socket';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { UserCheck, UserX, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const AdminPanel = ({ onClose }) => {
  const socket = useSocket();
  const { toast } = useToast();
  const [pendingRequests, setPendingRequests] = useState([]);

  useEffect(() => {
    if (!socket) return;

    // Listen for new requests
    const handleNewRequest = (request) => {
      setPendingRequests((prev) => [...prev, request]);
      toast({
        title: 'New Join Request',
        description: `${request.userName} wants to join the meeting.`,
      });
    };
    
    // Listen for updates when a request is handled
    const handleRequestUpdate = ({ requestId }) => {
      setPendingRequests((prev) => prev.filter(req => req.id !== requestId));
    };

    socket.on('newJoinRequest', handleNewRequest);
    socket.on('joinRequestApproved', handleRequestUpdate);
    socket.on('joinRequestDenied', handleRequestUpdate);
    
    // Fetch any existing requests when the panel opens
    socket.emit('adminGetPendingRequests', (requests) => {
        setPendingRequests(requests || []);
    });

    return () => {
      socket.off('newJoinRequest', handleNewRequest);
      socket.off('joinRequestApproved', handleRequestUpdate);
      socket.off('joinRequestDenied', handleRequestUpdate);
    };
  }, [socket, toast]);

  const handleApprove = (requestId) => {
    socket.emit('approveJoinRequest', { requestId }, (response) => {
      if (response?.success) {
        toast({ title: 'Request Approved' });
        // UI will update via 'joinRequestApproved' event
      } else {
        toast({ title: 'Error', description: response?.error || 'Could not approve request.', variant: 'destructive' });
      }
    });
  };

  const handleDeny = (requestId) => {
    socket.emit('denyJoinRequest', { requestId, reason: 'Your request to join was denied by the host.' }, (response) => {
      if (response?.success) {
        toast({ title: 'Request Denied' });
        // UI will update via 'joinRequestDenied' event
      } else {
        toast({ title: 'Error', description: response?.error || 'Could not deny request.', variant: 'destructive' });
      }
    });
  };

  return (
    <div className="p-4 h-full flex flex-col bg-meeting-sidebar">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-lg text-white">Admin Controls</h3>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="text-muted-foreground hover:text-white"
        >
          &times;
        </Button>
      </div>

      <Card className="flex-1 bg-meeting-controls/50 border-video-border text-white">
        <CardHeader>
          <CardTitle>Waiting Room</CardTitle>
          <CardDescription className="text-muted-foreground">Review requests to join the meeting.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {pendingRequests.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No one is waiting.</p>
          ) : (
            pendingRequests.map((req) => (
              <div key={req.id} className="flex items-center justify-between p-3 bg-meeting-sidebar rounded-lg">
                <div className="flex items-center space-x-3">
                  <Clock className="w-5 h-5 text-yellow-400" />
                  <span className="font-medium">{req.userName}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Button size="sm" variant="outline" className="border-green-500 text-green-500 hover:bg-green-500/10 hover:text-green-400" onClick={() => handleApprove(req.id)}>
                    <UserCheck className="w-4 h-4 mr-1" />
                    Approve
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => handleDeny(req.id)}>
                    <UserX className="w-4 h-4 mr-1" />
                    Deny
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminPanel;
