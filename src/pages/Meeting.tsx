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
  VolumeX
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

  // Get dominant speakers (local user + top 7 others)
  const dominantSpeakers = participants.filter(p => p.isLocal || participants.indexOf(p) < 8).slice(0, 8);
  const otherParticipants = participants.filter(p => !p.isLocal && participants.indexOf(p) >= 7);

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

  return (
    <div className="h-screen bg-meeting-bg flex flex-col">
      {/* Header */}
      <div className="bg-meeting-sidebar border-b border-video-border px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-success rounded-full animate-pulse" />
            <span className="text-white font-medium">Meeting In Progress</span>
          </div>
          <Badge variant="secondary" className="bg-meeting-controls text-white border-video-border">
            {participants.length} participants
          </Badge>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-meeting-controls px-3 py-2 rounded-lg">
            <span className="text-white text-sm">Room ID:</span>
            <code className="text-primary-glow font-mono">{roomId}</code>
            <Button variant="ghost" size="sm" onClick={copyRoomId} className="text-white hover:bg-video-border">
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          
          <Button variant="ghost" size="sm" onClick={toggleScreenShare} className="text-white hover:bg-meeting-controls">
            <Monitor className="h-4 w-4" />
          </Button>
          
          <Button variant="ghost" size="sm" onClick={() => setShowChat(!showChat)} className="text-white hover:bg-meeting-controls">
            <MessageSquare className="h-4 w-4" />
          </Button>
          
          <Button variant="ghost" size="sm" className="text-white hover:bg-meeting-controls">
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex">
        {/* Video Grid */}
        <div className="flex-1 p-6">
          {/* Dominant Speakers Grid */}
          <div className="grid grid-cols-4 gap-4 h-full">
            {dominantSpeakers.map((participant) => (
              <Card key={participant.id} className="bg-meeting-controls border-video-border relative overflow-hidden group">
                <div className="aspect-video bg-secondary/20 flex items-center justify-center relative">
                  {participant.isVideoOff ? (
                    <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center">
                      <span className="text-white font-semibold text-lg">
                        {participant.name.split(' ').map(n => n[0]).join('')}
                      </span>
                    </div>
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary-glow/20 flex items-center justify-center">
                      <Video className="h-8 w-8 text-white/50" />
                    </div>
                  )}
                  
                  {/* Participant Controls Overlay */}
                  <div className="absolute bottom-2 left-2 flex items-center gap-2">
                    {participant.isAudioMuted && (
                      <div className="w-6 h-6 bg-destructive rounded-full flex items-center justify-center">
                        <MicOff className="h-3 w-3 text-white" />
                      </div>
                    )}
                    {participant.isSpeaking && (
                      <div className="w-6 h-6 bg-success rounded-full flex items-center justify-center animate-pulse">
                        <Volume2 className="h-3 w-3 text-white" />
                      </div>
                    )}
                  </div>
                  
                  <div className="absolute bottom-2 right-2">
                    <span className="text-white text-sm bg-black/50 px-2 py-1 rounded">
                      {participant.name}
                    </span>
                  </div>
                  
                  {participant.isLocal && (
                    <Badge className="absolute top-2 left-2 bg-primary text-white">
                      You
                    </Badge>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Sidebar for Participants */}
        {showParticipants && (
          <div className="w-80 bg-meeting-sidebar border-l border-video-border">
            <div className="p-4">
              <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                <Users className="h-5 w-5" />
                Participants ({participants.length})
              </h3>
              
              <div className="space-y-2">
                {participants.map((participant) => (
                  <div key={participant.id} className="flex items-center justify-between p-3 bg-meeting-controls rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                        <span className="text-white text-sm font-semibold">
                          {participant.name.split(' ').map(n => n[0]).join('')}
                        </span>
                      </div>
                      <span className="text-white">{participant.name}</span>
                      {participant.isLocal && <Badge variant="secondary" className="text-xs">You</Badge>}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {participant.isAudioMuted ? (
                        <MicOff className="h-4 w-4 text-destructive" />
                      ) : (
                        <Mic className="h-4 w-4 text-success" />
                      )}
                      {!participant.isLocal && (
                        <Button variant="ghost" size="sm" className="text-white hover:bg-video-border">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              
              {otherParticipants.length > 0 && (
                <Button variant="ghost" className="w-full mt-4 text-white hover:bg-meeting-controls">
                  Show More Participants ({otherParticipants.length})
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Meeting Controls */}
      <div className="bg-meeting-sidebar border-t border-video-border px-6 py-4">
        <div className="flex items-center justify-center gap-4">
          <Button
            variant={isAudioMuted ? "destructive" : "secondary"}
            size="lg"
            onClick={toggleAudio}
            className="rounded-full w-12 h-12"
          >
            {isAudioMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </Button>
          
          <Button
            variant={isVideoOff ? "destructive" : "secondary"}
            size="lg"
            onClick={toggleVideo}
            className="rounded-full w-12 h-12"
          >
            {isVideoOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
          </Button>
          
          <Button
            variant={isScreenSharing ? "default" : "secondary"}
            size="lg"
            onClick={toggleScreenShare}
            className="rounded-full w-12 h-12"
          >
            <Monitor className="h-5 w-5" />
          </Button>
          
          <Button
            variant="secondary"
            size="lg"
            onClick={() => setShowParticipants(!showParticipants)}
            className="rounded-full w-12 h-12"
          >
            <Users className="h-5 w-5" />
          </Button>
          
          <Button
            variant="destructive"
            size="lg"
            onClick={handleEndMeeting}
            className="rounded-full w-12 h-12 ml-8"
          >
            <PhoneOff className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Meeting;