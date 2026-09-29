import { Images } from "../../../assets/images";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import DiscoverOutlinedIcon from "@iconify-react/weui/discover-outlined";
import SaveIcon from "@iconify-react/reicon/save";
import ScheduleIcon from "@iconify-react/akar-icons/schedule";
import MessageRoundIcon from "@iconify-react/mage/message-round";
import HomeBrokenIcon from "@iconify-react/solar/home-broken";
import PlusIcon from "@iconify-react/akar-icons/plus";
import CommentOutlineIcon from "@iconify-react/basil/comment-outline";
import PeopleGroupIcon from "@iconify-react/akar-icons/people-group";
import NotificationLineIcon from "@iconify-react/clarity/notification-line";
import EmojiDuotoneIcon from "@iconify-react/si/emoji-duotone";
import ImageIcon from "@iconify-react/akar-icons/image";
import VideoOutlineIcon from "@iconify-react/basil/video-outline";
import InformationOutlineIcon from "@iconify-react/ion/information-outline";
import GlobeIcon from "@iconify-react/entypo/globe";
import LikeIcon from "@iconify-react/icon-park-solid/like";
import ThreeDotsIcon from "@iconify-react/bi/three-dots";
import RepostIcon from "@iconify-react/hugeicons/repost";
import SaveAddIcon from "@iconify-react/reicon/save-add";
import ShareOutlineIcon from "@iconify-react/cuida/share-outline";
import SearchIcon from "@iconify-react/glyphs/search";
import { useEffect, useRef, useState } from "react";
import { api, normalizeMediaUrl, type User } from "../../../lib/api";
import { MobileBottomNav } from "../../../components/mobile-bottom-nav";
import { Skeleton } from "@/components/ui/skeleton";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const Feeds = () => {
  const status = [
    { label: "Select Visibility", value: null },
    { label: "public", value: "Public" },
    { label: "private", value: "private" },
  ];
  const sort = [
    { label: "Sorted by:", value: null },
    { label: "recent", value: "Recent" },
    { label: "last-week", value: "Last-week" },
  ];

  type FeedComment = {
    id: string;
    authorName: string;
    authorAvatarUrl?: string | null;
    body: string;
    createdAt: string;
  };

  type FeedPost = {
    id: string;
    authorName: string;
    authorAvatarUrl?: string | null;
    authorHandle: string;
    message: string;
    mediaType?: "image" | "video";
    mediaUrl?: string;
    createdAt: string;
    likes: number;
    liked: boolean;
    comments: FeedComment[];
    reposts: number;
    reposted: boolean;
    saved: boolean;
    saves: number;
    shares: number;
  };

  const [composerText, setComposerText] = useState("");
  const [composerMediaType, setComposerMediaType] = useState<
    "image" | "video" | null
  >(null);
  const [composerMediaUrl, setComposerMediaUrl] = useState("");
  const [composerMediaFile, setComposerMediaFile] = useState<File | null>(null);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>(
    {},
  );
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [followUsers, setFollowUsers] = useState<
    Array<User & { isFollowing?: boolean }>
  >([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const normalizePostMediaUrl = (url?: string) =>
    url ? (normalizeMediaUrl(url) ?? url) : undefined;

  const formatCompactCount = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return String(value);
  };

  useEffect(() => {
    api
      .me()
      .then(async (user) => {
        try {
          const profile = await api.user(user.id);
          setCurrentUser({ ...user, ...profile });
        } catch {
          setCurrentUser(user);
        }
      })
      .catch(() => setCurrentUser(null));

    api
      .posts()
      .then((response) => {
        const loadedPosts = response.posts.map((post) => ({
          id: post.id,
          authorName: post.author?.fullName ?? "Community member",
          authorAvatarUrl: post.author?.avatarUrl,
          authorHandle: `@${(post.author?.fullName ?? "member")
            .trim()
            .toLowerCase()
            .replace(/\s+/g, "")}`,
          message: post.body || "Shared an update with the community.",
          mediaType: post.mediaType ?? undefined,
          mediaUrl: normalizePostMediaUrl(post.mediaUrl),
          createdAt: new Date(post.createdAt).toLocaleString(),
          likes: Number(post.likes ?? 0),
          liked: Boolean(post.liked),
          comments: (post.comments ?? []).map((comment) => ({
            id: comment.id,
            authorName: comment.author?.fullName ?? "Community member",
            authorAvatarUrl: comment.author?.avatarUrl,
            body: comment.body,
            createdAt: new Date(comment.createdAt).toLocaleString(),
          })),
          reposts: Number(post.reposts ?? 0),
          reposted: Boolean(post.reposted),
          saved: Boolean(post.saved),
          saves: Number(post.saves ?? 0),
          shares: 0,
        }));
        setPosts(loadedPosts);
      })
      .catch(() => {
        setPosts([]);
      })
      .finally(() => {
        setLoadingPosts(false);
      });

    const loadSuggestedUsers = async () => {
      try {
        const [userResponse, counsellorResponse] = await Promise.all([
          api.users(),
          api.counsellors(),
        ]);

        const currentUserId = currentUser?.id;

        const merged = await Promise.all(
          [
            ...userResponse.users.map((person) => ({
              ...person,
              email: person.email ?? "",
              role: person.role ?? "client",
            })),
            ...counsellorResponse.counsellors.map((person) => ({
              id: person.id,
              fullName: person.fullName,
              email: "",
              role: "counsellor" as const,
              bio: person.bio,
              specialties: person.specialties,
            })),
          ]
            .filter((person) => person.id && person.id !== currentUserId)
            .map(async (person) => {
              try {
                const profile = await api.user(person.id);
                return {
                  ...person,
                  ...profile,
                  isFollowing: Boolean(profile.isFollowing),
                };
              } catch {
                return { ...person, isFollowing: false };
              }
            }),
        );

        const uniquePeople = merged.filter((person, index, list) => {
          if (!person?.id) return false;
          return list.findIndex((entry) => entry.id === person.id) === index;
        });

        setFollowUsers(uniquePeople);
      } catch {
        setFollowUsers([]);
      } finally {
        setLoadingUsers(false);
      }
    };

    loadSuggestedUsers();
  }, [currentUser?.id]);

  const handleFollowToggle = async (personId: string, isFollowing: boolean) => {
    setFollowUsers((current) =>
      current.map((person) =>
        person.id === personId
          ? { ...person, isFollowing: !isFollowing }
          : person,
      ),
    );

    try {
      if (isFollowing) {
        await api.unfollowUser(personId);
      } else {
        await api.followUser(personId);
      }
    } catch {
      setFollowUsers((current) =>
        current.map((person) =>
          person.id === personId ? { ...person, isFollowing } : person,
        ),
      );
    }
  };

  const handleSelectMedia = (type: "image" | "video") => {
    setComposerMediaType(type);
    fileInputRef.current?.click();
  };

  const handleLikeToggle = async (postId: string) => {
    const previous = posts.find((post) => post.id === postId);
    const nextLiked = !(previous?.liked ?? false);
    setPosts((currentPosts) =>
      currentPosts.map((post) => {
        if (post.id !== postId) return post;
        return {
          ...post,
          liked: nextLiked,
          likes: Math.max(0, post.likes + (nextLiked ? 1 : -1)),
        };
      }),
    );

    try {
      const result = await api.likePost(postId);
      setPosts((currentPosts) =>
        currentPosts.map((post) =>
          post.id === postId
            ? { ...post, liked: result.liked, likes: result.likes }
            : post,
        ),
      );
    } catch {
      setPosts((currentPosts) =>
        currentPosts.map((post) =>
          post.id === postId
            ? {
                ...post,
                liked: previous?.liked ?? false,
                likes: previous?.likes ?? 0,
              }
            : post,
        ),
      );
    }
  };

  const handleCommentDraftChange = (postId: string, value: string) => {
    setCommentDrafts((current) => ({ ...current, [postId]: value }));
  };

  const handleAddComment = async (postId: string) => {
    const draft = (commentDrafts[postId] ?? "").trim();
    if (!draft) return;

    const currentUserName = currentUser?.fullName || "You";
    const optimisticComment: FeedComment = {
      id: `${postId}-${Date.now()}`,
      authorName: currentUserName,
      body: draft,
      createdAt: "just now",
    };

    setPosts((currentPosts) =>
      currentPosts.map((post) =>
        post.id === postId
          ? {
              ...post,
              comments: [...post.comments, optimisticComment],
            }
          : post,
      ),
    );
    setCommentDrafts((current) => ({ ...current, [postId]: "" }));

    try {
      const result = await api.commentOnPost(postId, draft);
      const savedComment = result.comment;
      setPosts((currentPosts) =>
        currentPosts.map((post) => {
          if (post.id !== postId) return post;
          const nextComment = savedComment
            ? {
                id: savedComment.id,
                authorName: savedComment.author?.fullName || currentUserName,
                body: savedComment.body,
                createdAt: new Date(savedComment.createdAt).toLocaleString(),
              }
            : optimisticComment;
          return {
            ...post,
            comments: [
              ...post.comments.filter(
                (item) => item.id !== optimisticComment.id,
              ),
              nextComment,
            ],
          };
        }),
      );
    } catch {
      setPosts((currentPosts) =>
        currentPosts.map((post) =>
          post.id === postId
            ? {
                ...post,
                comments: post.comments.filter(
                  (item) => item.id !== optimisticComment.id,
                ),
              }
            : post,
        ),
      );
    }
  };

  const handleRepostToggle = async (postId: string) => {
    const previous = posts.find((post) => post.id === postId);
    const nextReposted = !(previous?.reposted ?? false);
    setPosts((currentPosts) =>
      currentPosts.map((post) => {
        if (post.id !== postId) return post;
        return {
          ...post,
          reposted: nextReposted,
          reposts: Math.max(0, post.reposts + (nextReposted ? 1 : -1)),
        };
      }),
    );

    try {
      const result = await api.repostPost(postId);
      setPosts((currentPosts) =>
        currentPosts.map((post) =>
          post.id === postId
            ? { ...post, reposted: result.reposted, reposts: result.reposts }
            : post,
        ),
      );
    } catch {
      setPosts((currentPosts) =>
        currentPosts.map((post) =>
          post.id === postId
            ? {
                ...post,
                reposted: previous?.reposted ?? false,
                reposts: previous?.reposts ?? 0,
              }
            : post,
        ),
      );
    }
  };

  const handleSaveToggle = async (postId: string) => {
    const previous = posts.find((post) => post.id === postId);
    const nextSaved = !(previous?.saved ?? false);
    setPosts((currentPosts) =>
      currentPosts.map((post) => {
        if (post.id !== postId) return post;
        return {
          ...post,
          saved: nextSaved,
          saves: Math.max(0, post.saves + (nextSaved ? 1 : -1)),
        };
      }),
    );

    try {
      const result = await api.savePost(postId);
      setPosts((currentPosts) =>
        currentPosts.map((post) =>
          post.id === postId
            ? { ...post, saved: result.saved, saves: result.saves }
            : post,
        ),
      );
    } catch {
      setPosts((currentPosts) =>
        currentPosts.map((post) =>
          post.id === postId
            ? {
                ...post,
                saved: previous?.saved ?? false,
                saves: previous?.saves ?? 0,
              }
            : post,
        ),
      );
    }
  };

  const handleShare = async (postId: string) => {
    const shareText = `Check out this post: ${window.location.href}`;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(shareText);
      }
      setPosts((currentPosts) =>
        currentPosts.map((post) =>
          post.id === postId ? { ...post, shares: post.shares + 1 } : post,
        ),
      );
    } catch {
      setPosts((currentPosts) =>
        currentPosts.map((post) =>
          post.id === postId ? { ...post, shares: post.shares + 1 } : post,
        ),
      );
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    setComposerMediaFile(selectedFile);
    const reader = new FileReader();
    reader.onload = () => {
      setComposerMediaUrl(String(reader.result ?? ""));
      setComposerMediaType(
        selectedFile.type.startsWith("video/") ? "video" : "image",
      );
    };
    reader.readAsDataURL(selectedFile);
    event.target.value = "";
  };

  const handleCreatePost = async () => {
    const trimmedText = composerText.trim();
    if (!trimmedText && !composerMediaFile && !composerMediaUrl) return;

    try {
      const created = await api.createPost({
        body: trimmedText,
        mediaType: composerMediaType ?? undefined,
        mediaFile: composerMediaFile ?? undefined,
        mediaUrl: composerMediaUrl || undefined,
      });

      const newPost: FeedPost = {
        id: created.post.id,
        authorName: created.post.author.fullName || "You",
        authorHandle: `@${(created.post.author.fullName || "you")
          .trim()
          .toLowerCase()
          .replace(/\s+/g, "")}`,
        message: created.post.body || "Shared a new update with the community.",
        mediaType: created.post.mediaType ?? undefined,
        mediaUrl: normalizePostMediaUrl(created.post.mediaUrl),
        createdAt: new Date(created.post.createdAt).toLocaleString(),
        likes: 0,
        liked: false,
        comments: [],
        reposts: 0,
        reposted: false,
        saved: false,
        saves: 0,
        shares: 0,
      };

      setPosts((currentPosts) => [newPost, ...currentPosts]);
      setComposerText("");
      setComposerMediaType(null);
      setComposerMediaUrl("");
      setComposerMediaFile(null);
    } catch (error) {
      console.error("Failed to create post:", error);
    }
  };

  // Class string for independent scrolling with invisible scrollbar
  const scrollableColumnClass =
    "mobile-feeds-scroll h-full overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden";

  return (
    <div className="mobile-feeds h-screen flex flex-col p-2 sm:p-4 overflow-hidden">
      {/*  Header */}
      <div className="relative flex flex-col sm:flex-row justify-center items-center gap-2 mb-3 shrink-0">
        <p
          className="static sm:absolute sm:left-3 text-[#0A0332]"
          style={{ fontSize: 28, fontWeight: "bolder" }}
        >
          Feeds
        </p>
        <div className="flex gap-10 sm:gap-15">
          {["For you", "Following", "Latest", "Live"].map((tab) => (
            <p
              key={tab}
              className="font-bold text-xs cursor-pointer transition-all duration-200 hover:text-[#1900FF] hover:-translate-y-0.5 active:scale-95 select-none"
            >
              {tab}
            </p>
          ))}
        </div>
      </div>

      {/* Main Column Grid Container */}
      <div className="mobile-feeds-grid grid grid-cols-1 lg:grid-cols-12 gap-3 flex-1 overflow-hidden">
        {/* Left Side & Main Content Wrapper */}
        <div className="mobile-feeds-content lg:col-span-10 grid grid-cols-1 lg:grid-cols-12 gap-3 h-full overflow-hidden">
          {/* 1. LEFT SIDEBAR (Scrolls independently) */}
          <div
            className={`lg:col-span-3 space-y-4 pr-1 ${scrollableColumnClass}`}
          >
            {/* User Profile Card */}
            <div className="bg-color1 border border-color1 rounded-xl overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5">
              <div className="w-full flex flex-col relative pb-2 group cursor-pointer">
                <img
                  src={Images[5]}
                  alt=""
                  className="w-[94%] mt-2 rounded-lg h-12 object-cover self-center transition-transform duration-300 group-hover:scale-105"
                />
                <div className="flex flex-col justify-center border-b border-color1 pt-5 pb-2">
                  <p className="text-xs text-center font-medium">
                    {currentUser?.fullName ?? "Loading profile..."}
                  </p>
                  <p className="text-[10px] text-center text-gray-500">
                    @
                    {(currentUser?.fullName ?? "user")
                      .trim()
                      .toLowerCase()
                      .replace(/\s+/g, "")}
                  </p>
                </div>
                <div className="bg-white h-11 w-11 rounded-full absolute left-1/2 -translate-x-1/2 top-7 flex justify-center items-center shadow-sm transition-transform duration-300 group-hover:scale-110">
                  <Avatar className="h-9 w-9 shrink-0">
                    <AvatarImage
                      src={normalizeMediaUrl(currentUser?.avatarUrl)}
                      alt="Your profile picture"
                    />
                    <AvatarFallback>
                      {currentUser?.fullName
                        ?.split(" ")
                        .map((name) => name[0])
                        .slice(0, 2)
                        .join("")
                        .toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                </div>
              </div>

              <div className="flex justify-center gap-10 items-center h-10 px-2">
                <div className="flex flex-col items-center cursor-pointer transition-transform duration-200 hover:scale-110 active:scale-95">
                  <p className="font-extrabold text-[10px]">{posts.length}</p>
                  <p className="text-[10px] font-light">Post</p>
                </div>
                <div className="flex flex-col items-center cursor-pointer transition-transform duration-200 hover:scale-110 active:scale-95">
                  <p className="font-extrabold text-[10px]">
                    {formatCompactCount(currentUser?.followerCount ?? 0)}
                  </p>
                  <p className="text-[10px] font-light">Followers</p>
                </div>
                <div className="flex flex-col items-center cursor-pointer transition-transform duration-200 hover:scale-110 active:scale-95">
                  <p className="font-extrabold text-[10px]">
                    {formatCompactCount(currentUser?.followingCount ?? 0)}
                  </p>
                  <p className="text-[10px] font-light">Following</p>
                </div>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="bg-color1 border border-color1 rounded-xl pb-3 min-h-48">
              <div className="h-12 border-b border-color1 p-2 flex items-center">
                <p className="text-lg font-bold text-[#0A0332]">Tabs</p>
              </div>
              <div className="space-y-1 px-2 mt-2">
                {[
                  { link: "home", icon: HomeBrokenIcon, label: "Home" },
                  {
                    link: "discover",
                    icon: DiscoverOutlinedIcon,
                    label: "Discover",
                  },
                  { link: "saved", icon: SaveIcon, label: "Saved" },
                  { link: "add-post", icon: PlusIcon, label: "Add Post" },
                  { link: "chats", icon: CommentOutlineIcon, label: "Chats" },
                  {
                    link: "communities",
                    icon: PeopleGroupIcon,
                    label: "Communities",
                  },
                  {
                    link: "",
                    icon: NotificationLineIcon,
                    label: "Notification",
                  },
                ].map((item, idx) => {
                  const Icon = item.icon;
                  return (
                    <button
                      onClick={() => item.link == "home" ? window.location.href = "/home" : null}
                      key={idx}
                      className="flex items-center w-full gap-2 p-2 rounded-lg cursor-pointer transition-all duration-200 hover:bg-black/5 dark:hover:bg-white/5 hover:translate-x-1 active:scale-95"
                    >
                      <Icon
                        height="1em"
                        className="transition-transform duration-200 group-hover:scale-110"
                      />
                      <p className="text-xs">{item.label}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Activity Card */}
            <div className="bg-color1 border border-color1 rounded-xl pb-3 min-h-48">
              <div className="h-12 border-b border-color1 p-2 flex items-center">
                <p className="text-lg font-bold text-[#0A0332]">Activity</p>
              </div>
              <div className="flex flex-col gap-3 px-2 py-3">
                {[...Array(7)].map((_, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-1 p-1 rounded-md transition-all duration-200 hover:bg-black/5 dark:hover:bg-white/5 hover:translate-x-0.5"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar className="h-8 w-8 shrink-0 transition-transform duration-200 hover:scale-110">
                        <AvatarFallback>GK</AvatarFallback>
                      </Avatar>
                      <div className="truncate">
                        <p className="text-[8px] font-bold truncate">
                          Mr. Godfred Kusi (mentor)
                        </p>
                        <p className="text-[7px]">Liked your comment</p>
                      </div>
                    </div>
                    <p className="text-[9px] font-bold text-[#1900FF] shrink-0 cursor-pointer transition-all duration-200 hover:scale-110 hover:-translate-y-0.5 active:scale-90">
                      Follow
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 2. MAIN FEED CONTENT (Scrolls independently) */}
          <div
            className={`lg:col-span-9 flex flex-col gap-4 pr-1 ${scrollableColumnClass}`}
          >
            {/* Create Post Widget */}
            <div className="min-h-20 border rounded-2xl border-color1 py-2 px-3 sm:px-5 transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 shrink-0">
              <div className="flex items-center gap-2 sm:gap-4 rounded-2xl">
                <Avatar className="h-8 w-8 shrink-0 transition-transform duration-200 hover:scale-110 cursor-pointer">
                  <AvatarImage
                    src={normalizeMediaUrl(currentUser?.avatarUrl)}
                    alt="Your profile picture"
                  />
                  <AvatarFallback>
                    {currentUser?.fullName
                      ?.split(/\s+/)
                      .slice(0, 2)
                      .map((part) => part[0]?.toUpperCase() ?? "")
                      .join("") || "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="bg-[#DCDFE5] w-full min-h-8 flex rounded-2xl px-4 sm:px-7 items-center relative transition-all duration-200 focus-within:ring-2 focus-within:ring-[#1900FF]/40 focus-within:bg-white">
                  <textarea
                    value={composerText}
                    onChange={(event) => setComposerText(event.target.value)}
                    rows={1}
                    placeholder="Share something......"
                    className="w-full bg-transparent text-xs text-gray-600 placeholder:text-gray-600 resize-none outline-none py-2"
                  />
                  <div className="absolute right-3 cursor-pointer transition-transform duration-200 hover:scale-125 hover:rotate-12 active:scale-90">
                    <EmojiDuotoneIcon height="1em" />
                  </div>
                </div>
              </div>

              {composerMediaUrl && (
                <div className="mt-3 rounded-xl overflow-hidden border border-color1 bg-white p-2">
                  {composerMediaType === "image" ? (
                    <img
                      src={composerMediaUrl}
                      alt="Selected post preview"
                      className="h-auto max-h-72 w-full rounded-lg object-contain"
                    />
                  ) : (
                    <video
                      src={composerMediaUrl}
                      controls
                      className="h-auto max-h-72 w-full rounded-lg bg-black object-contain"
                    />
                  )}
                </div>
              )}

              <div className="flex justify-end mt-2">
                <div className="w-full sm:w-[95%] flex flex-wrap justify-between items-center gap-2">
                  <div className="flex flex-wrap gap-1 sm:gap-2">
                    <button
                      type="button"
                      onClick={() => handleSelectMedia("image")}
                      className="flex gap-1 sm:gap-2 items-center py-1.5 px-2 rounded-lg transition-all duration-200 hover:bg-black/5 dark:hover:bg-white/5 hover:-translate-y-0.5 active:scale-95"
                    >
                      <ImageIcon height="1em" />
                      <span className="text-xs font-bold">Image</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectMedia("video")}
                      className="flex gap-1 sm:gap-2 items-center py-1.5 px-2 rounded-lg transition-all duration-200 hover:bg-black/5 dark:hover:bg-white/5 hover:-translate-y-0.5 active:scale-95"
                    >
                      <VideoOutlineIcon height="1em" />
                      <span className="text-xs font-bold">Video</span>
                    </button>
                    <button
                      type="button"
                      className="flex gap-1 sm:gap-2 items-center py-1.5 px-2 rounded-lg transition-all duration-200 hover:bg-black/5 dark:hover:bg-white/5 hover:-translate-y-0.5 active:scale-95"
                    >
                      <InformationOutlineIcon height="1em" />
                      <span className="text-xs font-bold">Poll</span>
                    </button>
                    <button
                      type="button"
                      className="flex gap-1 sm:gap-2 items-center py-1.5 px-2 rounded-lg transition-all duration-200 hover:bg-black/5 dark:hover:bg-white/5 hover:-translate-y-0.5 active:scale-95"
                    >
                      <ScheduleIcon height="1em" />
                      <span className="text-xs font-bold">Schedule</span>
                    </button>
                    <button
                      type="button"
                      className="flex gap-1 sm:gap-2 items-center py-1.5 px-2 rounded-lg transition-all duration-200 hover:bg-black/5 dark:hover:bg-white/5 hover:-translate-y-0.5 active:scale-95"
                    >
                      <InformationOutlineIcon height="1em" />
                      <span className="text-xs font-bold">Disclosure</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <GlobeIcon height="1em" />
                    <Select items={status}>
                      <SelectTrigger className="w-full max-w-48 border-none text-xs font-bold transition-all duration-200 hover:bg-black/5 dark:hover:bg-white/5 hover:-translate-y-0.5">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="border-none">
                        <SelectGroup>
                          <SelectLabel>Status</SelectLabel>
                          {status.map((item) => (
                            <SelectItem key={item.value} value={item.value}>
                              {item.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    <button
                      type="button"
                      onClick={handleCreatePost}
                      className="bg-[#1900FF] text-white text-xs font-bold px-4 py-2 rounded-full hover:brightness-110 active:scale-95"
                    >
                      Post
                    </button>
                  </div>
                </div>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept={composerMediaType === "video" ? "video/*" : "image/*"}
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            {/* Filter / Sort Row */}
            <div className="flex justify-between items-center gap-2 shrink-0">
              <div className="border-b w-full border-color1" />
              <div className="shrink-0">
                <Select items={sort}>
                  <SelectTrigger className="w-full max-w-48 border-none text-[10px] font-bold transition-all duration-200 hover:bg-black/5 dark:hover:bg-white/5 hover:-translate-y-0.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-none">
                    <SelectGroup>
                      <SelectLabel className="text-[10px]">
                        Sorted by:
                      </SelectLabel>
                      {sort.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Feed Posts */}
            {loadingPosts ? (
              <div className="space-y-3">
                {[1, 2, 3].map((item) => (
                  <div
                    key={item}
                    className="space-y-4 rounded-2xl border border-color1 px-3 py-4"
                  >
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-8 w-8 rounded-full" />
                      <div className="space-y-2">
                        <Skeleton className="h-2.5 w-36" />
                        <Skeleton className="h-2 w-20" />
                      </div>
                    </div>
                    <Skeleton className="h-3 w-4/5" />
                    <Skeleton className="h-48 w-full rounded-xl" />
                  </div>
                ))}
              </div>
            ) : posts.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-color1 p-6 text-center text-sm text-slate-500">
                No posts yet.
              </p>
            ) : (
              posts.map((post) => (
                <div
                  key={post.id}
                  className="min-h-44 rounded-2xl border border-color1 px-3 py-4 space-y-3 transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 shrink-0"
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex gap-3">
                      <Avatar className="h-8 w-8 shrink-0 transition-transform duration-200 hover:scale-110 cursor-pointer">
                        <AvatarImage
                          src={normalizeMediaUrl(post.authorAvatarUrl)}
                          alt={`${post.authorName} profile picture`}
                        />
                        <AvatarFallback>
                          {post.authorName
                            .split(/\s+/)
                            .slice(0, 2)
                            .map((part) => part[0]?.toUpperCase() ?? "")
                            .join("") || "U"}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-xs font-semibold">
                          {post.authorName}{" "}
                          <span className="text-[10px] text-[#656565] font-normal">
                            {post.authorHandle} {post.createdAt}
                          </span>
                        </p>
                        <p className="text-xs mt-2">{post.message}</p>
                      </div>
                    </div>
                    <div className="shrink-0 p-1 rounded-full transition-transform duration-200 hover:scale-125 active:scale-90 hover:bg-black/5 dark:hover:bg-white/5">
                      <ThreeDotsIcon height="1em" className="cursor-pointer" />
                    </div>
                  </div>

                  {post.mediaType === "image" && post.mediaUrl && (
                    <div className="mt-3 overflow-hidden rounded-xl bg-black/5">
                      <img
                        src={post.mediaUrl}
                        className="h-auto max-h-[75vh] w-full rounded-xl object-contain"
                        alt="Post media"
                      />
                    </div>
                  )}

                  {post.mediaType === "video" && post.mediaUrl && (
                    <div className="mt-3 overflow-hidden rounded-xl bg-black">
                      <video
                        src={post.mediaUrl}
                        controls
                        className="h-auto max-h-[75vh] w-full rounded-xl object-contain"
                      />
                    </div>
                  )}

                  <div className="h-10 flex flex-wrap gap-4 sm:gap-14 items-center">
                    <div
                      onClick={() => handleLikeToggle(post.id)}
                      className="flex gap-1.5 items-center cursor-pointer group transition-transform duration-200 hover:-translate-y-0.5 active:scale-90"
                    >
                      <LikeIcon
                        height="1em"
                        color={post.liked ? "#ef4444" : "#6b7280"}
                        className="transition-transform duration-200 group-hover:scale-125"
                      />
                      <p
                        className={`text-[10px] font-bold transition-colors ${
                          post.liked
                            ? "text-red-500"
                            : "group-hover:text-red-500"
                        }`}
                      >
                        {formatCompactCount(post.likes)}
                      </p>
                    </div>
                    <div className="flex gap-1.5 items-center cursor-pointer group transition-transform duration-200 hover:-translate-y-0.5 active:scale-90">
                      <MessageRoundIcon
                        height="1em"
                        className="transition-transform duration-200 group-hover:scale-125"
                      />
                      <p className="text-[10px] font-bold transition-colors group-hover:text-blue-500">
                        {formatCompactCount(post.comments.length)}
                      </p>
                    </div>
                    <div
                      onClick={() => handleRepostToggle(post.id)}
                      className="flex gap-1.5 items-center cursor-pointer group transition-transform duration-200 hover:-translate-y-0.5 active:scale-90"
                    >
                      <RepostIcon
                        height="1em"
                        color={post.reposted ? "#16a34a" : "#6b7280"}
                        className="transition-transform duration-200 group-hover:scale-125"
                      />
                      <p
                        className={`text-[10px] font-bold transition-colors ${
                          post.reposted
                            ? "text-green-500"
                            : "group-hover:text-green-500"
                        }`}
                      >
                        {formatCompactCount(post.reposts)}
                      </p>
                    </div>
                    <div
                      onClick={() => handleSaveToggle(post.id)}
                      className="flex gap-1.5 items-center cursor-pointer group transition-transform duration-200 hover:-translate-y-0.5 active:scale-90"
                    >
                      <SaveAddIcon
                        height="1em"
                        color={post.saved ? "#f59e0b" : "#6b7280"}
                        className="transition-transform duration-200 group-hover:scale-125"
                      />
                      <p
                        className={`text-[10px] font-bold transition-colors ${
                          post.saved
                            ? "text-yellow-500"
                            : "group-hover:text-yellow-500"
                        }`}
                      >
                        {formatCompactCount(post.saves)}
                      </p>
                    </div>
                    <div
                      onClick={() => handleShare(post.id)}
                      className="flex gap-1.5 items-center cursor-pointer group transition-transform duration-200 hover:-translate-y-0.5 active:scale-90"
                    >
                      <ShareOutlineIcon
                        height="1em"
                        className="transition-transform duration-200 group-hover:scale-125"
                      />
                      <p className="text-[10px] font-bold transition-colors group-hover:text-purple-500">
                        {formatCompactCount(post.shares)}
                      </p>
                    </div>
                  </div>

                  {post.comments.length > 0 && (
                    <div className="space-y-2 rounded-xl bg-[#F5F6F8] p-2">
                      {post.comments.slice(-2).map((comment) => (
                        <div
                          key={comment.id}
                          className="flex gap-2 items-start"
                        >
                          <Avatar className="h-6 w-6 shrink-0">
                            <AvatarImage
                              src={normalizeMediaUrl(comment.authorAvatarUrl)}
                              alt={`${comment.authorName} profile picture`}
                            />
                            <AvatarFallback className="text-[8px]">
                              {comment.authorName
                                .split(" ")
                                .map((part) => part[0])
                                .slice(0, 2)
                                .join("")
                                .toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="text-[9px] font-semibold">
                              {comment.authorName}
                            </p>
                            <p className="text-[9px] text-gray-600 break-words">
                              {comment.body}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-3 items-center">
                    <Avatar className="h-8 w-8 shrink-0 transition-transform duration-200 hover:scale-110 cursor-pointer">
                      <AvatarImage
                        src={normalizeMediaUrl(currentUser?.avatarUrl)}
                        alt="Your profile picture"
                      />
                      <AvatarFallback>
                        {currentUser?.fullName
                          ?.split(/\s+/)
                          .slice(0, 2)
                          .map((part) => part[0]?.toUpperCase() ?? "")
                          .join("") || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="w-full relative">
                      <input
                        value={commentDrafts[post.id] ?? ""}
                        onChange={(event) =>
                          handleCommentDraftChange(post.id, event.target.value)
                        }
                        className="bg-[#DCDFE5] h-9 w-full rounded-2xl text-xs text-[#656565] flex items-center pl-4 pr-9 outline-none transition-all duration-200 focus:ring-2 focus:ring-[#1900FF]/40 focus:bg-white"
                        placeholder="Write a comment"
                      />
                      <button
                        type="button"
                        onClick={() => handleAddComment(post.id)}
                        className="absolute right-2 top-1.5 rounded-full bg-[#1900FF] px-2 py-1 text-[9px] font-bold text-white transition-all hover:brightness-110 active:scale-95"
                      >
                        Post
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 3. RIGHT SIDEBAR (Scrolls independently) */}
        <div
          className={`lg:col-span-2 space-y-4 pr-1 ${scrollableColumnClass}`}
        >
          {/* Search Bar Block */}
          <div className="rounded-2xl mt-1 ml-0.5 h-10 sm:h-12 relative transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 focus-within:ring-2 focus-within:ring-[#1900FF]/40 focus-within:shadow-md focus-within:-translate-y-0.5 group cursor-pointer">
            <SearchIcon className="absolute top-2.5 sm:top-3 left-3 h-5 w-5 sm:h-6 sm:w-6 text-gray-500 transition-transform duration-200 group-hover:scale-110 group-focus-within:scale-110 group-focus-within:text-[#1900FF]" />
            <input
              type="text"
              placeholder="search something"
              className="bg-color3 h-full w-full rounded-2xl text-xs pl-9 sm:pl-10 pr-3 sm:pr-4 outline-none transition-all duration-200 focus:bg-white dark:focus:bg-black/20 cursor-text"
            />
          </div>

          {/* Subscribe to Premium Banner Block */}
          <div className="h-28 overflow-hidden rounded-2xl px-4 py-3 bg-[#FF9001] cursor-pointer transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.99] group">
            <p className="text-white font-bold transition-transform duration-200 group-hover:translate-x-0.5">
              Subscribe to Premium
            </p>
            <p className="text-xs text-white/90 line-clamp-3">
              Lorem ipsum dolor sit amet consectetur adipisicing elit. Nesciunt
              consectetur, doloremque perspiciatis suscipit id nostrum
            </p>
          </div>
          <div className="bg-color1 border border-color1 rounded-xl pb-3 min-h-48">
            <div className="h-12 border-b border-color1 p-2 flex items-center">
              <p className="text-lg font-bold">Suggested for you</p>
            </div>
            <div className="flex flex-col gap-3 px-2 py-3">
              {[
                { category: "Law", title: "Arrested" },
                { category: "Business", title: "Trading Gold" },
                { category: "Ghana", title: "His own friend" },
              ].map((item, i) => (
                <div
                  key={i}
                  className="p-1 rounded-md cursor-pointer transition-all duration-200 hover:bg-black/5 dark:hover:bg-white/5 hover:translate-x-1"
                >
                  <p className="text-[8px] text-gray-500">
                    Trending in {item.category}
                  </p>
                  <p className="text-[10px] font-bold">{item.title}</p>
                </div>
              ))}
              <p className="font-bold text-[10px] text-[#1900FF] cursor-pointer transition-all duration-200 hover:opacity-75 hover:translate-x-0.5">
                See more
              </p>
            </div>
          </div>

          <div className="bg-color1 border border-color1 rounded-xl pb-3 min-h-48">
            <div className="h-12 border-b border-color1 p-2 flex items-center">
              <p className="text-lg font-bold">What is happening</p>
            </div>
            <div className="flex flex-col gap-3 px-2 py-3">
              {[
                { category: "Law", title: "Arrested" },
                { category: "Business", title: "Trading Gold" },
                { category: "Ghana", title: "His own friend" },
              ].map((item, i) => (
                <div
                  key={i}
                  className="p-1 rounded-md cursor-pointer transition-all duration-200 hover:bg-black/5 dark:hover:bg-white/5 hover:translate-x-1"
                >
                  <p className="text-[8px] text-gray-500">
                    Trending in {item.category}
                  </p>
                  <p className="text-[10px] font-bold">{item.title}</p>
                </div>
              ))}
              <p className="font-bold text-[10px] text-[#1900FF] cursor-pointer transition-all duration-200 hover:opacity-75 hover:translate-x-0.5">
                See more
              </p>
            </div>
          </div>

          <div className="bg-color1 border border-color1 rounded-xl pb-3 min-h-48">
            <div className="h-12 border-b border-color1 p-2 flex items-center">
              <p className="text-lg font-bold">Who to follow</p>
            </div>
            <div className="flex flex-col gap-3 px-2 py-3">
              {loadingUsers ? (
                <p className="text-[10px] text-gray-500">Loading people...</p>
              ) : followUsers.length > 0 ? (
                followUsers.slice(0, 9).map((person) => (
                  <div
                    key={person.id}
                    className="flex items-center justify-between gap-1 p-1 rounded-md transition-all duration-200 hover:bg-black/5 dark:hover:bg-white/5 hover:translate-x-0.5"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar className="h-8 w-8 shrink-0 transition-transform duration-200 hover:scale-110 cursor-pointer">
                        <AvatarImage
                          src={normalizeMediaUrl(person.avatarUrl)}
                          alt={`${person.fullName} profile picture`}
                        />
                        <AvatarFallback>
                          {person.fullName
                            .split(/\s+/)
                            .slice(0, 2)
                            .map((part) => part[0]?.toUpperCase() ?? "")
                            .join("") || "U"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="truncate">
                        <p className="text-[8px] font-bold truncate">
                          {person.fullName}
                        </p>
                        <p className="text-[7px]">
                          {person.role === "counsellor"
                            ? "Counsellor"
                            : "Community member"}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() =>
                        handleFollowToggle(
                          person.id,
                          Boolean(person.isFollowing),
                        )
                      }
                      className={`text-[9px] font-bold py-1 px-2 rounded-lg shrink-0 cursor-pointer transition-all duration-200 hover:brightness-110 hover:-translate-y-0.5 active:scale-90 shadow-sm hover:shadow ${
                        person.isFollowing
                          ? "bg-white text-[#1900FF] border border-[#1900FF]"
                          : "text-white bg-[#1900FF]"
                      }`}
                    >
                      {person.isFollowing ? "Following" : "Follow"}
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-[10px] text-gray-500">
                  No users available to follow.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
      <MobileBottomNav />
    </div>
  );
};

export default Feeds;
