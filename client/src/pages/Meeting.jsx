import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Mic, MicOff, Video, VideoOff, Monitor, PhoneOff, Users, Copy, Settings, Crown, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { useMediasoup } from "@/hooks/useMediasoup";
import { useSocket } from "@/lib/socket";
import { cn } from "@/lib/utils";
import AdminPanel from "@/components/AdminPanel";

// Enhanced ParticipantTile with admin indicators
const ParticipantTile = ({ stream, userName, isLocal = false, isVideoOff = false, isAudioMuted = false, isAdmin = false }) => {
    const videoRef = useRef(null);
    const hasVideo = stream && stream.getVideoTracks().length > 0 && !isVideoOff;

    useEffect(() => {
        if (hasVideo && videoRef.current) {
            videoRef.current.srcObject = stream;
        }
    }, [stream, hasVideo]);

    return (
        <Card className="bg-card border-border relative overflow-hidden group w-full aspect-video">
            <div className="w-full h-full bg-muted/20 flex items-center justify-center relative">
                {!hasVideo ? (
                    <div className="w-20 h-20 bg-primary rounded-full flex items-center justify-center shadow-lg">
                        <span className="text-white font-semibold text-2xl">
                            {userName.split(' ').map(n => n[0]).join('')}
                        </span>
                    </div>
                ) : (
                    <video ref={videoRef} autoPlay playsInline muted={isLocal} className="w-full h-full object-cover" />
                )}
                
                <div className="absolute bottom-2 left-2 flex items-center gap-2">
                    {isAudioMuted && (
                        <div className="w-6 h-6 bg-destructive rounded-full flex items-center justify-center shadow-md">
                            <MicOff className="h-3 w-3 text-white" />
                        </div>
                    )}
                    {isAdmin && (
                        <div className="w-6 h-6 bg-warning rounded-full flex items-center justify-center shadow-md">
                            <Crown className="h-3 w-3 text-white" />
                        </div>
                    )}
                </div>
                
                <div className="absolute bottom-2 right-2 flex items-center gap-2">
                    <span className="text-white text-sm bg-black/60 backdrop-blur-sm px-2 py-1 rounded-md shadow-md flex items-center gap-1">
                        {isAdmin && <Crown className="h-3 w-3 text-warning" />}
                        {userName} {isLocal && "(You)"}
                    </span>
                </div>
            </div>
        </Card>
    );
};

