import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Landing from "./pages/Landing";
import Meeting from "./pages/Meeting";
import WaitingRoom from "./pages/WaitingRoom";
import NotFound from "./pages/NotFound";
import { SocketProvider } from "@/lib/socket.jsx";

const queryClient = new QueryClient();

const App = () => (
  <SocketProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/meeting/:roomId" element={<Meeting />} />
            <Route path="/waiting/:roomId" element={<WaitingRoom />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </SocketProvider>
);

export default App;