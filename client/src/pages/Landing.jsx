import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Video, Users, Monitor, Shield, Zap, Globe, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const Landing = () => {
  const navigate = useNavigate();
  const [isStarting, setIsStarting] = useState(false);
  const [showNameDialog, setShowNameDialog] = useState(false);
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const [userName, setUserName] = useState("");
  const [roomId, setRoomId] = useState("");

  const handleStartMeeting = () => {
    setShowNameDialog(true);
  };

  const handleJoinMeeting = () => {
    setShowJoinDialog(true);
  };

  const createMeetingRoom = () => {
    if (!userName.trim()) return;
    
    setIsStarting(true);
    const generatedRoomId = `MTG-${Math.random().toString(36).substring(2, 11)}`;
    
    // Store admin info in localStorage for the meeting page
    localStorage.setItem('meetingAdmin', JSON.stringify({
      userName: userName.trim(),
      roomId: generatedRoomId,
      isAdmin: true
    }));
    
    navigate(`/meeting/${generatedRoomId}`);
  };

  const joinMeetingRoom = () => {
    if (!userName.trim() || !roomId.trim()) return;
    
    setIsStarting(true);
    
    // Store user info for joining
    localStorage.setItem('meetingUser', JSON.stringify({
      userName: userName.trim(),
      roomId: roomId.trim(),
      isAdmin: false
    }));
    
    navigate(`/waiting/${roomId.trim()}`);
  };

  const features = [
    {
      icon: Video,
      title: "HD Video Calls",
      description: "Crystal clear video quality for seamless communication."
    },
    {
      icon: Monitor,
      title: "Screen Sharing",
      description: "Share your screen or applications in real-time."
    },
    {
      icon: Shield,
      title: "Admin Controls",
      description: "Full meeting control with waiting room and permissions."
    },
    {
      icon: Zap,
      title: "Instant Meetings",
      description: "Start or join meetings instantly with a single click."
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center">
                <Video className="h-5 w-5 text-white" />
              </div>
              <span className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                Agora Connect
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-6">
        <div className="container mx-auto text-center">
          <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-foreground via-primary to-primary-glow bg-clip-text text-transparent leading-tight">
            Seamless Video Meetings
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto leading-relaxed">
            Connect and collaborate with crystal-clear video quality and enterprise-grade security.
          </p>
          <div className="flex justify-center items-center gap-4 flex-wrap">
            <Button
              size="lg"
              onClick={handleStartMeeting}
              disabled={isStarting}
              className="bg-gradient-primary hover:opacity-90 text-white shadow-elegant px-8 py-6 text-lg font-semibold rounded-xl transition-all duration-300 transform hover:scale-105"
            >
              <Video className="mr-2 h-5 w-5" />
              Start Meeting
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={handleJoinMeeting}
              disabled={isStarting}
              className="px-8 py-6 text-lg font-semibold rounded-xl transition-all duration-300 transform hover:scale-105"
            >
              <Users className="mr-2 h-5 w-5" />
              Join Meeting
            </Button>
          </div>
        </div>
      </section>

      {/* Start Meeting Dialog */}
      <Dialog open={showNameDialog} onOpenChange={setShowNameDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Video className="h-5 w-5 text-primary" />
              Start New Meeting
            </DialogTitle>
            <DialogDescription>
              Enter your name to create and host a new meeting room.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="admin-name">Your Name</Label>
              <Input
                id="admin-name"
                placeholder="Enter your full name"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && createMeetingRoom()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNameDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={createMeetingRoom}
              disabled={!userName.trim() || isStarting}
              className="bg-gradient-primary text-white"
            >
              {isStarting ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Creating...
                </div>
              ) : (
                <>Create Meeting</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Join Meeting Dialog */}
      <Dialog open={showJoinDialog} onOpenChange={setShowJoinDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Join Meeting
            </DialogTitle>
            <DialogDescription>
              Enter your name and the meeting room ID to join.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="join-name">Your Name</Label>
              <Input
                id="join-name"
                placeholder="Enter your full name"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="room-id">Meeting ID</Label>
              <Input
                id="room-id"
                placeholder="Enter meeting ID (e.g., MTG-ABC123)"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && joinMeetingRoom()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowJoinDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={joinMeetingRoom}
              disabled={!userName.trim() || !roomId.trim() || isStarting}
              className="bg-gradient-primary text-white"
            >
              {isStarting ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Joining...
                </div>
              ) : (
                <>Join Meeting</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Features Section */}
      <section id="features" className="py-20 px-6 bg-muted/50">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Powerful Features
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Everything you need for modern team collaboration.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="border-0 shadow-card bg-card/80 backdrop-blur-sm hover:shadow-elegant transition-all duration-300 group">
                <CardHeader>
                  <div className="w-12 h-12 bg-gradient-primary rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                    <feature.icon className="h-6 w-6 text-white" />
                  </div>
                  <CardTitle className="text-xl mb-2">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base leading-relaxed">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-card/50 py-8 px-6">
        <div className="container mx-auto text-center text-muted-foreground">
          © 2024 Agora Connect. All rights reserved.
        </div>
      </footer>
    </div>
  );
};

export default Landing;