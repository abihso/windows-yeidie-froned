import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Icon } from "@iconify/react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  Mic,
  MicOff,
  PhoneOff,
  Video,
  VideoOff,
} from "lucide-react";
import PlusIcon from "@iconify-react/akar-icons/plus";
import StickerEmojiIcon from "@iconify-react/mdi/sticker-emoji";
import Emoji2LineIcon from "@iconify-react/mingcute/emoji-2-line";
import MicIcon from "@iconify-react/codicon/mic";
import { useCalls } from "../../../features/calls/call-context";
import { api, normalizeMediaUrl } from "../../../lib/api";
import { createCallClient } from "../../../lib/webrtc-client";
import type { CallClient } from "../../../lib/webrtc-client";

const API_BASE_URL = (
  import.meta.env.VITE_API_URL ?? "http://localhost:4000/api"
).replace(/\/$/, "");

const iconClass =
  "text-[#9AB3DA] text-xl cursor-pointer hover:text-white transition-colors duration-200 hover:scale-110 active:scale-95";

type ChatMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: string;
};

type RemoteMedia = { socketId: string; stream: MediaStream };
type CallPeer = {
  socketId: string;
  userId?: string;
  fullName?: string;
  avatarUrl?: string | null;
};

async function fetchWithCsrf(url: string, options: RequestInit = {}) {
  const csrfResponse = await fetch(`${API_BASE_URL}/auth/csrf`, {
    credentials: "include",
  });
  if (!csrfResponse.ok) throw new Error("Unable to initialize secure request.");
  const { csrfToken } = (await csrfResponse.json()) as { csrfToken?: string };
  return fetch(url, {
    ...options,
    credentials: "include",
    headers: {
      ...(options.headers ?? {}),
      ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
    },
  });
}

function mergeMessages(messages: ChatMessage[]) {
  return [
    ...new Map(messages.map((message) => [message.id, message])).values(),
  ].sort(
    (first, second) =>
      new Date(first.createdAt).getTime() -
      new Date(second.createdAt).getTime(),
  );
}

function Media({
  stream,
  muted = false,
  className = "",
}: {
  stream: MediaStream;
  muted?: boolean;
  className?: string;
}) {
  const mediaRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const element = mediaRef.current;
    if (!element) return;
    element.srcObject = stream;
    void element.play().catch(() => {});
    return () => {
      element.srcObject = null;
    };
  }, [stream]);

  return (
    <video
      ref={mediaRef}
      autoPlay
      playsInline
      muted={muted}
      className={className}
    />
  );
}

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "P"
  );
}

