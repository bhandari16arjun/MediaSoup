import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Clock, Video, User, Shield, AlertCircle } from "lucide-react";
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
  
  const [waitingStatus, setWaitingStatus] = useState('connecting'); // connecting, waiting, denied, approved
  const [adminName, setAdminName] = useState('');
  const [userInfo, setUserInfo] = useState(null);
  const [connectionError, setConnectionError] = useState(false);

  useEffect(() => {
    // Get user info from localStorage
    const storedUserInfo = localStorage.getItem('meetingUser');
    if (!storedUserInfo) {
      navigate('/');
      return;
    }

    const parsedUserInfo = JSON.parse(storedUserInfo);
    setUserInfo(parsedUserInfo);

    // Request to join the room
    if (socket && parsedUserInfo) {
      socket.emit('requestJoinRoom', {
        userName: parsedUserInfo.userName,
        roomName: parsedUserInfo.roomId
      });

      setWaitingStatus('waiting');
    }
  }, [socket, roomId, navigate]);

  useEffect(() => {
    if (!socket) return;

    // Listen for admin approval/denial
    const handleJoinApproved = ({ adminName: admin }) => {
      setAdminName(admin);
      setWaitingStatus('approved');
      toast({
        title: "Access Granted!",
        description: `${admin} has approved your request to join the meeting.`,
      });
      
      // Navigate to meeting after a short delay
      setTimeout(() => {
        navigate(`/meeting/${roomId}`);
      }, 1500);
    };

    const handleJoinDenied = ({ reason, adminName: admin }) => {
      setAdminName(admin);
      setWaitingStatus('denied');
      toast({
        title: "Access Denied",
        description: reason || `${admin} has denied your request to join the meeting.`,
        variant: "destructive",
      });
    };

    const handleRoomNotFound = () => {
      setConnectionError(true);
      toast({
        title: "Meeting Not Found",
        description: "The meeting room doesn't exist or has ended.",
        variant: "destructive",
      });
    };

    const handleAdminLeft = () => {
      toast({
        title: "Meeting Ended",
        description: "The meeting host has ended the meeting.",
        variant: "destructive",
      });
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

  const getStatusDisplay = () => {
    switch (waitingStatus) {
      case 'connecting':
        return {
          icon: <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />,
          title: "Connecting...",
          description: "Connecting to the meeting room",
          color: "bg-muted"
        };
      case 'waiting':
        return {
          icon: <Clock className="h-6 w-6 text-warning animate-pulse" />,
          title: "Waiting for Approval",
          description: "The meeting host will review your request shortly",
          color: "bg-warning/10 border-warning/20"
        };
      case 'approved':
        return {
          icon: <Shield className="h-6 w-6 text-success" />,
          title: "Access Granted!",
          description: "You've been approved to join the meeting",
          color: "bg-success/10 border-success/20"
        };
      case 'denied':
        return {
          icon: <AlertCircle className="h-6 w-6 text-destructive" />,
          title: "Access Denied",
          description: "Your request to join has been declined",
          color: "bg-destructive/10 border-destructive/20"
        };
      default:
        return {
          icon: <Clock className="h-6 w-6 text-muted-foreground" />,
          title: "Please Wait",
          description: "Processing your request",
          color: "bg-muted"
        };
    }
  };

  const statusInfo = getStatusDisplay();

  if (connectionError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
            <CardTitle className="text-xl text-destructive">Meeting Not Found</CardTitle>
            <CardDescription>
              The meeting room doesn't exist or may have ended.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button onClick={handleGoBack} className="w-full">
              Return to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${statusInfo.color}`}>
            {statusInfo.icon}
          </div>
          <CardTitle className="text-xl">{statusInfo.title}</CardTitle>
          <CardDescription>{statusInfo.description}</CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {userInfo && (
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Your Name:</span>
                <span className="font-medium">{userInfo.userName}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Video className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Meeting ID:</span>
                <code className="bg-background px-2 py-1 rounded text-xs font-mono">
                  {userInfo.roomId}
                </code>
              </div>
              {adminName && (
                <div className="flex items-center gap-2 text-sm">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Meeting Host:</span>
                  <span className="font-medium">{adminName}</span>
                </div>
              )}
            </div>
          )}

          {waitingStatus === 'waiting' && (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground">
                Please wait while the meeting host reviews your request to join.
              </p>
              <div className="mt-4 flex justify-center">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            </div>
          )}

          {waitingStatus === 'approved' && (
            <div className="text-center py-4">
              <Badge variant="outline" className="text-success border-success">
                Joining meeting...
              </Badge>
            </div>
          )}

          {waitingStatus === 'denied' && (
            <div className="text-center py-4 space-y-3">
              <p className="text-sm text-muted-foreground">
                You can try requesting to join again or contact the meeting host directly.
              </p>
              <Button variant="outline" onClick={handleGoBack} className="w-full">
                Return to Home
              </Button>
            </div>
          )}

          {waitingStatus === 'waiting' && (
            <Button variant="outline" onClick={handleGoBack} className="w-full">
              Cancel & Go Back
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default WaitingRoom;