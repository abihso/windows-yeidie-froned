import type { Socket } from "socket.io-client";

type PeerEvent = {
  socketId: string;
  userId?: string;
  fullName?: string;
  avatarUrl?: string | null;
};
type EndedEvent = { callId: string; reason?: string };
type Signal = {
  callId: string;
  fromId: string;
  sdp: RTCSessionDescriptionInit;
  candidate: RTCIceCandidateInit | null;
};
type JoinResult = {
  callId: string;
  mode: "audio" | "video";
  peers: PeerEvent[];
};
type Peer = {
  pc: RTCPeerConnection;
  remoteStream: MediaStream;
  pendingCandidates: (RTCIceCandidateInit | null)[];
  queue: Promise<void>;
  closed: boolean;
};
type Options = {
  socket: Socket;
  localStream: MediaStream;
  iceServers?: RTCIceServer[];
  onRemoteStream?: (event: PeerEvent & { stream: MediaStream }) => void;
  onPeerJoined?: (event: PeerEvent) => void;
  onPeerLeft?: (event: PeerEvent) => void;
  onError?: (error: Error) => void;
  onEnded?: (event: EndedEvent) => void;
};

// A replacement room waits for the previous client to finish leaving the same
// shared socket. This also protects route changes and React StrictMode cleanup.
const retirements = new WeakMap<Socket, Promise<void>>();

