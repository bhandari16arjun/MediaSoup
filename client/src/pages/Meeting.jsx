import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Mic, MicOff, Video, VideoOff, Monitor, PhoneOff, Users, Copy, Settings, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { useMediasoup } from "@/hooks/usemediasoup";
import { cn } from "@/lib/utils";

// This component is now smarter, showing the avatar fallback if the stream has no video tracks
const ParticipantTile = ({ stream, userName, isLocal = false, isVideoOff = false, isAudioMuted = false }) => {
    const videoRef = useRef(null);
    const hasVideo = stream && stream.getVideoTracks().length > 0;

    useEffect(() => {
        if (hasVideo && videoRef.current) {
            videoRef.current.srcObject = stream;
        }
    }, [stream, hasVideo]);

    return (
        <Card className="bg-card border-border relative overflow-hidden group w-full aspect-video">
            <div className="w-full h-full bg-muted/20 flex items-center justify-center relative">
                {isVideoOff || !hasVideo ? (
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
                </div>
                
                <div className="absolute bottom-2 right-2">
                    <span className="text-white text-sm bg-black/60 backdrop-blur-sm px-2 py-1 rounded-md shadow-md">
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
  
  const { localStream, remoteStreams, toggleAudio, toggleVideo } = useMediasoup();

  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [showParticipants, setShowParticipants] = useState(true);

  const handleEndMeeting = () => navigate("/");
  
  const handleToggleAudio = async () => {
    const isNowMuted = await toggleAudio();
    setIsAudioMuted(isNowMuted);
  };

  const handleToggleVideo = async () => {
    const isNowOff = await toggleVideo();
    setIsVideoOff(isNowOff);
  };

  const copyRoomId = () => {
    navigator.clipboard.writeText(roomId);
    toast({ title: "Room ID Copied!" });
  };
  
  const allParticipants = [
      { id: 'local', userName: 'You', isLocal: true, isAudioMuted, isVideoOff },
      ...Object.entries(remoteStreams).map(([peerId, data]) => ({
          id: peerId,
          userName: data.userName,
          isAudioMuted: data.isAudioMuted, 
          isVideoOff: data.isVideoOff,
      }))
  ];

  return (
    <div className="h-screen bg-background flex flex-col text-foreground">
      <div className="bg-card border-b border-border px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
              <span className="font-semibold">Meeting In Progress</span>
              <Badge variant="secondary">{allParticipants.length} participants</Badge>
          </div>
          <div className="flex items-center gap-2 bg-muted px-3 py-1.5 rounded-lg border">
            <span className="text-sm font-medium">Room ID:</span>
            <code className="text-primary font-mono text-sm">{roomId}</code>
            <Button variant="ghost" size="sm" onClick={copyRoomId} className="h-7 w-7 p-0">
              <Copy className="h-4 w-4" />
            </Button>
          </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 p-4 overflow-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <ParticipantTile 
                    stream={localStream} 
                    userName="You" 
                    isLocal={true} 
                    isVideoOff={isVideoOff} 
                    isAudioMuted={isAudioMuted}
                />
                
                {Object.entries(remoteStreams).map(([peerId, { combinedStream, userName, isVideoOff, isAudioMuted }]) => (
                    <ParticipantTile
                        key={peerId}
                        stream={combinedStream}
                        userName={userName}
                        isVideoOff={isVideoOff}
                        isAudioMuted={isAudioMuted}
                    />
                ))}
            </div>
        </div>

        {showParticipants && (
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
                        <span className="font-medium text-sm">{participant.userName} {participant.isLocal && <Badge variant="outline" className="ml-2">You</Badge>}</span>
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
      </div>

      <div className="bg-card border-t border-border p-4">
        <div className="flex items-center justify-center gap-4">
          <Button variant={isAudioMuted ? "destructive" : "secondary"} size="lg" onClick={handleToggleAudio} className="rounded-full w-14 h-14" title={isAudioMuted ? "Unmute" : "Mute"}>
            {isAudioMuted ? <MicOff /> : <Mic />}
          </Button>
          <Button variant={isVideoOff ? "destructive" : "secondary"} size="lg" onClick={handleToggleVideo} className="rounded-full w-14 h-14" title={isVideoOff ? "Start Video" : "Stop Video"}>
            {isVideoOff ? <VideoOff /> : <Video />}
          </Button>
          <Button variant="secondary" size="lg" className="rounded-full w-14 h-14" disabled title="Share Screen">
            <Monitor />
          </Button>
          <Button variant={showParticipants ? "default" : "secondary"} size="lg" onClick={() => setShowParticipants(!showParticipants)} className="rounded-full w-14 h-14" title="Participants">
            <Users />
          </Button>
          <div className="w-px h-8 bg-border mx-2" />
          <Button variant="destructive" size="lg" onClick={handleEndMeeting} className="rounded-full w-14 h-14" title="Leave Meeting">
            <PhoneOff />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Meeting;