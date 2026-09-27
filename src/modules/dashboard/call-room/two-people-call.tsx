import { useEffect, useRef, useState, type FormEvent } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Icon } from "@iconify/react";
import {
  ArrowLeft,
  LoaderCircle,
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  Video,
  VideoOff,
  Volume2,
} from "lucide-react";
import type { Socket } from "socket.io-client";
import { useCalls } from "../../../features/calls/call-context";
import { api } from "../../../lib/api";
import type { CallRoom as CallRecord } from "../../../lib/api";
import { createCallClient } from "../../../lib/webrtc-client";
import type { CallClient } from "../../../lib/webrtc-client";

type Phase = "loading" | "joining" | "waiting" | "active" | "ended" | "error";
type RemoteMedia = { socketId: string; stream: MediaStream };
type ChatMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: string;
};

const API_BASE_URL = (
  import.meta.env.VITE_API_URL ?? "http://localhost:4000/api"
).replace(/\/$/, "");

const iconClass =
  "text-[#9AB3DA] text-xl cursor-pointer hover:text-white transition-colors";

const mergeMessages = (messages: ChatMessage[]) =>
  [...new Map(messages.map((message) => [message.id, message])).values()].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

const fetchWithCsrf = async (
  url: string,
  options: RequestInit = {},
): Promise<Response> => {
  const csrfResponse = await fetch(`${API_BASE_URL}/auth/csrf`, {
    credentials: "include",
  });
  if (!csrfResponse.ok)
    throw new Error("Unable to initialize secure chat request.");
  const csrfData = (await csrfResponse.json()) as { csrfToken?: string };
  return fetch(url, {
    ...options,
    credentials: "include",
    headers: {
      ...(options.headers ?? {}),
      ...(csrfData.csrfToken ? { "X-CSRF-Token": csrfData.csrfToken } : {}),
    },
  });
};

function waitForConnection(socket: Socket, signal: AbortSignal) {
  if (socket.connected) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      socket.off("connect", connected);
      signal.removeEventListener("abort", cancelled);
    };
    const connected = () => {
      cleanup();
      resolve();
    };
    const cancelled = () => {
      cleanup();
      reject(new Error("Joining the call was cancelled."));
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(
        new Error(
          "Unable to connect to the call server. Check your connection and try again.",
        ),
      );
    }, 15_000);
    socket.on("connect", connected);
    signal.addEventListener("abort", cancelled, { once: true });
    if (signal.aborted) cancelled();
  });
}

function mediaError(error: unknown, video: boolean) {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError" || error.name === "SecurityError") {
      return `Allow access to your microphone${video ? " and camera" : ""} in your browser, then start a new call.`;
    }
    if (
      error.name === "NotFoundError" ||
      error.name === "OverconstrainedError"
    ) {
      return `No working microphone${video ? " or camera" : ""} was found. Connect your device and start a new call.`;
    }
    if (error.name === "NotReadableError") {
      return "Your microphone or camera is in use by another app. Close that app and start a new call.";
    }
  }
  return error instanceof Error
    ? error.message
    : "The call could not connect. Please try again.";
}

function Media({
  stream,
  video,
  muted = false,
  className = "",
}: {
  stream: MediaStream;
  video: boolean;
  muted?: boolean;
  className?: string;
}) {
  const mediaRef = useRef<HTMLVideoElement & HTMLAudioElement>(null);
  const [playbackBlocked, setPlaybackBlocked] = useState(false);

  useEffect(() => {
    const element = mediaRef.current;
    if (!element) return;
    let cancelled = false;
    element.srcObject = stream;
    void element
      .play()
      .then(() => {
        if (!cancelled) setPlaybackBlocked(false);
      })
      .catch(() => {
        if (!cancelled && !muted) setPlaybackBlocked(true);
      });
    return () => {
      cancelled = true;
      element.srcObject = null;
    };
  }, [stream, muted]);

  return (
    <>
      {video ? (
        <video
          ref={mediaRef}
          autoPlay
          playsInline
          muted={muted}
          className={className}
        />
      ) : (
        <audio ref={mediaRef} autoPlay muted={muted} />
      )}
      {playbackBlocked && (
        <button
          type="button"
          className="absolute bottom-5 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-900 shadow-lg"
          onClick={() => {
            void mediaRef.current
              ?.play()
              .then(() => setPlaybackBlocked(false))
              .catch(() => setPlaybackBlocked(true));
          }}
        >
          <Volume2 size={18} /> Enable call audio
        </button>
      )}
    </>
  );
}

