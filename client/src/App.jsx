import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Landing from "./pages/Landing";
import Meeting from "./pages/Meeting";
import NotFound from "./pages/NotFound";
import { SocketProvider } from "@/lib/socket.jsx"; // Make sure to import the SocketProvider

const queryClient = new QueryClient();

const App = () => (
  // It's also important to wrap your app in the SocketProvider
  <SocketProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            
            {/* THIS IS THE CORRECTED LINE */}
            <Route path="/meeting/:roomId" element={<Meeting />} />

            {/* CATCH-ALL ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </SocketProvider>
);

export default App;