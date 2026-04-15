import React from "react";
import {
    View, Text, TouchableOpacity, StyleSheet, ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useThemeColors } from "../../hooks/useThemeColors";
import ProfileDetails from "./ProfileDetails";
import AccountPrivacy from "./AccountPrivacy";
import General from "./General";
import NotificationsSettings from "./NotificationSettings";

const ACCENT = "#7c5cfc";

const menuItems = [
    { label: "Profile Details", icon: "person-outline", key: "profiledetails" },
    { label: "General",         icon: "settings-outline",   key: "general" },
    { label: "Account Privacy", icon: "lock-closed-outline", key: "accountprivacy" },
    { label: "Notifications",   icon: "notifications-outline", key: "notifications" },
    { label: "Blocked",         icon: "ban-outline",         key: "blocked" },
    { label: "Comments",        icon: "chatbubble-outline",  key: "comments" },
] as const;

type SettingKey = typeof menuItems[number]["key"];

export default function SettingsPage() {
    const colors = useThemeColors();
    const router = useRouter();
    const { setting } = useLocalSearchParams<{ setting?: string }>();

    const activeItem = menuItems.find((m) => m.key === setting);

    const renderContent = () => {
        if (setting === "profiledetails") return <ProfileDetails />;
        if (setting === "accountprivacy") return <AccountPrivacy />;
        if (setting === "general") return <General />;
        if (setting === "notifications") return <NotificationsSettings />;
        return null;
    };

    // ── Detail screen ──────────────────────────────────────────────────────
    if (setting && activeItem) {
        return (
            <SafeAreaView style={[styles.root, { backgroundColor: colors.bg }]} edges={[]}>
                {/* Top bar */}
                <View style={[styles.detailBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
                    <TouchableOpacity
                        onPress={() => router.back()}
                        style={[styles.backBtn, { backgroundColor: colors.hover, borderColor: colors.border }]}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="arrow-back" size={17} color={colors.textSecondary} />
                    </TouchableOpacity>
                    <Text style={[styles.detailTitle, { color: colors.textPrimary }]}>{activeItem.label}</Text>
                    <View style={{ width: 36 }} />
                </View>
                <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
                    {renderContent()}
                </ScrollView>
            </SafeAreaView>
        );
    }

    // ── Menu screen ────────────────────────────────────────────────────────
    return (
        <SafeAreaView style={[styles.root, { backgroundColor: colors.bg }]} edges={[]}>
            {/* Header */}
            <View style={[styles.menuHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
                <Text style={[styles.menuTitle, { color: colors.textPrimary }]}>Settings</Text>
                <Text style={[styles.menuSub, { color: colors.textSecondary }]}>Manage your account</Text>
            </View>

            <ScrollView contentContainerStyle={styles.menuList} showsVerticalScrollIndicator={false}>
                {menuItems.map((item) => (
                    <TouchableOpacity
                        key={item.key}
                        onPress={() => router.push(`/settings?setting=${item.key}`)}
                        activeOpacity={0.7}
                        style={[styles.menuItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
                    >
                        <View style={[styles.menuItemIcon, { backgroundColor: colors.hover, borderColor: colors.border }]}>
                            <Ionicons name={item.icon as any} size={17} color={colors.textSecondary} />
                        </View>
                        <Text style={[styles.menuItemLabel, { color: colors.textPrimary }]}>{item.label}</Text>
                        <Ionicons name="chevron-forward" size={15} color={colors.textDisabled} />
                    </TouchableOpacity>
                ))}

                {/* Footer */}
                <Text style={[styles.version, { color: colors.textDisabled }]}>v2.4.1</Text>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1 },

    // Detail view
    detailBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", height: 54, paddingHorizontal: 12, borderBottomWidth: 1 },
    backBtn: { width: 36, height: 36, borderRadius: 9, borderWidth: 1, alignItems: "center", justifyContent: "center" },
    detailTitle: { fontWeight: "600", fontSize: 15, letterSpacing: -0.2 },

    // Menu view
    menuHeader: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 18, borderBottomWidth: 1 },
    menuTitle: { fontWeight: "700", fontSize: 22, letterSpacing: -0.5 },
    menuSub: { fontSize: 12, marginTop: 3, letterSpacing: 0.2 },

    menuList: { padding: 16, gap: 10 },
    menuItem: { flexDirection: "row", alignItems: "center", gap: 14, padding: 14, borderRadius: 14, borderWidth: 1 },
    menuItemIcon: { width: 36, height: 36, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" },
    menuItemLabel: { flex: 1, fontSize: 15, fontWeight: "400", letterSpacing: -0.1 },

    version: { fontSize: 11, letterSpacing: 0.3, textAlign: "center", marginTop: 8, paddingBottom: 20 },
});