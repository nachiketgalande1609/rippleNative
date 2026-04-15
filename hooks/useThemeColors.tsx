// hooks/useThemeColors.ts
import { useColorScheme } from "react-native";
import { useGlobalStore } from "../store/store";

export function useThemeColors() {
    const scheme = useColorScheme();
    const user = useGlobalStore((s) => s.user);

    // User's saved preference wins over OS scheme
    const dark = user?.theme ? user.theme === "dark" : scheme === "dark";

    return {
        bg:            dark ? "#0d0d0d"  : "#f7f7f8",
        surface:       dark ? "#1a1a1a"  : "#ffffff",
        border:        dark ? "#2a2a2a"  : "#ebebeb",
        hover:         dark ? "#252525"  : "#f0f0f0",
        selected:      dark ? "#2e2e2e"  : "#e8e8e8",
        textPrimary:   dark ? "#f0f0f0"  : "#111111",
        textSecondary: dark ? "#999999"  : "#666666",
        textDisabled:  dark ? "#555555"  : "#aaaaaa",
        error:  "#e53935",
        accent: "#7c5cfc",
        isDark: dark,
    };
}