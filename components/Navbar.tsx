import React, { useState, useEffect, useRef, useCallback } from "react";
import { View, Text, TouchableOpacity, Modal, StyleSheet, Animated, Pressable, Image, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useRouter, usePathname } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import socket from "../services/socket";
import { useThemeColors } from "../hooks/useThemeColors";
import CreatePostModal from "../components/CreatePostModal";

const ACCENT = "#7c5cfc";
const TOAST_DURATION = 6000;

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

interface MessagePreview {
    senderId: number;
    senderUsername: string;
    senderProfilePicture: string | null;
    messageText: string;
}

interface ToastItem {
    id: number;
    preview: MessagePreview;
    hiding: boolean;
    version: number;
}

// ── useToastStack ──────────────────────────────────────────────────────────────
function useToastStack() {
    const [toasts, setToasts] = useState<ToastItem[]>([]);
    const timerMap = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
    const idRef = useRef(0);

    const scheduleRemove = useCallback((id: number) => {
        const existing = timerMap.current.get(id);
        if (existing) clearTimeout(existing);

        const hideTimer = setTimeout(() => {
            setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, hiding: true } : t)));
            const removeTimer = setTimeout(() => {
                setToasts((prev) => prev.filter((t) => t.id !== id));
                timerMap.current.delete(id);
            }, 300);
            timerMap.current.set(id, removeTimer);
        }, TOAST_DURATION);

        timerMap.current.set(id, hideTimer);
    }, []);

    const push = useCallback(
        (preview: MessagePreview) => {
            setToasts((prev) => {
                const existingIdx = prev.findIndex((t) => t.preview.senderId === preview.senderId);
                if (existingIdx !== -1) {
                    const existing = prev[existingIdx];
                    scheduleRemove(existing.id);
                    const next = [...prev];
                    next[existingIdx] = {
                        ...existing,
                        preview: { ...preview },
                        hiding: false,
                        version: existing.version + 1,
                    };
                    return next;
                }
                const id = ++idRef.current;
                scheduleRemove(id);
                return [...prev, { id, preview, hiding: false, version: 0 }];
            });
        },
        [scheduleRemove],
    );

    const dismiss = useCallback((id: number) => {
        const existing = timerMap.current.get(id);
        if (existing) clearTimeout(existing);
        setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, hiding: true } : t)));
        const t = setTimeout(() => {
            setToasts((prev) => prev.filter((toast) => toast.id !== id));
            timerMap.current.delete(id);
        }, 300);
        timerMap.current.set(id, t);
    }, []);

    const dismissAll = useCallback(() => {
        timerMap.current.forEach((t) => clearTimeout(t));
        timerMap.current.clear();
        setToasts([]);
    }, []);

    useEffect(
        () => () => {
            timerMap.current.forEach((t) => clearTimeout(t));
        },
        [],
    );

    return { toasts, push, dismiss, dismissAll };
}

