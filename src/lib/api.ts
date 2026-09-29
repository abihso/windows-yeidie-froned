const API_BASE_URL = (
  import.meta.env.VITE_API_URL ?? "http://localhost:4000/api"
).replace(/\/$/, "");
export const API_ORIGIN = API_BASE_URL.replace(/\/api$/, "");

export function normalizeMediaUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  if (
    url.startsWith("http://") ||
    url.startsWith("https://") ||
    url.startsWith("data:")
  ) {
    return url;
  }
  if (url.startsWith("/")) {
    return `${API_ORIGIN}${url}`;
  }
  return url;
}

export type User = {
  id: string;
  fullName: string;
  email: string;
  role: "client" | "counsellor" | "admin";
  avatarUrl?: string | null;
  bio?: string;
  specialties?: string[];
  followerCount?: number;
  followingCount?: number;
  isFollowing?: boolean;
};

export type Counsellor = Pick<
  User,
  "id" | "fullName" | "bio" | "specialties" | "avatarUrl"
>;

export type AvailabilitySlot = {
  id: string;
  counsellorId: string;
  startsAt: string;
  endsAt: string;
  createdAt: string;
};

export type Booking = {
  id: string;
  slotId: string;
  clientId: string;
  counsellorId: string;
  status: "pending" | "confirmed" | "cancelled" | "completed";
  note: string;
  startsAt: string;
  endsAt: string;
  counsellorName: string;
  clientName: string;
};

export type ConversationMember = {
  id: string;
  fullName: string;
  role: string;
  avatarUrl?: string | null;
  membershipRole: string;
};

export type LatestMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: string;
};

export type Conversation = {
  id: string;
  kind: "direct" | "group";
  title: string | null;
  createdBy: string;
  createdAt: string;
  members: ConversationMember[];
  latestMessage: LatestMessage | null;
};

export type CallRoom = {
  id: string;
  conversationId: string | null;
  bookingId: string | null;
  createdBy: string;
  mode: "audio" | "video";
  createdAt: string;
  endedAt: string | null;
};

export type CreateCallInput = {
  conversationId?: string;
  bookingId?: string;
  mode?: "audio" | "video";
};

export type PostComment = {
  id: string;
  body: string;
  createdAt: string;
  author?: {
    id: string;
    fullName: string;
    role: string;
    avatarUrl?: string | null;
  };
};

export type Post = {
  id: string;
  body: string;
  mediaType?: "image" | "video";
  mediaUrl?: string;
  createdAt: string;
  likes?: number;
  liked?: boolean;
  comments?: PostComment[];
  reposts?: number;
  reposted?: boolean;
  saves?: number;
  saved?: boolean;
  author: {
    id: string;
    fullName: string;
    role: string;
    avatarUrl?: string | null;
  };
};

type ApiErrorResponse = {
  error?: { message?: string };
};

let csrfToken: string | null = null;

async function readResponse<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => null)) as
    | T
    | ApiErrorResponse
    | null;
  if (!response.ok) {
    const message =
      (body as ApiErrorResponse | null)?.error?.message ??
      "Something went wrong.";
    throw Object.assign(new Error(message), { status: response.status });
  }
  return body as T;
}

async function getCsrfToken() {
  const response = await fetch(`${API_BASE_URL}/auth/csrf`, {
    credentials: "include",
  });
  const body = await readResponse<{ csrfToken: string }>(response);
  csrfToken = body.csrfToken;
  return csrfToken;
}

async function request<T>(path: string, options: RequestInit = {}) {
  const method = options.method?.toUpperCase() ?? "GET";
  const headers = new Headers(options.headers);
  const hasBody = typeof options.body !== "undefined" && options.body !== null;
  if (
    hasBody &&
    !(options.body instanceof FormData) &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }
  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    headers.set("X-CSRF-Token", csrfToken ?? (await getCsrfToken()));
  }
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    credentials: "include",
  });
  return readResponse<T>(response);
}

