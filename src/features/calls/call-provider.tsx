import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import type { Socket } from "socket.io-client";
import { Phone, PhoneOff, Video, X } from "lucide-react";
import { api, API_ORIGIN } from "../../lib/api";
import type { User } from "../../lib/api";
import { CallsContext } from "./call-context";
import type {
  AcceptedCall,
  CallInvitation,
  StartCallInput,
} from "./call-context";
import { socketRequest } from "./socket-request";

type PendingCalls = {
  incoming: CallInvitation | null;
  outgoing: CallInvitation | null;
};

const emptyCalls: PendingCalls = { incoming: null, outgoing: null };
function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unable to update this call.";
}

function CallPrompt({
  invitation,
  incoming,
  connected,
  acting,
  error,
  onAccept,
  onDismiss,
}: {
  invitation: CallInvitation;
  incoming: boolean;
  connected: boolean;
  acting: boolean;
  error: string;
  onAccept: () => void;
  onDismiss: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  const [seconds, setSeconds] = useState(() =>
    Math.max(
      0,
      Math.ceil((Date.parse(invitation.expiresAt) - Date.now()) / 1000),
    ),
  );

  const [notificationPermission, setNotificationPermission] = useState(() =>
    "Notification" in window ? Notification.permission : "unsupported",
  );
  const name = incoming ? invitation.fromUserName : invitation.targetUserName;
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("");
  const CallIcon = invitation.type === "video" ? Video : Phone;

  useEffect(() => {
    const interval = window.setInterval(() => {
      setSeconds(
        Math.max(
          0,
          Math.ceil((Date.parse(invitation.expiresAt) - Date.now()) / 1000),
        ),
      );
    }, 1000);
    return () => window.clearInterval(interval);
  }, [invitation.expiresAt]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!incoming || !dialog) return;
    dialog.showModal();
    return () => dialog.close();
  }, [incoming]);

  const content = (
    <>
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#eeecff] text-xl font-bold text-[#1900FF]">
          {initials}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#1900FF]">
            {incoming ? "Incoming" : "Outgoing"} {invitation.type} call
          </p>
          <h2
            id="call-prompt-title"
            className="mt-1 wrap-break-word text-xl font-bold text-[#0A0332]"
          >
            {name}
          </h2>
          <p
            id="call-prompt-description"
            className="mt-1 text-sm text-slate-600"
          >
            {incoming ? "is calling you" : "Waiting for an answer…"}
          </p>
        </div>
      </div>
      <p className="mt-4 text-sm text-slate-500" role="status">
        {!connected
          ? "Reconnecting…"
          : seconds > 0
            ? `Ringing · ${seconds}s remaining`
            : "Checking call status…"}
      </p>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="mt-5 flex gap-3">
        <button
          type="button"
          onClick={onDismiss}
          disabled={acting || !connected}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-50 px-4 py-3 font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
        >
          <PhoneOff size={19} /> {incoming ? "Reject" : "Cancel call"}
        </button>
        {incoming && (
          <button
            type="button"
            onClick={onAccept}
            disabled={acting || !connected || seconds === 0}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#1900FF] px-4 py-3 font-semibold text-white hover:bg-[#1300c4] disabled:opacity-50"
          >
            <CallIcon size={19} /> {acting ? "Connecting…" : "Accept"}
          </button>
        )}
      </div>
      {notificationPermission === "default" && window.isSecureContext && (
        <button
          type="button"
          className="mt-4 text-xs text-slate-600 underline hover:text-[#1900FF]"
          onClick={() => {
            void Notification.requestPermission()
              .then(setNotificationPermission)
              .catch(() => {});
          }}
        >
          Enable desktop alerts for future calls
        </button>
      )}
    </>
  );

  if (incoming) {
    return (
      <dialog
        ref={dialogRef}
        aria-labelledby="call-prompt-title"
        aria-describedby="call-prompt-description"
        onCancel={(event) => event.preventDefault()}
        className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-sm rounded-3xl border border-[#ACA9FF] bg-white p-6 shadow-2xl backdrop:bg-[#0A0332]/40"
      >
        {content}
      </dialog>
    );
  }

  return (
    <section
      aria-labelledby="call-prompt-title"
      className="fixed right-4 bottom-4 z-50 w-[calc(100%-2rem)] max-w-sm rounded-3xl border border-[#ACA9FF] bg-white p-6 shadow-2xl"
    >
      {content}
    </section>
  );
}

