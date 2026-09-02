import React, { useState, useEffect } from "react";
import { FiHome, FiPackage, FiBarChart2, FiUser } from "react-icons/fi";
import { useNavigation } from "../context/NavigationContext.jsx";

const BottomBar = () => {
  const { activeTab, navigateToTab, setAssetType, refreshAssets, isBottomBarHidden } = useNavigation();
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    const handleMouseMove = (e) => {
      const windowHeight = window.innerHeight;
      const threshold = 100; // Show when cursor is within 100px of bottom
      if (windowHeight - e.clientY < threshold) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY < lastScrollY) {
        setIsVisible(true); // Show on scroll up
      } else if (currentScrollY > 50 && currentScrollY > lastScrollY) {
        setIsVisible(false); // Hide on scroll down
      }
      setLastScrollY(currentScrollY);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("scroll", handleScroll);
    
    // For mobile touch
    const handleTouchStart = (e) => {
        const touchY = e.touches[0].clientY;
        const windowHeight = window.innerHeight;
        if (windowHeight - touchY < 80) {
            setIsVisible(true);
        }
    };

    window.addEventListener("touchstart", handleTouchStart);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("touchstart", handleTouchStart);
    };
  }, [lastScrollY]);

  const navItems = [
    { id: "dashboard", icon: FiHome, label: "Dashboard" },
    { id: "assets", icon: FiPackage, label: "Assets" },
    { id: "analysis", icon: FiBarChart2, label: "Analysis" },
    { id: "profile", icon: FiUser, label: "Profile" },
  ];

  return (
    <div
      className={`fixed bottom-0 left-0 w-full z-50 transition-all duration-500 ease-in-out ${
        isVisible && !isBottomBarHidden ? "opacity-100 translate-y-0" : "opacity-0 translate-y-full pointer-events-none"
      }`}
    >
      <div className="flex items-center justify-around p-2 pb-4 bg-gray-900/80 backdrop-blur-xl border-t border-white/10 shadow-2xl">
        {navItems.map(({ id, icon: Icon, label }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => {
                if (id === "assets" && activeTab === "assets") {
                  setAssetType(null);
                  refreshAssets();
                } else {
                  navigateToTab(id);
                }
              }}
              className={`relative flex flex-col items-center justify-center py-1 px-3 transition-all duration-300 group ${
                isActive 
                  ? "text-white" 
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
              <span className={`text-[10px] mt-1 font-medium ${isActive ? "text-white" : "text-gray-400"}`}>
                {label}
              </span>

              {/* Active Indicator Dot */}
              {isActive && (
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-white rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default BottomBar;
