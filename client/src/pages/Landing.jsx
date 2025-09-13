import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Video, Users, Monitor, Shield, Zap, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const Landing = () => {
  const navigate = useNavigate();
  const [isStarting, setIsStarting] = useState(false);

  // THIS FUNCTION IS NOW CORRECTED
  const handleStartMeeting = () => {
    setIsStarting(true);
    // Generate a unique room ID
    const roomId = `MTG-${Math.random().toString(36).substring(2, 11)}`;
    
    // Navigate to the dynamic meeting room URL
    navigate(`/meeting/${roomId}`);
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
      title: "Secure & Private",
      description: "End-to-end encryption for all your meetings."
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
          <div className="flex justify-center items-center">
            <Button
              size="lg"
              onClick={handleStartMeeting}
              disabled={isStarting}
              className="bg-gradient-primary hover:opacity-90 text-white shadow-elegant px-8 py-6 text-lg font-semibold rounded-xl transition-all duration-300 transform hover:scale-105"
            >
              {isStarting ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Starting...
                </div>
              ) : (
                <>
                  <Video className="mr-2 h-5 w-5" />
                  Start Meeting Now
                </>
              )}
            </Button>
          </div>
        </div>
      </section>

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