// ── Toast Banner ───────────────────────────────────────────────────────────────
function ToastBanner({
    toast,
    onDismiss,
    onPress,
    insetTop,
}: {
    toast: ToastItem;
    onDismiss: (id: number) => void;
    onPress: (senderId: number) => void;
    insetTop: number;
}) {
    const colors = useThemeColors();
    const opacity = useRef(new Animated.Value(0)).current;
    const translateY = useRef(new Animated.Value(-20)).current;
    const progress = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(opacity, {
                toValue: 1,
                duration: 220,
                useNativeDriver: true,
            }),
            Animated.timing(translateY, {
                toValue: 0,
                duration: 280,
                useNativeDriver: true,
            }),
        ]).start();
        Animated.timing(progress, {
            toValue: 0,
            duration: TOAST_DURATION,
            useNativeDriver: false,
        }).start();
    }, [toast.version]);

    useEffect(() => {
        if (toast.hiding) {
            Animated.parallel([
                Animated.timing(opacity, {
                    toValue: 0,
                    duration: 200,
                    useNativeDriver: true,
                }),
                Animated.timing(translateY, {
                    toValue: -20,
                    duration: 220,
                    useNativeDriver: true,
                }),
            ]).start();
        }
    }, [toast.hiding]);

    return (
        <Animated.View
            style={[
                styles.toastBanner,
                {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    top: insetTop + 8,
                    opacity,
                    transform: [{ translateY }],
                },
            ]}
        >
            <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                    onDismiss(toast.id);
                    onPress(toast.preview.senderId);
                }}
                style={styles.toastInner}
            >
                <View style={{ position: "relative" }}>
                    <Image
                        source={
                            toast.preview.senderProfilePicture ? { uri: toast.preview.senderProfilePicture } : require("../assets/profile_blank.png")
                        }
                        style={styles.toastAvatar}
                    />
                    <View style={styles.toastOnlineDot} />
                </View>

                <View style={{ flex: 1 }}>
                    <Text style={[styles.toastUsername, { color: colors.textPrimary }]} numberOfLines={1}>
                        {toast.preview.senderUsername}
                    </Text>
                    <Text style={[styles.toastMessage, { color: colors.textSecondary }]} numberOfLines={1}>
                        {toast.preview.messageText || "Sent you a message"}
                    </Text>
                </View>

                <TouchableOpacity onPress={() => onDismiss(toast.id)} style={styles.toastClose}>
                    <Ionicons name="close" size={14} color={colors.textDisabled} />
                </TouchableOpacity>
            </TouchableOpacity>

            {/* Progress bar */}
            <Animated.View
                style={[
                    styles.toastProgress,
                    {
                        width: progress.interpolate({
                            inputRange: [0, 1],
                            outputRange: ["0%", "100%"],
                        }),
                    },
                ]}
            />
        </Animated.View>
    );
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

    const { toasts, push, dismiss, dismissAll } = useToastStack();

    // Load user
    useEffect(() => {
        AsyncStorage.getItem("user").then((raw) => {
            if (raw) setCurrentUser(JSON.parse(raw));
        });
    }, []);

    // Hide on auth screens
    const hideBar = ["/login", "/register", "/reset-password", "/verify-email"].includes(pathname);

    // Dismiss toasts when navigating to messages
    useEffect(() => {
        if (pathname.startsWith("/messages")) dismissAll();
    }, [pathname, dismissAll]);

    // Socket: unread messages + toast preview
    useEffect(() => {
        const handler = (data: any) => {
            setUnreadMessagesCount(data.unreadCount);
            if (data.preview && !pathname.startsWith("/messages")) {
                push(data.preview);
            }
        };
        socket.on("unreadMessagesCount", handler);
        return () => {
            socket.off("unreadMessagesCount", handler);
        };
    }, [push, pathname]);

    const handleNavigateToChat = useCallback(
        (senderId: number) => {
            dismissAll();
            router.push(`/messages/${senderId}`);
        },
        [dismissAll, router],
    );

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
                <View>
                    <Ionicons
                        name={(active ? item.activeIcon : item.icon) as any}
                        size={26} // ← was 24
                        color={active ? colors.textPrimary : colors.textDisabled}
                    />
                    {!!badge && (
                        <View style={styles.badge}>
                            <Text style={styles.badgeText}>{badge > 99 ? "99+" : badge}</Text>
                        </View>
                    )}
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <>
            {toasts.slice(-1).map((toast) => (
                <ToastBanner key={toast.id} toast={toast} onDismiss={dismiss} onPress={handleNavigateToChat} insetTop={insets.top} />
            ))}

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
                    <Image
                        source={currentUser?.profile_picture_url ? { uri: currentUser.profile_picture_url } : require("../assets/profile_blank.png")}
                        style={[styles.profileAvatar, isActive(`profile/${currentUser?.id}`) && styles.profileAvatarActive]}
                    />
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
