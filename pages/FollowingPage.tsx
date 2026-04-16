import React, { useState, useEffect } from "react";
import { View, Text, Image, TouchableOpacity, TextInput, StyleSheet, ScrollView } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getFollowing, followUser, cancelFollowRequest, unfollowUser } from "../services/api";
import { useThemeColors } from "../hooks/useThemeColors";
import FollowButton from "../components/FollowButton";

interface FollowingUser {
    id: number;
    username: string;
    profile_picture?: string;
    is_following: boolean;
    is_request_active: boolean;
    is_private?: boolean;
    follow_status?: string;
}

// ── Following Row ──────────────────────────────────────────────────────────────
function FollowingRow({
    user,
    currentUserId,
    onFollowChange,
    colors,
}: {
    user: FollowingUser;
    currentUserId?: number;
    onFollowChange: (userId: number, following: boolean, requestActive: boolean) => void;
    colors: any;
}) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const isOwnProfile = currentUserId === user.id;

    const handleFollow = async () => {
        if (!currentUserId) return;
        setLoading(true);
        try {
            const res = await followUser(currentUserId.toString(), user.id.toString());
            if (res?.success) onFollowChange(user.id, true, true);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleCancelRequest = async () => {
        if (!currentUserId) return;
        setLoading(true);
        try {
            const res = await cancelFollowRequest(currentUserId.toString(), user.id.toString());
            if (res?.success) onFollowChange(user.id, false, false);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleUnfollow = async () => {
        if (!currentUserId) return;
        setLoading(true);
        try {
            const res = await unfollowUser(currentUserId.toString(), user.id.toString());
            if (res?.success) onFollowChange(user.id, false, false);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.rowWrap}>
            <TouchableOpacity onPress={() => router.push(`/profile/${user.id}`)} style={styles.rowLeft} activeOpacity={0.7}>
                <Image
                    source={user.profile_picture ? { uri: user.profile_picture } : require("../assets/profile_blank.png")}
                    style={[styles.rowAvatar, { borderColor: colors.border }]}
                />
                <Text style={[styles.rowUsername, { color: colors.textPrimary }]} numberOfLines={1}>
                    {user.username}
                </Text>
            </TouchableOpacity>

            {!isOwnProfile && !!currentUserId && (
                <View style={styles.rowRight}>
                    <FollowButton
                        isFollowing={user.is_following}
                        profileData={user}
                        followButtonLoading={loading}
                        handleFollow={handleFollow}
                        handleCancelRequest={handleCancelRequest}
                        handleUnfollow={handleUnfollow}
                    />
                </View>
            )}
        </View>
    );
}

// ── Skeleton ───────────────────────────────────────────────────────────────────
function SkeletonRow({ colors }: { colors: any }) {
    return (
        <View style={styles.rowWrap}>
            <View style={styles.rowLeft}>
                <View style={[styles.skeletonAvatar, { backgroundColor: colors.hover }]} />
                <View style={[styles.skeletonLine, { backgroundColor: colors.hover }]} />
            </View>
            <View style={[styles.skeletonBtn, { backgroundColor: colors.hover }]} />
        </View>
    );
}

// ── Page ───────────────────────────────────────────────────────────────────────
const FollowingPage = () => {
    const colors = useThemeColors();
    const router = useRouter();
    const { userId } = useLocalSearchParams<{ userId: string }>();

    const [currentUser, setCurrentUser] = useState<any>(null);
    const [following, setFollowing] = useState<FollowingUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [username, setUsername] = useState("");

    const insets = useSafeAreaInsets();

    useEffect(() => {
        AsyncStorage.getItem("user").then((raw) => {
            if (raw) setCurrentUser(JSON.parse(raw));
        });
    }, []);

    useEffect(() => {
        const fetch = async () => {
            if (!userId) return;
            try {
                setLoading(true);
                const res = await getFollowing(userId);
                setFollowing(res.data.following || []);
                setUsername(res.data.username || "");
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        fetch();
    }, [userId]);

    const filtered = following.filter((u) => u.username.toLowerCase().includes(search.toLowerCase()));

    const handleFollowChange = (uid: number, isFollowing: boolean, requestActive: boolean) => {
        setFollowing((prev) => prev.map((u) => (u.id === uid ? { ...u, is_following: isFollowing, is_request_active: requestActive } : u)));
    };

    return (
        <SafeAreaView style={[styles.root, { backgroundColor: colors.bg, marginTop: -insets.top }]} edges={["top"]}>
            {/* ── Header ── */}
            <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
                <TouchableOpacity onPress={() => router.back()} style={[styles.backBtn, { borderColor: colors.border }]} activeOpacity={0.7}>
                    <Ionicons name="arrow-back" size={17} color={colors.textSecondary} />
                </TouchableOpacity>
                <View>
                    <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Following</Text>
                    {!!username && <Text style={[styles.headerSub, { color: colors.textDisabled }]}>@{username}</Text>}
                </View>
            </View>

            <View style={styles.body}>
                {/* ── Search ── */}
                <View style={[styles.searchRow, { backgroundColor: colors.hover, borderColor: colors.border }]}>
                    <Ionicons name="search-outline" size={17} color={colors.textDisabled} />
                    <TextInput
                        style={[styles.searchInput, { color: colors.textPrimary }]}
                        placeholder="Search following…"
                        placeholderTextColor={colors.textDisabled}
                        value={search}
                        onChangeText={setSearch}
                        autoCapitalize="none"
                    />
                    {!!search && (
                        <TouchableOpacity onPress={() => setSearch("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <Ionicons name="close-circle" size={15} color={colors.textDisabled} />
                        </TouchableOpacity>
                    )}
                </View>

                {/* ── Count ── */}
                {!loading && (
                    <Text style={[styles.countLabel, { color: colors.textDisabled }]}>
                        {filtered.length} {filtered.length === 1 ? "PERSON" : "PEOPLE"}
                    </Text>
                )}

                {/* ── List ── */}
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
                    {loading ? (
                        Array(6)
                            .fill(0)
                            .map((_, i) => <SkeletonRow key={i} colors={colors} />)
                    ) : filtered.length === 0 ? (
                        <View style={styles.emptyState}>
                            <View style={[styles.emptyIcon, { backgroundColor: colors.hover, borderColor: colors.border }]}>
                                <Ionicons name="person-outline" size={26} color={colors.textDisabled} />
                            </View>
                            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
                                {search ? "No results found" : "Not following anyone yet"}
                            </Text>
                            <Text style={[styles.emptySub, { color: colors.textDisabled }]}>
                                {search ? "Try a different search" : "Accounts this user follows will appear here"}
                            </Text>
                        </View>
                    ) : (
                        filtered.map((user) => (
                            <FollowingRow
                                key={user.id}
                                user={user}
                                currentUserId={currentUser?.id}
                                onFollowChange={handleFollowChange}
                                colors={colors}
                            />
                        ))
                    )}
                </ScrollView>
            </View>
        </SafeAreaView>
    );
};

export default FollowingPage;

// ── Styles ─────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    root: { flex: 1 },

    header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
    backBtn: { width: 34, height: 34, borderRadius: 9, borderWidth: 1, alignItems: "center", justifyContent: "center" },
    headerTitle: { fontWeight: "500", fontSize: 16, lineHeight: 22 },
    headerSub: { fontSize: 12, marginTop: 1 },

    body: { flex: 1, paddingHorizontal: 16, paddingTop: 14 },

    searchRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingHorizontal: 12,
        paddingVertical: 9,
        borderRadius: 10,
        borderWidth: 1,
        marginBottom: 12,
    },
    searchInput: { flex: 1, fontSize: 14 },

    countLabel: { fontSize: 11, fontWeight: "500", letterSpacing: 1, marginBottom: 8 },

    rowWrap: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10, paddingHorizontal: 4 },
    rowLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1, minWidth: 0 },
    rowAvatar: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, flexShrink: 0 },
    rowUsername: { fontWeight: "500", fontSize: 14, flex: 1 },
    rowRight: { flexShrink: 0, marginLeft: 12 },

    skeletonAvatar: { width: 40, height: 40, borderRadius: 20 },
    skeletonLine: { height: 13, borderRadius: 6, width: 120 },
    skeletonBtn: { width: 68, height: 30, borderRadius: 9 },

    emptyState: { alignItems: "center", paddingVertical: 64, gap: 12 },
    emptyIcon: { width: 56, height: 56, borderRadius: 16, borderWidth: 1, alignItems: "center", justifyContent: "center" },
    emptyTitle: { fontWeight: "500", fontSize: 15 },
    emptySub: { fontSize: 13, textAlign: "center", lineHeight: 20, maxWidth: 260 },
});