function CallSession({ callId }: { callId: string }) {
  const { socket, connected, user: currentUser } = useCalls();
  const navigate = useNavigate();
  const location = useLocation();
  const peerName =
    typeof location.state?.peerName === "string"
      ? location.state.peerName
      : "Your contact";
  const initials = peerName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part: string) => part[0])
    .join("")
    .toUpperCase();
  const [message, setMessage] = useState("");
  const [room, setRoom] = useState<CallRecord | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [status, setStatus] = useState("Preparing your call…");
  const [error, setError] = useState("");
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remote, setRemote] = useState<RemoteMedia | null>(null);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [ending, setEnding] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState("");
  const clientRef = useRef<CallClient | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stopRef = useRef<(() => void) | null>(null);

  async function handleSendMessage(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const conversationId = room?.conversationId;
    const payload = message.trim();
    if (!conversationId || !payload || !currentUser?.id) return;

    const optimisticMessage: ChatMessage = {
      id: `temp-${crypto.randomUUID()}`,
      conversationId,
      senderId: currentUser.id,
      body: payload,
      createdAt: new Date().toISOString(),
    };
    setMessages((previous) => mergeMessages([...previous, optimisticMessage]));
    setMessage("");

    try {
      const response = await fetchWithCsrf(
        `${API_BASE_URL}/conversations/${conversationId}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: payload }),
        },
      );
      const result = (await response.json().catch(() => null)) as {
        message?: Partial<ChatMessage>;
      } | null;
      if (!response.ok || !result?.message?.id)
        throw new Error("Message not sent.");

      const savedMessage: ChatMessage = {
        ...optimisticMessage,
        id: result.message.id,
        body: result.message.body ?? payload,
        createdAt: result.message.createdAt ?? optimisticMessage.createdAt,
      };
      setMessages((previous) =>
        mergeMessages([
          ...previous.filter((item) => item.id !== optimisticMessage.id),
          savedMessage,
        ]),
      );
    } catch (failure) {
      setMessages((previous) =>
        previous.filter((item) => item.id !== optimisticMessage.id),
      );
      setChatError(
        failure instanceof Error
          ? failure.message
          : "Message could not be sent.",
      );
    }
  }

  useEffect(() => {
    const conversationId = room?.conversationId;
    if (!conversationId) {
      setMessages([]);
      setChatError("");
      return;
    }

    let cancelled = false;
    setChatLoading(true);
    setChatError("");

    async function loadChat() {
      try {
        const response = await fetch(
          `${API_BASE_URL}/conversations/${conversationId}/messages?limit=50&offset=0`,
          { credentials: "include" },
        );
        if (!response.ok)
          throw new Error("Unable to load conversation messages.");
        const result = (await response.json()) as { messages?: ChatMessage[] };
        if (!cancelled) setMessages(mergeMessages(result.messages ?? []));
      } catch (failure) {
        if (!cancelled) {
          setChatError(
            failure instanceof Error
              ? failure.message
              : "Unable to load conversation messages.",
          );
        }
      } finally {
        if (!cancelled) setChatLoading(false);
      }
    }

    const receiveMessage = (incoming: ChatMessage) => {
      if (incoming.conversationId !== conversationId) return;
      setMessages((previous) => mergeMessages([...previous, incoming]));
    };

    socket?.on("message:new", receiveMessage);
    void loadChat();
    return () => {
      cancelled = true;
      socket?.off("message:new", receiveMessage);
    };
  }, [room?.conversationId, socket]);

  useEffect(() => {
    if (!socket) return;
    const activeSocket = socket as NonNullable<typeof socket>;
    const abort = new AbortController();
    let cancelled = false;
    let ended = false;
    let validated = false;
    let client: CallClient | null = null;
    let stream: MediaStream | null = null;
    let video = false;
    const active = () => !cancelled && !ended;
    const release = () => {
      stream?.getTracks().forEach((track) => track.stop());
      if (client) void client.destroy().catch(() => {});
    };
    const stop = () => {
      ended = true;
      abort.abort();
      release();
    };
    stopRef.current = stop;

    const onEnded = (event: { callId: string; reason?: string }) => {
      if (event.callId !== callId || cancelled || ended) return;
      ended = true;
      abort.abort();
      release();
      setLocalStream(null);
      setRemote(null);
      setPhase("ended");
      setStatus(
        event.reason?.startsWith("disconnected") ||
          event.reason === "connection_error"
          ? "Your connection was lost. Return to messages to start a new call."
          : "This call has ended.",
      );
    };

    activeSocket.on("call:ended", onEnded);

    async function start() {
      try {
        const { call } = await api.call(callId);
        if (!active()) return;
        setRoom(call);
        video = call.mode === "video";
        if (call.endedAt) {
          onEnded({ callId });
          return;
        }
        validated = true;
        const { iceServers } = await api.callIce();
        if (!active()) return;
        await waitForConnection(activeSocket, abort.signal);
        if (!active()) return;
        if (
          !navigator.mediaDevices?.getUserMedia ||
          typeof RTCPeerConnection === "undefined"
        ) {
          throw new Error(
            "Calling needs a supported browser on HTTPS or localhost.",
          );
        }
        setStatus(
          `Allow microphone${video ? " and camera" : ""} access to join the call.`,
        );
        stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video,
        });
        if (!active()) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        setLocalStream(stream);
        setPhase("joining");
        setStatus("Connecting your call…");
        client = createCallClient({
          socket: activeSocket,
          localStream: stream,
          iceServers,
          onRemoteStream: (media) => {
            if (!active()) return;
            setRemote(media);
            setPhase("active");
            setStatus("You are connected");
          },
          onPeerLeft: ({ socketId }) => {
            if (!active()) return;
            setRemote((current) =>
              current?.socketId === socketId ? null : current,
            );
            setPhase("waiting");
            setStatus(
              "The other person has left. Waiting for them to reconnect…",
            );
          },
          onError: (failure) => {
            if (active()) setError(failure.message);
          },
          onEnded,
        });
        clientRef.current = client;
        await client.join(callId);
        if (!active()) return;
        setPhase((current) => (current === "active" ? current : "waiting"));
        setStatus((current) =>
          current === "You are connected"
            ? current
            : "Waiting for the other person to join…",
        );
      } catch (failure) {
        if (!active()) return;
        release();
        setLocalStream(null);
        setRemote(null);
        setError(mediaError(failure, video));
        setPhase("error");
        setStatus("Unable to join the call");
        if (validated) {
          ended = true;
          void api.endCall(callId).catch(() => {
            if (activeSocket?.connected)
              activeSocket.emit("call:leave", { callId });
          });
        }
      }
    }

    void start();

    return () => {
      cancelled = true;
      abort.abort();
      activeSocket.off("call:ended", onEnded);
      release();
      if (validated && !client && activeSocket.connected) {
        activeSocket.emit("call:leave", { callId });
      }
      if (clientRef.current === client) clientRef.current = null;
      if (streamRef.current === stream) streamRef.current = null;
      if (stopRef.current === stop) stopRef.current = null;
    };
  }, [socket, callId]);

  async function endCall() {
    if (ending) return;
    setEnding(true);
    stopRef.current?.();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    void clientRef.current?.destroy().catch(() => {});
    setLocalStream(null);
    setRemote(null);
    try {
      await api.endCall(callId);
      navigate("/dashboard/messages");
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Unable to end the call. Please try again.",
      );
      setPhase("error");
      setStatus("Your microphone and camera have been turned off.");
      setEnding(false);
    }
  }

  function toggleMicrophone() {
    const next = !muted;
    localStream?.getAudioTracks().forEach((track) => {
      track.enabled = !next;
    });
    setMuted(next);
  }

  function toggleCamera() {
    const next = !cameraOff;
    localStream?.getVideoTracks().forEach((track) => {
      track.enabled = !next;
    });
    setCameraOff(next);
  }

  const terminal = phase === "ended" || phase === "error";
  const video = room?.mode === "video";
  const canControl = Boolean(localStream) && !terminal && !ending;

  return (
    <div className="mobile-two-call grid gap-2 grid-cols-12 h-screen p-2 overflow-hidden">
      <div className="col-span-8 gap-2 h-full flex">
        <div className="flex relative flex-col items-center pt-7 pb-20 w-20 h-full border bg-color4 rounded-3xl shrink-0">
          <Avatar className="h-11 w-11 shrink-0 cursor-pointer">
            <AvatarImage src="https://github.com/shadcn.png" />
            <AvatarFallback>abihsolo</AvatarFallback>
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

        <div className="w-full h-full flex flex-col gap-2">
          <div className="h-24 shrink-0 rounded-2xl px-4 bg-[#F3F7FF] border border-[#ACA9FF] flex items-center justify-between">
            {error && (
              <div className="absolute inset-x-4 top-4 z-30 rounded-xl bg-red-50 px-3 py-2 text-center text-xs text-red-700 shadow-sm">
                {error}
              </div>
            )}
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
                <p className="text-xl text-[#000057]">{peerName}</p>
                <div className="flex gap-10 mt-1">
                  <p className="text-xs">
                    {room ? (video ? "Video call" : "Audio call") : "Call room"}
                  </p>
                  <p className="text-xs">
                    Status:{" "}
                    <span className="bg-amber-600 p-1 rounded-full text-white px-2">
                      {connected ? "Online" : "Connecting"}
                    </span>
                  </p>
                </div>
              </div>
            </div>
            <div className="flex gap-2 items-end h-full pb-5">
              <button
                type="button"
                className="h-7 w-20 bg-red-600 rounded-md text-xs text-white"
              >
                {terminal ? "Ended" : "Live"}
              </button>
              <button
                type="button"
                className="h-7 w-20 bg-[#EEEEFF] rounded-md text-xs"
              >
                {status}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-12 gap-2 flex-1 min-h-0">
            <div className="col-span-6 border border-[#ACA9FF] h-full rounded-2xl relative bg-black/5 overflow-hidden">
              <div className="absolute top-2 left-2 flex items-center gap-2 z-10">
                <Avatar className="h-9 w-9 shrink-0 cursor-pointer">
                  <AvatarImage src="https://github.com/shadcn.png" />
                  <AvatarFallback>{initials || "ME"}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-xs">You</p>
                  <p className="text-[10px]">{muted ? "Muted" : "Live"}</p>
                </div>
              </div>
              <div className="absolute top-2 right-2 flex items-center gap-2 h-10 w-10 rounded-full bg-black justify-center cursor-pointer z-10">
                <Icon
                  icon="eva:expand-fill"
                  height="1.5em"
                  className="text-white"
                />
              </div>

              {localStream && video && !terminal && (
                <div className="absolute inset-0 z-0">
                  <Media
                    stream={localStream}
                    video
                    muted
                    className="h-full w-full object-cover -scale-x-100"
                  />
                </div>
              )}

              {!localStream || !video || terminal ? (
                <div className="absolute inset-0 z-10 flex items-center justify-center text-center text-white">
                  <div className="flex max-w-xs flex-col items-center gap-3 px-6 py-8">
                    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#1900FF]/20 text-3xl font-bold text-[#dfe3ff] ring-8 ring-white/10">
                      {initials || <Phone size={30} />}
                    </div>
                    <p className="text-lg font-semibold">{peerName}</p>
                    <p className="text-sm text-slate-200">{status}</p>
                  </div>
                </div>
              ) : null}

              <div className="bg-black rounded-xl h-20 absolute bottom-10 left-10 right-10 flex gap-2 justify-center items-center z-20">
                <button
                  type="button"
                  onClick={toggleCamera}
                  disabled={!canControl}
                  className={`h-10 w-10 rounded-full flex justify-center items-center ${cameraOff ? "bg-slate-800 text-white" : "bg-[#f3f7ffb5] text-[#000057]"} disabled:opacity-40`}
                >
                  {cameraOff ? <VideoOff size={20} /> : <Video size={20} />}
                </button>
                <button
                  type="button"
                  onClick={toggleMicrophone}
                  disabled={!canControl}
                  className={`h-10 w-10 rounded-full flex justify-center items-center ${muted ? "bg-slate-800 text-white" : "bg-[#f3f7ffb5] text-[#000057]"} disabled:opacity-40`}
                >
                  {muted ? <MicOff size={20} /> : <Mic size={20} />}
                </button>
                <button
                  type="button"
                  onClick={() => void endCall()}
                  disabled={ending}
                  className="bg-[#FF9001] h-10 w-24 rounded-full flex justify-center items-center text-white disabled:opacity-60"
                >
                  {ending ? (
                    <LoaderCircle size={18} className="animate-spin" />
                  ) : (
                    <PhoneOff size={18} />
                  )}
                </button>
                <button
                  type="button"
                  className="bg-[#f3f7ffb5] h-10 w-10 rounded-full flex justify-center items-center text-[#000057]"
                >
                  <Icon icon="qlementine-icons:menu-dots-16" height="1.5em" />
                </button>
              </div>
            </div>

            <div className="col-span-6 border border-[#ACA9FF] h-full rounded-2xl relative bg-black/5 overflow-hidden">
              <div className="absolute top-2 left-2 flex items-center gap-2 z-10">
                <Avatar className="h-9 w-9 shrink-0 cursor-pointer">
                  <AvatarImage src="https://github.com/shadcn.png" />
                  <AvatarFallback>{initials || "CN"}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-xs">{peerName}</p>
                  <p className="text-[10px]">
                    {remote ? "Connected" : "Waiting"}
                  </p>
                </div>
              </div>
              <div className="absolute top-2 right-2 flex items-center gap-2 h-10 w-10 rounded-full bg-black justify-center cursor-pointer z-10">
                <Icon
                  icon="eva:expand-fill"
                  height="1.5em"
                  className="text-white"
                />
              </div>

              {remote && !terminal ? (
                <Media
                  stream={remote.stream}
                  video={Boolean(video)}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 z-10 flex items-center justify-center text-center text-white">
                  <div className="flex max-w-xs flex-col items-center gap-3 px-6 py-8">
                    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#1900FF]/20 text-3xl font-bold text-[#dfe3ff] ring-8 ring-white/10">
                      {initials || <Phone size={30} />}
                    </div>
                    <p className="text-lg font-semibold">{peerName}</p>
                    <p className="text-sm text-slate-200">{status}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="col-span-4 h-full rounded-2xl px-4 pb-4 bg-[#F3F7FF] border border-[#ACA9FF] flex flex-col justify-between overflow-hidden">
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          <div className="border-y h-10 mt-6 mb-4 border-[#ACA9FF] flex items-center sticky top-0 bg-[#F3F7FF] z-10">
            <p>
              Chat <span className="text-[#FF9001]"> ({messages.length}) </span>
            </p>
          </div>

          {chatLoading ? (
            <div className="flex h-full items-center justify-center text-xs text-slate-500">
              Loading messages…
            </div>
          ) : messages.length === 0 ? (
            <div className="flex h-full items-center justify-center text-center text-xs text-slate-500">
              {room?.conversationId
                ? "No messages yet. Say hello to start the conversation."
                : "Chat is unavailable for this call."}
            </div>
          ) : (
            messages.map((chatMessage) => {
              const outgoing = chatMessage.senderId === currentUser?.id;
              return (
                <div
                  key={chatMessage.id}
                  className={`flex items-end gap-2 ${
                    outgoing ? "justify-end" : "justify-start"
                  }`}
                >
                  {!outgoing && (
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarImage src="https://github.com/shadcn.png" />
                      <AvatarFallback>{initials || "CN"}</AvatarFallback>
                    </Avatar>
                  )}
                  <div
                    className={`max-w-[78%] rounded-2xl px-3 py-2 text-xs wrap-break-word ${
                      outgoing
                        ? "bg-color4 text-white"
                        : "bg-[#EEEEFF] text-slate-700"
                    }`}
                  >
                    {chatMessage.body}
                  </div>
                  {outgoing && (
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarImage src="https://github.com/shadcn.png" />
                      <AvatarFallback>ME</AvatarFallback>
                    </Avatar>
                  )}
                </div>
              );
            })
          )}
          {chatError && <p className="text-[10px] text-red-600">{chatError}</p>}
        </div>

        <form
          onSubmit={handleSendMessage}
          className="mt-2 flex gap-2 justify-center items-center shrink-0"
        >
          <div className="h-11 w-full border border-[#ACA9FF] bg-white/50 rounded-xl flex items-center justify-between px-3 min-w-0 transition-all duration-200 focus-within:ring-2 focus-within:ring-[#1900FF]/40 focus-within:shadow-md">
            <div className="flex gap-2 items-center flex-1 h-full min-w-0">
              <div className="p-1 rounded-full cursor-pointer transition-transform duration-200 hover:scale-125 hover:rotate-90 active:scale-90 shrink-0">
                <Icon icon="akar-icons:plus" height="1.1em" />
              </div>
              <div className="p-1 rounded-full cursor-pointer transition-transform duration-200 hover:scale-125 active:scale-90 shrink-0">
                <Icon icon="mdi:sticker-emoji" height="1.1em" />
              </div>
              <input
                type="text"
                placeholder="Type a message..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                disabled={!room?.conversationId || chatLoading}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void event.currentTarget.form?.requestSubmit();
                  }
                }}
                className="text-xs h-full w-full min-w-0 py-2 bg-transparent outline-none text-gray-700 disabled:cursor-not-allowed disabled:text-gray-400"
              />
            </div>
            <div className="flex gap-2 items-center shrink-0">
              <div className="p-1 rounded-full cursor-pointer transition-transform duration-200 hover:scale-125 hover:rotate-12 active:scale-90 shrink-0">
                <Icon icon="mingcute:emoji-2-line" height="1.1em" />
              </div>
              <button
                type="submit"
                disabled={
                  !room?.conversationId || !message.trim() || chatLoading
                }
                className="p-1 rounded-full cursor-pointer transition-transform duration-200 hover:scale-125 active:scale-90 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
              >
                <Icon icon="bi:send" height="1.1em" />
              </button>
            </div>
          </div>
          <button
            type="submit"
            className="h-11 w-11 bg-color4 rounded-full flex justify-center items-center shrink-0"
          >
            <Icon icon="bi:send" height="1em" className="text-white" />
          </button>
        </form>
      </div>
    </div>
  );
}

export default function TwoPeopleCall() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const callId = params.get("callId")?.toLowerCase() ?? "";

  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
      callId,
    )
  ) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[#f3f7ff] px-6 text-center">
        <PhoneOff className="text-slate-400" size={40} />
        <h1 className="text-2xl font-bold text-slate-900">
          No active call to join
        </h1>
        <p className="text-slate-600">
          Start a call from a conversation or accept an incoming call.
        </p>
        <button
          type="button"
          onClick={() => navigate("/dashboard/messages")}
          className="rounded-full bg-indigo-600 px-5 py-3 font-semibold text-white"
        >
          Back to messages
        </button>
      </main>
    );
  }

  return <CallSession key={callId} callId={callId} />;
}
