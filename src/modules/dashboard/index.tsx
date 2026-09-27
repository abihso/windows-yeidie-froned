import { ProfileMenu } from "../../components/profile";
import { Icon } from "@iconify/react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Images } from "../../assets/images";
import { ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { FormEvent, MouseEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  api,
  type AvailabilitySlot,
  type Booking,
  type Counsellor,
  type Conversation,
  type User,
} from "../../lib/api";
import Calendar from "../../components/calendar";
import { MobileBottomNav } from "../../components/mobile-bottom-nav";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const Dashboard = () => {
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [user, setUser] = useState<User | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [counsellors, setCounsellors] = useState<Counsellor[]>([]);
  const [availableSlots, setAvailableSlots] = useState<AvailabilitySlot[]>([]);
  const [loadError, setLoadError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<Counsellor[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [bookingOpen, setBookingOpen] = useState(false);
  const [selectedCounsellor, setSelectedCounsellor] =
    useState<Counsellor | null>(null);
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([]);
  const [selectedSlotId, setSelectedSlotId] = useState("");
  const [bookingNote, setBookingNote] = useState("");
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingError, setBookingError] = useState("");
  const [bookingSuccess, setBookingSuccess] = useState("");
  const [slotStart, setSlotStart] = useState("");
  const [slotEnd, setSlotEnd] = useState("");
  const [slotError, setSlotError] = useState("");
  const [slotSuccess, setSlotSuccess] = useState("");
  const [updatingBookingIds, setUpdatingBookingIds] = useState<string[]>([]);
  const updatingBookingIdsRef = useRef(new Set<string>());
  const [dashboardLoading, setDashboardLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      try {
        const currentUser = await api.me();
        if (cancelled) return;
        setUser(currentUser);
        const conversationResponse = await api.conversations();
        if (cancelled) return;
        setConversations(conversationResponse.conversations);

        if (currentUser.role === "admin") {
          const [clients, counsellorsResponse, adminUsers, bookingResponse] =
            await Promise.all([
              api.users("", "client"),
              api.users("", "counsellor"),
              api.users("", "admin"),
              api.bookings(),
            ]);

          const mergedUsers = [
            ...clients.users,
            ...counsellorsResponse.users,
            ...adminUsers.users,
          ];
          setAllUsers(mergedUsers);
          setCounsellors(
            counsellorsResponse.users.map(
              ({ id, fullName, bio, specialties }) => ({
                id,
                fullName,
                bio,
                specialties,
              }),
            ),
          );
          setBookings(bookingResponse.bookings);
          return;
        }

        if (currentUser.role === "counsellor") {
          const [counsellorsResponse, slotResponse, bookingResponse] =
            await Promise.all([
              api.counsellors(),
              api.counsellorAvailability(currentUser.id),
              api.bookings(),
            ]);

          setCounsellors(counsellorsResponse.counsellors);
          setAvailableSlots(slotResponse.slots);
          setBookings(
            bookingResponse.bookings.filter(
              (booking) => booking.counsellorId === currentUser.id,
            ),
          );
          return;
        }

        const [counsellorsResponse, bookingResponse] = await Promise.all([
          api.counsellors(),
          api.bookings(),
        ]);

        setCounsellors(counsellorsResponse.counsellors);
        setBookings(
          bookingResponse.bookings.filter(
            (booking) => booking.clientId === currentUser.id,
          ),
        );
      } catch (requestError) {
        if (cancelled) return;
        setLoadError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load your dashboard.",
        );
        window.location.href = "/";
      } finally {
        if (!cancelled) setDashboardLoading(false);
      }
    }

    void loadDashboard();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const query = searchTerm.trim();
    if (!query) {
      setSearchResults([]);
      setHasSearched(false);
      setSearchError("");
      setSearching(false);
      return;
    }

    const normalizedQuery = query.toLowerCase();
    const cachedMatches = counsellors.filter((counsellor) =>
      [counsellor.fullName, ...(counsellor.specialties ?? [])].some((value) =>
        value.toLowerCase().includes(normalizedQuery),
      ),
    );
    setSearchResults(cachedMatches);
    setHasSearched(true);
    setSearching(true);

    let cancelled = false;
    const timer = window.setTimeout(() => {
      setSearchError("");
      void api
        .counsellors(query)
        .then((result) => {
          if (!cancelled) setSearchResults(result.counsellors);
        })
        .catch((requestError) => {
          if (cancelled) return;
          setSearchResults([]);
          setSearchError(
            requestError instanceof Error
              ? requestError.message
              : "Unable to search counsellors.",
          );
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 150);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [counsellors, searchTerm]);

  function openBooking(counsellor?: Counsellor) {
    setSelectedCounsellor(counsellor ?? null);
    setAvailability([]);
    setSelectedSlotId("");
    setBookingNote("");
    setBookingError("");
    setBookingSuccess("");
    setBookingOpen(true);
  }

  useEffect(() => {
    if (!bookingOpen || !selectedCounsellor) return;
    let cancelled = false;
    setBookingError("");
    void api
      .counsellorAvailability(selectedCounsellor.id)
      .then((result) => {
        if (!cancelled) setAvailability(result.slots);
      })
      .catch((requestError) => {
        if (!cancelled) {
          setBookingError(
            requestError instanceof Error
              ? requestError.message
              : "Unable to load available appointment times.",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [bookingOpen, selectedCounsellor]);

  async function handleBookAppointment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedSlotId) {
      setBookingError("Choose an available time first.");
      return;
    }
    setBookingLoading(true);
    setBookingError("");
    setBookingSuccess("");
    try {
      await api.createBooking(selectedSlotId, bookingNote.trim());
      setBookingSuccess("Appointment request sent successfully.");
      setAvailability((slots) =>
        slots.filter((slot) => slot.id !== selectedSlotId),
      );
      setSelectedSlotId("");
      setBookingNote("");
    } catch (requestError) {
      setBookingError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to book this appointment.",
      );
    } finally {
      setBookingLoading(false);
    }
  }

  async function handleRoleUpdate(id: string, role: User["role"] | "admin") {
    try {
      const response = await api.updateUserRole(id, role);
      setAllUsers((users) =>
        users.map((userItem) =>
          userItem.id === id ? response.user : userItem,
        ),
      );
    } catch (requestError) {
      window.alert(
        requestError instanceof Error
          ? requestError.message
          : "Unable to update role.",
      );
    }
  }

  async function handleCreateSlot() {
    if (!slotStart || !slotEnd) {
      setSlotError("Select both start and end times.");
      return;
    }

    try {
      setSlotError("");
      setSlotSuccess("");
      const response = await api.createAvailability(
        new Date(slotStart).toISOString(),
        new Date(slotEnd).toISOString(),
      );
      setAvailableSlots((current) => [response.slot, ...current]);
      setSlotStart("");
      setSlotEnd("");
      setSlotSuccess("Availability saved.");
    } catch (requestError) {
      setSlotError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to save availability.",
      );
    }
  }

  async function handleDeleteSlot(slotId: string) {
    try {
      await api.deleteAvailability(slotId);
      setAvailableSlots((current) =>
        current.filter((slot) => slot.id !== slotId),
      );
    } catch (requestError) {
      window.alert(
        requestError instanceof Error
          ? requestError.message
          : "Unable to remove availability.",
      );
    }
  }

  async function handleBookingStatusUpdate(
    bookingId: string,
    status: Booking["status"],
  ) {
    if (updatingBookingIdsRef.current.has(bookingId)) return;
    updatingBookingIdsRef.current.add(bookingId);
    setUpdatingBookingIds((current) => [...current, bookingId]);
    try {
      const response = await api.updateBookingStatus(bookingId, status);
      setBookings((current) =>
        current.map((booking) =>
          booking.id === bookingId
            ? { ...booking, status: response.booking.status }
            : booking,
        ),
      );
    } catch (requestError) {
      window.alert(
        requestError instanceof Error
          ? requestError.message
          : "Unable to update the booking.",
      );
    } finally {
      updatingBookingIdsRef.current.delete(bookingId);
      setUpdatingBookingIds((current) =>
        current.filter((id) => id !== bookingId),
      );
    }
  }

  const pendingRequests = bookings.filter(
    (booking) => booking.status === "pending",
  );
  const upcomingAppointments = bookings
    .filter(
      (booking) =>
        (booking.status === "confirmed" || booking.status === "pending") &&
        new Date(booking.startsAt).getTime() > Date.now(),
    )
    .sort(
      (first, second) =>
        new Date(first.startsAt).getTime() -
        new Date(second.startsAt).getTime(),
    )
    .slice(0, 3);
  const recentConversations = conversations
    .filter((conversation) => conversation.latestMessage)
    .slice(0, 5);

  function conversationName(conversation: Conversation) {
    if (conversation.kind === "group") {
      return conversation.title || "Group conversation";
    }
    return (
      conversation.members.find((member) => member.id !== user?.id)?.fullName ??
      "Conversation"
    );
  }

  function formatRelativeTime(date: string) {
    const elapsed = Date.now() - new Date(date).getTime();
    const minutes = Math.floor(elapsed / 60_000);
    if (minutes < 1) return "Now";
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  }

  async function joinAppointment(booking: Booking) {
    if (booking.status !== "confirmed") {
      window.alert("This appointment is waiting for confirmation.");
      return;
    }

    try {
      const response = await api.createCall({
        bookingId: booking.id,
        mode: "video",
      });
      const peerName =
        user?.role === "counsellor"
          ? booking.clientName
          : booking.counsellorName;
      navigate(`/callroom/session?callId=${response.call.id}`, {
        state: { peerName },
      });
    } catch (requestError) {
      window.alert(
        requestError instanceof Error
          ? requestError.message
          : "The meeting is not available yet.",
      );
    }
  }

  const [activeTab, setActiveTab] = useState("Dashboard-0");

  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeftState, setScrollLeftState] = useState(0);

  const handleMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    if (!scrollRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - scrollRef.current.offsetLeft);
    setScrollLeftState(scrollRef.current.scrollLeft);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!isDragging || !scrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - startX) * 2;
    scrollRef.current.scrollLeft = scrollLeftState - walk;
  };

  const navItems = ["Dashboard", "Why Yiedie", "How it works", "Pricing"];

  const sidebarGroups = [
    [
      { icon: "mynaui:users-group", label: "Counselors" },
      { icon: "vadivam:network", label: "Organisation" },
    ],
    [
      {
        icon: "weui:discover-outlined",
        label: "Discover",
        link: "/dashboard/discovery",
      },
      { icon: "solar:feed-linear", label: "Feeds", link: "/dashboard/feeds" },
      { icon: "reicon:save", label: "Saved" },
    ],
    [
      {
        icon: "mage:message-round",
        label: "Message",
        link: "/dashboard/messages",
      },
      { icon: "arcticons:google-journal", label: "My Journals" },
      { icon: "grommet-icons:resources", label: "Resources" },
    ],
    [
      { icon: "akar-icons:schedule", label: "Schedule" },
      { icon: "qlementine-icons:task-16", label: "Task" },
    ],
  ];

  if (dashboardLoading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] px-3 py-5 sm:px-5">
        <div className="flex items-center justify-between">
          <Skeleton className="h-14 w-16 rounded-2xl" />
          <div className="flex items-center gap-3">
            <Skeleton className="h-6 w-6 rounded-full" />
            <Skeleton className="h-10 w-10 rounded-full" />
          </div>
        </div>
        <div className="mt-16 space-y-3">
          <Skeleton className="h-8 w-72" />
          <Skeleton className="h-8 w-96 max-w-full" />
          <Skeleton className="mt-5 h-14 w-full rounded-full" />
        </div>
        <div className="mt-8 grid gap-3 lg:grid-cols-[70px_minmax(0,1fr)_minmax(0,2fr)_minmax(0,1.2fr)]">
          <Skeleton className="h-72 rounded-2xl" />
          <Skeleton className="h-72 rounded-2xl" />
          <Skeleton className="h-72 rounded-2xl" />
          <Skeleton className="h-72 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="mobile-dashboard h-screen bg-[#f8fafc] overflow-x-hidden overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
      {/* Top Header Section */}
      <div className="mobile-dashboard-header min-h-48 bg-[#e5e5e5e3] px-3 sm:px-5 pb-5 overflow-visible">
        <div className="h-14 border-black flex flex-wrap lg:flex-nowrap justify-between items-center w-full gap-2 overflow-visible">
          {/* Left Navigation and Logo */}
          <div className="h-full flex items-center gap-2 sm:gap-4 overflow-x-auto lg:overflow-visible scrollbar-none w-full lg:w-auto">
            <div className="bg-white mt-9 w-fit p-2 rounded-2xl h-16 shrink-0 flex items-center justify-center relative z-50 shadow-md transition-transform duration-300 hover:scale-105 cursor-pointer">
              <img
                src={Images[0]}
                alt=""
                className="w-10 h-10 object-contain"
              />
            </div>

            {/* Dynamic Navigation Tabs */}
            <div className="mobile-dashboard-nav flex items-center gap-2 sm:gap-4">
              {navItems.map((item, index) => {
                const isActive = activeTab === `${item}-${index}`;
                return (
                  <div
                    key={index}
                    onMouseEnter={() => setActiveTab(`${item}-${index}`)}
                    onClick={() => setActiveTab(`${item}-${index}`)}
                    className={`border-t-4 transition-all duration-300 flex justify-center items-end h-full w-fit shrink-0 cursor-pointer ${
                      isActive ? "border-[#A8A8AD]" : "border-transparent"
                    }`}
                  >
                    <p
                      className={`font-extrabold py-1 px-2 rounded-b-lg transition-all duration-200 text-xs sm:text-sm active:scale-95 select-none ${
                        isActive
                          ? "bg-[#A8A8AD] text-white -translate-y-0.5"
                          : "text-[#000057] hover:text-[#1900FF]"
                      }`}
                    >
                      {item}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Notifications and Profile */}
          <div className="h-full flex items-center justify-end pt-5 shrink-0 ml-auto lg:ml-0">
            <div className="flex items-center gap-2 h-1/2">
              <Icon
                icon="mingcute:notification-fill"
                className="-mt-1 cursor-pointer shrink-0 transition-transform duration-200 hover:scale-125 hover:-rotate-12 active:scale-90"
                color="#09024B"
                fontSize={22}
              />
              <Icon
                icon="mage:message-fill"
                className="-mt-1 cursor-pointer shrink-0 transition-transform duration-200 hover:scale-125 hover:rotate-12 active:scale-90"
                color="#09024B"
                fontSize={22}
              />
              <div className="w-fit border-black shrink-0 transition-transform duration-200 hover:scale-105">
                <ProfileMenu user={user} onUserUpdated={setUser} />
              </div>
            </div>
          </div>
        </div>

        {/* Hero Search Area */}
        <div className="mt-16 sm:mt-18">
          <p className="text-[#000057] font-extrabold text-xl sm:text-3xl">
            {user
              ? `Welcome back, ${user.fullName}`
              : "Loading your account..."}
          </p>
          <p className="text-[#000057] font-extrabold text-xl sm:text-3xl">
            {user?.role === "admin"
              ? "Manage the platform and support your community"
              : user?.role === "counsellor"
                ? "Manage your schedule and counselling sessions"
                : "Find a perfect and professional counselor"}
          </p>
          {loadError && (
            <p className="text-red-600 text-sm mt-2">{loadError}</p>
          )}
          {user?.role !== "admin" && (
            <form
              onSubmit={(event) => event.preventDefault()}
              className="bg-color6 h-auto rounded-3xl sm:rounded-full mt-2 px-3 py-3 sm:py-2 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm transition-all duration-300 hover:shadow-md"
            >
              <div className="border-b sm:border-b-0 sm:border-r-2 h-auto sm:h-3/5 border-[#B6B6B6] pb-2 sm:pb-0 sm:pl-6 sm:pr-6 w-full sm:w-2/10 flex gap-4 items-center shrink-0">
                <Icon
                  icon="ri:search-fill"
                  className="text-white text-xl sm:text-2xl shrink-0 transition-transform duration-200 hover:scale-110"
                />
                <p className="text-white text-sm whitespace-nowrap">
                  Counsellor search
                </p>
              </div>

              <div className="w-full h-full flex flex-col sm:flex-row items-center gap-3">
                <div className="relative flex items-center w-full h-12">
                  <Icon
                    icon="duo-icons:location"
                    className="absolute left-4 text-xl sm:text-2xl text-white z-10 pointer-events-none"
                  />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    className="w-full h-full text-white rounded-full pl-14 sm:pl-16 pr-4 bg-color6 sm:bg-transparent outline-none border sm:border-none text-sm transition-all duration-200 focus:bg-white focus:ring-2 focus:ring-[#1900FF]/30"
                    placeholder="Search by name or specialty"
                  />
                </div>
                <Button
                  type="submit"
                  variant={"secondary"}
                  disabled={searching}
                  className={
                    "bg-color5 hover:bg-[#1900ffb7] font-bold w-full sm:w-50 rounded-full h-12 text-white px-8 shrink-0 cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 active:scale-95"
                  }
                >
                  {searching ? "Searching..." : "Search"}
                </Button>
              </div>
            </form>
          )}
          {(hasSearched || searchError) && user?.role !== "admin" && (
            <div className="mt-3 rounded-2xl bg-white border border-[#ACA9FF] p-3 shadow-md">
              {searchError && (
                <p className="text-sm text-red-600">{searchError}</p>
              )}
              {searchResults.length > 0 && (
                <div className="grid gap-2 sm:grid-cols-2">
                  {searchResults.map((counsellor) => (
                    <button
                      key={counsellor.id}
                      type="button"
                      onClick={() => openBooking(counsellor)}
                      className="rounded-xl border border-[#E0DFFF] p-3 text-left hover:border-[#1900FF] hover:bg-[#F3F2FF]"
                    >
                      <p className="font-bold text-[#0A0332]">
                        {counsellor.fullName}
                      </p>
                      <p className="mt-1 text-xs text-slate-600">
                        {counsellor.specialties?.join(", ") ||
                          "Professional counsellor"}
                      </p>
                    </button>
                  ))}
                </div>
              )}
              {!searchError && searchResults.length === 0 && (
                <p className="text-sm text-slate-600">No counsellors found.</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Categories Scroll & Banner Row */}
      <div className="flex flex-col xl:flex-row my-5 px-3 sm:px-5 items-stretch xl:items-center gap-4">
        <div className="w-full xl:w-20 flex items-center justify-between gap-3 shrink-0">
          <div className="bg-[#1900FF] w-fit rounded-lg p-1 transition-transform duration-200 hover:scale-105 shadow-sm">
            <Icon
              icon="material-symbols:dashboard-rounded"
              className="w-10 h-10 text-white"
            />
          </div>
        </div>

        <div
          className={`flex items-center gap-3 overflow-x-auto scrollbar-none px-2 py-1 w-full scroll-smooth [-webkit-overflow-scrolling:touch] select-none ${
            isDragging ? "cursor-grabbing" : "cursor-grab"
          }`}
          ref={scrollRef}
          onMouseDown={handleMouseDown}
          onMouseLeave={handleMouseLeave}
          onMouseUp={handleMouseUp}
          onMouseMove={handleMouseMove}
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {[
            "Health & Wellness",
            "Education",
            "Relationships",
            "Family",
            "Finance",
            "Career",
            "Career",
            "Family",
          ].map((item, idx) => (
            <Button
              key={idx}
              variant="default"
              className="shrink-0 text-[#010158] font-extrabold h-15 w-48 border border-[#A19EFF] rounded-2xl bg-[#EDEBFF] hover:bg-[#1900FF] hover:text-white shadow-none cursor-pointer transition-all duration-200 hover:-translate-y-0.5 active:scale-95"
            >
              {item}
            </Button>
          ))}
        </div>

        <div className="w-full xl:w-fit flex items-center justify-between xl:justify-start gap-2 px-2 shrink-0">
          <div className="bg-color6 h-14 rounded-xl flex flex-col justify-center items-start px-6 sm:px-8 w-full xl:w-87.5 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 cursor-pointer">
            <p className="text-xs sm:text-sm font-bold text-white truncate w-full">
              keep going to reach and improve even more.
            </p>
            <p className="text-xs sm:text-sm font-bold text-white truncate w-full">
              {counsellors.length} counsellors available to connect with today.
            </p>
          </div>
        </div>
      </div>

      {/* Main Content Dashboard Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[70px_minmax(0,1fr)_minmax(0,2fr)_minmax(0,1.2fr)] min-h-[50vh] px-3 sm:px-5 gap-3 my-6 items-start">
        {/* Left Sidebar Icon Column */}
        <div className="flex flex-col justify-between items-center py-6 bg-color6 border border-[#c1c1ff] rounded-2xl w-full min-h-[155] lg:min-h-full">
          <div className="flex flex-col items-center gap-2 w-full">
            {sidebarGroups.map((group, gIdx) => (
              <div
                key={gIdx}
                className="flex flex-col items-center gap-2 w-full"
              >
                {group.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() =>
                      item.link && (window.location.href = item.link)
                    }
                    className="relative group flex items-center justify-center w-full h-10 px-3 cursor-pointer bg-transparent border-none transition-transform duration-200 active:scale-90"
                  >
                    <Icon
                      icon={item.icon}
                      className="text-4xl text-[#aabfe1] group-hover:text-[#1900FF] shrink-0 transition-all duration-200 group-hover:scale-110"
                    />
                    <div className="absolute z-10 left-16 h-10 w-32 pl-4 items-center justify-start hidden group-hover:flex">
                      <div className="h-10 w-25 bg-[#0A0332] py-2 px-4 rounded-lg flex items-center justify-center shadow-md relative transition-transform duration-200 animate-in fade-in slide-in-from-left-2 before:content-[''] before:absolute before:right-full before:top-1/2 before:-translate-y-1/2 before:border-[6px] before:border-transparent before:border-r-[#0A0332]">
                        <p className="text-white font-bold text-sm tracking-tight whitespace-nowrap">
                          {item.label}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
                {gIdx < sidebarGroups.length - 1 && (
                  <div className="border border-[#DEDEDE] my-1 w-[80%]" />
                )}
              </div>
            ))}
          </div>

          <div className="w-full flex flex-col items-center pt-2">
            <div className="border border-[#DEDEDE] mb-2 w-[80%]" />
            <button className="relative group flex items-center justify-center w-full h-10 px-3 cursor-pointer bg-transparent border-none transition-transform duration-200 active:scale-90">
              <Icon
                icon="uil:setting"
                className="text-4xl text-[#aabfe1] group-hover:text-[#1900FF] shrink-0 transition-all duration-200 group-hover:scale-110"
              />
              <div className="absolute z-10 left-16 h-10 w-32 pl-4 items-center justify-start hidden group-hover:flex">
                <div className="h-10 w-25 bg-[#0A0332] py-2 px-4 rounded-lg flex items-center justify-center shadow-md relative transition-transform duration-200 animate-in fade-in slide-in-from-left-2 before:content-[''] before:absolute before:right-full before:top-1/2 before:-translate-y-1/2 before:border-[6px] before:border-transparent before:border-r-[#0A0332]">
                  <p className="text-white font-bold text-sm tracking-tight whitespace-nowrap">
                    Settings
                  </p>
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Messages Section */}
        <div className="bg-[#F0EFFC] rounded-2xl min-h-50 lg:min-h-full p-3 overflow-hidden transition-all duration-300 hover:shadow-sm">
          <div className="flex justify-between items-center">
            <p className="font-extrabold text-xl text-color6">Messages</p>
            <button
              type="button"
              onClick={() => (window.location.href = "/dashboard/messages")}
              className="text-xs cursor-pointer font-bold text-color6 transition-all duration-200 hover:underline hover:scale-105 active:scale-95"
            >
              View all
            </button>
          </div>

          {recentConversations.length ? (
            recentConversations.map((conversation) => {
              const latestMessage = conversation.latestMessage;
              return (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() =>
                    (window.location.href = `/dashboard/messages?conversationId=${conversation.id}`)
                  }
                  className="h-14 w-full rounded-full p-2 mt-3 flex items-center gap-3 text-left transition-all duration-200 hover:bg-[#d8d6f0] hover:shadow-sm hover:translate-x-1 cursor-pointer group"
                >
                  <Avatar className="h-10 w-10 shrink-0 transition-transform duration-200 group-hover:scale-110">
                    <AvatarFallback>
                      {conversationName(conversation).slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex justify-between w-full min-w-0 border-b-2 py-5">
                    <div className="w-full min-w-0 overflow-hidden">
                      <p className="text-[#0A0332] font-bold text-sm truncate group-hover:text-[#1900FF] transition-colors">
                        {conversationName(conversation)}
                      </p>
                      <p className="text-[#0A0332]/70 font-medium text-xs truncate">
                        {latestMessage?.body}
                      </p>
                    </div>
                    {latestMessage && (
                      <p className="ml-2 shrink-0 text-[10px]">
                        {formatRelativeTime(latestMessage.createdAt)}
                      </p>
                    )}
                  </div>
                </button>
              );
            })
          ) : (
            <p className="mt-5 text-sm text-slate-600">
              Your recent conversations will appear here.
            </p>
          )}
        </div>

        {user?.role === "admin" ? (
          <div className="bg-white rounded-2xl min-h-50 lg:min-h-full p-4">
            <div className="flex justify-between items-center mb-4">
              <p className="font-bold text-[#000057] text-2xl">
                Admin Dashboard
              </p>
              <span className="rounded-full bg-[#EDEBFF] px-3 py-1 text-xs font-bold text-[#1900FF]">
                Operations
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-[#F0EFFC] p-4">
                <p className="text-xs uppercase text-slate-500">Total users</p>
                <p className="mt-2 text-3xl font-black text-[#000057]">
                  {allUsers.length}
                </p>
              </div>
              <div className="rounded-2xl bg-[#F0EFFC] p-4">
                <p className="text-xs uppercase text-slate-500">Bookings</p>
                <p className="mt-2 text-3xl font-black text-[#000057]">
                  {bookings.length}
                </p>
              </div>
              <div className="rounded-2xl bg-[#F0EFFC] p-4">
                <p className="text-xs uppercase text-slate-500">Counsellors</p>
                <p className="mt-2 text-3xl font-black text-[#000057]">
                  {counsellors.length}
                </p>
              </div>
              <div className="rounded-2xl bg-[#F0EFFC] p-4">
                <p className="text-xs uppercase text-slate-500">Pending</p>
                <p className="mt-2 text-3xl font-black text-[#000057]">
                  {bookings.filter((item) => item.status === "pending").length}
                </p>
              </div>
            </div>

            <div className="mt-5">
              <p className="mb-3 font-bold text-[#000057]">User roles</p>
              <div className="space-y-2">
                {allUsers.slice(0, 8).map((person) => (
                  <div
                    key={person.id}
                    className="flex items-center justify-between rounded-xl border border-slate-200 p-3"
                  >
                    <div>
                      <p className="font-bold text-[#0A0332]">
                        {person.fullName}
                      </p>
                      <p className="text-xs text-slate-500">{person.email}</p>
                    </div>
                    <select
                      value={person.role}
                      onChange={(event) =>
                        handleRoleUpdate(
                          person.id,
                          event.target.value as User["role"] | "admin",
                        )
                      }
                      className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm outline-none"
                    >
                      <option value="client">Client</option>
                      <option value="counsellor">Counsellor</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : user?.role === "counsellor" ? (
          <div className="bg-white rounded-2xl min-h-50 lg:min-h-full p-4">
            <div className="flex justify-between items-center mb-4">
              <p className="font-bold text-[#000057] text-2xl">
                Counsellor Dashboard
              </p>
              <span className="rounded-full bg-[#EDEBFF] px-3 py-1 text-xs font-bold text-[#1900FF]">
                Schedule
              </span>
            </div>

            <div className="rounded-2xl border border-[#E0DFFF] bg-[#F9F8FF] p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <p className="font-bold text-[#0A0332]">
                  Pending appointment requests
                </p>
                <span className="rounded-full bg-[#EDEBFF] px-2.5 py-1 text-[10px] font-bold uppercase text-[#1900FF]">
                  {pendingRequests.length} waiting
                </span>
              </div>

              {pendingRequests.length ? (
                <div className="space-y-3">
                  {pendingRequests.map((booking) => (
                    <div
                      key={booking.id}
                      className="rounded-2xl border border-[#D9D3FF] bg-white p-3"
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-bold text-[#0A0332]">
                            {booking.clientName || "Client request"}
                          </p>
                          <p className="text-xs text-slate-600">
                            {new Date(booking.startsAt).toLocaleString([], {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })}
                          </p>
                        </div>
                        <span className="rounded-full bg-[#FFF3D5] px-2 py-1 text-[10px] font-bold uppercase text-[#9A6400]">
                          Pending
                        </span>
                      </div>

                      {booking.note && (
                        <p className="mt-2 text-sm text-slate-600">
                          {booking.note}
                        </p>
                      )}

                      <div className="mt-3 flex gap-2">
                        <Button
                          type="button"
                          disabled={updatingBookingIds.includes(booking.id)}
                          onClick={() =>
                            void handleBookingStatusUpdate(
                              booking.id,
                              "confirmed",
                            )
                          }
                          className="flex-1 rounded-xl bg-[#1900FF] text-white hover:bg-[#1300c4]"
                        >
                          Accept
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={updatingBookingIds.includes(booking.id)}
                          onClick={() =>
                            void handleBookingStatusUpdate(
                              booking.id,
                              "cancelled",
                            )
                          }
                          className="flex-1 rounded-xl border-red-200 text-red-600 hover:bg-red-50"
                        >
                          Reject
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-600">
                  No pending appointment requests right now.
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-[#E0DFFF] bg-[#F9F8FF] p-4">
              <p className="font-bold text-[#0A0332] mb-3">Add availability</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  type="datetime-local"
                  value={slotStart}
                  onChange={(event) => setSlotStart(event.target.value)}
                  className="rounded-xl border border-slate-200 p-3 outline-none"
                />
                <input
                  type="datetime-local"
                  value={slotEnd}
                  onChange={(event) => setSlotEnd(event.target.value)}
                  className="rounded-xl border border-slate-200 p-3 outline-none"
                />
              </div>
              {slotError && (
                <p className="mt-3 text-sm text-red-600">{slotError}</p>
              )}
              {slotSuccess && (
                <p className="mt-3 text-sm text-green-700">{slotSuccess}</p>
              )}
              <Button
                onClick={handleCreateSlot}
                className="mt-4 rounded-xl bg-[#1900FF] text-white hover:bg-[#1300c4]"
              >
                Save availability
              </Button>
            </div>

            <div className="mt-5">
              <p className="mb-3 font-bold text-[#000057]">
                My upcoming availability
              </p>
              <div className="space-y-2">
                {availableSlots.length ? (
                  availableSlots.map((slot) => (
                    <div
                      key={slot.id}
                      className="flex items-center justify-between rounded-xl border border-slate-200 p-3"
                    >
                      <div>
                        <p className="font-bold text-[#0A0332]">
                          {new Date(slot.startsAt).toLocaleString([], {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </p>
                        <p className="text-xs text-slate-500">
                          to{" "}
                          {new Date(slot.endsAt).toLocaleString([], {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        onClick={() => handleDeleteSlot(slot.id)}
                        className="rounded-xl"
                      >
                        Remove
                      </Button>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-600">
                    No availability set yet.
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl min-h-50 lg:min-h-full">
            <div className="rounded-2xl border border-gray-200 bg-color6 overflow-hidden py-4 px-4 sm:px-8 transition-all duration-300 hover:shadow-md hover:-translate-y-0.5">
              <div className="flex justify-between">
                <p className="text-white font-extrabold">Anxiety Test</p>
                <p className="text-white/80 text-sm font-medium">Ads</p>
              </div>
              <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="w-full">
                  <p className="text-white mt-3 sm:mt-5 text-sm sm:text-base">
                    Have you been feeling particularly Anxious? Why not check
                    it?
                  </p>
                  <Button
                    className={
                      "bg-white text-[#1900FF] hover:bg-gray-100 mt-6 sm:mt-10 font-bold py-6 sm:py-7 rounded-full w-full sm:w-40 cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 active:scale-95"
                    }
                  >
                    Contact Us
                  </Button>
                </div>
                <div className="w-full relative flex items-center justify-center min-h-40 sm:min-h-0 my-4 sm:my-0 group cursor-pointer">
                  <div className="w-32 sm:w-40 rounded-[60px] sm:-ml-20 h-40 sm:h-48 z-40 bg-white overflow-hidden shadow-lg transition-transform duration-300 group-hover:scale-105">
                    <img
                      src={Images[3]}
                      className="w-full h-full object-cover rounded-[60px] transition-transform duration-500 group-hover:scale-110"
                      alt=""
                    />
                  </div>
                  <div className="w-32 sm:w-40 h-36 sm:h-44 bg-[#FF7DCD] absolute top-2 z-15 rounded-full opacity-80 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6"></div>
                  <div className="w-32 sm:w-40 h-32 sm:h-40 bg-[#E4F2FF] absolute -bottom-4 sm:-bottom-35 left-5 sm:left-5 rounded-[60px] opacity-80 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6"></div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 py-4 px-4 sm:px-8 bg-[#f0effc] mt-5 overflow-hidden transition-all duration-300 hover:shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <p className="font-bold text-[#000057] text-2xl">
                  Appointments
                </p>
                <p className="text-xs cursor-pointer font-bold text-[#000057] transition-all duration-200 hover:underline hover:scale-105 active:scale-95">
                  View all
                </p>
              </div>

              {bookings.length ? (
                bookings.map((booking) => (
                  <div
                    key={booking.id}
                    className="mt-3 rounded-2xl bg-[#E4E3F2] p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-bold text-[#0A0332]">
                          {booking.counsellorName}
                        </p>
                        <p className="text-xs text-slate-600">
                          {new Date(booking.startsAt).toLocaleString([], {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </p>
                      </div>
                      <span className="rounded-full bg-white px-2 py-1 text-[10px] font-bold uppercase text-[#1900FF]">
                        {booking.status}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-600">No appointments yet.</p>
              )}
            </div>
          </div>
        )}

        {/* Reminders & Calendar Section */}
        <div className="bg-white min-h-50 lg:min-h-full flex flex-col gap-6 w-full">
          <div className="py-3 px-4 sm:px-5 bg-[#F0EFFC] border border-gray-200 rounded-2xl transition-all duration-300 hover:shadow-sm">
            <div className="flex justify-between items-center">
              <p className="font-bold text-xl text-[#000057]">Appointments</p>
              <span className="text-xs font-bold text-[#000057]">
                {upcomingAppointments.length} upcoming
              </span>
            </div>
            {upcomingAppointments.length ? (
              upcomingAppointments.map((booking) => (
                <button
                  key={booking.id}
                  type="button"
                  onClick={() => void joinAppointment(booking)}
                  className="flex w-full mt-3 bg-[#E4E3F2] px-2 py-2 min-h-14 rounded-2xl items-center gap-2 text-left transition-all duration-200 hover:bg-[#d8d7e8] hover:shadow-sm group"
                >
                  <div className="w-12 sm:w-16 shrink-0 flex justify-center">
                    <div className="w-10 h-10 rounded-full flex justify-center items-center bg-[#FF9001] transition-transform duration-200 group-hover:scale-110">
                      <Icon
                        icon="mingcute:notification-fill"
                        className="h-6 text-white"
                      />
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-sm truncate group-hover:text-[#1900FF] transition-colors">
                      {user?.role === "counsellor"
                        ? booking.clientName
                        : booking.counsellorName}
                    </p>
                    <p className="text-xs text-[#656565] truncate">
                      {new Date(booking.startsAt).toLocaleString([], {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                      {booking.status === "pending"
                        ? " · Awaiting confirmation"
                        : ""}
                    </p>
                  </div>
                  <ChevronRight className="text-black shrink-0" />
                </button>
              ))
            ) : (
              <p className="mt-5 text-sm text-slate-600">
                No upcoming appointments.
              </p>
            )}
          </div>

          <Calendar />

          {user?.role === "client" && (
            <Button
              type="button"
              onClick={() => openBooking()}
              className={
                "font-bold bg-[#000057] hover:bg-[#1500d6] h-20 -mt-10 rounded-t-none rounded-b-3xl text-3xl text-white transition-all duration-300 hover:shadow-lg hover:tracking-wide active:scale-98 cursor-pointer"
              }
            >
              Book Appointment
            </Button>
          )}
          {user?.role === "counsellor" && (
            <Button
              type="button"
              onClick={() => (window.location.href = "/dashboard/messages")}
              className={
                "font-bold bg-[#000057] hover:bg-[#1500d6] h-20 -mt-10 rounded-t-none rounded-b-3xl text-2xl text-white transition-all duration-300 hover:shadow-lg active:scale-98 cursor-pointer"
              }
            >
              Manage Sessions
            </Button>
          )}
          {user?.role === "admin" && (
            <Button
              type="button"
              onClick={() => (window.location.href = "/dashboard/messages")}
              className={
                "font-bold bg-[#000057] hover:bg-[#1500d6] h-20 -mt-10 rounded-t-none rounded-b-3xl text-2xl text-white transition-all duration-300 hover:shadow-lg active:scale-98 cursor-pointer"
              }
            >
              Review Activity
            </Button>
          )}
        </div>
      </div>

      {bookingOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0A0332]/50 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-[#0A0332]">
                  Book an appointment
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Choose a counsellor and an available time.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setBookingOpen(false)}
                className="rounded-lg px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100"
              >
                Close
              </button>
            </div>

            {!selectedCounsellor ? (
              <div className="mt-5 grid gap-2">
                {(counsellors.length ? counsellors : searchResults).map(
                  (counsellor) => (
                    <button
                      key={counsellor.id}
                      type="button"
                      onClick={() => setSelectedCounsellor(counsellor)}
                      className="rounded-xl border border-[#E0DFFF] p-3 text-left hover:border-[#1900FF] hover:bg-[#F3F2FF]"
                    >
                      <p className="font-bold text-[#0A0332]">
                        {counsellor.fullName}
                      </p>
                      <p className="mt-1 text-xs text-slate-600">
                        {counsellor.specialties?.join(", ") ||
                          "Professional counsellor"}
                      </p>
                    </button>
                  ),
                )}
                {!counsellors.length && !searchResults.length && (
                  <p className="text-sm text-slate-600">
                    No counsellors are available.
                  </p>
                )}
              </div>
            ) : (
              <form onSubmit={handleBookAppointment} className="mt-5 space-y-4">
                <div className="flex items-center justify-between rounded-xl bg-[#F3F2FF] p-3">
                  <div>
                    <p className="font-bold text-[#0A0332]">
                      {selectedCounsellor.fullName}
                    </p>
                    <p className="text-xs text-slate-600">
                      {selectedCounsellor.specialties?.join(", ") ||
                        "Professional counsellor"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedCounsellor(null)}
                    className="text-xs font-bold text-[#1900FF] hover:underline"
                  >
                    Change
                  </button>
                </div>

                <div>
                  <p className="mb-2 text-sm font-bold text-[#0A0332]">
                    Available times
                  </p>
                  {availability.length ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {availability.map((slot) => (
                        <label
                          key={slot.id}
                          className={`cursor-pointer rounded-xl border p-3 text-sm ${selectedSlotId === slot.id ? "border-[#1900FF] bg-[#F3F2FF]" : "border-slate-200"}`}
                        >
                          <input
                            type="radio"
                            name="appointment-slot"
                            value={slot.id}
                            checked={selectedSlotId === slot.id}
                            onChange={() => setSelectedSlotId(slot.id)}
                            className="mr-2"
                          />
                          {new Date(slot.startsAt).toLocaleString([], {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </label>
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
                      {bookingError || "No available times found."}
                    </p>
                  )}
                </div>

                <textarea
                  value={bookingNote}
                  onChange={(event) => setBookingNote(event.target.value)}
                  maxLength={2000}
                  placeholder="Add a note for the counsellor (optional)"
                  className="min-h-24 w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-[#1900FF]"
                />
                {bookingError && (
                  <p className="text-sm text-red-600">{bookingError}</p>
                )}
                {bookingSuccess && (
                  <p className="text-sm text-green-700">{bookingSuccess}</p>
                )}
                <Button
                  type="submit"
                  disabled={bookingLoading || !availability.length}
                  className="w-full rounded-xl bg-[#1900FF] text-white hover:bg-[#1300c4]"
                >
                  {bookingLoading ? "Booking..." : "Request appointment"}
                </Button>
              </form>
            )}
          </div>
        </div>
      )}
      <MobileBottomNav />
    </div>
  );
};

export default Dashboard;
