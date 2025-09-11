import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  Monitor, 
  PhoneOff, 
  Users, 
  Copy, 
  Settings, 
  MessageSquare,
  MoreVertical,
  UserCheck,
  UserX,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";

interface Participant {
  id: string;
  name: string;
  isAudioMuted: boolean;
  isVideoOff: boolean;
  isLocal: boolean;
  isSpeaking: boolean;
}

const Meeting = () => {
  const navigate = useNavigate();
  const [roomId] = useState("MTG-" + Math.random().toString(36).substring(2, 8).toUpperCase());
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Local video preview state for screen sharing
  const [videoPosition, setVideoPosition] = useState({ x: 24, y: 24 });
  const [videoSize, setVideoSize] = useState({ width: 256, height: 144 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  
  // Mock participants data
  const [participants, setParticipants] = useState<Participant[]>([
    { id: "local", name: "You", isAudioMuted: false, isVideoOff: false, isLocal: true, isSpeaking: false },
    { id: "1", name: "John Smith", isAudioMuted: false, isVideoOff: false, isLocal: false, isSpeaking: true },
    { id: "2", name: "Sarah Johnson", isAudioMuted: true, isVideoOff: false, isLocal: false, isSpeaking: false },
    { id: "3", name: "Mike Chen", isAudioMuted: false, isVideoOff: false, isLocal: false, isSpeaking: false },
    { id: "4", name: "Emily Davis", isAudioMuted: false, isVideoOff: true, isLocal: false, isSpeaking: false },
    { id: "5", name: "Alex Wilson", isAudioMuted: false, isVideoOff: false, isLocal: false, isSpeaking: false },
    { id: "6", name: "Lisa Brown", isAudioMuted: true, isVideoOff: false, isLocal: false, isSpeaking: false },
    { id: "7", name: "David Lee", isAudioMuted: false, isVideoOff: false, isLocal: false, isSpeaking: false },
  ]);

  // Get dominant speakers (local user + top 5 others) - max 6 total
  const dominantSpeakers = participants.filter(p => p.isLocal || participants.indexOf(p) < 6).slice(0, 6);
  const otherParticipants = participants.filter(p => !p.isLocal && participants.indexOf(p) >= 5);

  const copyRoomId = () => {
    navigator.clipboard.writeText(roomId);
    toast({
      title: "Room ID Copied",
      description: "Room ID has been copied to clipboard",
    });
  };

  const handleEndMeeting = () => {
    if (window.confirm("Are you sure you want to end the meeting?")) {
      navigate("/");
    }
  };

  const toggleAudio = () => {
    setIsAudioMuted(!isAudioMuted);
    setParticipants(prev => prev.map(p => 
      p.isLocal ? { ...p, isAudioMuted: !isAudioMuted } : p
    ));
  };

  const toggleVideo = () => {
    setIsVideoOff(!isVideoOff);
    setParticipants(prev => prev.map(p => 
      p.isLocal ? { ...p, isVideoOff: !isVideoOff } : p
    ));
  };

  const toggleScreenShare = () => {
    setIsScreenSharing(!isScreenSharing);
    toast({
      title: isScreenSharing ? "Screen sharing stopped" : "Screen sharing started",
      description: isScreenSharing ? "You stopped sharing your screen" : "You're now sharing your screen",
    });
  };

  // Handle dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    if (isResizing) return;
    setIsDragging(true);
    const rect = e.currentTarget.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging && !isResizing) {
      const newX = e.clientX - dragOffset.x;
      const newY = e.clientY - dragOffset.y;
      
      // Keep within screen bounds
      const maxX = window.innerWidth - videoSize.width;
      const maxY = window.innerHeight - videoSize.height - 120; // Account for footer
      
      setVideoPosition({
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY))
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setIsResizing(false);
  };

  // Handle resizing
  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsResizing(true);
  };

  const handleResizeMove = (e: MouseEvent) => {
    if (isResizing) {
      const newWidth = Math.max(200, Math.min(400, e.clientX - videoPosition.x));
      const newHeight = Math.max(112, Math.min(225, e.clientY - videoPosition.y));
      
      setVideoSize({ width: newWidth, height: newHeight });
    }
  };

  useEffect(() => {
    if (isDragging || isResizing) {
      const moveHandler = isDragging ? handleMouseMove : handleResizeMove;
      document.addEventListener('mousemove', moveHandler);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', moveHandler);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, isResizing, dragOffset, videoPosition, videoSize]);

  return (
    <div className="h-screen bg-background flex flex-col transition-colors duration-300">
      {/* Header */}
      <div className="bg-card border-b border-border px-6 py-4 flex items-center justify-between backdrop-blur-sm bg-opacity-90">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-success rounded-full animate-pulse shadow-sm" />
            <span className="text-foreground font-semibold">Meeting In Progress</span>
          </div>
          <Badge variant="secondary" className="bg-muted text-foreground border-border px-3 py-1">
            {participants.length} participants
          </Badge>
          <div className="text-xs text-muted-foreground">
            {new Date().toLocaleTimeString()}
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-muted px-4 py-2 rounded-xl border border-border">
            <span className="text-foreground text-sm font-medium">Room ID:</span>
            <code className="text-primary font-mono text-sm bg-background px-2 py-1 rounded">{roomId}</code>
            <Button variant="ghost" size="sm" onClick={copyRoomId} className="text-foreground hover:bg-background h-8 w-8 p-0">
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="text-foreground hover:bg-muted h-10 w-10 p-0"
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
          
          <Button variant="ghost" size="sm" onClick={() => setShowChat(!showChat)} className="text-foreground hover:bg-muted h-10 w-10 p-0">
            <MessageSquare className="h-4 w-4" />
          </Button>
          
          <Button variant="ghost" size="sm" className="text-foreground hover:bg-muted h-10 w-10 p-0">
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex relative pb-32">
        {/* Video Grid or Screen Share */}
        <div className="flex-1 p-6">
          {isScreenSharing ? (
            /* Screen Share Mode */
            <div className="relative h-full">
              <Card className="h-full bg-card border-border relative overflow-hidden shadow-xl">
                <div className="h-full bg-gradient-to-br from-primary/10 to-primary-glow/10 flex items-center justify-center relative">
                  <div className="text-center">
                    <Monitor className="h-16 w-16 text-primary mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-foreground mb-2">Screen Sharing Active</h3>
                    <p className="text-muted-foreground">Your screen is being shared with all participants</p>
                  </div>
                  
                  {/* Screen sharing controls overlay */}
                  <div className="absolute top-4 left-4">
                    <Badge className="bg-success text-white animate-pulse">
                      <Monitor className="h-3 w-3 mr-1" />
                      Presenting
                    </Badge>
                  </div>
                </div>
              </Card>
              
              {/* Local Video Preview - Draggable and Resizable */}
              <Card 
                className="absolute bg-card border-border overflow-hidden shadow-2xl cursor-move select-none hover:shadow-3xl transition-shadow duration-200"
                style={{ 
                  left: videoPosition.x, 
                  top: videoPosition.y, 
                  width: videoSize.width, 
                  height: videoSize.height 
                }}
                onMouseDown={handleMouseDown}
              >
                <div className="h-full bg-gradient-to-br from-primary/20 to-primary-glow/20 flex items-center justify-center relative">
                  {isVideoOff ? (
                    <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center">
                      <span className="text-white font-semibold">
                        {participants.find(p => p.isLocal)?.name.split(' ').map(n => n[0]).join('') || 'Y'}
                      </span>
                    </div>
                  ) : (
                    <Video className="h-6 w-6 text-white/70" />
                  )}
                  
                  <div className="absolute bottom-2 left-2 flex items-center gap-1">
                    {isAudioMuted && (
                      <div className="w-4 h-4 bg-destructive rounded-full flex items-center justify-center">
                        <MicOff className="h-2 w-2 text-white" />
                      </div>
                    )}
                  </div>
                  
                  <div className="absolute bottom-2 right-2">
                    <span className="text-white text-xs bg-black/50 px-1 py-0.5 rounded">
                      You
                    </span>
                  </div>
                  
                  {/* Resize handle */}
                  <div 
                    className="absolute bottom-0 right-0 w-4 h-4 bg-primary/20 cursor-se-resize"
                    onMouseDown={handleResizeMouseDown}
                  >
                    <div className="absolute bottom-1 right-1 w-2 h-2 border-r-2 border-b-2 border-white/50" />
                  </div>
                </div>
              </Card>
            </div>
          ) : (
            /* Normal Participant Grid */
            <div className="grid grid-cols-3 gap-6 h-full content-center justify-items-center px-8">
              {dominantSpeakers.map((participant) => (
                <Card key={participant.id} className="bg-card border-border relative overflow-hidden group hover:shadow-lg transition-all duration-300 w-80 h-60">
                  <div className="w-full h-40 bg-muted/20 flex items-center justify-center relative">
                    {participant.isVideoOff ? (
                      <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center shadow-lg">
                        <span className="text-white font-semibold text-lg">
                          {participant.name.split(' ').map(n => n[0]).join('')}
                        </span>
                      </div>
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary-glow/20 flex items-center justify-center">
                        <Video className="h-8 w-8 text-foreground/50" />
                      </div>
                    )}
                    
                    {/* Participant Controls Overlay */}
                    <div className="absolute bottom-3 left-3 flex items-center gap-2">
                      {participant.isAudioMuted && (
                        <div className="w-6 h-6 bg-destructive rounded-full flex items-center justify-center shadow-md">
                          <MicOff className="h-3 w-3 text-white" />
                        </div>
                      )}
                      {participant.isSpeaking && (
                        <div className="w-6 h-6 bg-success rounded-full flex items-center justify-center animate-pulse shadow-md">
                          <Volume2 className="h-3 w-3 text-white" />
                        </div>
                      )}
                    </div>
                    
                    <div className="absolute bottom-3 right-3">
                      <span className="text-white text-sm bg-black/60 backdrop-blur-sm px-2 py-1 rounded-md shadow-md">
                        {participant.name}
                      </span>
                    </div>
                    
                    {participant.isLocal && (
                      <Badge className="absolute top-3 left-3 bg-primary text-white shadow-md">
                        You
                      </Badge>
                    )}
                    
                    {/* Hover effect */}
                    <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  </div>
                  
                  {/* White bottom section */}
                  <div className="h-20 bg-white border-t border-border flex items-center justify-center">
                    <span className="text-foreground font-medium text-center px-4">
                      {participant.name}
                    </span>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Sidebar for Participants */}
        {showParticipants && (
          <div className="w-80 bg-card border-l border-border backdrop-blur-sm">
            <div className="p-6">
              <h3 className="text-foreground font-bold mb-6 flex items-center gap-3">
                <Users className="h-5 w-5 text-primary" />
                Participants ({participants.length})
              </h3>
              
              <div className="space-y-3 max-h-[calc(100vh-300px)] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
                {participants.map((participant) => (
                  <div key={participant.id} className="flex items-center justify-between p-4 bg-muted rounded-xl border border-border hover:shadow-md transition-all duration-200">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center shadow-md">
                        <span className="text-white text-sm font-bold">
                          {participant.name.split(' ').map(n => n[0]).join('')}
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-foreground font-medium">{participant.name}</span>
                        {participant.isLocal && <Badge variant="secondary" className="text-xs w-fit">You</Badge>}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {participant.isAudioMuted ? (
                        <div className="w-8 h-8 bg-destructive/10 rounded-full flex items-center justify-center">
                          <MicOff className="h-4 w-4 text-destructive" />
                        </div>
                      ) : (
                        <div className="w-8 h-8 bg-success/10 rounded-full flex items-center justify-center">
                          <Mic className="h-4 w-4 text-success" />
                        </div>
                      )}
                      {participant.isVideoOff && (
                        <div className="w-8 h-8 bg-warning/10 rounded-full flex items-center justify-center">
                          <VideoOff className="h-4 w-4 text-warning" />
                        </div>
                      )}
                      {!participant.isLocal && (
                        <Button variant="ghost" size="sm" className="text-foreground hover:bg-background h-8 w-8 p-0">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              
              {otherParticipants.length > 0 && (
                <Button variant="ghost" className="w-full mt-6 text-foreground hover:bg-muted border border-border rounded-xl py-3">
                  Show More Participants ({otherParticipants.length})
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Meeting Controls - Fixed at bottom */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border px-6 py-6 backdrop-blur-sm bg-opacity-90 z-50">
        <div className="flex items-center justify-center gap-4">
          <Button
            variant={isAudioMuted ? "destructive" : "secondary"}
            size="lg"
            onClick={toggleAudio}
            className="rounded-full w-14 h-14 shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
            title={isAudioMuted ? "Unmute microphone" : "Mute microphone"}
          >
            {isAudioMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </Button>
          
          <Button
            variant={isVideoOff ? "destructive" : "secondary"}
            size="lg"
            onClick={toggleVideo}
            className="rounded-full w-14 h-14 shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
            title={isVideoOff ? "Turn on camera" : "Turn off camera"}
          >
            {isVideoOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
          </Button>
          
          <Button
            variant={isScreenSharing ? "default" : "secondary"}
            size="lg"
            onClick={toggleScreenShare}
            className="rounded-full w-14 h-14 shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
            title={isScreenSharing ? "Stop screen share" : "Start screen share"}
          >
            <Monitor className="h-5 w-5" />
          </Button>
          
          <Button
            variant="secondary"
            size="lg"
            onClick={() => setShowParticipants(!showParticipants)}
            className="rounded-full w-14 h-14 shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
            title="Toggle participants panel"
          >
            <Users className="h-5 w-5" />
          </Button>
          
          <div className="w-px h-8 bg-border mx-2" />
          
          <Button
            variant="destructive"
            size="lg"
            onClick={handleEndMeeting}
            className="rounded-full w-14 h-14 shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 bg-destructive hover:bg-destructive/90"
            title="End meeting"
          >
            <PhoneOff className="h-5 w-5" />
          </Button>
        </div>
        
        {/* Meeting duration */}
        <div className="text-center mt-4">
          <span className="text-sm text-muted-foreground dark:text-white/60">
            Meeting Duration: {Math.floor(Math.random() * 45 + 5)} minutes
          </span>
        </div>
      </div>
    </div>
  );
};

export default Meeting;