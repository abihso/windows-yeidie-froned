import { Images } from "../../../assets/images";
import SearchFillIcon from "@iconify-react/ri/search-fill";
import LocationIcon from "@iconify-react/duo-icons/location";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import MenuDots16Icon from "@iconify-react/qlementine-icons/menu-dots-16";
import ShareOutlineIcon from "@iconify-react/cuida/share-outline";
import CommentOutlineIcon from "@iconify-react/basil/comment-outline";
import ViewOutlineIcon from "@iconify-react/lsicon/view-outline";
import HomeBrokenIcon from "@iconify-react/solar/home-broken";
import DiscoverLightIcon from "@iconify-react/iconamoon/discover-light";
import SaveAddIcon from "@iconify-react/reicon/save-add";
import ProfileLightIcon from "@iconify-react/iconamoon/profile-light";
import PlusIcon from "@iconify-react/akar-icons/plus";
import { useEffect, useState } from "react";
import { api, normalizeMediaUrl, type Counsellor } from "../../../lib/api";

const Discover = () => {
  const [counsellors, setCounsellors] = useState<Counsellor[]>([]);
  const [loadingCounsellors, setLoadingCounsellors] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api
      .counsellors()
      .then((response) => {
        if (!cancelled) setCounsellors(response.counsellors);
      })
      .catch(() => {
        if (!cancelled) setCounsellors([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingCounsellors(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const categories = [
    { label: "Health & Wellness" },
    { label: "Education" },
    { label: "Relationships" },
    { label: "Family" },
    { label: "Finance" },
    { label: "Career" },
    { label: "Legal and The Law" },
    { label: "Social Support" },
    { label: "Motivation and Inspiration" },
    { label: "Religious & Spiritual" },
    { label: "Business and Investment" },
    { label: "Political" },
    { label: "Personal" },
  ];

  return (
    <div className="min-h-screen px-3 sm:px-6 pt-4 pb-24 bg-white relative max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="h-10 flex justify-between items-center mb-4">
        <p
          style={{ fontSize: 28, fontWeight: "bolder" }}
          className=" text-color1 text-lg sm:text-xl"
        >
          Discover
        </p>
        <img className="w-7 h-10" src={Images[0]} alt="Logo" />
      </div>

      {/* Main Container Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left & Middle Main Content Block */}
        <div className="lg:col-span-9 xl:col-span-10 flex flex-col gap-5">
          {/* Top Controls: Search Bar & Content Type Buttons */}
          <div className="flex flex-col xl:flex-row justify-between items-stretch xl:items-center gap-4">
            {/* --- RESPONSIVE SEARCH BAR --- */}
            <div className="w-full max-w-3xl border border-[#A19EFF] h-auto rounded-3xl md:rounded-full p-2 flex flex-col md:flex-row items-center justify-between gap-2 shadow-sm">
              {/* Keyword Section */}
              <div className="border-b md:border-b-0 md:border-r border-[#B6B6B6] pb-2 md:pb-0 px-3 md:px-4 w-full md:w-auto flex gap-3 items-center shrink-0">
                <SearchFillIcon
                  height="1em"
                  className="text-color6 text-xl shrink-0"
                />
                <p className="text-[#B6B6B6] text-sm whitespace-nowrap">
                  service type keyword
                </p>
              </div>

              {/* Location Input & Button Section */}
              <div className="w-full flex flex-col md:flex-row items-center gap-2 flex-1 min-w-0">
                <div className="relative flex items-center w-full min-w-0 h-11">
                  <LocationIcon
                    height="1em"
                    className="absolute left-3 text-xl text-color6 z-10 pointer-events-none"
                  />
                  <input
                    type="text"
                    className="w-full h-full rounded-full pl-10 pr-4 bg-gray-50 md:bg-transparent outline-none text-sm"
                    placeholder="search by location"
                  />
                </div>
                <Button
                  variant={"secondary"}
                  className="bg-[#010158] hover:bg-[#0101589e] font-bold w-full md:w-auto rounded-full h-11 text-white px-6 shrink-0 cursor-pointer transition-transform hover:scale-105 active:scale-95"
                >
                  Search
                </Button>
              </div>
            </div>

            {/* Content Type Filter Buttons */}
            <div className="flex items-center justify-start sm:justify-end gap-2 overflow-x-auto pb-1 sm:pb-0">
              <Button className="bg-[#010158] hover:bg-[#01015877] border-[#A19EFF] text-white font-extrabold px-6 h-10 rounded-full shrink-0">
                Video
              </Button>
              <Button className="bg-[#010158] hover:bg-[#01015877] border-[#A19EFF] text-white font-extrabold px-6 h-10 rounded-full shrink-0">
                Polls
              </Button>
              <Button className="bg-[#010158] hover:bg-[#01015877] border-[#A19EFF] text-white font-extrabold px-6 h-10 rounded-full shrink-0">
                Magazines
              </Button>
            </div>
          </div>

          {/* Grid Layout for Categories & Feed */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
            {/* --- ANIMATED CATEGORIES SIDEBAR --- */}
            <div className="bg-color md:col-span-4 lg:col-span-3 xl:col-span-2 border border-[#A19EFF] hover:border-[#1900FF]/50 rounded-2xl p-4 flex flex-col transition-all duration-300 ease-in-out hover:shadow-xl hover:shadow-[#1900FF]/5 hover:-translate-y-1">
              <p className="font-extrabold text-color1 text-sm mb-3">
                Categories
              </p>
              <div className="flex md:flex-col gap-1.5 md:gap-2.5 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0">
                {/* Active "All" Item */}
                <span className="text-[#1900FF] font-bold text-xs cursor-pointer whitespace-nowrap px-2.5 py-1 rounded-lg bg-[#EDEBFF] md:bg-transparent transition-all duration-200 md:hover:translate-x-1.5">
                  All
                </span>

                {/* Interactive Category Links */}
                {categories.map((cat, idx) => (
                  <span
                    key={idx}
                    className="font-bold text-xs text-[#010158] hover:text-[#1900FF] hover:font-semibold cursor-pointer whitespace-nowrap px-2.5 py-1 md:px-1 md:py-0.5 rounded-lg hover:bg-[#EDEBFF] md:hover:bg-transparent transition-all duration-200 ease-out md:hover:translate-x-1.5 shrink-0"
                  >
                    {cat.label}
                  </span>
                ))}
              </div>
            </div>

            {/* Posts Grid Container */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-[#f3f7ff] md:col-span-8 lg:col-span-9 xl:col-span-10 border border-[#A19EFF] rounded-2xl p-3 sm:p-5">
              {loadingCounsellors ? (
                <p className="col-span-full p-6 text-center text-sm text-gray-500">
                  Loading counsellors...
                </p>
              ) : counsellors.length === 0 ? (
                <p className="col-span-full p-6 text-center text-sm text-gray-500">
                  No counsellors are available yet.
                </p>
              ) : (
                counsellors.slice(0, 5).map((counsellor, idx) => (
                  <div
                    key={counsellor.id}
                    className="w-full bg-white border border-[#A19EFF] rounded-2xl overflow-hidden flex flex-col transition-all duration-300 hover:shadow-lg hover:-translate-y-1"
                  >
                    <img
                      src={
                        [Images[4], Images[8], Images[7], Images[9], Images[9]][
                          idx
                        ]
                      }
                      className="h-48 sm:h-56 w-full object-cover rounded-2xl"
                      alt="Counselling resource"
                    />
                    <div className="flex justify-between items-center px-4 mt-3 gap-2">
                      <div className="flex gap-2 items-center min-w-0">
                        <Avatar className="h-9 w-9 shrink-0">
                          <AvatarImage
                            src={normalizeMediaUrl(counsellor.avatarUrl)}
                            alt={`${counsellor.fullName} profile picture`}
                          />
                          <AvatarFallback>
                            {counsellor.fullName
                              .split(/\s+/)
                              .slice(0, 2)
                              .map((part) => part[0]?.toUpperCase() ?? "")
                              .join("") || "CN"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="font-bold text-xs text-[#010158] truncate">
                            {counsellor.fullName} -{" "}
                            <span className="text-red-500">
                              {counsellor.specialties?.[0] ?? "Counsellor"}
                            </span>
                          </p>
                          <p className="font-medium text-[10px] text-gray-500 truncate">
                            {counsellor.specialties?.join(", ") || "Counsellor"}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2 items-center shrink-0">
                        <div className="text-center">
                          <ViewOutlineIcon height="1em" className="text-xl" />
                          <p className="text-[10px]">25M</p>
                        </div>
                        <div className="text-center">
                          <CommentOutlineIcon
                            height="1em"
                            className="text-xl"
                          />
                          <p className="text-[10px]">25M</p>
                        </div>
                        <div className="text-center">
                          <ShareOutlineIcon height="1em" className="text-xl" />
                          <p className="text-[10px]">25M</p>
                        </div>
                        <MenuDots16Icon
                          height="1em"
                          className="text-xl cursor-pointer"
                        />
                      </div>
                    </div>
                    <div className="px-4 py-3">
                      <p className="text-xs text-[#807F9D] line-clamp-4">
                        Lorem ipsum dolor sit amet consectetur adipisicing elit.
                        Omnis sed at beatae similique accusantium minima
                        reiciendis ipsum consequatur voluptatem enim suscipit,
                        error vero ratione voluptate consequuntur veniam!
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Sidebar: Related Posts */}
        <div className="bg-[#f3f7ff] lg:col-span-3 xl:col-span-2 border border-[#A19EFF] rounded-2xl p-4 flex flex-col gap-6">
          <div className="flex justify-between items-end">
            <p className="font-black text-base lg:text-lg">Related Post</p>
            <p className="text-[10px] font-bold text-[#1900FF] cursor-pointer hover:underline">
              View All
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-4">
            {[1, 2, 3].map((_, idx) => (
              <div key={idx} className="flex flex-col group cursor-pointer">
                <img
                  src={Images[8]}
                  className="h-32 w-full object-cover rounded-2xl transition-transform duration-300 group-hover:scale-[1.02]"
                  alt="Related post preview"
                />
                <div className="bg-white border border-[#A19EFF] rounded-2xl mt-2 p-3 flex flex-col justify-between flex-1 transition-colors duration-200 group-hover:border-[#1900FF]/50">
                  <p className="text-[10px] text-[#807F9D] line-clamp-3">
                    Lorem ipsum dolor sit amet consectetur adipisicing elit.
                    Omnis sed at beatae similique accusantium minima reiciendis.
                  </p>
                  <p className="text-xs font-bold text-right text-[#1900FF] mt-2 group-hover:underline">
                    Read More
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* --- FLOATING RESPONSIVE FOOTER NAVIGATION WITH HOVER ANIMATIONS --- */}
      <div className="fixed bottom-3 sm:bottom-5 left-0 right-0 flex justify-center z-50 pointer-events-none px-4">
        <div className="h-14 sm:h-16 w-full max-w-md sm:w-auto px-4 sm:px-8 shadow-xl hover:shadow-2xl hover:shadow-[#1900FF]/15 bg-white/90 hover:bg-white backdrop-blur-md border border-gray-200 hover:border-[#A19EFF] rounded-full flex items-center justify-around sm:justify-center gap-1 sm:gap-4 pointer-events-auto transition-all duration-300 ease-in-out hover:-translate-y-1">
          {/* Home Button */}
          <Button
            onClick={() => (window.location.href = "/home")}
            className="group flex-col bg-transparent h-fit p-1.5 sm:p-2.5 hover:bg-[#EDEBFF]/60 rounded-2xl shadow-none border-none transition-all duration-200 hover:scale-105 active:scale-95"
          >
            <HomeBrokenIcon
              className="text-[#010158] group-hover:text-[#FFAE00] text-lg sm:text-xl transition-transform duration-200 group-hover:-translate-y-0.5"
              height="1em"
            />
            <p className="text-[#010158] group-hover:text-[#FFAE00] text-[10px] sm:text-xs font-bold transition-colors">
              Home
            </p>
          </Button>

          {/* Discover Button */}
          <Button className="group flex-col bg-transparent h-fit p-1.5 sm:p-2.5 hover:bg-[#EDEBFF]/60 rounded-2xl shadow-none border-none transition-all duration-200 hover:scale-105 active:scale-95">
            <DiscoverLightIcon
              className="text-[#010158] group-hover:text-[#FFAE00] text-lg sm:text-xl transition-transform duration-200 group-hover:-translate-y-0.5"
              height="1em"
            />
            <p className="text-[#010158] group-hover:text-[#FFAE00] text-[10px] sm:text-xs font-bold transition-colors">
              Discover
            </p>
          </Button>

          {/* Saved Button */}
          <Button className="group flex-col bg-transparent h-fit p-1.5 sm:p-2.5 hover:bg-[#EDEBFF]/60 rounded-2xl shadow-none border-none transition-all duration-200 hover:scale-105 active:scale-95">
            <SaveAddIcon
              className="text-[#010158] group-hover:text-[#FFAE00] text-lg sm:text-xl transition-transform duration-200 group-hover:-translate-y-0.5"
              height="1em"
            />
            <p className="text-[#010158] group-hover:text-[#FFAE00] text-[10px] sm:text-xs font-bold transition-colors">
              Saved
            </p>
          </Button>

          {/* Add Post Button */}
          <Button className="group flex-col bg-transparent h-fit p-1.5 sm:p-2.5 hover:bg-[#EDEBFF]/60 rounded-2xl shadow-none border-none transition-all duration-200 hover:scale-105 active:scale-95">
            <PlusIcon
              className="text-[#010158] group-hover:text-[#FFAE00] text-lg sm:text-xl transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:rotate-90"
              height="1em"
            />
            <p className="text-[#010158] group-hover:text-[#FFAE00] text-[10px] sm:text-xs font-bold transition-colors">
              Add Post
            </p>
          </Button>

          {/* Profile Button */}
          <Button className="group flex-col bg-transparent h-fit p-1.5 sm:p-2.5 hover:bg-[#EDEBFF]/60 rounded-2xl shadow-none border-none transition-all duration-200 hover:scale-105 active:scale-95">
            <ProfileLightIcon
              className="text-[#010158] group-hover:text-[#FFAE00] text-lg sm:text-xl transition-transform duration-200 group-hover:-translate-y-0.5"
              height="1em"
            />
            <p className="text-[#010158] group-hover:text-[#FFAE00] text-[10px] sm:text-xs font-bold transition-colors">
              Profile
            </p>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Discover;
