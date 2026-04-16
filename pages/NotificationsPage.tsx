import React, { useState, useEffect, useMemo, useRef } from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Animated, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { followUser, getNotifications, respondToFollowRequest } from "../services/api";
import { useGlobalStore } from "../store/store";
import { useThemeColors } from "../hooks/useThemeColors";
import NotificationCard from "../components/NotificationCard";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const ACCENT = "#7c5cfc";

interface Notification {
    id: number;
    type: string;
    message: string;
    post_id: number | null;
    created_at: string;
    sender_id: string;
    username: string;
    profile_picture: string;
    file_url?: string;
    request_status: string;
    requester_id?: number;
    request_id: number;
}

// ── Skeleton ───────────────────────────────────────────────────────────────────
function SkeletonCard({ colors }: { colors: any }) {
    const pulse = useRef(new Animated.Value(1)).current;
    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulse, {
                    toValue: 0.4,
                    duration: 700,
                    useNativeDriver: true,
                }),
                Animated.timing(pulse, {
                    toValue: 1,
                    duration: 700,
                    useNativeDriver: true,
                }),
            ]),
        ).start();
    }, []);

    return (
        <Animated.View
            style={[
                styles.skeletonCard,
                {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    opacity: pulse,
                },
            ]}
        >
            {/* Avatar */}
            <View style={[styles.skeletonAvatar, { backgroundColor: colors.hover }]} />
            {/* Lines */}
            <View style={{ flex: 1, gap: 8 }}>
                <View style={[styles.skeletonLine, { width: "65%", backgroundColor: colors.hover }]} />
                <View style={[styles.skeletonLine, { width: "40%", height: 10, backgroundColor: colors.hover }]} />
            </View>
            {/* Thumb placeholder */}
            <View style={[styles.skeletonThumb, { backgroundColor: colors.hover }]} />
        </Animated.View>
    );
}

// ── Main ───────────────────────────────────────────────────────────────────────
const NotificationsPage = () => {
    const colors = useThemeColors();
    const { unreadNotificationsCount, resetNotificationsCount } = useGlobalStore();
    const insets = useSafeAreaInsets();

    const [currentUser, setCurrentUser] = useState<any>(null);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<0 | 1>(0);
    const [followRequestAcceptLoading, setFollowRequestAcceptLoading] = useState(false);
    const [followRequestRejectLoading, setFollowRequestRejectLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchNotifications();
        setRefreshing(false);
    };

    useEffect(() => {
        AsyncStorage.getItem("user").then((raw) => {
            if (raw) setCurrentUser(JSON.parse(raw));
        });
    }, []);

    const fetchNotifications = async () => {
        if (!currentUser?.id) return;
        try {
            setLoading(true);
            const res = await getNotifications();
            setNotifications(res.data);
        } catch (e) {
            console.error("Error fetching notifications:", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (currentUser?.id) {
            fetchNotifications();
            resetNotificationsCount();
        }
    }, [currentUser?.id, unreadNotificationsCount]);

    const handleFollowBack = async (userId: string) => {
        if (!currentUser?.id || !userId) return;
        try {
            setLoading(true);
            const res = await followUser(currentUser.id.toString(), userId);
            if (res?.success) await fetchNotifications();
        } catch (e) {
            console.error("Failed to follow:", e);
        } finally {
            setLoading(false);
        }
    };

    const handleFollowRequestResponse = async (request_id: number, response: "accepted" | "rejected") => {
        response === "accepted" ? setFollowRequestAcceptLoading(true) : setFollowRequestRejectLoading(true);
        try {
            setLoading(true);
            const res = await respondToFollowRequest(request_id, response);
            if (res?.success) await fetchNotifications();
        } catch (e) {
            console.error(`Failed to ${response} follow request:`, e);
        } finally {
            setLoading(false);
            setFollowRequestAcceptLoading(false);
            setFollowRequestRejectLoading(false);
        }
    };

    const allNotifications = useMemo(
        () => notifications.filter((n) => n.type !== "follow_request" || n.request_status === "accepted"),
        [notifications],
    );
    const followRequests = useMemo(() => notifications.filter((n) => n.type === "follow_request" && n.request_status === "pending"), [notifications]);
    const pendingCount = followRequests.length;
    const visibleNotifications = activeTab === 0 ? allNotifications : followRequests;

    return (
        <SafeAreaView style={[styles.root, { backgroundColor: colors.bg, marginTop: -insets.top }]} edges={["top"]}>
            <View style={styles.inner}>
                {/* ── Header ── */}
                <View style={[styles.header, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.pageTitle, { color: colors.textPrimary }]}>Notifications</Text>
                    {!loading && notifications.length > 0 && (
                        <View style={[styles.totalBadge, { backgroundColor: colors.hover, borderColor: colors.border }]}>
                            <Text style={[styles.totalBadgeText, { color: colors.textDisabled }]}>{notifications.length}</Text>
                        </View>
                    )}
                </View>

                {/* ── Tabs ── */}
                <View style={[styles.tabs, { borderBottomColor: colors.border }]}>
                    {[
                        { label: "All", count: 0 },
                        { label: "Follow Requests", count: pendingCount },
                    ].map((tab, i) => (
                        <TouchableOpacity
                            key={tab.label}
                            onPress={() => setActiveTab(i as 0 | 1)}
                            activeOpacity={0.8}
                            style={[
                                styles.tab,
                                activeTab === i && {
                                    borderBottomWidth: 2,
                                    borderBottomColor: ACCENT,
                                },
                            ]}
                        >
                            <Text
                                style={[
                                    styles.tabLabel,
                                    {
                                        color: activeTab === i ? colors.textPrimary : colors.textDisabled,
                                        fontWeight: activeTab === i ? "600" : "500",
                                    },
                                ]}
                            >
                                {tab.label}
                            </Text>
                            {tab.count > 0 && (
                                <View style={[styles.tabBadge, { backgroundColor: ACCENT }]}>
                                    <Text style={styles.tabBadgeText}>{tab.count}</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    ))}
                </View>

                {/* ── Content ── */}
                <ScrollView
                    style={{ flex: 1 }}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{
                        paddingBottom: 100,
                        paddingTop: 8,
                        paddingHorizontal: 12,
                    }}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT} colors={[ACCENT]} />}
                >
                    {loading ? (
                        Array(6)
                            .fill(0)
                            .map((_, i) => <SkeletonCard key={i} colors={colors} />)
                    ) : visibleNotifications.length === 0 ? (
                        <View style={styles.emptyState}>
                            <View
                                style={[
                                    styles.emptyIconWrap,
                                    {
                                        backgroundColor: colors.surface,
                                        borderColor: colors.border,
                                    },
                                ]}
                            >
                                <Ionicons name={activeTab === 1 ? "people-outline" : "notifications-outline"} size={28} color={colors.textDisabled} />
                            </View>
                            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
                                {activeTab === 1 ? "No follow requests" : "You're all caught up"}
                            </Text>
                            <Text style={[styles.emptySub, { color: colors.textDisabled }]}>
                                {activeTab === 1 ? "New follow requests will appear here" : "New activity will show up here"}
                            </Text>
                        </View>
                    ) : (
                        visibleNotifications.map((notification) => (
                            <NotificationCard
                                key={notification.id}
                                notification={notification}
                                onFollowBack={handleFollowBack}
                                onFollowRequestResponse={handleFollowRequestResponse}
                                followRequestAcceptLoading={followRequestAcceptLoading}
                                followRequestRejectLoading={followRequestRejectLoading}
                            />
                        ))
                    )}
                </ScrollView>
            </View>
        </SafeAreaView>
    );
};

