import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
// Fix: Import from "react-router-dom" instead of "react-router"
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./modules/Auth/index.tsx";
import Register from "./modules/Auth/register.tsx";
import ForgotPassword from "./modules/Auth/forget-password.tsx";
import Dashboard from "./modules/dashboard/index.tsx";
import Discover from "./modules/dashboard/tabs/discover.tsx";
import Feeds from "./modules/dashboard/tabs/feeds.tsx";
import Messages from "./modules/dashboard/tabs/messages.tsx";
import CallRoom from "./modules/dashboard/call-room/index.tsx";
import TwoPeopleCall from "./modules/dashboard/call-room/two-people-call.tsx";
import GroupsCalls from "./modules/dashboard/call-room/groups-call.tsx";
import { CallProvider } from "./features/calls/call-provider.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <CallProvider>
        <Routes>
          <Route path="/test" element={<App />} />
          <Route path="/" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/home" element={<Dashboard />} />
          <Route path="/forget-password" element={<ForgotPassword />} />
          <Route path="/dashboard/discovery" element={<Discover />} />
          <Route path="/dashboard/feeds" element={<Feeds />} />
          <Route path="/dashboard/messages" element={<Messages />} />
          <Route path="/dashboard/admin" element={<Dashboard />} />
          <Route path="/dashboard/counsellor" element={<Dashboard />} />
          <Route path="/callroom/session" element={<CallRoom />} />
          <Route path="/callroom/two-people-call" element={<TwoPeopleCall />} />
          <Route path="/callroom/groups-call" element={<GroupsCalls />} />
        </Routes>
      </CallProvider>
    </BrowserRouter>
  </StrictMode>,
);