/** One authenticated connection above every route keeps invitations available throughout the app. */
export function CallProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const navigateRef = useRef(navigate);
  const [authVersion, setAuthVersion] = useState(0);
  const [user, setUser] = useState<User | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [pending, setPending] = useState<PendingCalls>(emptyCalls);
  const pendingRef = useRef<PendingCalls>(emptyCalls);
  const settledRequests = useRef(new Set<string>());
  const requestInProgress = useRef(false);
  const decisionInProgress = useRef(false);
  const sessionEpoch = useRef(0);
  const [starting, setStarting] = useState(false);
  const [acting, setActing] = useState(false);
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");
  const acceptRef = useRef<(call: AcceptedCall) => void>(() => {});
  const syncRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    navigateRef.current = navigate;
  }, [navigate]);

  useEffect(() => {
    const changed = () => {
      sessionEpoch.current += 1;
      pendingRef.current = emptyCalls;
      requestInProgress.current = false;
      decisionInProgress.current = false;
      setUser(null);
      setSocket(null);
      setConnected(false);
      setPending(emptyCalls);
      setStarting(false);
      setActing(false);
      setActionError("");
      setNotice("");
      setAuthVersion((version) => version + 1);
    };
    window.addEventListener("yiedie:session-change", changed);
    return () => window.removeEventListener("yiedie:session-change", changed);
  }, []);

  useEffect(() => {
    let disposed = false;
    let liveSocket: Socket | null = null;
    let desktopAlert: Notification | null = null;
    let revision = 0;
    const completed = settledRequests.current;
    let connecting = false;
    let retryTimer: number | undefined;

    function scheduleRetry() {
      window.clearTimeout(retryTimer);
      retryTimer = window.setTimeout(recover, 3000);
    }

    function recover() {
      if (disposed) return;
      if (liveSocket) {
        if (!liveSocket.connected) liveSocket.connect();
      } else {
        void connect();
      }
    }

    function updatePending(next: PendingCalls) {
      revision += 1;
      pendingRef.current = next;
      setPending(next);
      setActionError("");
      if (!next.incoming) {
        desktopAlert?.close();
        desktopAlert = null;
      }
    }

    function settled(requestId: string) {
      completed.add(requestId);
      if (completed.size > 100) {
        completed.delete(completed.values().next().value!);
      }
      const previous = pendingRef.current;
      updatePending({
        incoming:
          previous.incoming?.requestId === requestId ? null : previous.incoming,
        outgoing:
          previous.outgoing?.requestId === requestId ? null : previous.outgoing,
      });
    }

    function showIncoming(invitation: CallInvitation) {
      if (disposed || completed.has(invitation.requestId)) return;
      updatePending({ incoming: invitation, outgoing: null });
      setNotice("");
      if (
        document.hidden &&
        "Notification" in window &&
        Notification.permission === "granted"
      ) {
        try {
          desktopAlert?.close();
          desktopAlert = new Notification(
            `${invitation.fromUserName} is calling`,
            {
              body: `Incoming ${invitation.type} call. Open Yiedie to accept or reject.`,
              tag: invitation.requestId,
            },
          );
          desktopAlert.onclick = () => {
            window.focus();
            desktopAlert?.close();
          };
        } catch {
          // Fallback for browsers with strict SW requirements
        }
      }
    }

    async function connect() {
      if (disposed || connecting) return;
      connecting = true;
      try {
        const identity = await api.me();
        if (disposed) return;
        setUser(identity);
        const nextSocket = io(API_ORIGIN, {
          autoConnect: false,
          withCredentials: true,
          auth: (callback) => {
            void api
              .csrf()
              .then((csrfToken) => {
                if (!disposed) callback({ csrfToken });
              })
              .catch(() => {
                if (!disposed) callback({ csrfToken: "" });
              });
          },
        });
        liveSocket = nextSocket;
        setSocket(nextSocket);

        async function sync() {
          const snapshot = revision;
          const calls = await socketRequest<PendingCalls>(
            nextSocket,
            "call:sync",
            {},
          );
          if (disposed || snapshot !== revision) return;
          updatePending(calls);
          if (calls.incoming) showIncoming(calls.incoming);
        }
        syncRef.current = sync;

        function accepted(call: AcceptedCall) {
          if (disposed || completed.has(call.requestId)) return;
          settled(call.requestId);
          const isCaller =
            identity.id === call.fromUserId &&
            nextSocket.id === call.callerSocketId;
          const isRecipient =
            identity.id === call.targetUserId &&
            nextSocket.id === call.acceptedBySocketId;
          if (isCaller || isRecipient) {
            setNotice("");
            navigateRef.current(
              `/callroom/two-people-call?callId=${encodeURIComponent(call.callId)}`,
              {
                state: {
                  peerName: isCaller ? call.targetUserName : call.fromUserName,
                  requestId: call.requestId,
                },
              },
            );
          } else {
            setNotice("This call was answered in another tab or device.");
          }
        }
        acceptRef.current = accepted;

        nextSocket.on("connect", () => {
          window.clearTimeout(retryTimer);
          setConnected(true);
          void sync().catch((error) => {
            if (!disposed) setNotice(errorMessage(error));
          });
        });
        nextSocket.on("disconnect", () => {
          setConnected(false);
          updatePending(emptyCalls);
        });
        nextSocket.on("connect_error", (error) => {
          setConnected(false);
          const failure = error as Error & { data?: { code?: string } };
          if (
            failure.data?.code === "UNAUTHENTICATED" ||
            failure.data?.code === "SESSION_EXPIRED"
          ) {
            setUser(null);
            updatePending(emptyCalls);
          } else if (!nextSocket.active) {
            scheduleRetry();
          }
        });
        nextSocket.on("call:request", showIncoming);
        nextSocket.on(
          "call:invited",
          (payload: { callId?: string; call?: { id?: string } }) => {
            const callId = payload.callId ?? payload.call?.id;
            if (!callId || disposed) return;
            navigateRef.current(
              `/callroom/groups-call?callId=${encodeURIComponent(callId)}`,
            );
          },
        );
        nextSocket.on("call:accepted", accepted);
        nextSocket.on("call:rejected", (invitation: CallInvitation) => {
          settled(invitation.requestId);
          setNotice(
            identity.id === invitation.fromUserId
              ? `${invitation.targetUserName} declined your call.`
              : "Call declined.",
          );
        });
        nextSocket.on("call:cancelled", (invitation: CallInvitation) => {
          settled(invitation.requestId);
          setNotice(
            identity.id === invitation.targetUserId
              ? `${invitation.fromUserName} cancelled the call.`
              : "Call cancelled.",
          );
        });
        nextSocket.on("call:expired", (invitation: CallInvitation) => {
          settled(invitation.requestId);
          setNotice(
            identity.id === invitation.fromUserId
              ? `${invitation.targetUserName} did not answer.`
              : `Missed ${invitation.type} call from ${invitation.fromUserName}.`,
          );
        });
        nextSocket.connect();
      } catch (error) {
        if (!disposed) {
          setUser(null);
          setSocket(null);
          setConnected(false);
          updatePending(emptyCalls);
          if ((error as { status?: number }).status !== 401) scheduleRetry();
        }
      } finally {
        connecting = false;
      }
    }

    void connect();
    window.addEventListener("online", recover);
    window.addEventListener("focus", recover);
    return () => {
      disposed = true;
      window.clearTimeout(retryTimer);
      window.removeEventListener("online", recover);
      window.removeEventListener("focus", recover);
      desktopAlert?.close();
      liveSocket?.removeAllListeners();
      liveSocket?.disconnect();
      pendingRef.current = emptyCalls;
      completed.clear();
      acceptRef.current = () => {};
      syncRef.current = async () => {};
    };
  }, [authVersion]);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(""), 7000);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  useEffect(() => {
    const invitation = pending.incoming ?? pending.outgoing;
    if (!invitation || !connected) return;
    const timeout = window.setTimeout(
      () => {
        void syncRef
          .current()
          .catch((error) => setActionError(errorMessage(error)));
      },
      Math.max(0, Date.parse(invitation.expiresAt) - Date.now()) + 500,
    );
    return () => window.clearTimeout(timeout);
  }, [pending, connected]);

  async function startCall(input: StartCallInput) {
    if (
      requestInProgress.current ||
      pendingRef.current.incoming ||
      pendingRef.current.outgoing
    ) {
      throw new Error("Finish your current call request first.");
    }
    requestInProgress.current = true;
    const epoch = sessionEpoch.current;
    setStarting(true);
    setNotice("");
    try {
      const invitation = await socketRequest<CallInvitation>(
        socket,
        "call:request",
        input,
      );
      if (sessionEpoch.current !== epoch) return;
      if (!settledRequests.current.has(invitation.requestId)) {
        const calls = { incoming: null, outgoing: invitation };
        pendingRef.current = calls;
        setPending(calls);
        setActionError("");
      }
    } catch (error) {
      if (sessionEpoch.current !== epoch) return;
      await syncRef.current().catch(() => {});
      throw error;
    } finally {
      if (sessionEpoch.current === epoch) {
        requestInProgress.current = false;
        setStarting(false);
      }
    }
  }

  async function decide(action: "accept" | "reject" | "cancel") {
    const invitation =
      action === "cancel"
        ? pendingRef.current.outgoing
        : pendingRef.current.incoming;
    if (!invitation || decisionInProgress.current) return;
    const epoch = sessionEpoch.current;
    decisionInProgress.current = true;
    setActing(true);
    setActionError("");
    const event =
      action === "accept"
        ? "call:accepted"
        : action === "reject"
          ? "call:rejected"
          : "call:cancelled";
    try {
      const result = await socketRequest<AcceptedCall>(socket, event, {
        requestId: invitation.requestId,
      });
      if (sessionEpoch.current !== epoch) return;
      if (action === "accept") acceptRef.current(result);
    } catch (error) {
      if (sessionEpoch.current !== epoch) return;
      await syncRef.current().catch(() => {});
      setActionError(errorMessage(error));
    } finally {
      if (sessionEpoch.current === epoch) {
        decisionInProgress.current = false;
        setActing(false);
      }
    }
  }

  const invitation = pending.incoming ?? pending.outgoing;

  return (
    <CallsContext.Provider
      value={{
        user,
        socket,
        connected,
        busy:
          starting ||
          !!invitation ||
          location.pathname.startsWith("/callroom/"),
        startCall,
      }}
    >
      {children}
      {invitation && (
        <CallPrompt
          key={invitation.requestId}
          invitation={invitation}
          incoming={!!pending.incoming}
          connected={connected}
          acting={acting}
          error={actionError}
          onAccept={() => {
            void decide("accept");
          }}
          onDismiss={() => {
            void decide(pending.incoming ? "reject" : "cancel");
          }}
        />
      )}
      {notice && !invitation && (
        <div
          role="status"
          className="fixed right-4 bottom-4 z-50 flex max-w-sm items-start gap-4 rounded-2xl border border-[#ACA9FF] bg-white px-5 py-4 text-sm text-[#0A0332] shadow-xl"
        >
          <p>{notice}</p>
          <button
            type="button"
            aria-label="Dismiss call notification"
            onClick={() => setNotice("")}
            className="shrink-0 rounded p-1 hover:bg-slate-100"
          >
            <X size={16} />
          </button>
        </div>
      )}
    </CallsContext.Provider>
  );
}
