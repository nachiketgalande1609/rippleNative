import React, { useState, useEffect, useMemo } from "react";
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { followUser, getNotifications, respondToFollowRequest } from "../services/api";
import { useGlobalStore } from "../store/store";
import { useThemeColors } from "../hooks/useThemeColors";
import NotificationCard from "../components/NotificationCard";

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
function NotificationSkeleton({ colors }: { colors: any }) {
    return (
        <View style={[styles.skeletonCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.skeletonAvatar, { backgroundColor: colors.hover }]} />
            <View style={{ flex: 1, gap: 7 }}>
                <View style={[styles.skeletonLine, { width: "60%", backgroundColor: colors.hover }]} />
                <View style={[styles.skeletonLine, { width: "30%", height: 10, backgroundColor: colors.hover }]} />
            </View>
        </View>
    );
}

// ── Main ───────────────────────────────────────────────────────────────────────
const NotificationsPage = () => {
    const colors = useThemeColors();
    const { unreadNotificationsCount, resetNotificationsCount } = useGlobalStore();

    const [currentUser, setCurrentUser] = useState<any>(null);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<0 | 1>(0);
    const [followRequestAcceptLoading, setFollowRequestAcceptLoading] = useState(false);
    const [followRequestRejectLoading, setFollowRequestRejectLoading] = useState(false);

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
        [notifications]
    );

    const followRequests = useMemo(
        () => notifications.filter((n) => n.type === "follow_request" && n.request_status === "pending"),
        [notifications]
    );

    const pendingRequestCount = followRequests.filter((n) => n.request_status === "pending").length;
    const visibleNotifications = activeTab === 0 ? allNotifications : followRequests;

    return (
        <SafeAreaView style={[styles.root, { backgroundColor: colors.bg }]} edges={["top"]}>
            <View style={styles.inner}>
                {/* Header */}
                <Text style={[styles.pageTitle, { color: colors.textPrimary }]}>Notifications</Text>

                {/* Tabs */}
                <View style={[styles.tabs, { borderBottomColor: colors.border }]}>
                    <TouchableOpacity
                        onPress={() => setActiveTab(0)}
                        activeOpacity={0.8}
                        style={[styles.tab, activeTab === 0 && { borderBottomWidth: 2, borderBottomColor: colors.textPrimary }]}
                    >
                        <Text style={[styles.tabLabel, { color: activeTab === 0 ? colors.textPrimary : colors.textDisabled, fontWeight: activeTab === 0 ? "600" : "500" }]}>
                            All
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => setActiveTab(1)}
                        activeOpacity={0.8}
                        style={[styles.tab, activeTab === 1 && { borderBottomWidth: 2, borderBottomColor: colors.textPrimary }]}
                    >
                        <View style={styles.tabInner}>
                            <Text style={[styles.tabLabel, { color: activeTab === 1 ? colors.textPrimary : colors.textDisabled, fontWeight: activeTab === 1 ? "600" : "500" }]}>
                                Follow Requests
                            </Text>
                            {pendingRequestCount > 0 && (
                                <View style={[styles.badge, { backgroundColor: colors.textPrimary }]}>
                                    <Text style={[styles.badgeText, { color: colors.bg }]}>{pendingRequestCount}</Text>
                                </View>
                            )}
                        </View>
                    </TouchableOpacity>
                </View>

                {/* Content */}
                <ScrollView
                    style={{ flex: 1 }}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 100, paddingTop: 4 }}
                >
                    {loading ? (
                        Array(5).fill(0).map((_, i) => <NotificationSkeleton key={i} colors={colors} />)
                    ) : visibleNotifications.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyEmoji}>{activeTab === 1 ? "👥" : "🔔"}</Text>
                            <Text style={[styles.emptyText, { color: colors.textDisabled }]}>
                                {activeTab === 1 ? "No follow requests" : "You're all caught up"}
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
    inner: { flex: 1, paddingHorizontal: 14, paddingTop: 20 },

    pageTitle: { fontSize: 17, fontWeight: "600", marginBottom: 16, paddingHorizontal: 2 },

    // Tabs
    tabs: { flexDirection: "row", borderBottomWidth: 1, marginBottom: 12 },
    tab: { marginRight: 24, paddingBottom: 10, borderBottomWidth: 0, borderBottomColor: "transparent" },
    tabInner: { flexDirection: "row", alignItems: "center", gap: 8 },
    tabLabel: { fontSize: 14 },
    badge: { borderRadius: 9, minWidth: 18, height: 18, paddingHorizontal: 5, alignItems: "center", justifyContent: "center" },
    badgeText: { fontSize: 10.5, fontWeight: "700" },

    // Skeleton
    skeletonCard: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 14, marginBottom: 8, borderRadius: 14, borderWidth: 1 },
    skeletonAvatar: { width: 48, height: 48, borderRadius: 24, flexShrink: 0 },
    skeletonLine: { height: 13, borderRadius: 6 },

    // Empty
    emptyState: { marginTop: 64, alignItems: "center", gap: 10 },
    emptyEmoji: { fontSize: 36 },
    emptyText: { fontSize: 14.5 },
});