export function createCallClient({
  socket,
  localStream,
  iceServers = [],
  onRemoteStream = () => {},
  onPeerJoined = () => {},
  onPeerLeft = () => {},
  onError = () => {},
  onEnded = () => {},
}: Options) {
  const peers = new Map<string, Peer>();
  const departedPeers = new Set<string>();
  const previousRetirement = retirements.get(socket);
  let activeCallId: string | null = null;
  let joining = false;
  let destroyed = false;
  let generation = 0;
  let pendingJoin: Promise<JoinResult> | null = null;
  let teardown: Promise<void> | null = null;

  function report(error: unknown) {
    onError(
      error instanceof Error ? error : new Error("Unable to connect the call."),
    );
  }

  function request<T>(event: string, payload: object): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!socket.connected) {
        reject(
          new Error(
            "The connection was lost. Reconnect before joining the call.",
          ),
        );
        return;
      }
      socket.timeout(10_000).emit(
        event,
        payload,
        (
          timeoutError: Error | null,
          response: {
            ok: boolean;
            data: T;
            error?: { message?: string; code?: string };
          },
        ) => {
          if (timeoutError) {
            reject(
              new Error("The call server did not respond. Please try again."),
            );
            return;
          }
          if (!response?.ok) {
            reject(
              Object.assign(
                new Error(
                  response?.error?.message || "Unable to connect the call.",
                ),
                { code: response?.error?.code },
              ),
            );
            return;
          }
          resolve(response.data);
        },
      );
    });
  }

  function closePeer(socketId: string) {
    departedPeers.add(socketId);
    const peer = peers.get(socketId);
    if (!peer) return;
    peers.delete(socketId);
    peer.closed = true;
    peer.pendingCandidates.length = 0;
    peer.pc.onicecandidate = null;
    peer.pc.ontrack = null;
    peer.pc.onconnectionstatechange = null;
    peer.pc.close();
    peer.remoteStream.getTracks().forEach((track) => track.stop());
    onPeerLeft({ socketId });
  }

  function releaseMedia() {
    for (const socketId of [...peers.keys()]) closePeer(socketId);
    localStream.getTracks().forEach((track) => track.stop());
  }

  function peerFor(socketId: string): Peer {
    const existing = peers.get(socketId);
    if (existing) return existing;
    const pc = new RTCPeerConnection({ iceServers });
    const peer: Peer = {
      pc,
      remoteStream: new MediaStream(),
      pendingCandidates: [],
      queue: Promise.resolve(),
      closed: false,
    };
    peers.set(socketId, peer);
    for (const track of localStream.getTracks())
      pc.addTrack(track, localStream);
    pc.ontrack = (event) => {
      if (peer.closed) return;
      if (
        !peer.remoteStream
          .getTracks()
          .some((track) => track.id === event.track.id)
      )
        peer.remoteStream.addTrack(event.track);
      onRemoteStream({ socketId, stream: peer.remoteStream });
    };
    pc.onicecandidate = (event) => {
      const callId = activeCallId;
      if (peer.closed || !callId) return;
      void request("webrtc:ice-candidate", {
        callId,
        targetId: socketId,
        candidate: event.candidate?.toJSON() ?? null,
      }).catch((error) => {
        if (!peer.closed && activeCallId === callId) report(error);
      });
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed") {
        report(
          new Error(
            "The media connection failed. End this call and try again.",
          ),
        );
        closePeer(socketId);
      }
    };
    return peer;
  }

  function enqueue(peer: Peer, work: () => Promise<void>) {
    peer.queue = peer.queue
      .then(async () => {
        if (!peer.closed) await work();
      })
      .catch((error: unknown) => {
        if (!peer.closed) report(error);
      });
    return peer.queue;
  }

  async function flushCandidates(peer: Peer) {
    while (!peer.closed && peer.pendingCandidates.length) {
      await peer.pc.addIceCandidate(peer.pendingCandidates.shift());
    }
  }

  function accepts(payload: { callId: string }) {
    return !destroyed && activeCallId && payload?.callId === activeCallId;
  }

  function offerReceived(payload: Signal) {
    if (!accepts(payload) || departedPeers.has(payload.fromId)) return;
    const peer = peerFor(payload.fromId);
    void enqueue(peer, async () => {
      await peer.pc.setRemoteDescription(payload.sdp);
      await flushCandidates(peer);
      if (peer.closed) return;
      await peer.pc.setLocalDescription(await peer.pc.createAnswer());
      if (!peer.closed)
        await request("webrtc:answer", {
          callId: payload.callId,
          targetId: payload.fromId,
          sdp: peer.pc.localDescription?.toJSON(),
        });
    });
  }

  function answerReceived(payload: Signal) {
    if (!accepts(payload) || departedPeers.has(payload.fromId)) return;
    const peer = peers.get(payload.fromId);
    if (!peer) return;
    void enqueue(peer, async () => {
      await peer.pc.setRemoteDescription(payload.sdp);
      await flushCandidates(peer);
    });
  }

  function candidateReceived(payload: Signal) {
    if (!accepts(payload) || departedPeers.has(payload.fromId)) return;
    const peer = peerFor(payload.fromId);
    void enqueue(peer, async () => {
      if (peer.pc.remoteDescription)
        await peer.pc.addIceCandidate(payload.candidate);
      else if (peer.pendingCandidates.length < 256)
        peer.pendingCandidates.push(payload.candidate);
      else throw new Error("Unable to establish the media connection.");
    });
  }

  function peerLeft(payload: PeerEvent & { callId: string }) {
    if (accepts(payload)) closePeer(payload.socketId);
  }

  function peerJoined(payload: PeerEvent & { callId: string }) {
    if (accepts(payload)) {
      departedPeers.delete(payload.socketId);
      onPeerJoined(payload);
    }
  }

  function ended(payload: EndedEvent) {
    if (!accepts(payload)) return;
    generation += 1;
    activeCallId = null;
    joining = false;
    releaseMedia();
    onEnded(payload);
  }

  function disconnected(reason: string) {
    if (!activeCallId) {
      releaseMedia();
      return;
    }
    ended({ callId: activeCallId, reason: `disconnected: ${reason}` });
  }

  function connectionError(error: Error) {
    report(error);
    if (activeCallId)
      ended({ callId: activeCallId, reason: "connection_error" });
    else releaseMedia();
  }

  const listeners = {
    "webrtc:offer": offerReceived,
    "webrtc:answer": answerReceived,
    "webrtc:ice-candidate": candidateReceived,
    "call:peer-joined": peerJoined,
    "call:peer-left": peerLeft,
    "call:ended": ended,
    disconnect: disconnected,
    connect_error: connectionError,
  };
  for (const [event, listener] of Object.entries(listeners))
    socket.on(event, listener);

  async function join(callId: string): Promise<JoinResult> {
    callId = callId.toLowerCase();
    if (destroyed) throw new Error("This call client was destroyed.");
    if (activeCallId || joining)
      throw new Error("Leave the current call before joining another.");
    joining = true;
    const operation = ++generation;
    await previousRetirement;
    if (destroyed || operation !== generation)
      throw new Error("Joining the call was cancelled.");
    if (!localStream.getTracks().some((track) => track.readyState === "live")) {
      joining = false;
      throw new Error(
        "Acquire a fresh microphone/camera stream before joining.",
      );
    }
    departedPeers.clear();
    activeCallId = callId;
    try {
      pendingJoin = request<JoinResult>("call:join", { callId });
      const data = await pendingJoin;
      if (operation !== generation || activeCallId !== callId)
        throw new Error("Joining the call was cancelled.");
      for (const remote of data.peers) {
        if (operation !== generation || activeCallId !== callId)
          throw new Error("Joining the call was cancelled.");
        const peer = peerFor(remote.socketId);
        await enqueue(peer, async () => {
          await peer.pc.setLocalDescription(await peer.pc.createOffer());
          if (!peer.closed)
            await request("webrtc:offer", {
              callId,
              targetId: remote.socketId,
              sdp: peer.pc.localDescription?.toJSON(),
            });
        });
      }
      if (operation !== generation || activeCallId !== callId)
        throw new Error("Joining the call was cancelled.");
      return data;
    } catch (error) {
      if (operation === generation && activeCallId === callId) {
        activeCallId = null;
        releaseMedia();
        if (socket.connected)
          await request("call:leave", { callId }).catch(() => {});
      }
      throw error;
    } finally {
      if (operation === generation) joining = false;
    }
  }

  function leave(): Promise<void> {
    if (teardown) return teardown;
    const callId = activeCallId;
    generation += 1;
    activeCallId = null;
    joining = false;
    releaseMedia();
    // Local capture stops immediately; wait for the server join to finish before
    // removing its membership, so an in-flight join cannot outlive cleanup.
    teardown = (async () => {
      if (pendingJoin) await pendingJoin.catch(() => {});
      if (callId && socket.connected) await request("call:leave", { callId });
    })();
    retirements.set(
      socket,
      teardown.catch(() => {}),
    );
    return teardown;
  }

  async function destroy() {
    if (destroyed) return teardown;
    destroyed = true;
    for (const [event, listener] of Object.entries(listeners))
      socket.off(event, listener);
    await leave();
  }

  return { join, leave, destroy };
}

export type CallClient = ReturnType<typeof createCallClient>;
