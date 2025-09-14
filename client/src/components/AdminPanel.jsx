// client/src/components/AdminPanel.jsx
import { useState, useEffect } from "react";
import { 
  Shield, 
  UserCheck, 
  UserX, 
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  Crown,
  Clock,
  Settings,
  Ban,
  UserMinus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSocket } from "@/lib/socket";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const AdminPanel = ({ isAdmin, participants, pendingRequests = [] }) => {
  const socket = useSocket();
  const { toast } = useToast();

  if (!isAdmin) return null;

  const handleApproveUser = (requestId, userName) => {
    socket.emit('approveJoinRequest', { requestId });
    toast({
      title: "User Approved",
      description: `${userName} has been granted access to the meeting.`,
    });
  };

  const handleDenyUser = (requestId, userName, reason = "Access denied by host") => {
    socket.emit('denyJoinRequest', { requestId, reason });
    toast({
      title: "User Denied",
      description: `${userName}'s request has been declined.`,
    });
  };

  const handleMuteParticipant = (participantId, userName) => {
    socket.emit('adminMuteParticipant', { participantId, mute: true });
    toast({
      title: "Participant Muted",
      description: `${userName} has been muted.`,
    });
  };

  const handleUnmuteParticipant = (participantId, userName) => {
    socket.emit('adminMuteParticipant', { participantId, mute: false });
    toast({
      title: "Participant Unmuted",
      description: `${userName} has been unmuted.`,
    });
  };

  const handleDisableVideo = (participantId, userName) => {
    socket.emit('adminDisableVideo', { participantId, disable: true });
    toast({
      title: "Video Disabled",
      description: `${userName}'s video has been disabled.`,
    });
  };

  const handleEnableVideo = (participantId, userName) => {
    socket.emit('adminDisableVideo', { participantId, disable: false });
    toast({
      title: "Video Enabled",
      description: `${userName}'s video has been enabled.`,
    });
  };

  const handleRemoveParticipant = (participantId, userName) => {
    socket.emit('adminRemoveParticipant', { participantId });
    toast({
      title: "Participant Removed",
      description: `${userName} has been removed from the meeting.`,
      variant: "destructive",
    });
  };

  return (
    <Card className="w-80 h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Shield className="h-5 w-5 text-primary" />
          Admin Controls
        </CardTitle>
        <CardDescription>Manage meeting participants and requests</CardDescription>
      </CardHeader>
      
      <CardContent className="flex-1 p-0">
        <ScrollArea className="h-full">
          <div className="px-4 space-y-4">
            {/* Pending Join Requests */}
            {pendingRequests.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-warning" />
                  <span className="font-medium text-sm">Pending Requests</span>
                  <Badge variant="secondary" className="ml-auto">
                    {pendingRequests.length}
                  </Badge>
                </div>
                
                {pendingRequests.map((request) => (
                  <Card key={request.id} className="bg-warning/5 border-warning/20">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">
                            {request.userName.split(' ').map(n => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{request.userName}</p>
                          <p className="text-xs text-muted-foreground">Wants to join</p>
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleApproveUser(request.id, request.userName)}
                          className="flex-1 h-8 bg-success hover:bg-success/90"
                        >
                          <UserCheck className="h-3 w-3 mr-1" />
                          Admit
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDenyUser(request.id, request.userName)}
                          className="flex-1 h-8"
                        >
                          <UserX className="h-3 w-3 mr-1" />
                          Deny
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                
                <Separator />
              </div>
            )}

            {/* Participant Management */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Settings className="h-4 w-4 text-primary" />
                <span className="font-medium text-sm">Participant Controls</span>
              </div>
              
              {participants
                .filter(p => !p.isLocal)
                .map((participant) => (
                  <Card key={participant.id} className="bg-muted/30">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">
                            {participant.userName.split(' ').map(n => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{participant.userName}</p>
                          <div className="flex gap-1 mt-1">
                            {participant.isAudioMuted ? (
                              <Badge variant="destructive" className="text-xs px-1.5 py-0.5">
                                <MicOff className="h-2.5 w-2.5 mr-1" />
                                Muted
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs px-1.5 py-0.5">
                                <Mic className="h-2.5 w-2.5 mr-1" />
                                Audio
                              </Badge>
                            )}
                            {participant.isVideoOff ? (
                              <Badge variant="destructive" className="text-xs px-1.5 py-0.5">
                                <VideoOff className="h-2.5 w-2.5 mr-1" />
                                No Video
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs px-1.5 py-0.5">
                                <Video className="h-2.5 w-2.5 mr-1" />
                                Video
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-1.5">
                        {/* Audio Controls */}
                        {participant.isAudioMuted ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleUnmuteParticipant(participant.id, participant.userName)}
                            className="h-7 text-xs"
                          >
                            <Mic className="h-3 w-3 mr-1" />
                            Unmute
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleMuteParticipant(participant.id, participant.userName)}
                            className="h-7 text-xs"
                          >
                            <MicOff className="h-3 w-3 mr-1" />
                            Mute
                          </Button>
                        )}

                        {/* Video Controls */}
                        {participant.isVideoOff ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEnableVideo(participant.id, participant.userName)}
                            className="h-7 text-xs"
                          >
                            <Video className="h-3 w-3 mr-1" />
                            Enable
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleDisableVideo(participant.id, participant.userName)}
                            className="h-7 text-xs"
                          >
                            <VideoOff className="h-3 w-3 mr-1" />
                            Disable
                          </Button>
                        )}

                        {/* Remove Participant */}
                        <div className="col-span-2 mt-1">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                size="sm"
                                variant="destructive"
                                className="h-7 text-xs w-full"
                              >
                                <UserMinus className="h-3 w-3 mr-1" />
                                Remove
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remove Participant</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to remove {participant.userName} from the meeting? 
                                  This action cannot be undone and they will need to request to join again.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleRemoveParticipant(participant.id, participant.userName)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Remove
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              
              {participants.filter(p => !p.isLocal).length === 0 && (
                <div className="text-center py-8">
                  <p className="text-sm text-muted-foreground">No other participants in the meeting</p>
                </div>
              )}
            </div>

            {/* Admin Status */}
            <Separator />
            <div className="pb-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Crown className="h-4 w-4 text-warning" />
                <span>You are the meeting host</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                You have full control over this meeting room
              </p>
            </div>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default AdminPanel;