export default NotificationsPage;

const styles = StyleSheet.create({
    root: { flex: 1 },
    inner: { flex: 1 },

    // Header
    header: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 18,
        paddingTop: 16,
        paddingBottom: 12,
        borderBottomWidth: 0.5,
        gap: 10,
    },
    pageTitle: { fontSize: 18, fontWeight: "700", flex: 1, letterSpacing: -0.3 },
    totalBadge: {
        borderRadius: 10,
        borderWidth: 1,
        paddingHorizontal: 8,
        paddingVertical: 2,
    },
    totalBadgeText: { fontSize: 11, fontWeight: "600" },

    // Tabs
    tabs: { flexDirection: "row", borderBottomWidth: 0.5 }, // ← remove paddingHorizontal: 18
    tab: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        paddingVertical: 12,
        borderBottomWidth: 0,
        borderBottomColor: "transparent",
    },
    tabLabel: { fontSize: 14 },
    tabBadge: {
        borderRadius: 9,
        minWidth: 18,
        height: 18,
        paddingHorizontal: 5,
        alignItems: "center",
        justifyContent: "center",
    },
    tabBadgeText: { fontSize: 10.5, fontWeight: "700", color: "#fff" },

    // Skeleton
    skeletonCard: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 13,
        marginBottom: 6,
        borderRadius: 16,
        borderWidth: 1,
    },
    skeletonAvatar: { width: 46, height: 46, borderRadius: 23, flexShrink: 0 },
    skeletonLine: { height: 13, borderRadius: 6 },
    skeletonThumb: { width: 46, height: 46, borderRadius: 10, flexShrink: 0 },

    // Empty
    emptyState: {
        alignItems: "center",
        paddingTop: 80,
        gap: 12,
        paddingHorizontal: 32,
    },
    emptyIconWrap: {
        width: 64,
        height: 64,
        borderRadius: 20,
        borderWidth: 1,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 4,
    },
    emptyTitle: { fontSize: 16, fontWeight: "600" },
    emptySub: { fontSize: 13.5, textAlign: "center", lineHeight: 20 },
});
