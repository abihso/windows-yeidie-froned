import PeopleGroupDuotoneIcon from "@iconify-react/stash/people-group-duotone";
import SettingOutlinedIcon from "@iconify-react/ant-design/setting-outlined";
import Task16Icon from "@iconify-react/qlementine-icons/task-16";
import ScheduleIcon from "@iconify-react/akar-icons/schedule";
import ResourcesIcon from "@iconify-react/grommet-icons/resources";
import GoogleJournalIcon from "@iconify-react/arcticons/google-journal";
import MessageRoundIcon from "@iconify-react/mage/message-round";
import SaveIcon from "@iconify-react/reicon/save";
import FeedLinearIcon from "@iconify-react/solar/feed-linear";
import DiscoverLightIcon from "@iconify-react/iconamoon/discover-light";
import OrganizationIcon from "@iconify-react/grommet-icons/organization";
import { Images } from "../../../assets/images";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import VideoOutlineIcon from "@iconify-react/basil/video-outline";
import CallOutlineIcon from "@iconify-react/famicons/call-outline";
import {
  Download,
  LoaderCircle,
  Mic,
  Paperclip,
  Send,
  Smile,
  Square,
  X,
} from "lucide-react";
import MenuDots16Icon from "@iconify-react/qlementine-icons/menu-dots-16";
import PlusIcon from "@iconify-react/akar-icons/plus";
import { useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  api,
  normalizeMediaUrl,
  type Conversation,
  type User,
} from "../../../lib/api";
import { useCalls } from "../../../features/calls/call-context";
import { MobileBottomNav } from "../../../components/mobile-bottom-nav";

const API_BASE_URL = (
  import.meta.env.VITE_API_URL ?? "http://localhost:4000/api"
).replace(/\/$/, "");

type ChatMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: string;
  attachmentName?: string | null;
  attachmentUrl?: string | null;
  attachmentMime?: string | null;
  attachmentSize?: number | null;
  reactions?: { emoji: string; userId: string }[];
};

const REACTION_EMOJIS = ["❤️", "😂", "👍", "😮", "😢", "👏"];

const fetchWithCsrf = async (
  url: string,
  options: RequestInit = {},
): Promise<Response> => {
  const csrfResponse = await fetch(`${API_BASE_URL}/auth/csrf`, {
    credentials: "include",
  });

  if (!csrfResponse.ok) {
    throw new Error("Unable to initialize secure chat request.");
  }

  const csrfData = (await csrfResponse.json()) as { csrfToken?: string };
  const csrfToken = csrfData.csrfToken;

  return fetch(url, {
    ...options,
    credentials: "include",
    headers: {
      ...(options.headers ?? {}),
      ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
    },
  });
};

const mergeMessages = (messages: ChatMessage[]) =>
  [...new Map(messages.map((message) => [message.id, message])).values()].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