const Meeting = () => {
  const navigate = useNavigate();
  const { roomId } = useParams();
  const { toast } = useToast();
  const socket = useSocket();
  
  const { localStream, remoteStreams, toggleAudio, toggleVideo } = useMediasoup();

  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [showParticipants, setShowParticipants] = useState(true);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [pendingRequests, setPendingRequests] = useState([]);

  // Initialize user info and admin status
  useEffect(() => {
    const adminInfo = localStorage.getItem('meetingAdmin');
    const userInfo = localStorage.getItem('meetingUser');
    
    if (adminInfo) {
      const parsed = JSON.parse(adminInfo);
      setUserInfo(parsed);
      setIsAdmin(parsed.isAdmin);
    } else if (userInfo) {
      const parsed = JSON.parse(userInfo);
      setUserInfo(parsed);
      setIsAdmin(false);
    } else {
      // No user info found, redirect to landing
      navigate('/');
      return;
    }
  }, [navigate]);

  // Socket event listeners for admin functionality
  useEffect(() => {
    if (!socket || !isAdmin) return;

    const handleJoinRequest = (request) => {
      setPendingRequests(prev => [...prev, request]);
      toast({
        title: "New Join Request",
        description: `${request.userName} wants to join the meeting`,
      });
    };

    const handleRequestApproved = ({ requestId }) => {
      setPendingRequests(prev => prev.filter(req => req.id !== requestId));
    };

    const handleRequestDenied = ({ requestId }) => {
      setPendingRequests(prev => prev.filter(req => req.id !== requestId));
    };

    const handleParticipantLeft = ({ userName, reason }) => {
      if (reason === 'removed') {
        toast({
          title: "Participant Removed",
          description: `${userName} has been removed from the meeting`,
        });
      }
    };

    socket.on('newJoinRequest', handleJoinRequest);
    socket.on('joinRequestApproved', handleRequestApproved);
    socket.on('joinRequestDenied', handleRequestDenied);
    socket.on('participantLeft', handleParticipantLeft);

    return () => {
      socket.off('newJoinRequest', handleJoinRequest);
      socket.off('joinRequestApproved', handleRequestApproved);
      socket.off('joinRequestDenied', handleRequestDenied);
      socket.off('participantLeft', handleParticipantLeft);
    };
  }, [socket, isAdmin, toast]);

  // Listen for admin actions on participants
  useEffect(() => {
    if (!socket) return;

    const handleAdminMute = ({ muted, by }) => {
      if (muted !== isAudioMuted) {
        setIsAudioMuted(muted);
        toast({
          title: muted ? "You've been muted" : "You've been unmuted",
          description: `By ${by}`,
          variant: muted ? "destructive" : "default",
        });
      }
    };

    const handleAdminVideoDisable = ({ disabled, by }) => {
      if (disabled !== isVideoOff) {
        setIsVideoOff(disabled);
        toast({
          title: disabled ? "Your video has been disabled" : "Your video has been enabled",
          description: `By ${by}`,
          variant: disabled ? "destructive" : "default",
        });
      }
    };

    const handleRemovedFromMeeting = ({ by, reason }) => {
      toast({
        title: "Removed from Meeting",
        description: reason || `You have been removed by ${by}`,
        variant: "destructive",
      });
      
      setTimeout(() => {
        navigate('/');
      }, 3000);
    };

    socket.on('adminMuted', handleAdminMute);
    socket.on('adminVideoDisabled', handleAdminVideoDisable);
    socket.on('removedFromMeeting', handleRemovedFromMeeting);

    return () => {
      socket.off('adminMuted', handleAdminMute);
      socket.off('adminVideoDisabled', handleAdminVideoDisable);
      socket.off('removedFromMeeting', handleRemovedFromMeeting);
    };
  }, [socket, isAudioMuted, isVideoOff, navigate, toast]);

  const handleEndMeeting = () => {
    // Clear user info
    localStorage.removeItem('meetingAdmin');
    localStorage.removeItem('meetingUser');
    
    if (isAdmin) {
      // Notify all participants that admin is leaving
      socket.emit('adminEndMeeting', { roomName: roomId });
    }
    
    navigate("/");
  };
  
  const handleToggleAudio = async () => {
    const isNowMuted = toggleAudio();
    setIsAudioMuted(isNowMuted);
  };

  const handleToggleVideo = async () => {
    const isNowOff = toggleVideo();
    setIsVideoOff(isNowOff);
  };

  const copyRoomId = () => {
    const meetingUrl = `${window.location.origin}/meeting/${roomId}`;
    navigator.clipboard.writeText(meetingUrl);
    toast({ 
      title: "Meeting Link Copied!",
      description: "Share this link with others to join the meeting"
    });
  };
  
  const allParticipants = [
      { 
        id: 'local', 
        userName: userInfo?.userName || 'You', 
        isLocal: true, 
        isAudioMuted, 
        isVideoOff, 
        isAdmin 
      },
      ...Object.entries(remoteStreams).map(([peerId, data]) => ({
          id: peerId,
          userName: data.userName,
          isAudioMuted: data.isAudioMuted, 
          isVideoOff: data.isVideoOff,
          isAdmin: data.isAdmin || false,
      }))
  ];

  if (!userInfo) {
    return (
      <div className="h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p>Loading meeting...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-background flex flex-col text-foreground">
      {/* Header */}
      <div className="bg-card border-b border-border px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
              <span className="font-semibold flex items-center gap-2">
                Meeting In Progress
                {isAdmin && (
                  <Badge variant="outline" className="text-warning border-warning">
                    <Crown className="h-3 w-3 mr-1" />
                    Host
                  </Badge>
                )}
              </span>
              <Badge variant="secondary">{allParticipants.length} participants</Badge>
              {pendingRequests.length > 0 && isAdmin && (
                <Badge variant="outline" className="text-warning border-warning animate-pulse">
                  {pendingRequests.length} waiting
                </Badge>
              )}
          </div>
          <div className="flex items-center gap-2 bg-muted px-3 py-1.5 rounded-lg border">
            <span className="text-sm font-medium">Meeting ID:</span>
            <code className="text-primary font-mono text-sm">{roomId}</code>
            <Button variant="ghost" size="sm" onClick={copyRoomId} className="h-7 w-7 p-0">
              <Copy className="h-4 w-4" />
            </Button>
          </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Main Video Area */}
        <div className="flex-1 p-4 overflow-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <ParticipantTile 
                    stream={localStream} 
                    userName={userInfo.userName || "You"} 
                    isLocal={true} 
                    isVideoOff={isVideoOff} 
                    isAudioMuted={isAudioMuted}
                    isAdmin={isAdmin}
                />
                
                {Object.entries(remoteStreams).map(([peerId, { combinedStream, userName, isVideoOff, isAudioMuted, isAdmin: peerIsAdmin }]) => (
                    <ParticipantTile
                        key={peerId}
                        stream={combinedStream}
                        userName={userName}
                        isVideoOff={isVideoOff}
                        isAudioMuted={isAudioMuted}
                        isAdmin={peerIsAdmin}
                    />
                ))}
            </div>
        </div>

        {/* Sidebar - Participants or Admin Panel */}
        {(showParticipants || (showAdminPanel && isAdmin)) && (
          <div className="flex">
            {/* Regular Participants Panel */}
            {showParticipants && !showAdminPanel && (
              <div className="w-80 bg-card border-l border-border flex flex-col">
                <div className="p-4 border-b">
                  <h3 className="font-bold flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    Participants ({allParticipants.length})
                  </h3>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                  {allParticipants.map((participant) => (
                      <div key={participant.id} className="flex items-center justify-between p-2 hover:bg-muted rounded-lg">
                        <div className="flex items-center gap-3">
                            <Avatar>
                               <AvatarFallback>{participant.userName.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm">{participant.userName}</span>
                                {participant.isLocal && <Badge variant="outline" className="text-xs">You</Badge>}
                                {participant.isAdmin && <Crown className="h-3 w-3 text-warning" />}
                              </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            {participant.isAudioMuted ? 
                                <MicOff className="h-4 w-4 text-destructive" /> : 
                                <Mic className="h-4 w-4 text-success" />
                            }
                        </div>
                      </div>
                  ))}
                </div>
              </div>
            )}

            {/* Admin Panel */}
            {showAdminPanel && isAdmin && (
              <AdminPanel 
                isAdmin={isAdmin}
                participants={allParticipants}
                pendingRequests={pendingRequests}
              />
            )}
          </div>
        )}
      </div>

      {/* Fixed Controls */}
      <div className="bg-card border-t border-border p-4">
        <div className="flex items-center justify-center gap-3">
          <Button 
            variant={isAudioMuted ? "destructive" : "secondary"} 
            size="icon" 
            onClick={handleToggleAudio} 
            className="w-12 h-12 rounded-full"
            title={isAudioMuted ? "Unmute" : "Mute"}
          >
            {isAudioMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </Button>
          
          <Button 
            variant={isVideoOff ? "destructive" : "secondary"} 
            size="icon"
            onClick={handleToggleVideo} 
            className="w-12 h-12 rounded-full"
            title={isVideoOff ? "Start Video" : "Stop Video"}
          >
            {isVideoOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
          </Button>
          
          <Button 
            variant="secondary" 
            size="icon"
            className="w-12 h-12 rounded-full"
            disabled 
            title="Share Screen"
          >
            <Monitor className="h-5 w-5" />
          </Button>
          
          <Button 
            variant={showParticipants && !showAdminPanel ? "default" : "secondary"} 
            size="icon"
            onClick={() => {
              setShowParticipants(!showParticipants);
              setShowAdminPanel(false);
            }} 
            className="w-12 h-12 rounded-full"
            title="Participants"
          >
            <Users className="h-5 w-5" />
            {pendingRequests.length > 0 && isAdmin && (
              <span className="absolute -top-1 -right-1 bg-warning text-warning-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {pendingRequests.length}
              </span>
            )}
          </Button>

          {isAdmin && (
            <Button 
              variant={showAdminPanel ? "default" : "secondary"} 
              size="icon"
              onClick={() => {
                setShowAdminPanel(!showAdminPanel);
                setShowParticipants(false);
              }} 
              className="w-12 h-12 rounded-full relative"
              title="Admin Controls"
            >
              <Shield className="h-5 w-5" />
              {pendingRequests.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {pendingRequests.length}
                </span>
              )}
            </Button>
          )}
          
          <div className="w-px h-8 bg-border mx-2" />
          
          <Button 
            variant="destructive" 
            size="icon"
            onClick={handleEndMeeting} 
            className="w-12 h-12 rounded-full"
            title="Leave Meeting"
          >
            <PhoneOff className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Meeting;