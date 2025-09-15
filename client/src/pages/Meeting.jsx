import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Mic, MicOff, Video, VideoOff, Monitor, PhoneOff, Users, Copy, Settings, Crown, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { useMediasoup } from "@/hooks/useMediasoup";
import { useSocket } from "@/lib/socket";
import { cn } from "@/lib/utils";

// Simple inline AdminPanel to keep this file self-contained.
// If a separate AdminPanel component exists, you can replace this with that import.
function AdminPanel({ pendingRequests, onApprove, onDeny }) {
  return (
    <Card className="p-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <Crown className="w-5 h-5" />
        <h3 className="text-lg font-semibold">Admin Controls</h3>
      </div>
      <div className="space-y-2">
        <div className="text-sm text-muted-foreground">Pending join requests</div>
        {pendingRequests.length === 0 ? (
          <div className="text-sm text-muted-foreground">No pending requests</div>
        ) : (
          pendingRequests.map((req) => (
            <div key={req.id} className="flex items-center justify-between rounded border p-2">
              <div className="flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarFallback>{(req.userName || "?").slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <span className="font-medium">{req.userName}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(req.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="default" onClick={() => onApprove(req.id)}>
                  Approve
                </Button>
                <Button size="sm" variant="destructive" onClick={() => onDeny(req.id)}>
                  Deny
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}

const ParticipantTile = ({ stream, userName, isLocal = false, isVideoOff = false, isAudioMuted = false, isAdmin = false }) => {
  const videoRef = useRef(null);
  const hasVideo = !!stream && stream.getVideoTracks().length > 0 && !isVideoOff;

  useEffect(() => {
    if (hasVideo && videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current
        .play()
        .catch(() => {
          // Autoplay might be blocked, ignore
        });
    }
  }, [stream, hasVideo]);

  return (
    <div className={cn("relative overflow-hidden rounded-lg border", isLocal ? "ring-2 ring-primary" : "")}>
      <div className="absolute top-2 left-2 z-10 flex items-center gap-2">
        <Badge variant="secondary" className="flex items-center gap-1">
          <Users className="w-3 h-3" />
          {userName || (isLocal ? "Me" : "Guest")}
        </Badge>
        {isAdmin && (
          <Badge variant="default" className="flex items-center gap-1">
            <Shield className="w-3 h-3" />
            Host
          </Badge>
        )}
        {isAudioMuted && (
          <Badge variant="destructive" className="flex items-center gap-1">
            <MicOff className="w-3 h-3" />
            Muted
          </Badge>
        )}
        {isVideoOff && (
          <Badge variant="outline" className="flex items-center gap-1">
            <VideoOff className="w-3 h-3" />
            Video Off
          </Badge>
        )}
      </div>

      <div className="aspect-video bg-muted flex items-center justify-center">
        {hasVideo ? (
          <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted={isLocal} />
        ) : (
          <div className="flex flex-col items-center justify-center p-8 text-muted-foreground">
            <Avatar className="h-16 w-16 mb-2">
              <AvatarFallback>{(userName || "U").slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="text-sm">{userName || (isLocal ? "Me" : "Waiting for video...")}</div>
          </div>
        )}
      </div>
    </div>
  );
};

const Meeting = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const socket = useSocket();
  const { toast } = useToast();

  // Pull mediasoup state and admin flag from the hook
  const { localStream, remoteStreams, toggleAudio, toggleVideo, isInitialized, isAdmin } = useMediasoup();

  // Admin pending requests list
  const [pendingRequests, setPendingRequests] = useState([]);
  
  // Local state for audio/video controls
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  // Subscribe to admin-only events
  useEffect(() => {
    if (!socket || !isAdmin) return;

    function onNewJoinRequest(req) {
      setPendingRequests((prev) => [req, ...prev]);
    }
    function onJoinRequestApproved({ requestId }) {
      setPendingRequests((prev) => prev.filter((r) => r.id !== requestId));
    }
    function onJoinRequestDenied({ requestId }) {
      setPendingRequests((prev) => prev.filter((r) => r.id !== requestId));
    }

    socket.on("newJoinRequest", onNewJoinRequest);
    socket.on("joinRequestApproved", onJoinRequestApproved);
    socket.on("joinRequestDenied", onJoinRequestDenied);

    // Fetch current pending requests in case admin reloads mid-session
    socket.emit("adminGetPendingRequests", (list) => {
      if (Array.isArray(list)) setPendingRequests(list);
    });

    return () => {
      socket.off("newJoinRequest", onNewJoinRequest);
      socket.off("joinRequestApproved", onJoinRequestApproved);
      socket.off("joinRequestDenied", onJoinRequestDenied);
    };
  }, [socket, isAdmin]);

  // Admin approve/deny handlers
  const approve = (requestId) => {
    if (!socket) return;
    socket.emit("approveJoinRequest", { requestId }, (res) => {
      if (res?.error) {
        toast({ title: "Approve failed", description: res.error, variant: "destructive" });
      } else {
        toast({ title: "Approved", description: "Participant approved." });
      }
    });
  };

  const deny = (requestId) => {
    if (!socket) return;
    socket.emit("denyJoinRequest", { requestId }, (res) => {
      if (res?.error) {
        toast({ title: "Deny failed", description: res.error, variant: "destructive" });
      } else {
        toast({ title: "Denied", description: "Request denied." });
      }
    });
  };

  // Build participant list: local + remotes
  const participants = useMemo(() => {
    const list = [];
    
    // Get current user info
    const adminInfo = localStorage.getItem("meetingAdmin");
    const userInfo = localStorage.getItem("meetingUser");
    const currentUser = adminInfo ? JSON.parse(adminInfo) : userInfo ? JSON.parse(userInfo) : null;
    
    // Add local participant
    list.push({
      key: "local",
      userName: currentUser?.userName || "Me",
      stream: localStream,
      isLocal: true,
      isVideoOff: isVideoOff || !localStream || localStream.getVideoTracks().length === 0,
      isAudioMuted: isAudioMuted || !localStream || localStream.getAudioTracks().every((t) => t.muted || t.enabled === false),
      isAdmin: !!isAdmin,
    });

    // Add remote participants
    for (const [peerId, data] of Object.entries(remoteStreams || {})) {
      list.push({
        key: peerId,
        userName: data.userName || `User ${peerId.slice(-4)}`,
        stream: data.combinedStream,
        isLocal: false,
        isVideoOff: !!data.isVideoOff,
        isAudioMuted: !!data.isAudioMuted,
        isAdmin: false,
      });
    }

    return list;
  }, [localStream, remoteStreams, isAdmin, isVideoOff, isAudioMuted]);

  // Toggle functions with proper state management
  const handleToggleAudio = () => {
    const newMutedState = toggleAudio();
    setIsAudioMuted(newMutedState);
    toast({ 
      title: newMutedState ? "Audio Muted" : "Audio Unmuted", 
      description: newMutedState ? "Your microphone is now muted" : "Your microphone is now active" 
    });
  };

  const handleToggleVideo = async () => {
    const newVideoState = await toggleVideo();
    setIsVideoOff(newVideoState);
    toast({ 
      title: newVideoState ? "Video Off" : "Video On", 
      description: newVideoState ? "Your camera is now off" : "Your camera is now on" 
    });
  };

  // Basic toolbar actions
  const handleLeave = () => {
    // best-effort cleanup; server will also handle socket disconnect
    navigate("/");
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast({ title: "Link copied", description: "Meeting link copied to clipboard." });
    } catch {
      toast({ title: "Copy failed", description: "Could not copy meeting link.", variant: "destructive" });
    }
  };

  return (
    <div className="w-full h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-card/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Video className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold">Meeting</h1>
          </div>
          <Badge variant="secondary" className="text-sm px-3 py-1">{roomId}</Badge>
          {isAdmin && (
            <Badge variant="default" className="flex items-center gap-1 px-3 py-1">
              <Shield className="w-4 h-4" />
              Host
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="text-sm text-muted-foreground">
            {participants.length} participant{participants.length !== 1 ? 's' : ''}
          </div>
          <Button variant="outline" size="sm" onClick={handleCopyLink}>
            <Copy className="w-4 h-4 mr-2" />
            Copy link
          </Button>
          <Button variant="destructive" size="sm" onClick={handleLeave}>
            <PhoneOff className="w-4 h-4 mr-2" />
            Leave
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Video Grid */}
        <div className="flex-1 p-4">
          {/* Admin Controls */}
          {isAdmin && (
            <div className="mb-4">
              <AdminPanel pendingRequests={pendingRequests} onApprove={approve} onDeny={deny} />
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 h-full">
            {participants.map((p) => (
              <ParticipantTile
                key={p.key}
                stream={p.stream}
                userName={p.userName}
                isLocal={p.isLocal}
                isVideoOff={p.isVideoOff}
                isAudioMuted={p.isAudioMuted}
                isAdmin={p.isAdmin}
              />
            ))}
          </div>
        </div>

        {/* Participants Sidebar */}
        <div className="w-80 border-l bg-card/30 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Users className="w-5 h-5" />
              Participants ({participants.length})
            </h3>
            
            <div className="space-y-2">
              {participants.map((p) => (
                <div key={p.key} className="flex items-center gap-3 p-3 rounded-lg bg-card/50 border">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="text-sm">
                      {p.userName.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{p.userName}</span>
                      {p.isAdmin && (
                        <Badge variant="default" className="text-xs px-2 py-0.5">
                          <Shield className="w-3 h-3 mr-1" />
                          Host
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      {p.isAudioMuted && (
                        <Badge variant="destructive" className="text-xs px-2 py-0.5">
                          <MicOff className="w-3 h-3 mr-1" />
                          Muted
                        </Badge>
                      )}
                      {p.isVideoOff && (
                        <Badge variant="outline" className="text-xs px-2 py-0.5">
                          <VideoOff className="w-3 h-3 mr-1" />
                          Video Off
                        </Badge>
                      )}
                      {!p.isAudioMuted && !p.isVideoOff && (
                        <Badge variant="secondary" className="text-xs px-2 py-0.5">
                          Active
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
        <Card className="px-6 py-3 flex items-center gap-4 bg-card/95 backdrop-blur-sm border shadow-lg">
          <Button 
            variant={isAudioMuted ? "destructive" : "outline"} 
            onClick={handleToggleAudio}
            className="flex items-center gap-2"
          >
            {isAudioMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            {isAudioMuted ? "Unmute" : "Mute"}
          </Button>
          <Button 
            variant={isVideoOff ? "destructive" : "outline"} 
            onClick={handleToggleVideo}
            className="flex items-center gap-2"
          >
            {isVideoOff ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
            {isVideoOff ? "Turn On Video" : "Turn Off Video"}
          </Button>
          <Button variant="outline" disabled title="Coming soon">
            <Monitor className="w-4 h-4 mr-2" />
            Share Screen
          </Button>
          <Button variant="outline" disabled title="Settings coming soon">
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </Button>
        </Card>
      </div>

      {!isInitialized && (
        <div className="fixed inset-x-0 bottom-20 flex items-center justify-center z-40">
          <Badge variant="outline" className="px-4 py-2 text-sm">Initializing media...</Badge>
        </div>
      )}
    </div>
  );
};

export default Meeting;