const MessagesPanel = () => {
  const { user: currentUser, socket, connected, busy, startCall } = useCalls();
  const navigate = useNavigate();
  const [followingUsers, setFollowingUsers] = useState<User[]>([]);
  const [groupConversations, setGroupConversations] = useState<Conversation[]>(
    [],
  );
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<Conversation | null>(null);
  const [selectedConversationId, setSelectedConversationId] = useState<
    string | null
  >(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageDraft, setMessageDraft] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [sendingFile, setSendingFile] = useState(false);
  const [recording, setRecording] = useState(false);
  const [reactionMessageId, setReactionMessageId] = useState<string | null>(
    null,
  );
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [chatError, setChatError] = useState("");
  const [groupOpen, setGroupOpen] = useState(false);
  const [groupTitle, setGroupTitle] = useState("");
  const [groupMemberIds, setGroupMemberIds] = useState<string[]>([]);
  const [groupError, setGroupError] = useState("");
  const [groupManageOpen, setGroupManageOpen] = useState(false);
  const [groupManageTitle, setGroupManageTitle] = useState("");
  const [groupAction, setGroupAction] = useState<string | null>(null);
  const [sidebarLoading, setSidebarLoading] = useState(true);
  const conversationIdRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingConversationRef = useRef<string | null>(null);
  const selectedUserId = selectedUser?.id;

  const handleStartCallRequest = async (type: "audio" | "video") => {
    if (selectedGroup && selectedConversationId) {
      setChatError("");
      try {
        const response = await api.createCall({
          conversationId: selectedConversationId,
          mode: type,
        });
        navigate(`/callroom/groups-call?callId=${response.call.id}`);
      } catch (error) {
        setChatError(
          error instanceof Error
            ? error.message
            : "Unable to start the group call.",
        );
      }
      return;
    }
    if (
      !selectedUserId ||
      !selectedConversationId ||
      selectedConversationId !== conversationIdRef.current ||
      !connected ||
      busy
    ) {
      return;
    }

    const conversationId = selectedConversationId;
    setChatError("");
    try {
      await startCall({ conversationId, targetUserId: selectedUserId, type });
    } catch (error) {
      if (conversationIdRef.current !== conversationId) return;
      setChatError(
        error instanceof Error ? error.message : "Unable to start the call.",
      );
    }
  };

  const handleCreateGroup = async () => {
    if (!groupTitle.trim() || groupMemberIds.length === 0) {
      setGroupError("Add a group name and at least one member.");
      return;
    }
    try {
      const response = await api.createGroup(groupTitle.trim(), groupMemberIds);
      setGroupConversations((groups) => [response.conversation, ...groups]);
      setSelectedUser(null);
      setSelectedGroup(response.conversation);
      setGroupOpen(false);
      setGroupTitle("");
      setGroupMemberIds([]);
      setGroupError("");
    } catch (error) {
      setGroupError(
        error instanceof Error ? error.message : "Unable to create the group.",
      );
    }
  };

  const handleRenameGroup = async () => {
    if (!selectedGroup || !groupManageTitle.trim()) return;
    setGroupAction("rename");
    try {
      const response = await api.renameGroup(
        selectedGroup.id,
        groupManageTitle.trim(),
      );
      setSelectedGroup(response.conversation);
      setGroupConversations((groups) =>
        groups.map((group) =>
          group.id === response.conversation.id ? response.conversation : group,
        ),
      );
      setGroupManageTitle(response.conversation.title ?? "");
    } catch (error) {
      setChatError(
        error instanceof Error ? error.message : "Unable to rename the group.",
      );
    } finally {
      setGroupAction(null);
    }
  };

  const handleRemoveGroupMember = async (memberId: string) => {
    if (!selectedGroup) return;
    setGroupAction(`remove:${memberId}`);
    try {
      await api.removeGroupMember(selectedGroup.id, memberId);
      if (memberId === currentUser?.id) {
        setGroupConversations((groups) =>
          groups.filter((group) => group.id !== selectedGroup.id),
        );
        setSelectedGroup(null);
        setSelectedConversationId(null);
        setMessages([]);
        setGroupManageOpen(false);
        return;
      }
      setSelectedGroup((group) =>
        group
          ? {
              ...group,
              members: group.members.filter((member) => member.id !== memberId),
            }
          : group,
      );
      setGroupConversations((groups) =>
        groups.map((group) =>
          group.id === selectedGroup.id
            ? {
                ...group,
                members: group.members.filter(
                  (member) => member.id !== memberId,
                ),
              }
            : group,
        ),
      );
    } catch (error) {
      setChatError(
        error instanceof Error ? error.message : "Unable to remove the member.",
      );
    } finally {
      setGroupAction(null);
    }
  };

  const handleDeleteGroup = async () => {
    if (!selectedGroup) return;
    setGroupAction("delete");
    try {
      await api.deleteGroup(selectedGroup.id);
      setGroupConversations((groups) =>
        groups.filter((group) => group.id !== selectedGroup.id),
      );
      setSelectedGroup(null);
      setSelectedConversationId(null);
      setMessages([]);
      setGroupManageOpen(false);
    } catch (error) {
      setChatError(
        error instanceof Error ? error.message : "Unable to delete the group.",
      );
    } finally {
      setGroupAction(null);
    }
  };

  const handleAddGroupMember = async (memberId: string) => {
    if (!selectedGroup) return;
    setGroupAction(`add:${memberId}`);
    try {
      const response = await api.addGroupMember(selectedGroup.id, memberId);
      setSelectedGroup((group) =>
        group ? { ...group, members: response.members } : group,
      );
      setGroupConversations((groups) =>
        groups.map((group) =>
          group.id === selectedGroup.id
            ? { ...group, members: response.members }
            : group,
        ),
      );
    } catch (error) {
      setChatError(
        error instanceof Error ? error.message : "Unable to add the member.",
      );
    } finally {
      setGroupAction(null);
    }
  };

  const handleSendMessage = async (
    file?: File,
    expectedConversationId?: string,
  ) => {
    const conversationId = expectedConversationId ?? selectedConversationId;
    const payload = messageDraft.trim();
    if (
      !conversationId ||
      conversationId !== conversationIdRef.current ||
      (!payload && !file)
    ) {
      return;
    }

    const optimisticMessage: ChatMessage | null = file
      ? null
      : {
          id: `temp-${crypto.randomUUID()}`,
          conversationId,
          senderId: currentUser?.id ?? "me",
          body: payload,
          createdAt: new Date().toISOString(),
        };
    if (optimisticMessage) {
      setMessages((previous) => [...previous, optimisticMessage]);
      setMessageDraft("");
    }
    if (file) setSendingFile(true);

    try {
      const formData = file ? new FormData() : null;
      if (formData && file) {
        if (payload) formData.append("body", payload);
        formData.append("file", file, file.name);
      }
      const response = await fetchWithCsrf(
        `${API_BASE_URL}/conversations/${conversationId}/messages${file ? "/attachment" : ""}`,
        {
          method: "POST",
          ...(formData
            ? { body: formData }
            : {
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ body: payload }),
              }),
        },
      );

      const result = (await response.json().catch(() => null)) as {
        message?: ChatMessage;
        error?: { message?: string };
      } | null;
      if (!response.ok || !result?.message) {
        throw new Error(result?.error?.message ?? "Message not sent.");
      }
      if (conversationIdRef.current !== conversationId) return;
      setMessages((previous) =>
        mergeMessages([
          ...previous.filter((item) => item.id !== optimisticMessage?.id),
          result.message!,
        ]),
      );
      if (file) {
        setPendingFile((selected) => (selected === file ? null : selected));
        setMessageDraft("");
      }
    } catch (error) {
      console.error("Failed to send message:", error);
      if (conversationIdRef.current !== conversationId) return;
      setChatError(
        error instanceof Error ? error.message : "Message could not be sent.",
      );
      if (optimisticMessage) {
        setMessages((previous) =>
          previous.filter((item) => item.id !== optimisticMessage.id),
        );
      }
    } finally {
      if (file) setSendingFile(false);
    }
  };

  const handleReaction = async (message: ChatMessage, emoji: string) => {
    if (!selectedConversationId || !currentUser?.id) return;
    const conversationId = selectedConversationId;
    try {
      const response = await fetchWithCsrf(
        `${API_BASE_URL}/conversations/${conversationId}/messages/${message.id}/reactions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ emoji }),
        },
      );
      const result = (await response.json().catch(() => null)) as {
        active?: boolean;
        error?: { message?: string };
      } | null;
      if (!response.ok || typeof result?.active !== "boolean") {
        throw new Error(
          result?.error?.message ?? "Reaction could not be saved.",
        );
      }
      setMessages((previous) =>
        previous.map((item) => {
          if (item.id !== message.id) return item;
          const reactions = (item.reactions ?? []).filter(
            (reaction) =>
              reaction.userId !== currentUser.id || reaction.emoji !== emoji,
          );
          if (result.active) reactions.push({ emoji, userId: currentUser.id });
          return { ...item, reactions };
        }),
      );
      setReactionMessageId(null);
    } catch (error) {
      setChatError(
        error instanceof Error ? error.message : "Reaction could not be saved.",
      );
    }
  };

  const toggleRecording = async () => {
    if (recording) {
      recorderRef.current?.stop();
      return;
    }
    const conversationId = selectedConversationId;
    if (!conversationId || conversationId !== conversationIdRef.current) return;
    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setChatError("Voice recording is not supported in this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (conversationIdRef.current !== conversationId) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      recordingStreamRef.current = stream;
      const mimeType = ["audio/webm;codecs=opus", "audio/mp4"].find((type) =>
        MediaRecorder.isTypeSupported(type),
      );
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      recordingConversationRef.current = conversationId;
      recordingChunksRef.current = [];
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size) recordingChunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const audio = new Blob(recordingChunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        recordingChunksRef.current = [];
        stream.getTracks().forEach((track) => track.stop());
        recordingStreamRef.current = null;
        recorderRef.current = null;
        recordingConversationRef.current = null;
        setRecording(false);
        if (!audio.size || conversationIdRef.current !== conversationId) return;
        const extension = audio.type.includes("mp4") ? "m4a" : "webm";
        const voiceMessage = new File([audio], `voice-message.${extension}`, {
          type: audio.type,
        });
        setPendingFile(voiceMessage);
        void handleSendMessage(voiceMessage, conversationId);
      };
      recorder.start();
      setChatError("");
      setRecording(true);
    } catch (error) {
      recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
      recordingStreamRef.current = null;
      setChatError(
        error instanceof Error
          ? error.message
          : "Microphone access is required to record a voice message.",
      );
    }
  };

  useEffect(() => {
    if (
      recorderRef.current &&
      recordingConversationRef.current !== selectedConversationId
    ) {
      recorderRef.current.stop();
    }
  }, [selectedConversationId]);

  useEffect(
    () => () => {
      const recorder = recorderRef.current;
      if (recorder) {
        recorder.onstop = null;
        recorder.ondataavailable = null;
        recorder.stop();
      }
      recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
    },
    [],
  );

  useEffect(() => {
    if (!currentUser?.id) return;
    let isMounted = true;

    async function loadFollowing(userId: string) {
      setSidebarLoading(true);
      try {
        const response = await fetch(
          `${API_BASE_URL}/users/${userId}/following`,
          { credentials: "include" },
        );

        if (!response.ok) {
          throw new Error("Unable to load following users.");
        }

        const data = (await response.json()) as { users?: User[] };
        const people = data.users ?? [];

        if (!isMounted) return;

        setFollowingUsers(people);
        const conversations = await api.conversations();
        if (!isMounted) return;
        setGroupConversations(
          conversations.conversations.filter(
            (conversation) => conversation.kind === "group",
          ),
        );
        setSelectedUser(
          (previous: User | null) => previous ?? people[0] ?? null,
        );
      } catch (error) {
        console.error("Failed to load messages sidebar data:", error);
      } finally {
        if (isMounted) setSidebarLoading(false);
      }
    }

    void loadFollowing(currentUser.id);

    return () => {
      isMounted = false;
    };
  }, [currentUser?.id]);

  useEffect(() => {
    let cancelled = false;
    conversationIdRef.current = null;
    if (!selectedGroup) return;
    const group = selectedGroup;

    async function openGroupConversation() {
      try {
        const response = await fetch(
          `${API_BASE_URL}/conversations/${group.id}/messages?limit=50&offset=0`,
          { credentials: "include" },
        );
        if (!response.ok) throw new Error("Unable to load group messages.");
        const history = (await response.json()) as { messages?: ChatMessage[] };
        if (cancelled) return;
        conversationIdRef.current = group.id;
        setMessages(mergeMessages(history.messages ?? []));
        setSelectedConversationId(group.id);
      } catch (error) {
        if (cancelled) return;
        setChatError(
          error instanceof Error ? error.message : "Unable to load this group.",
        );
      }
    }

    void openGroupConversation();
    return () => {
      cancelled = true;
      conversationIdRef.current = null;
    };
  }, [selectedGroup]);

  useEffect(() => {
    let cancelled = false;
    conversationIdRef.current = null;
    if (!selectedUserId) return;

    const openConversation = async () => {
      try {
        const response = await fetchWithCsrf(`${API_BASE_URL}/conversations`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind: "direct", memberIds: [selectedUserId] }),
        });

        const payload = (await response.json().catch(() => null)) as {
          conversation?: { id?: string };
        } | null;
        if (cancelled) return;
        if (!response.ok || !payload?.conversation?.id) {
          throw new Error("Unable to open chat with this person.");
        }

        const conversationId = payload.conversation.id;
        conversationIdRef.current = conversationId;
        const historyResponse = await fetch(
          `${API_BASE_URL}/conversations/${conversationId}/messages?limit=50&offset=0`,
          { credentials: "include" },
        );
        if (!historyResponse.ok) throw new Error("Unable to load messages.");
        const history = (await historyResponse.json()) as {
          messages?: ChatMessage[];
        };
        if (cancelled) return;
        setMessages((previous) =>
          mergeMessages([...(history.messages ?? []), ...previous]),
        );
        setSelectedConversationId(conversationId);
      } catch (error) {
        if (cancelled) return;
        conversationIdRef.current = null;
        setChatError(
          error instanceof Error
            ? error.message
            : "Unable to load this conversation.",
        );
        setMessages([]);
        setSelectedConversationId(null);
      }
    };

    void openConversation();

    return () => {
      cancelled = true;
      conversationIdRef.current = null;
    };
  }, [selectedUserId]);

  useEffect(() => {
    if (!socket) return;
    const receiveMessage = (message: ChatMessage) => {
      if (message.conversationId !== conversationIdRef.current) return;
      setMessages((previous) => mergeMessages([...previous, message]));
    };
    const receiveReaction = (event: {
      conversationId: string;
      messageId: string;
      userId: string;
      emoji: string;
      active: boolean;
    }) => {
      if (event.conversationId !== conversationIdRef.current) return;
      setMessages((previous) =>
        previous.map((message) => {
          if (message.id !== event.messageId) return message;
          const reactions = (message.reactions ?? []).filter(
            (reaction) =>
              reaction.userId !== event.userId ||
              reaction.emoji !== event.emoji,
          );
          if (event.active) {
            reactions.push({ emoji: event.emoji, userId: event.userId });
          }
          return { ...message, reactions };
        }),
      );
    };
    socket.on("message:new", receiveMessage);
    socket.on("message:reaction", receiveReaction);
    return () => {
      socket.off("message:new", receiveMessage);
      socket.off("message:reaction", receiveReaction);
    };
  }, [socket]);

  const userInitials =
    currentUser?.fullName
      ?.split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part: string) => part[0]?.toUpperCase() ?? "")
      .join("") || "YO";

  const selectedContact = selectedUser;
  const callsDisabled = !selectedConversationId || !connected || busy;

  return (
    <div className="mobile-messages flex flex-col h-screen overflow-hidden">
      <div className="h-14 shrink-0 flex items-center gap-3">
        <div className="w-16 bg-color6 h-full" />
        <p className="text-color1 font-extrabold text-xl">Messages</p>
      </div>

      <div className="mobile-messages-body flex justify-between flex-1 overflow-hidden ">
        {/* Leftmost Icon Sidebar */}
        <div className="mobile-messages-nav w-16 px-3 flex gap-4 flex-col items-center bg-color6 relative shrink-0">
          <PeopleGroupDuotoneIcon
            height="1em"
            className="text-3xl text-color4 cursor-pointer transition-transform duration-200 hover:scale-125 active:scale-90"
          />
          <OrganizationIcon
            onClick={() => (window.location.href = "/home")}
            height="1em"
            className="text-3xl text-color4 cursor-pointer transition-transform duration-200 hover:scale-125 active:scale-90"
          />
          <div className="border w-full" />
          <DiscoverLightIcon
            height="1em"
            className="text-3xl text-color4 cursor-pointer transition-transform duration-200 hover:scale-125 active:scale-90"
          />
          <FeedLinearIcon
            height="1em"
            className="text-3xl text-color4 cursor-pointer transition-transform duration-200 hover:scale-125 active:scale-90"
          />
          <SaveIcon
            height="1em"
            className="text-3xl text-color4 cursor-pointer transition-transform duration-200 hover:scale-125 active:scale-90"
          />
          <div className="border w-full mt-2" />
          <MessageRoundIcon
            height="1em"
            className="text-3xl text-color4 cursor-pointer transition-transform duration-200 hover:scale-125 active:scale-90 text-[#1900FF]"
          />
          <GoogleJournalIcon
            height="1em"
            className="text-3xl text-color4 cursor-pointer transition-transform duration-200 hover:scale-125 active:scale-90"
          />
          <ResourcesIcon
            height="1em"
            className="text-3xl text-color4 cursor-pointer transition-transform duration-200 hover:scale-125 active:scale-90"
          />
          <div className="border w-full mt-2" />
          <ScheduleIcon
            height="1em"
            className="text-3xl text-color4 cursor-pointer transition-transform duration-200 hover:scale-125 active:scale-90"
          />
          <Task16Icon
            height="1em"
            className="text-3xl text-color4 cursor-pointer transition-transform duration-200 hover:scale-125 active:scale-90"
          />
          <div className="absolute bottom-6">
            <SettingOutlinedIcon
              height="1em"
              className="text-3xl text-color4 cursor-pointer transition-transform duration-300 hover:rotate-90 hover:scale-125 active:scale-90"
            />
          </div>
        </div>

        {/* Main Workspace */}
        <div className="mobile-messages-workspace w-full grid grid-cols-12 overflow-hidden">
          {/* Middle Navigation Column */}
          <div className="mobile-messages-list col-span-2 flex flex-col overflow-hidden ">
            {/* User Profile Card */}
            <div className="h-40 border border-[#ACA9FF] bg-[#f3f7ff] shrink-0 transition-all duration-300 hover:shadow-md">
              <div className="w-full flex flex-col relative pb-2 group cursor-pointer">
                <img
                  src={Images[5]}
                  alt=""
                  className="w-[94%] mt-2 rounded-lg h-16 object-cover self-center transition-transform duration-300 group-hover:scale-105"
                />
                <div className="flex flex-col justify-center pt-9 pb-2">
                  <p className="text-xs text-center font-medium transition-colors group-hover:text-[#1900FF]">
                    {currentUser?.fullName ?? "Loading profile..."}
                  </p>
                  <p className="text-[10px] text-center text-gray-500">
                    @{currentUser?.email?.split("@")[0] ?? "user"}
                  </p>
                </div>
                <div className="bg-white h-14 w-14 rounded-full absolute left-1/2 -translate-x-1/2 top-12 flex justify-center items-center shadow-sm transition-transform duration-300 group-hover:scale-110">
                  <Avatar className="h-12 w-12 shrink-0">
                    <AvatarImage
                      src={normalizeMediaUrl(currentUser?.avatarUrl)}
                      alt="Your profile picture"
                    />
                    <AvatarFallback>{userInitials}</AvatarFallback>
                  </Avatar>
                </div>
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-4 px-3 h-10 my-2 border border-[#ACA9FF] bg-[#f3f7ff] items-center shrink-0">
              {["All", "Groups", "Request", "Calls"].map((tab, idx) => (
                <button
                  key={tab}
                  className={`text-xs font-medium cursor-pointer transition-all duration-200 hover:text-[#1900FF] hover:-translate-y-0.5 active:scale-95 ${
                    idx === 0 ? "text-[#1900FF] font-bold" : ""
                  }`}
                >
                  {tab}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setGroupOpen(true)}
                className="ml-auto rounded-full p-1 text-[#1900FF] hover:bg-[#ACA9FF]/20"
                aria-label="Create group"
              >
                <PlusIcon height="1em" />
              </button>
            </div>

            {/* Conversation List */}
            <div className="flex-1 overflow-y-auto scrollbar-none [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden border border-[#ACA9FF] bg-[#f3f7ff] p-3 flex flex-col gap-3">
              {sidebarLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4].map((item) => (
                    <div key={item} className="flex items-center gap-2 p-1">
                      <Skeleton className="h-9 w-9 rounded-full" />
                      <div className="min-w-0 flex-1 space-y-2">
                        <Skeleton className="h-2.5 w-24" />
                        <Skeleton className="h-2 w-14" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : groupConversations.length === 0 &&
                followingUsers.length === 0 ? (
                <div className="flex h-full items-center justify-center text-center text-[10px] text-gray-500">
                  Create a group or follow someone to start chatting.
                </div>
              ) : (
                <>
                  {groupConversations.map((group) => (
                    <button
                      key={group.id}
                      type="button"
                      onClick={() => {
                        setSelectedUser(null);
                        setSelectedGroup(group);
                        conversationIdRef.current = null;
                        setMessages([]);
                        setSelectedConversationId(null);
                        setMessageDraft("");
                        setPendingFile(null);
                        setReactionMessageId(null);
                        setEmojiPickerOpen(false);
                        setChatError("");
                      }}
                      className={`flex gap-2 items-center p-1 rounded-lg cursor-pointer text-left transition-all duration-200 hover:bg-[#ACA9FF]/20 hover:translate-x-1 group ${selectedGroup?.id === group.id ? "bg-[#ACA9FF]/20 ring-1 ring-[#1900FF]/30" : ""}`}
                    >
                      <Avatar className="h-9 w-9 shrink-0">
                        <AvatarFallback>
                          {(group.title || "Group")
                            .split(" ")
                            .slice(0, 2)
                            .map((part) => part[0]?.toUpperCase() ?? "")
                            .join("")}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 truncate">
                        <p className="text-[10px] font-medium truncate group-hover:text-[#1900FF]">
                          {group.title || "Group conversation"}
                        </p>
                        <p className="text-[8px] text-gray-500 truncate">
                          {group.members.length} members
                        </p>
                      </div>
                    </button>
                  ))}
                  {followingUsers.map((person) => {
                    const isSelected = selectedContact?.id === person.id;
                    const handleName = person.fullName || "Followed user";
                    const handleTag = person.role
                      ? person.role.toUpperCase()
                      : "USER";

                    return (
                      <div
                        key={person.id}
                        onClick={() => {
                          if (person.id === selectedUserId) return;
                          setSelectedGroup(null);
                          conversationIdRef.current = null;
                          setSelectedConversationId(null);
                          setMessages([]);
                          setChatError("");
                          setMessageDraft("");
                          setPendingFile(null);
                          setReactionMessageId(null);
                          setEmojiPickerOpen(false);
                          setSelectedUser(person);
                        }}
                        className={`flex gap-2 items-center p-1 rounded-lg cursor-pointer transition-all duration-200 hover:bg-[#ACA9FF]/20 hover:translate-x-1 active:scale-[0.98] group ${
                          isSelected
                            ? "bg-[#ACA9FF]/20 ring-1 ring-[#1900FF]/30"
                            : ""
                        }`}
                      >
                        <Avatar className="h-9 w-9 shrink-0 transition-transform duration-200 group-hover:scale-105">
                          <AvatarImage
                            src={normalizeMediaUrl(person.avatarUrl)}
                            alt={`${handleName} profile picture`}
                          />
                          <AvatarFallback>
                            {handleName
                              .split(" ")
                              .filter(Boolean)
                              .slice(0, 2)
                              .map(
                                (part: string) => part[0]?.toUpperCase() ?? "",
                              )
                              .join("") || "U"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="truncate">
                          <p className="text-[10px] font-medium truncate transition-colors group-hover:text-[#1900FF]">
                            {handleName}
                          </p>
                          <p className="text-[8px] text-gray-500 truncate">
                            {handleTag}
                          </p>
                        </div>
                        <MobileBottomNav />
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          </div>

          {/* Right Chat Column */}
          <div className="mobile-messages-chat col-span-10 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="h-12 bg-color6 border border-[#ACA9FF] flex justify-between items-center px-5 shrink-0">
              <div className="flex items-center gap-2 cursor-pointer group">
                <Avatar className="h-10 w-10 shrink-0 transition-transform duration-200 group-hover:scale-105">
                  <AvatarImage
                    src={normalizeMediaUrl(currentUser?.avatarUrl)}
                    alt="Your profile picture"
                  />
                  <AvatarFallback>{userInitials}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-[10px] font-extrabold transition-colors text-white group-hover:text-[#eeeeefa1]">
                    {currentUser?.fullName ?? "Your profile"}
                  </p>
                  <p className="text-[8px] text-gray-500">
                    {currentUser?.email ?? ""}
                  </p>
                </div>
              </div>
              <div className="flex flex-row gap-3">
                <button
                  type="button"
                  onClick={() => void handleStartCallRequest("audio")}
                  disabled={callsDisabled}
                  className="p-1.5 rounded-full cursor-pointer transition-all duration-200 hover:bg-black/5 dark:hover:bg-white/5 hover:scale-110 active:scale-90 disabled:opacity-40 disabled:cursor-not-allowed"
                  aria-label="Request an audio call"
                >
                  <CallOutlineIcon height="22px" color="white" />
                </button>
                <button
                  type="button"
                  onClick={() => void handleStartCallRequest("video")}
                  disabled={callsDisabled}
                  className="p-1.5 rounded-full cursor-pointer transition-all duration-200 hover:bg-black/5 dark:hover:bg-white/5 hover:scale-110 active:scale-90 disabled:opacity-40 disabled:cursor-not-allowed"
                  aria-label="Request a video call"
                >
                  <VideoOutlineIcon height="22px" color="white" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!selectedGroup) return;
                    setGroupManageTitle(selectedGroup.title ?? "");
                    setGroupManageOpen(true);
                  }}
                  disabled={!selectedGroup}
                  className="p-1.5 rounded-full cursor-pointer transition-all duration-200 hover:bg-black/5 dark:hover:bg-white/5 hover:scale-110 active:scale-90 disabled:opacity-40"
                >
                  <MenuDots16Icon height="22px" color="white" />
                </button>
              </div>
            </div>

            {/* Chat Content Panel */}
            <div className="border flex-1 border-[#ACA9FF] flex flex-col justify-between py-4 px-6 overflow-hidden">
              <div className="flex-1 overflow-y-auto scrollbar-none [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden flex flex-col gap-3 pr-2">
                {messages.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-center text-sm text-gray-500">
                    {selectedContact
                      ? "No messages yet. Say hello to start the conversation."
                      : "Select a person to start chatting."}
                  </div>
                ) : (
                  messages.map((message) => {
                    const isOutgoing = message.senderId === currentUser?.id;
                    const sender = selectedGroup?.members.find(
                      (member) => member.id === message.senderId,
                    );
                    const senderAvatarUrl = isOutgoing
                      ? currentUser?.avatarUrl
                      : selectedGroup
                        ? sender?.avatarUrl
                        : selectedContact?.avatarUrl;
                    const attachmentEndpoint = message.attachmentUrl
                      ? `${API_BASE_URL}/conversations/${encodeURIComponent(message.conversationId)}/messages/${encodeURIComponent(message.id)}/attachment`
                      : "";
                    const groupedReactions = Object.entries(
                      (message.reactions ?? []).reduce<
                        Record<string, string[]>
                      >((groups, reaction) => {
                        (groups[reaction.emoji] ??= []).push(reaction.userId);
                        return groups;
                      }, {}),
                    );

                    return (
                      <div
                        key={message.id}
                        className={`w-full flex items-center gap-2 ${
                          isOutgoing ? "justify-end" : "justify-start"
                        }`}
                      >
                        {!isOutgoing && (
                          <Avatar className="h-9 w-9 shrink-0 transition-transform duration-200 hover:scale-110 cursor-pointer">
                            <AvatarImage
                              src={normalizeMediaUrl(senderAvatarUrl)}
                              alt={`${sender?.fullName ?? selectedContact?.fullName ?? "Sender"} profile picture`}
                            />
                            <AvatarFallback>
                              {selectedContact?.fullName
                                ?.split(" ")
                                .filter(Boolean)
                                .slice(0, 2)
                                .map(
                                  (part: string) =>
                                    part[0]?.toUpperCase() ?? "",
                                )
                                .join("") || "U"}
                            </AvatarFallback>
                          </Avatar>
                        )}

                        <div className="relative flex max-w-[75%] flex-col">
                          {reactionMessageId === message.id && (
                            <div className="absolute bottom-full right-0 z-20 mb-2 flex gap-1 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
                              {REACTION_EMOJIS.map((emoji) => (
                                <button
                                  key={emoji}
                                  type="button"
                                  onClick={() =>
                                    void handleReaction(message, emoji)
                                  }
                                  aria-label={`React with ${emoji}`}
                                  className="rounded-md p-1.5 text-lg hover:bg-slate-100"
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          )}
                          <div
                            className={`min-w-28 rounded-3xl px-4 py-3 transition-colors ${
                              isOutgoing
                                ? "bg-color6 text-white hover:bg-[#ACA9FF]/40"
                                : "bg-[#EAEAEA] text-[#656565] hover:bg-[#e0e0e0]"
                            }`}
                          >
                            {message.body && (
                              <p className="whitespace-pre-wrap wrap-break-word text-xs">
                                {message.body}
                              </p>
                            )}
                            {message.attachmentUrl && (
                              <div className={message.body ? "mt-2" : ""}>
                                {message.attachmentMime?.startsWith(
                                  "image/",
                                ) && (
                                  <img
                                    src={`${attachmentEndpoint}?inline=true`}
                                    crossOrigin="use-credentials"
                                    alt={
                                      message.attachmentName ?? "Shared image"
                                    }
                                    className="mb-2 max-h-56 max-w-full rounded-lg object-contain"
                                  />
                                )}
                                {message.attachmentMime?.startsWith(
                                  "audio/",
                                ) && (
                                  <audio
                                    controls
                                    crossOrigin="use-credentials"
                                    src={`${attachmentEndpoint}?inline=true`}
                                    className="max-w-full"
                                  />
                                )}
                                <div className="flex items-center gap-2 text-xs">
                                  <span className="max-w-48 truncate">
                                    {message.attachmentName ?? "Shared file"}
                                    {message.attachmentSize
                                      ? ` · ${Math.max(1, Math.round(message.attachmentSize / 1024))} KB`
                                      : ""}
                                  </span>
                                  <a
                                    href={attachmentEndpoint}
                                    aria-label={`Download ${message.attachmentName ?? "file"}`}
                                    title="Download file"
                                    className="shrink-0 rounded p-1 hover:bg-black/10"
                                  >
                                    <Download size={15} />
                                  </a>
                                </div>
                              </div>
                            )}
                          </div>
                          <div
                            className={`mt-1 flex items-center gap-1 ${isOutgoing ? "justify-end" : "justify-start"}`}
                          >
                            {groupedReactions.map(([emoji, users]) => (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() =>
                                  void handleReaction(message, emoji)
                                }
                                aria-label={`${emoji} reaction, ${users.length} total`}
                                aria-pressed={Boolean(
                                  currentUser && users.includes(currentUser.id),
                                )}
                                className={`rounded-full border px-2 py-0.5 text-xs ${users.includes(currentUser?.id ?? "") ? "border-[#1900FF] bg-[#1900FF]/10" : "border-slate-200 bg-white"}`}
                              >
                                {emoji} {users.length}
                              </button>
                            ))}
                            <button
                              type="button"
                              onClick={() =>
                                setReactionMessageId((id) =>
                                  id === message.id ? null : message.id,
                                )
                              }
                              aria-label="React to message"
                              title="React to message"
                              className="rounded-full p-1 text-slate-500 hover:bg-slate-100"
                            >
                              <Smile size={15} />
                            </button>
                          </div>
                        </div>

                        {isOutgoing && (
                          <Avatar className="h-9 w-9 shrink-0 transition-transform duration-200 hover:scale-110 cursor-pointer">
                            <AvatarImage
                              src={normalizeMediaUrl(currentUser?.avatarUrl)}
                              alt="Your profile picture"
                            />
                            <AvatarFallback>{userInitials}</AvatarFallback>
                          </Avatar>
                        )}
                      </div>
                    );
                  })
                )}
                {chatError && (
                  <p className="text-[10px] text-red-500">{chatError}</p>
                )}
              </div>

              {/* Chat Input Bar */}
              {pendingFile && (
                <div className="mt-2 flex items-center gap-2 text-xs text-slate-600">
                  <Paperclip size={14} />
                  <span className="max-w-64 truncate">{pendingFile.name}</span>
                  <button
                    type="button"
                    onClick={() => setPendingFile(null)}
                    aria-label="Remove selected file"
                    className="rounded p-1 hover:bg-slate-100"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
              <div className="relative mt-2 flex min-h-11 shrink-0 items-center justify-between gap-2 rounded-xl border border-[#ACA9FF] px-3 transition-all duration-200 focus-within:ring-2 focus-within:ring-[#1900FF]/40 focus-within:shadow-md">
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) setPendingFile(file);
                    event.target.value = "";
                  }}
                />
                <div className="flex h-10 min-w-0 flex-1 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={!selectedConversationId || sendingFile}
                    aria-label="Attach a file"
                    title="Attach a file"
                    className="rounded-full p-1.5 hover:bg-slate-100 disabled:opacity-40"
                  >
                    <Paperclip size={18} />
                  </button>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setEmojiPickerOpen((open) => !open)}
                      disabled={!selectedConversationId}
                      aria-label="Choose an emoji"
                      title="Choose an emoji"
                      className="rounded-full p-1.5 hover:bg-slate-100 disabled:opacity-40"
                    >
                      <Smile size={18} />
                    </button>
                    {emojiPickerOpen && (
                      <div className="absolute bottom-full left-0 z-20 mb-2 flex gap-1 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
                        {REACTION_EMOJIS.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => {
                              setMessageDraft((draft) => `${draft}${emoji}`);
                              setEmojiPickerOpen(false);
                            }}
                            aria-label={`Insert ${emoji}`}
                            className="rounded-md p-1.5 text-lg hover:bg-slate-100"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <input
                    type="text"
                    value={messageDraft}
                    onChange={(e) => setMessageDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        void handleSendMessage();
                      }
                    }}
                    placeholder={
                      selectedConversationId
                        ? "Write a message..."
                        : "Select a person to chat"
                    }
                    disabled={!selectedConversationId}
                    className="h-full w-full min-w-0 bg-transparent py-2 text-xs text-gray-700 outline-none disabled:cursor-not-allowed disabled:text-gray-400"
                  />
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => void toggleRecording()}
                    disabled={!selectedConversationId || sendingFile}
                    aria-label={
                      recording
                        ? "Stop and send voice message"
                        : "Record voice message"
                    }
                    aria-pressed={recording}
                    title={
                      recording
                        ? "Stop and send voice message"
                        : "Record voice message"
                    }
                    className={`rounded-full p-2 hover:bg-slate-100 disabled:opacity-40 ${recording ? "text-red-600" : "text-slate-700"}`}
                  >
                    {recording ? <Square size={17} /> : <Mic size={18} />}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void handleSendMessage(pendingFile ?? undefined)
                    }
                    disabled={
                      !selectedConversationId ||
                      (!messageDraft.trim() && !pendingFile) ||
                      sendingFile
                    }
                    aria-label={sendingFile ? "Sending file" : "Send message"}
                    title={sendingFile ? "Sending" : "Send"}
                    className="rounded-full bg-[#1900FF] p-2 text-white hover:bg-[#1200c4] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {sendingFile ? (
                      <LoaderCircle size={17} className="animate-spin" />
                    ) : (
                      <Send size={17} />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {groupOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0A0332]/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-[#0A0332]">
                  Create a group
                </h2>
                <p className="text-xs text-slate-500">
                  Choose people you want in this conversation.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setGroupOpen(false)}
                className="rounded-lg px-2 py-1 text-sm font-bold text-slate-500 hover:bg-slate-100"
              >
                Close
              </button>
            </div>
            <input
              value={groupTitle}
              onChange={(event) => setGroupTitle(event.target.value)}
              placeholder="Group name"
              maxLength={120}
              className="mt-4 w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-[#1900FF]"
            />
            <div className="mt-4 max-h-52 space-y-2 overflow-y-auto">
              {followingUsers.length ? (
                followingUsers.map((person) => (
                  <label
                    key={person.id}
                    className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-3 hover:bg-[#F3F2FF]"
                  >
                    <input
                      type="checkbox"
                      checked={groupMemberIds.includes(person.id)}
                      onChange={(event) =>
                        setGroupMemberIds((current) =>
                          event.target.checked
                            ? [...current, person.id]
                            : current.filter((id) => id !== person.id),
                        )
                      }
                    />
                    <span className="text-sm font-bold text-[#0A0332]">
                      {person.fullName}
                    </span>
                  </label>
                ))
              ) : (
                <p className="text-sm text-slate-600">
                  Follow people first so you can add them to a group.
                </p>
              )}
            </div>
            {groupError && (
              <p className="mt-3 text-sm text-red-600">{groupError}</p>
            )}
            <button
              type="button"
              onClick={() => void handleCreateGroup()}
              className="mt-4 w-full rounded-xl bg-[#1900FF] px-4 py-3 text-sm font-bold text-white hover:bg-[#1300c4]"
            >
              Create group
            </button>
          </div>
        </div>
      )}

      {groupManageOpen && selectedGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0A0332]/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold text-[#0A0332]">Manage group</h2>
              <button
                type="button"
                onClick={() => setGroupManageOpen(false)}
                className="rounded-lg px-2 py-1 text-sm font-bold text-slate-500 hover:bg-slate-100"
              >
                Close
              </button>
            </div>
            {selectedGroup.createdBy === currentUser?.id ? (
              <>
                <div className="mt-4 flex gap-2">
                  <input
                    value={groupManageTitle}
                    onChange={(event) =>
                      setGroupManageTitle(event.target.value)
                    }
                    className="min-w-0 flex-1 rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-[#1900FF]"
                  />
                  <button
                    type="button"
                    onClick={() => void handleRenameGroup()}
                    disabled={groupAction !== null}
                    className="flex items-center gap-2 rounded-xl bg-[#1900FF] px-3 text-sm font-bold text-white hover:bg-[#1300c4] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {groupAction === "rename" && (
                      <LoaderCircle size={14} className="animate-spin" />
                    )}
                    {groupAction === "rename" ? "Saving..." : "Save"}
                  </button>
                </div>
                <p className="mt-4 text-xs font-bold uppercase text-slate-500">
                  Members
                </p>
                <div className="mt-2 space-y-2">
                  {selectedGroup.members.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between rounded-xl border border-slate-200 p-3"
                    >
                      <span className="text-sm font-bold text-[#0A0332]">
                        {member.fullName}
                      </span>
                      {member.id !== selectedGroup.createdBy && (
                        <button
                          type="button"
                          onClick={() =>
                            void handleRemoveGroupMember(member.id)
                          }
                          disabled={groupAction !== null}
                          className="flex items-center gap-1 text-xs font-bold text-red-600 hover:underline disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {groupAction === `remove:${member.id}` && (
                            <LoaderCircle size={12} className="animate-spin" />
                          )}
                          {groupAction === `remove:${member.id}`
                            ? "Removing..."
                            : "Remove"}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-xs font-bold uppercase text-slate-500">
                  Add members
                </p>
                <div className="mt-2 space-y-2">
                  {followingUsers
                    .filter(
                      (person) =>
                        !selectedGroup.members.some(
                          (member) => member.id === person.id,
                        ),
                    )
                    .map((person) => (
                      <div
                        key={person.id}
                        className="flex items-center justify-between rounded-xl border border-slate-200 p-3"
                      >
                        <span className="text-sm text-[#0A0332]">
                          {person.fullName}
                        </span>
                        <button
                          type="button"
                          onClick={() => void handleAddGroupMember(person.id)}
                          disabled={groupAction !== null}
                          className="flex items-center gap-1 text-xs font-bold text-[#1900FF] hover:underline disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {groupAction === `add:${person.id}` && (
                            <LoaderCircle size={12} className="animate-spin" />
                          )}
                          {groupAction === `add:${person.id}`
                            ? "Adding..."
                            : "Add"}
                        </button>
                      </div>
                    ))}
                </div>
                <button
                  type="button"
                  onClick={() => void handleDeleteGroup()}
                  disabled={groupAction !== null}
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 px-4 py-3 text-sm font-bold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {groupAction === "delete" && (
                    <LoaderCircle size={16} className="animate-spin" />
                  )}
                  {groupAction === "delete" ? "Deleting..." : "Delete group"}
                </button>
              </>
            ) : (
              <>
                <p className="mt-4 text-sm text-slate-600">
                  Only the group owner can manage members and group settings.
                </p>
                <button
                  type="button"
                  onClick={() =>
                    currentUser && void handleRemoveGroupMember(currentUser.id)
                  }
                  disabled={groupAction !== null}
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 px-4 py-3 text-sm font-bold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {groupAction === `remove:${currentUser?.id}` && (
                    <LoaderCircle size={16} className="animate-spin" />
                  )}
                  {groupAction === `remove:${currentUser?.id}`
                    ? "Leaving..."
                    : "Leave group"}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const Messages = () => {
  const { user } = useCalls();
  return <MessagesPanel key={user?.id ?? "signed-out"} />;
};

export default Messages;