export const api = {
  login: (email: string, password: string) =>
    request<{ user: User; csrfToken: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }).then((body) => {
      csrfToken = body.csrfToken;
      window.dispatchEvent(new Event("yiedie:session-change"));
      return body.user;
    }),
  register: (
    fullName: string,
    email: string,
    password: string,
    role: User["role"],
  ) =>
    request<{ user: User; csrfToken: string }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ fullName, email, password, role }),
    }).then((body) => {
      csrfToken = body.csrfToken;
      window.dispatchEvent(new Event("yiedie:session-change"));
      return body.user;
    }),
  me: () =>
    request<{ user: User; csrfToken: string }>("/auth/me").then((body) => {
      csrfToken = body.csrfToken;
      return body.user;
    }),
  updateMe: (input: {
    fullName?: string;
    bio?: string;
    specialties?: string[];
  }) =>
    request<{ user: User }>("/users/me", {
      method: "PATCH",
      body: JSON.stringify(input),
    }).then((body) => body.user),
  uploadAvatar: (image: File) => {
    const formData = new FormData();
    formData.append("avatar", image);
    return request<{ user: User }>("/users/me/avatar", {
      method: "POST",
      body: formData,
    }).then((body) => body.user);
  },
  changePassword: (currentPassword: string, newPassword: string) =>
    request<void>("/auth/password", {
      method: "PATCH",
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
  deleteAccount: (password: string) =>
    request<void>("/auth/account", {
      method: "DELETE",
      body: JSON.stringify({ password }),
    }).then(() => {
      csrfToken = null;
      window.dispatchEvent(new Event("yiedie:session-change"));
    }),
  user: (id: string) =>
    request<{ user: User }>(`/users/${id}`).then((body) => body.user),
  csrf: getCsrfToken,
  call: (id: string) =>
    request<{ call: CallRoom }>(`/calls/${encodeURIComponent(id)}`),
  createCall: (input: CreateCallInput) =>
    request<{ call: CallRoom }>("/calls", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  callIce: () =>
    request<{ iceServers: RTCIceServer[]; expiresAt: string | null }>(
      "/calls/ice",
    ),
  endCall: (id: string) =>
    request<{ call: CallRoom }>(`/calls/${encodeURIComponent(id)}/end`, {
      method: "POST",
    }),
  users: (search = "", role?: User["role"] | "admin") => {
    const qs = role
      ? `?search=${encodeURIComponent(search)}&role=${encodeURIComponent(role)}`
      : `?search=${encodeURIComponent(search)}`;
    return request<{ users: User[] }>(`/users${qs}`);
  },
  updateUserRole: (id: string, role: User["role"] | "admin") =>
    request<{ user: User }>(`/users/${encodeURIComponent(id)}/role`, {
      method: "PATCH",
      body: JSON.stringify({ role }),
    }),
  counsellors: (search = "") =>
    request<{ counsellors: Counsellor[] }>(
      `/counsellors?search=${encodeURIComponent(search)}`,
    ),
  counsellorAvailability: (counsellorId: string) =>
    request<{ slots: AvailabilitySlot[] }>(
      `/counsellors/${encodeURIComponent(counsellorId)}/availability`,
    ),
  createAvailability: (startsAt: string, endsAt: string) =>
    request<{ slot: AvailabilitySlot }>("/counsellors/availability", {
      method: "POST",
      body: JSON.stringify({ startsAt, endsAt }),
    }),
  deleteAvailability: (slotId: string) =>
    request<void>(`/counsellors/availability/${encodeURIComponent(slotId)}`, {
      method: "DELETE",
    }),
  bookings: () => request<{ bookings: Booking[] }>("/bookings"),
  updateBookingStatus: (id: string, status: Booking["status"]) =>
    request<{ booking: Booking }>(
      `/bookings/${encodeURIComponent(id)}/status`,
      {
        method: "PATCH",
        body: JSON.stringify({ status }),
      },
    ),
  createBooking: (slotId: string, note = "") =>
    request<{ booking: Booking }>("/bookings", {
      method: "POST",
      body: JSON.stringify({ slotId, note }),
    }),
  conversations: () =>
    request<{ conversations: Conversation[] }>("/conversations"),
  createGroup: (title: string, memberIds: string[]) =>
    request<{ conversation: Conversation }>("/conversations", {
      method: "POST",
      body: JSON.stringify({ kind: "group", title, memberIds }),
    }),
  renameGroup: (id: string, title: string) =>
    request<{ conversation: Conversation }>(
      `/conversations/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        body: JSON.stringify({ title }),
      },
    ),
  addGroupMember: (id: string, memberId: string) =>
    request<{ members: ConversationMember[] }>(
      `/conversations/${encodeURIComponent(id)}/members`,
      {
        method: "POST",
        body: JSON.stringify({ memberId }),
      },
    ),
  removeGroupMember: (id: string, memberId: string) =>
    request<void>(
      `/conversations/${encodeURIComponent(id)}/members/${encodeURIComponent(memberId)}`,
      { method: "DELETE" },
    ),
  deleteGroup: (id: string) =>
    request<void>(`/conversations/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),
  posts: () => request<{ posts: Post[] }>("/posts"),
  likePost: (postId: string) =>
    request<{ liked: boolean; likes: number }>(`/posts/${postId}/like`, {
      method: "POST",
    }),
  commentOnPost: (postId: string, body: string) =>
    request<{ comment: PostComment }>(`/posts/${postId}/comments`, {
      method: "POST",
      body: JSON.stringify({ body }),
    }),
  repostPost: (postId: string) =>
    request<{ reposted: boolean; reposts: number }>(`/posts/${postId}/repost`, {
      method: "POST",
    }),
  savePost: (postId: string) =>
    request<{ saved: boolean; saves: number }>(`/posts/${postId}/save`, {
      method: "POST",
    }),
  createPost: (input: {
    body?: string;
    mediaType?: "image" | "video";
    mediaUrl?: string;
    mediaFile?: File | null;
  }) => {
    if (input.mediaFile) {
      const formData = new FormData();
      formData.append("body", input.body ?? "");
      if (input.mediaType) formData.append("mediaType", input.mediaType);
      formData.append("media", input.mediaFile);
      return request<{ post: Post }>("/posts", {
        method: "POST",
        body: formData,
      });
    }

    return request<{ post: Post }>("/posts", {
      method: "POST",
      body: JSON.stringify({
        body: input.body ?? "",
        mediaType: input.mediaType ?? null,
        mediaUrl: input.mediaUrl ?? "",
      }),
    });
  },
  followUser: (userId: string) =>
    request<{ following: boolean }>(`/users/${userId}/follow`, {
      method: "POST",
    }),
  unfollowUser: (userId: string) =>
    request<{ following: boolean }>(`/users/${userId}/follow`, {
      method: "DELETE",
    }),
  logout: () =>
    request<void>("/auth/logout", { method: "POST" }).then(() => {
      csrfToken = null;
      window.dispatchEvent(new Event("yiedie:session-change"));
    }),
};