function GroupsCalls() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { socket, connected, user: currentUser } = useCalls();
  const [roomId, setRoomId] = useState(searchParams.get("callId"));
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [mode, setMode] = useState<"audio" | "video">(
    searchParams.get("mode") === "audio" ? "audio" : "video",
  );
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<RemoteMedia[]>([]);
  const [callPeers, setCallPeers] = useState<Record<string, CallPeer>>({});
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [recording, setRecording] = useState(false);
  const [status, setStatus] = useState("Preparing your group call…");
  const [error, setError] = useState("");
  const [ended, setEnded] = useState(false);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const clientRef = useRef<CallClient | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const requestedCallId = searchParams.get("callId");
  const requestedConversationId = searchParams.get("conversationId");
  const requestedMode =
    searchParams.get("mode") === "audio" ? "audio" : "video";

  useEffect(() => {
    if (!socket || !connected) return;
    const activeSocket = socket;
    let cancelled = false;
    let activeRoomId: string | null = requestedCallId;
    let stream: MediaStream | null = null;
    let client: CallClient | null = null;

    async function start() {
      try {
        const roomResponse = activeRoomId
          ? await api.call(activeRoomId)
          : await api.createCall({
              conversationId: requestedConversationId ?? undefined,
              mode: requestedMode,
            });
        if (cancelled) return;
        const room = roomResponse.call;
        activeRoomId = room.id;
        setRoomId(room.id);
        setConversationId(room.conversationId);
        setMode(room.mode);

        const { iceServers } = await api.callIce();
        if (cancelled) return;
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("Group calling needs microphone and camera access.");
        }
        setStatus(
          `Allow microphone${room.mode === "video" ? " and camera" : ""} access.`,
        );
        stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: room.mode === "video",
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        setLocalStream(stream);
        client = createCallClient({
          socket: activeSocket,
          localStream: stream,
          iceServers,
          onRemoteStream: (remote) => {
            if (cancelled) return;
            setRemoteStreams((previous) => [
              ...previous.filter((item) => item.socketId !== remote.socketId),
              remote,
            ]);
            setStatus("You are connected");
          },
          onPeerJoined: (peer) => {
            if (!cancelled) {
              setCallPeers((previous) => ({
                ...previous,
                [peer.socketId]: peer,
              }));
            }
          },
          onPeerLeft: ({ socketId }) => {
            setRemoteStreams((previous) =>
              previous.filter((item) => item.socketId !== socketId),
            );
            setCallPeers((previous) => {
              const next = { ...previous };
              delete next[socketId];
              return next;
            });
          },
          onError: (failure) => {
            if (!cancelled) setError(failure.message);
          },
          onEnded: () => {
            if (!cancelled) {
              setEnded(true);
              setStatus("This call has ended.");
            }
          },
        });
        clientRef.current = client;
        const joined = await client.join(room.id);
        if (!cancelled) {
          setCallPeers(
            Object.fromEntries(
              joined.peers.map((peer) => [peer.socketId, peer]),
            ),
          );
          setStatus(
            joined.peers.length
              ? `${joined.peers.length + 1} people in the call`
              : "Waiting for other people to join…",
          );
        }
      } catch (failure) {
        if (!cancelled) {
          setError(
            failure instanceof Error
              ? failure.message
              : "Unable to join the call.",
          );
          setStatus("Unable to join the call");
        }
      }
    }

    void start();
    return () => {
      cancelled = true;
      void client?.destroy().catch(() => {});
      stream?.getTracks().forEach((track) => track.stop());
      if (clientRef.current === client) clientRef.current = null;
      if (streamRef.current === stream) streamRef.current = null;
    };
  }, [
    connected,
    requestedCallId,
    requestedConversationId,
    requestedMode,
    socket,
  ]);

  useEffect(() => {
    if (!conversationId || !socket) return;
    let cancelled = false;
    const receiveMessage = (incoming: ChatMessage) => {
      if (incoming.conversationId !== conversationId) return;
      setMessages((previous) => mergeMessages([...previous, incoming]));
    };
    socket.on("message:new", receiveMessage);
    void fetch(
      `${API_BASE_URL}/conversations/${conversationId}/messages?limit=50&offset=0`,
      { credentials: "include" },
    )
      .then(
        (response) => response.json() as Promise<{ messages?: ChatMessage[] }>,
      )
      .then((result) => {
        if (!cancelled) setMessages(mergeMessages(result.messages ?? []));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      socket.off("message:new", receiveMessage);
    };
  }, [conversationId, socket]);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = message.trim();
    if (!conversationId || !body || !currentUser?.id) return;
    const optimistic: ChatMessage = {
      id: `temp-${crypto.randomUUID()}`,
      conversationId,
      senderId: currentUser.id,
      body,
      createdAt: new Date().toISOString(),
    };
    setMessages((previous) => mergeMessages([...previous, optimistic]));
    setMessage("");
    try {
      const response = await fetchWithCsrf(
        `${API_BASE_URL}/conversations/${conversationId}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body }),
        },
      );
      const result = (await response.json()) as { message?: ChatMessage };
      if (!response.ok || !result.message) throw new Error("Message not sent.");
      setMessages((previous) =>
        mergeMessages([
          ...previous.filter((item) => item.id !== optimistic.id),
          result.message!,
        ]),
      );
    } catch {
      setMessages((previous) =>
        previous.filter((item) => item.id !== optimistic.id),
      );
    }
  }

  function toggleMicrophone() {
    const next = !muted;
    localStream?.getAudioTracks().forEach((track) => (track.enabled = !next));
    setMuted(next);
  }

  function toggleCamera() {
    const next = !cameraOff;
    localStream?.getVideoTracks().forEach((track) => (track.enabled = !next));
    setCameraOff(next);
  }

  function toggleRecording() {
    if (recording) {
      recorderRef.current?.stop();
      recorderRef.current = null;
      setRecording(false);
      return;
    }
    if (!localStream || typeof MediaRecorder === "undefined") {
      setError("Recording is not supported in this browser.");
      return;
    }
    const recorder = new MediaRecorder(localStream);
    recordingChunksRef.current = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size) recordingChunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(recordingChunksRef.current, {
        type: recorder.mimeType || "video/webm",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `yiedie-group-call-${new Date().toISOString()}.webm`;
      link.click();
      URL.revokeObjectURL(url);
      recordingChunksRef.current = [];
    };
    recorder.start(1000);
    recorderRef.current = recorder;
    setRecording(true);
  }

  async function leaveCall() {
    if (!roomId) return;
    recorderRef.current?.stop();
    await clientRef.current?.destroy().catch(() => {});
    await api.endCall(roomId).catch(() => {});
    navigate("/dashboard/messages");
  }

  const primaryStream = remoteStreams[0];
  const additionalStreams = remoteStreams.slice(1);
  const video = mode === "video";

  return (
    <div className="mobile-group-call grid grid-cols-12 gap-2 p-2">
      <div className="col-span-8 flex gap-2">
        <div className="flex relative flex-col items-center pt-7 pb-20 w-20 border bg-color4 rounded-3xl shrink-0">
          <Avatar className="h-11 w-11 shrink-0">
            <AvatarImage
              src={normalizeMediaUrl(currentUser?.avatarUrl)}
              alt="Your profile picture"
            />
            <AvatarFallback>
              {initials(currentUser?.fullName ?? "You")}
            </AvatarFallback>
          </Avatar>
          <div className="border-t border-[#59595C] my-5 w-[40%]" />
          <div className="flex flex-col items-center gap-6">
            <Icon icon="akar-icons:home-alt1" className={iconClass} />
            <Icon icon="stash:people-group-duotone" className={iconClass} />
            <Icon icon="fluent:organization-20-regular" className={iconClass} />
          </div>
          <div className="border-t border-[#59595C] my-5 w-[40%]" />
          <div className="flex flex-col items-center gap-6">
            <Icon icon="mage:message-round" className={iconClass} />
            <Icon icon="ic:outline-add-reaction" className={iconClass} />
            <Icon icon="ci:add-plus" className={iconClass} />
          </div>
          <div className="border-t border-[#59595C] my-5 w-[40%]" />
          <div className="flex flex-col items-center gap-6">
            <Icon icon="akar-icons:airplay-video" className={iconClass} />
            <Icon icon="akar-icons:star" className={iconClass} />
          </div>
          <div className="border-t border-[#59595C] my-5 w-[40%]" />
          <div className="absolute bottom-6">
            <Icon icon="ant-design:setting-outlined" className={iconClass} />
          </div>
        </div>

        <div className="w-full flex flex-col gap-2">
          <div className="h-24 shrink-0 rounded-2xl px-4 bg-[#F3F7FF] border border-[#ACA9FF] flex items-center justify-between">
            <div className="flex gap-2 items-center">
              <button
                type="button"
                onClick={() => navigate("/dashboard/messages")}
                className="h-10 w-10 rounded-full flex items-center justify-center"
                aria-label="Return to messages"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div>
                <p className="text-xl text-[#000057] font-semibold">
                  Group call
                </p>
                <div className="flex gap-10 mt-1 items-center">
                  <p className="text-xs text-gray-600">
                    {video ? "Video call" : "Audio call"}
                  </p>
                  <p className="text-xs text-gray-600">
                    Status:{" "}
                    <span className="bg-amber-600 rounded-full text-white px-2 py-0.5 text-[10px]">
                      {connected ? "Online" : "Connecting"}
                    </span>
                  </p>
                </div>
              </div>
            </div>
            <div className="flex gap-2 items-center h-full">
              <button
                type="button"
                onClick={toggleRecording}
                className="h-8 w-20 bg-red-600 hover:bg-red-700 rounded-md text-xs text-white"
              >
                {recording ? "Stop" : "Record"}
              </button>
              <button
                type="button"
                className="h-8 max-w-40 bg-[#EEEEFF] text-[#000057] rounded-md text-xs px-2 truncate"
              >
                {error || status}
              </button>
            </div>
          </div>

          <div className="h-96 border rounded-2xl relative bg-slate-900 overflow-hidden">
            {primaryStream && video ? (
              <Media
                stream={primaryStream.stream}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="h-full flex items-center justify-center text-white">
                <Avatar className="h-24 w-24">
                  <AvatarImage
                    src={normalizeMediaUrl(
                      callPeers[primaryStream?.socketId ?? ""]?.avatarUrl,
                    )}
                    alt={
                      callPeers[primaryStream?.socketId ?? ""]?.fullName ??
                      "Participant profile picture"
                    }
                  />
                  <AvatarFallback>G</AvatarFallback>
                </Avatar>
              </div>
            )}
            <div className="absolute top-3 left-4 z-10 text-white text-sm">
              {primaryStream ? "Participant" : "Waiting for participants…"}
            </div>
            <div className="bg-slate-900/90 rounded-full h-14 absolute bottom-6 left-1/2 -translate-x-1/2 px-6 flex gap-3 justify-center items-center z-20 border border-slate-700">
              <button
                type="button"
                onClick={toggleCamera}
                disabled={!video || ended}
                className="h-10 w-10 rounded-full flex justify-center items-center bg-slate-800 text-white disabled:opacity-40"
                aria-label={cameraOff ? "Turn camera on" : "Turn camera off"}
              >
                {cameraOff ? <VideoOff size={18} /> : <Video size={18} />}
              </button>
              <button
                type="button"
                onClick={toggleMicrophone}
                disabled={ended}
                className="h-10 w-10 rounded-full flex justify-center items-center bg-slate-800 text-white"
                aria-label={muted ? "Unmute microphone" : "Mute microphone"}
              >
                {muted ? <MicOff size={18} /> : <Mic size={18} />}
              </button>
              <button
                type="button"
                onClick={() => void leaveCall()}
                className="bg-[#FF9001] hover:bg-amber-600 h-10 w-20 rounded-full flex justify-center items-center text-white"
                aria-label="Leave call"
              >
                <PhoneOff size={18} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-12 gap-2">
            {additionalStreams.slice(0, 2).map((remote) => (
              <div
                key={remote.socketId}
                className="col-span-4 h-72 border rounded-3xl relative bg-slate-900 overflow-hidden"
              >
                {video ? (
                  <Media
                    stream={remote.stream}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="h-full flex items-center justify-center">
                    <Avatar className="h-20 w-20">
                      <AvatarImage
                        src={normalizeMediaUrl(
                          callPeers[remote.socketId]?.avatarUrl,
                        )}
                        alt={
                          callPeers[remote.socketId]?.fullName ??
                          "Participant profile picture"
                        }
                      />
                      <AvatarFallback>P</AvatarFallback>
                    </Avatar>
                  </div>
                )}
              </div>
            ))}
            <div className="col-span-4 rounded-3xl grid grid-cols-2 gap-4">
              {additionalStreams.slice(2, 6).map((remote) => (
                <div
                  key={remote.socketId}
                  className="w-full aspect-square border rounded-full overflow-hidden"
                >
                  {video ? (
                    <Media
                      stream={remote.stream}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Avatar className="h-full w-full">
                      <AvatarImage
                        src={normalizeMediaUrl(
                          callPeers[remote.socketId]?.avatarUrl,
                        )}
                        alt={
                          callPeers[remote.socketId]?.fullName ??
                          "Participant profile picture"
                        }
                      />
                      <AvatarFallback>P</AvatarFallback>
                    </Avatar>
                  )}
                </div>
              ))}
              {additionalStreams.length < 6 && (
                <div className="w-full aspect-square border rounded-full bg-color4 flex justify-center items-center">
                  <p className="text-white font-extrabold text-3xl">
                    {Math.max(0, 5 - remoteStreams.length)}+
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="col-span-4 flex flex-col gap-2">
        <div className="bg-[#F3F7FF] relative px-2 pt-4 border border-[#ACA9FF] rounded-2xl flex-1 min-h-100">
          <p className="text-color6 text-xl font-extrabold">
            Chat <span className="text-color5">({messages.length})</span>
          </p>
          <div className="mt-2 space-y-2 max-h-[calc(100%-5rem)] overflow-y-auto">
            {messages.map((item) => (
              <div
                key={item.id}
                className={`flex items-center gap-2 ${item.senderId === currentUser?.id ? "justify-end" : ""}`}
              >
                <p className="bg-[#EEEEFF] min-w-10 p-2 rounded-2xl text-sm">
                  {item.body}
                </p>
              </div>
            ))}
          </div>
          <form
            onSubmit={sendMessage}
            className="absolute bottom-5 left-3 right-3 h-11 border border-[#ACA9FF] rounded-xl flex items-center justify-between px-3"
          >
            <div className="flex gap-3 items-center flex-1 h-full">
              <PlusIcon height="1.1em" />
              <StickerEmojiIcon height="1.1em" />
              <input
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                type="text"
                placeholder=" Type a message..."
                className="text-xs h-full w-full py-2 bg-transparent outline-none text-gray-700"
              />
            </div>
            <div className="flex gap-3 items-center">
              <Emoji2LineIcon height="1.1em" />
              <button type="submit" className="p-1" aria-label="Send message">
                <MicIcon height="1.1em" />
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default GroupsCalls;
