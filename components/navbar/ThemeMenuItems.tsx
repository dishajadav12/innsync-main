"use client";

import { useTheme } from "next-themes";
import { LuSun, LuMoon, LuMonitor } from "react-icons/lu";

const THEME_OPTIONS = [
  { label: "Light",  value: "light",  Icon: LuSun     },
  { label: "Dark",   value: "dark",   Icon: LuMoon    },
  { label: "System", value: "system", Icon: LuMonitor },
] as const;

// Shown only on mobile (md:hidden) — desktop has a dedicated DarkMode toggle in the navbar.
function ThemeMenuItems() {
  const { setTheme } = useTheme();

  return (
    <>
      <div className="my-2 border-t md:hidden" />
      {THEME_OPTIONS.map(({ label, value, Icon }) => (
        <button
          key={value}
          onClick={() => setTheme(value)}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-md text-sm font-medium hover:bg-muted transition-colors md:hidden"
        >
          <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
          Theme: {label}
        </button>
      ))}
    </>
  );
}

export default ThemeMenuItems;
