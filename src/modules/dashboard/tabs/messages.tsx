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
import { LoaderCircle } from "lucide-react";
import MenuDots16Icon from "@iconify-react/qlementine-icons/menu-dots-16";
import PlusIcon from "@iconify-react/akar-icons/plus";
import StickerEmojiIcon from "@iconify-react/mdi/sticker-emoji";
import Emoji2LineIcon from "@iconify-react/mingcute/emoji-2-line";
import MicIcon from "@iconify-react/codicon/mic";
import { useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api, type Conversation, type User } from "../../../lib/api";
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
};

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

  const handleSendMessage = async () => {
    if (
      !selectedConversationId ||
      selectedConversationId !== conversationIdRef.current ||
      !messageDraft.trim()
    ) {
      return;
    }

    const conversationId = selectedConversationId;
    const payload = messageDraft.trim();
    const optimisticMessage = {
      id: `temp-${crypto.randomUUID()}`,
      conversationId,
      senderId: currentUser?.id ?? "me",
      body: payload,
      createdAt: new Date().toISOString(),
    };

    setMessages((previous) => [...previous, optimisticMessage]);
    setMessageDraft("");

    try {
      const response = await fetchWithCsrf(
        `${API_BASE_URL}/conversations/${conversationId}/messages`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ body: payload }),
        },
      );

      const result = (await response.json().catch(() => null)) as {
        message?: { id?: string; body?: string; createdAt?: string };
      } | null;

      if (!response.ok || !result?.message) {
        throw new Error("Message not sent.");
      }

      if (conversationIdRef.current !== conversationId) return;
      const savedMessage: ChatMessage = {
        ...optimisticMessage,
        id: result.message.id ?? optimisticMessage.id,
        body: result.message.body ?? optimisticMessage.body,
        createdAt: result.message.createdAt ?? optimisticMessage.createdAt,
      };
      setMessages((previous) =>
        mergeMessages([
          ...previous.filter((item) => item.id !== optimisticMessage.id),
          savedMessage,
        ]),
      );
    } catch (error) {
      console.error("Failed to send message:", error);
      if (conversationIdRef.current !== conversationId) return;
      setChatError(
        error instanceof Error ? error.message : "Message could not be sent.",
      );
      setMessages((previous) =>
        previous.filter((item) => item.id !== optimisticMessage.id),
      );
    }
  };

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
    socket.on("message:new", receiveMessage);
    return () => {
      socket.off("message:new", receiveMessage);
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
  const selectedDisplayName = selectedGroup?.title ?? selectedContact?.fullName;
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
                    <AvatarImage src="https://github.com/shadcn.png" />
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
                        setMessages([]);
                        setSelectedConversationId(null);
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
                          setSelectedUser(person);
                        }}
                        className={`flex gap-2 items-center p-1 rounded-lg cursor-pointer transition-all duration-200 hover:bg-[#ACA9FF]/20 hover:translate-x-1 active:scale-[0.98] group ${
                          isSelected
                            ? "bg-[#ACA9FF]/20 ring-1 ring-[#1900FF]/30"
                            : ""
                        }`}
                      >
                        <Avatar className="h-9 w-9 shrink-0 transition-transform duration-200 group-hover:scale-105">
                          <AvatarImage src="https://github.com/shadcn.png" />
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
                  <AvatarImage src="https://github.com/shadcn.png" />
                  <AvatarFallback>CN</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-[10px] font-extrabold transition-colors text-white group-hover:text-[#eeeeefa1]">
                    {selectedDisplayName ??
                      currentUser?.fullName ??
                      "Select a contact"}
                  </p>
                  <p className="text-[8px] text-gray-500">
                    {selectedGroup
                      ? `${selectedGroup.members.length} members`
                      : `@${selectedContact?.email?.split("@")[0] ?? currentUser?.email?.split("@")[0] ?? "user"}`}
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

                    return (
                      <div
                        key={message.id}
                        className={`w-full flex items-center gap-2 ${
                          isOutgoing ? "justify-end" : "justify-start"
                        }`}
                      >
                        {!isOutgoing && (
                          <Avatar className="h-9 w-9 shrink-0 transition-transform duration-200 hover:scale-110 cursor-pointer">
                            <AvatarImage src="https://github.com/shadcn.png" />
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

                        <div
                          className={`max-w-[75%] py-3 px-6 flex items-center rounded-3xl transition-all duration-200 ${
                            isOutgoing
                              ? "bg-color6 text-white hover:bg-[#ACA9FF]/40 hover:shadow-sm"
                              : "bg-[#EAEAEA] text-[#656565] hover:bg-[#e0e0e0] hover:shadow-sm"
                          }`}
                        >
                          <p className="text-xs wrap-break-word">
                            {message.body}
                          </p>
                        </div>

                        {isOutgoing && (
                          <Avatar className="h-9 w-9 shrink-0 transition-transform duration-200 hover:scale-110 cursor-pointer">
                            <AvatarImage src="https://github.com/shadcn.png" />
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
              <div className="h-11 border border-[#ACA9FF] rounded-xl flex items-center justify-between px-3 mt-2 shrink-0 transition-all duration-200 focus-within:ring-2 focus-within:ring-[#1900FF]/40 focus-within:shadow-md">
                <div className="flex gap-3 items-center flex-1 h-full">
                  <div className="p-1 rounded-full cursor-pointer transition-transform duration-200 hover:scale-125 hover:rotate-90 active:scale-90">
                    <PlusIcon height="1.1em" />
                  </div>
                  <div className="p-1 rounded-full cursor-pointer transition-transform duration-200 hover:scale-125 active:scale-90">
                    <StickerEmojiIcon height="1.1em" />
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
                        ? "Type a message..."
                        : "Select a person to chat"
                    }
                    disabled={!selectedConversationId}
                    className="text-xs h-full w-full py-2 bg-transparent outline-none text-gray-700 disabled:cursor-not-allowed disabled:text-gray-400"
                  />
                </div>
                <div className="flex gap-3 items-center">
                  <div className="p-1 rounded-full cursor-pointer transition-transform duration-200 hover:scale-125 hover:rotate-12 active:scale-90">
                    <Emoji2LineIcon height="1.1em" />
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleSendMessage()}
                    disabled={!selectedConversationId || !messageDraft.trim()}
                    className="p-1 rounded-full cursor-pointer transition-transform duration-200 hover:scale-125 active:scale-90 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <MicIcon height="1.1em" />
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
