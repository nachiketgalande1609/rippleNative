import React, { useState, useEffect, useRef, useCallback } from "react";
import { View, Text, TouchableOpacity, Modal, StyleSheet, Pressable, Image, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useRouter, usePathname } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import socket from "../services/socket";
import { useThemeColors } from "../hooks/useThemeColors";
import CreatePostModal from "../components/CreatePostModal";
import * as Notifications from "expo-notifications";

const ACCENT = "#7c5cfc";

// ── Types ──────────────────────────────────────────────────────────────────────
interface NavBarProps {
    unreadMessagesCount: number | null;
    unreadNotificationsCount: number | null;
    setUnreadMessagesCount: (count: number) => void;
    onlineUsers?: string[];
    selectedUser?: any;
    setSelectedUser?: (user: any) => void;
    onVideoCall?: (userId: number) => void;
}

// ── Logout Confirm Modal ───────────────────────────────────────────────────────
function LogoutModal({
    visible,
    onCancel,
    onConfirm,
    colors,
}: {
    visible: boolean;
    onCancel: () => void;
    onConfirm: () => void;
    colors: ReturnType<typeof useThemeColors>;
}) {
    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
            <Pressable style={styles.modalBackdrop} onPress={onCancel}>
                <Pressable>
                    <View style={[styles.logoutCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <Text style={[styles.logoutTitle, { color: colors.textPrimary }]}>Log out of Ripple?</Text>
                        <Text style={[styles.logoutSub, { color: colors.textSecondary }]}>You can always log back in.</Text>
                        <View style={styles.logoutBtns}>
                            <TouchableOpacity onPress={onCancel} style={[styles.logoutBtn, { borderColor: colors.border }]} activeOpacity={0.7}>
                                <Text style={[styles.logoutBtnText, { color: colors.textSecondary }]}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={onConfirm}
                                style={[styles.logoutBtn, { backgroundColor: "#e53935", borderColor: "#e53935" }]}
                                activeOpacity={0.8}
                            >
                                <Text style={[styles.logoutBtnText, { color: "#fff" }]}>Log out</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

// ── NavBar ─────────────────────────────────────────────────────────────────────
export default function NavBar({ unreadMessagesCount, unreadNotificationsCount, setUnreadMessagesCount, onVideoCall }: NavBarProps) {
    const colors = useThemeColors();
    const router = useRouter();
    const pathname = usePathname();
    const insets = useSafeAreaInsets();

    const [currentUser, setCurrentUser] = useState<any>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [logoutOpen, setLogoutOpen] = useState(false);

    // Load user
    useEffect(() => {
        AsyncStorage.getItem("user").then((raw) => {
            if (raw) setCurrentUser(JSON.parse(raw));
        });
    }, []);

    // Hide on auth screens
    const hideBar = ["/login", "/register", "/reset-password", "/verify-email"].includes(pathname);

    // Socket: unread messages + toast preview
    useEffect(() => {
        const handler = (data: any) => {
            setUnreadMessagesCount(data.unreadCount);
            if (data.preview && !pathname.startsWith("/messages")) {
                Notifications.scheduleNotificationAsync({
                    content: {
                        title: data.preview.senderUsername,
                        body: data.preview.messageText || "Sent you a message",
                        data: { senderId: data.preview.senderId },
                        sound: true,
                    },
                    trigger: null,
                });
            }
        };
        socket.on("unreadMessagesCount", handler);
        return () => {
            socket.off("unreadMessagesCount", handler);
        };
    }, [pathname]);

    const handleLogout = async () => {
        socket.disconnect();
        await AsyncStorage.multiRemove(["token", "user", "privateKey"]);
        setLogoutOpen(false);
        router.replace("/login");
    };

    const isActive = (segment: string) =>
        segment === "messages" ? pathname.startsWith("/messages") : pathname === `/${segment}` || (segment === "" && pathname === "/");

    if (hideBar) return null;

    // ── Nav items ──
    type NavItemDef = {
        segment: string;
        icon: string;
        activeIcon: string;
        badge?: number | null;
    };

    const loggedInItems: NavItemDef[] = [
        { segment: "", icon: "home-outline", activeIcon: "home" },
        { segment: "search", icon: "search-outline", activeIcon: "search" },
        {
            segment: "messages",
            icon: "chatbubble-outline",
            activeIcon: "chatbubble",
            badge: unreadMessagesCount,
        },
    ];

    const loggedOutItems: NavItemDef[] = [
        { segment: "login", icon: "log-in-outline", activeIcon: "log-in" },
        {
            segment: "register",
            icon: "person-add-outline",
            activeIcon: "person-add",
        },
    ];

    const items = currentUser ? loggedInItems : loggedOutItems;
    const leftItems = currentUser ? items.slice(0, 2) : items;
    const rightItems = currentUser ? items.slice(2) : [];

    const NavBtn = ({ item }: { item: NavItemDef }) => {
        const active = isActive(item.segment);
        const badge = item.badge && item.badge > 0 ? item.badge : null;
        return (
            <TouchableOpacity onPress={() => router.push(item.segment === "" ? "/" : `/${item.segment}`)} style={styles.navBtn} activeOpacity={0.7}>
                <View style={styles.navBtnInner}>
                    <View>
                        <Ionicons
                            name={(active ? item.activeIcon : item.icon) as any}
                            size={26}
                            color={active ? colors.textPrimary : colors.textDisabled}
                        />
                        {!!badge && (
                            <View style={styles.badge}>
                                <Text style={styles.badgeText}>{badge > 99 ? "99+" : badge}</Text>
                            </View>
                        )}
                    </View>
                    {active && <View style={styles.activeDot} />}
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <>
            <View
                style={[
                    styles.navBar,
                    {
                        backgroundColor: colors.surface,
                        borderTopColor: colors.border,
                        paddingBottom: insets.bottom,
                    },
                ]}
            >
                <NavBtn item={{ segment: "home", icon: "home-outline", activeIcon: "home" }} />
                <NavBtn
                    item={{
                        segment: "search",
                        icon: "search-outline",
                        activeIcon: "search",
                    }}
                />

                <TouchableOpacity onPress={() => setModalOpen(true)} style={styles.createBtn} activeOpacity={0.85}>
                    <Ionicons name="add" size={22} color="#fff" />
                </TouchableOpacity>

                <NavBtn
                    item={{
                        segment: "messages",
                        icon: "chatbubble-outline",
                        activeIcon: "chatbubble",
                        badge: unreadMessagesCount,
                    }}
                />

                <TouchableOpacity onPress={() => router.push(`/profile/${currentUser?.id}`)} style={styles.navBtn} activeOpacity={0.7}>
                    <View style={styles.navBtnInner}>
                        <Image
                            source={currentUser?.profile_picture_url ? { uri: currentUser.profile_picture_url } : require("../assets/profile_blank.png")}
                            style={[styles.profileAvatar, isActive(`profile/${currentUser?.id}`) && styles.profileAvatarActive]}
                        />
                        {isActive(`profile/${currentUser?.id}`) && <View style={styles.activeDot} />}
                    </View>
                </TouchableOpacity>
            </View>

            <LogoutModal visible={logoutOpen} onCancel={() => setLogoutOpen(false)} onConfirm={handleLogout} colors={colors} />
            <CreatePostModal open={modalOpen} handleClose={() => setModalOpen(false)} />
        </>
    );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    // Nav bar
    navBar: {
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-around",
        borderTopWidth: 0.5,
        paddingTop: 0,
        paddingHorizontal: 8,
        zIndex: 100,
        height: 62,
    },
    navBtn: {
        alignItems: "center",
        justifyContent: "center",
        width: 44,
        height: 44,
    },
    navBtnInner: {
        alignItems: "center",
        gap: 2,
    },
    activeDot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: ACCENT,
    },
    createBtn: {
        width: 36,
        height: 36,
        borderRadius: 12,
        backgroundColor: ACCENT,
        alignItems: "center",
        justifyContent: "center",
    },
    profileAvatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        borderWidth: 2,
        borderColor: "transparent",
    },
    profileAvatarActive: { borderColor: ACCENT },
    navSide: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-evenly",
    },
    // Badge
    badge: {
        position: "absolute",
        top: -2,
        right: -2,
        backgroundColor: "#e53935",
        borderRadius: 8,
        minWidth: 15,
        height: 15,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 2,
    },
    badgeText: { color: "#fff", fontSize: 9, fontWeight: "600" },
    // Toast banner
    toastBanner: {
        position: "absolute",
        left: 10,
        right: 10,
        zIndex: 1500,
        borderRadius: 14,
        borderWidth: 1,
        overflow: "hidden",
        shadowColor: "#000",
        shadowOpacity: 0.12,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 8,
    },
    toastInner: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    toastAvatar: { width: 38, height: 38, borderRadius: 19 },
    toastOnlineDot: {
        position: "absolute",
        bottom: 0,
        right: 0,
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: ACCENT,
        borderWidth: 2,
        borderColor: "#fff",
    },
    toastUsername: { fontWeight: "600", fontSize: 13, lineHeight: 18 },
    toastMessage: { fontSize: 12.5, lineHeight: 18 },
    toastClose: { padding: 4 },
    toastProgress: {
        height: 2,
        backgroundColor: ACCENT,
        position: "absolute",
        bottom: 0,
        left: 0,
    },

    // Logout modal
    modalBackdrop: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.4)",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
    },
    logoutCard: { width: 300, borderRadius: 16, borderWidth: 1, padding: 20 },
    logoutTitle: { fontWeight: "500", fontSize: 15, marginBottom: 6 },
    logoutSub: { fontSize: 13, marginBottom: 20 },
    logoutBtns: { flexDirection: "row", gap: 8 },
    logoutBtn: {
        flex: 1,
        borderWidth: 1,
        borderRadius: 10,
        paddingVertical: 10,
        alignItems: "center",
    },
    logoutBtnText: { fontWeight: "500", fontSize: 14 },
});
