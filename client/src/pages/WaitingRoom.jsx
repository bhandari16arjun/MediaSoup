// src/pages/WaitingRoom.jsx
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useSocket } from "@/lib/socket";
import { useToast } from "@/hooks/use-toast";

const WaitingRoom = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const socket = useSocket();
  const { toast } = useToast();

  const [waitingStatus, setWaitingStatus] = useState('connecting');
  const [adminName, setAdminName] = useState('');
  const [userInfo, setUserInfo] = useState(null);
  const [connectionError, setConnectionError] = useState(false);

  useEffect(() => {
    const storedUserInfo = localStorage.getItem('meetingUser');
    if (!storedUserInfo) { navigate('/'); return; }
    const parsedUserInfo = JSON.parse(storedUserInfo);
    setUserInfo(parsedUserInfo);

    const request = async () => {
      if (!socket || !parsedUserInfo) return;
      try {
        await socket.timeout(10000).emitWithAck('requestJoinRoom', {
          userName: parsedUserInfo.userName,
          roomName: parsedUserInfo.roomId
        });
        setWaitingStatus('waiting');
      } catch {
        setConnectionError(true);
        toast({ title: 'Connection Error', description: 'Could not reach the meeting server.', variant: 'destructive' });
      }
    };
    request();
  }, [socket, roomId, navigate, toast]);

  useEffect(() => {
    if (!socket) return;

    const handleJoinApproved = ({ adminName: admin }) => {
      setAdminName(admin);
      setWaitingStatus('approved');
      toast({ title: 'Access Granted!', description: `${admin} has approved your request to join the meeting.` });
      setTimeout(() => navigate(`/meeting/${roomId}`), 1200);
    };
    const handleJoinDenied = ({ reason, adminName: admin }) => {
      setAdminName(admin);
      setWaitingStatus('denied');
      toast({ title: 'Access Denied', description: reason || `${admin} denied your request.`, variant: 'destructive' });
    };
    const handleRoomNotFound = () => {
      setConnectionError(true);
      toast({ title: 'Meeting Not Found', description: "The meeting room doesn't exist or has ended.", variant: 'destructive' });
    };
    const handleAdminLeft = () => {
      toast({ title: 'Meeting Ended', description: 'The meeting host has ended the meeting.', variant: 'destructive' });
      navigate('/');
    };

    socket.on('joinApproved', handleJoinApproved);
    socket.on('joinDenied', handleJoinDenied);
    socket.on('roomNotFound', handleRoomNotFound);
    socket.on('adminLeft', handleAdminLeft);

    return () => {
      socket.off('joinApproved', handleJoinApproved);
      socket.off('joinDenied', handleJoinDenied);
      socket.off('roomNotFound', handleRoomNotFound);
      socket.off('adminLeft', handleAdminLeft);
    };
  }, [socket, roomId, navigate, toast]);

  const handleGoBack = () => {
    localStorage.removeItem('meetingUser');
    navigate('/');
  };

  // Render enhanced waiting UI
  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 flex items-center justify-center p-4">
      <Card className="w-full max-w-md mx-auto shadow-xl border-0 bg-card/80 backdrop-blur-sm">
        <CardHeader className="text-center pb-4">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Users className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">Waiting Room</CardTitle>
          <CardDescription className="text-base">
            Room: <span className="font-mono font-semibold">{roomId}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center gap-2">
              <span className="text-sm text-muted-foreground">Status:</span>
              <Badge 
                variant={waitingStatus === 'approved' ? 'default' : waitingStatus === 'denied' ? 'destructive' : 'secondary'}
                className="px-3 py-1"
              >
                {waitingStatus === 'connecting' && 'Connecting...'}
                {waitingStatus === 'waiting' && 'Waiting for approval'}
                {waitingStatus === 'approved' && 'Approved!'}
                {waitingStatus === 'denied' && 'Access Denied'}
              </Badge>
            </div>
            
            {waitingStatus === 'waiting' && (
              <div className="text-sm text-muted-foreground">
                Waiting for <span className="font-semibold">{adminName}</span> to approve your request
              </div>
            )}
            
            {waitingStatus === 'approved' && (
              <div className="text-sm text-green-600 font-medium">
                You've been approved! Redirecting to meeting...
              </div>
            )}
            
            {waitingStatus === 'denied' && (
              <div className="text-sm text-destructive">
                Your request was denied by {adminName}
              </div>
            )}
          </div>

          {connectionError && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm text-center">
              Connection error. Please check your internet connection and try again.
            </div>
          )}

          <div className="flex flex-col gap-3">
            <Button 
              variant="outline" 
              onClick={handleGoBack}
              className="w-full"
            >
              Back to Home
            </Button>
            
            {waitingStatus === 'waiting' && (
              <div className="text-center">
                <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                  Waiting for host approval
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default WaitingRoom;
