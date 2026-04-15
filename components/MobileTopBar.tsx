// components/navbar/MobileTopBar.tsx
import { useRouter, usePathname } from "expo-router";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors } from "../hooks/useThemeColors";

interface MobileTopBarProps {
  unreadNotificationsCount: number | null;
}

export default function MobileTopBar({
  unreadNotificationsCount,
}: MobileTopBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const colors = useThemeColors();

  const hideBar =
    ["/login", "/register", "/reset-password", "/verify-email"].includes(
      pathname,
    ) || pathname.startsWith("/messages");

  if (hideBar) return null;

  const isActive = pathname === "/notifications";

  return (
    <SafeAreaView
      style={[
        styles.safeArea,
        { backgroundColor: colors.surface, borderBottomColor: colors.border },
      ]}
    >
      <View style={styles.container}>
        <Text style={styles.brandText}>Ripple</Text>
        <TouchableOpacity
          onPress={() => router.push("/notifications")}
          activeOpacity={0.7}
          style={[
            styles.iconBtn,
            { backgroundColor: isActive ? colors.selected : "transparent" },
          ]}
        >
          <Ionicons
            name={isActive ? "heart" : "heart-outline"}
            size={22}
            color={isActive ? colors.textPrimary : colors.textSecondary}
          />
          {!!unreadNotificationsCount && unreadNotificationsCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {unreadNotificationsCount > 99
                  ? "99+"
                  : unreadNotificationsCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    borderBottomWidth: 1,
  },
  container: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  brandText: {
    fontFamily: "MomoSignature", // ← matches the key in useFonts
    fontWeight: "400",
    fontSize: 18, // signature fonts usually need to be larger
    color: "#7c5cfc",
    letterSpacing: 0, // signature fonts don't need letter spacing
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: 2,
    right: 2,
    backgroundColor: "#e53935",
    borderRadius: 8,
    minWidth: 15,
    height: 15,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  badgeText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "600",
  },
});
