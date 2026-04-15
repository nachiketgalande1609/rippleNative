import React, { useState, useEffect } from "react";
import {
    View,
    Text,
    Image,
    TouchableOpacity,
    TextInput,
    Modal,
    StyleSheet,
    ScrollView,
    ActivityIndicator,
    Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
    getFollowers,
    followUser,
    cancelFollowRequest,
    unfollowUser,
    removeFollower,
} from "../services/api";
import { useThemeColors } from "../hooks/useThemeColors";
import FollowButton from "../components/FollowButton";

const ACCENT = "#7c5cfc";

interface FollowerUser {
    id: number;
    username: string;
    profile_picture?: string;
    is_following: boolean;
    is_request_active: boolean;
    is_private?: boolean;
    follow_status?: string;
}

// ── Remove Confirm Modal ───────────────────────────────────────────────────────
function RemoveConfirmModal({
    visible,
    username,
    profilePicture,
    loading,
    onConfirm,
    onCancel,
    colors,
}: {
    visible: boolean;
    username: string;
    profilePicture?: string;
    loading: boolean;
    onConfirm: () => void;
    onCancel: () => void;
    colors: any;
}) {
    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
            <Pressable style={styles.backdrop} onPress={onCancel}>
                <Pressable>
                    <View style={[styles.confirmCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <Image
                            source={
                                profilePicture
                                    ? { uri: profilePicture }
                                    : require("../assets/profile_blank.png")
                            }
                            style={[styles.confirmAvatar, { borderColor: colors.border }]}
                        />
                        <Text style={[styles.confirmTitle, { color: colors.textPrimary }]}>Remove follower?</Text>
                        <Text style={[styles.confirmSub, { color: colors.textSecondary }]}>
                            <Text style={{ fontWeight: "600" }}>@{username}</Text>
                            {" "}will be removed from your followers. They won't be notified.
                        </Text>

                        <TouchableOpacity
                            onPress={onConfirm}
                            disabled={loading}
                            activeOpacity={0.8}
                            style={[styles.confirmRemoveBtn, { opacity: loading ? 0.6 : 1 }]}
                        >
                            <Text style={styles.confirmRemoveText}>{loading ? "Removing…" : "Remove"}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={onCancel}
                            disabled={loading}
                            activeOpacity={0.7}
                            style={[styles.confirmCancelBtn, { borderColor: colors.border }]}
                        >
                            <Text style={[styles.confirmCancelText, { color: colors.textSecondary }]}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

// ── Follower Row ───────────────────────────────────────────────────────────────
function FollowerRow({
    user,
    currentUserId,
    isOwnFollowersList,
    onFollowChange,
    onRemove,
    colors,
}: {
    user: FollowerUser;
    currentUserId?: number;
    isOwnFollowersList: boolean;
    onFollowChange: (userId: number, following: boolean, requestActive: boolean) => void;
    onRemove: (userId: number) => void;
    colors: any;
}) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [removeLoading, setRemoveLoading] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const isOwnProfile = currentUserId === user.id;

    const handleFollow = async () => {
        if (!currentUserId) return;
        setLoading(true);
        try {
            const res = await followUser(currentUserId.toString(), user.id.toString());
            if (res?.success) onFollowChange(user.id, true, true);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const handleCancelRequest = async () => {
        if (!currentUserId) return;
        setLoading(true);
        try {
            const res = await cancelFollowRequest(currentUserId.toString(), user.id.toString());
            if (res?.success) onFollowChange(user.id, false, false);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const handleUnfollow = async () => {
        if (!currentUserId) return;
        setLoading(true);
        try {
            const res = await unfollowUser(currentUserId.toString(), user.id.toString());
            if (res?.success) onFollowChange(user.id, false, false);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const handleConfirmRemove = async () => {
        if (!currentUserId) return;
        setRemoveLoading(true);
        try {
            const res = await removeFollower(user.id.toString(), currentUserId.toString());
            if (res?.success) { setConfirmOpen(false); onRemove(user.id); }
        } catch (e) { console.error(e); }
        finally { setRemoveLoading(false); }
    };

    return (
        <>
            <View style={styles.rowWrap}>
                <TouchableOpacity
                    onPress={() => router.push(`/profile/${user.id}`)}
                    style={styles.rowLeft}
                    activeOpacity={0.7}
                >
                    <Image
                        source={
                            user.profile_picture
                                ? { uri: user.profile_picture }
                                : require("../assets/profile_blank.png")
                        }
                        style={[styles.rowAvatar, { borderColor: colors.border }]}
                    />
                    <Text style={[styles.rowUsername, { color: colors.textPrimary }]} numberOfLines={1}>
                        {user.username}
                    </Text>
                </TouchableOpacity>

                <View style={styles.rowRight}>
                    {isOwnFollowersList && !isOwnProfile && (
                        <TouchableOpacity
                            onPress={() => setConfirmOpen(true)}
                            disabled={removeLoading}
                            activeOpacity={0.7}
                            style={[styles.removeBtn, { borderColor: colors.border }]}
                        >
                            <MaterialIcons name="person-remove" size={13} color={colors.textSecondary} />
                            <Text style={[styles.removeBtnText, { color: colors.textSecondary }]}>Remove</Text>
                        </TouchableOpacity>
                    )}

                    {!isOwnProfile && !!currentUserId && (
                        <FollowButton
                            isFollowing={user.is_following}
                            profileData={user}
                            followButtonLoading={loading}
                            handleFollow={handleFollow}
                            handleCancelRequest={handleCancelRequest}
                            handleUnfollow={handleUnfollow}
                        />
                    )}
                </View>
            </View>

            <RemoveConfirmModal
                visible={confirmOpen}
                username={user.username}
                profilePicture={user.profile_picture}
                loading={removeLoading}
                onConfirm={handleConfirmRemove}
                onCancel={() => setConfirmOpen(false)}
                colors={colors}
            />
        </>
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
const FollowersPage = () => {
    const colors = useThemeColors();
    const router = useRouter();
    const { userId } = useLocalSearchParams<{ userId: string }>();

    const [currentUser, setCurrentUser] = useState<any>(null);
    const [followers, setFollowers] = useState<FollowerUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [username, setUsername] = useState("");

    useEffect(() => {
        AsyncStorage.getItem("user").then((raw) => {
            if (raw) setCurrentUser(JSON.parse(raw));
        });
    }, []);

    const isOwnFollowersList = currentUser?.id?.toString() === userId;

    useEffect(() => {
        const fetch = async () => {
            if (!userId) return;
            try {
                setLoading(true);
                const res = await getFollowers(userId);
                setFollowers(res.data.followers || []);
                setUsername(res.data.username || "");
            } catch (e) { console.error(e); }
            finally { setLoading(false); }
        };
        fetch();
    }, [userId]);

    const filtered = followers.filter((u) =>
        u.username.toLowerCase().includes(search.toLowerCase())
    );

    const handleFollowChange = (uid: number, following: boolean, requestActive: boolean) => {
        setFollowers((prev) =>
            prev.map((u) => u.id === uid ? { ...u, is_following: following, is_request_active: requestActive } : u)
        );
    };

    const handleRemove = (uid: number) => {
        setFollowers((prev) => prev.filter((u) => u.id !== uid));
    };

    return (
        <SafeAreaView style={[styles.root, { backgroundColor: colors.bg }]} edges={["top"]}>
            {/* ── Header ── */}
            <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
                <TouchableOpacity onPress={() => router.back()} style={[styles.backBtn, { borderColor: colors.border }]} activeOpacity={0.7}>
                    <Ionicons name="arrow-back" size={17} color={colors.textSecondary} />
                </TouchableOpacity>
                <View>
                    <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Followers</Text>
                    {!!username && (
                        <Text style={[styles.headerSub, { color: colors.textDisabled }]}>@{username}</Text>
                    )}
                </View>
            </View>

            <View style={styles.body}>
                {/* ── Search ── */}
                <View style={[styles.searchRow, { backgroundColor: colors.hover, borderColor: colors.border }]}>
                    <Ionicons name="search-outline" size={17} color={colors.textDisabled} />
                    <TextInput
                        style={[styles.searchInput, { color: colors.textPrimary }]}
                        placeholder="Search followers…"
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
                        Array(6).fill(0).map((_, i) => <SkeletonRow key={i} colors={colors} />)
                    ) : filtered.length === 0 ? (
                        <View style={styles.emptyState}>
                            <View style={[styles.emptyIcon, { backgroundColor: colors.hover, borderColor: colors.border }]}>
                                <Ionicons name="person-outline" size={26} color={colors.textDisabled} />
                            </View>
                            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
                                {search ? "No results found" : "No followers yet"}
                            </Text>
                            <Text style={[styles.emptySub, { color: colors.textDisabled }]}>
                                {search
                                    ? "Try a different search"
                                    : "When someone follows this account, they'll appear here"}
                            </Text>
                        </View>
                    ) : (
                        filtered.map((user) => (
                            <FollowerRow
                                key={user.id}
                                user={user}
                                currentUserId={currentUser?.id}
                                isOwnFollowersList={isOwnFollowersList}
                                onFollowChange={handleFollowChange}
                                onRemove={handleRemove}
                                colors={colors}
                            />
                        ))
                    )}
                </ScrollView>
            </View>
        </SafeAreaView>
    );
};

export default FollowersPage;

// ── Styles ─────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    root: { flex: 1 },

    // Header
    header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
    backBtn: { width: 34, height: 34, borderRadius: 9, borderWidth: 1, alignItems: "center", justifyContent: "center" },
    headerTitle: { fontWeight: "500", fontSize: 16, lineHeight: 22 },
    headerSub: { fontSize: 12, marginTop: 1 },

    // Body
    body: { flex: 1, paddingHorizontal: 16, paddingTop: 14 },

    // Search
    searchRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, borderWidth: 1, marginBottom: 12 },
    searchInput: { flex: 1, fontSize: 14 },

    // Count
    countLabel: { fontSize: 11, fontWeight: "500", letterSpacing: 1, marginBottom: 8 },

    // Row
    rowWrap: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10, paddingHorizontal: 4 },
    rowLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1, minWidth: 0 },
    rowAvatar: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, flexShrink: 0 },
    rowUsername: { fontWeight: "500", fontSize: 14, flex: 1 },
    rowRight: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 0, marginLeft: 12 },

    // Remove button
    removeBtn: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 6 },
    removeBtnText: { fontSize: 12.5, fontWeight: "500" },

    // Skeleton
    skeletonAvatar: { width: 40, height: 40, borderRadius: 20 },
    skeletonLine: { height: 13, borderRadius: 6, width: 120 },
    skeletonBtn: { width: 68, height: 30, borderRadius: 9 },

    // Empty
    emptyState: { alignItems: "center", paddingVertical: 64, gap: 12 },
    emptyIcon: { width: 56, height: 56, borderRadius: 16, borderWidth: 1, alignItems: "center", justifyContent: "center" },
    emptyTitle: { fontWeight: "500", fontSize: 15 },
    emptySub: { fontSize: 13, textAlign: "center", lineHeight: 20, maxWidth: 260 },

    // Confirm modal
    backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center", padding: 24 },
    confirmCard: { width: 300, borderRadius: 16, borderWidth: 1, padding: 20, alignItems: "center" },
    confirmAvatar: { width: 54, height: 54, borderRadius: 27, borderWidth: 1, marginBottom: 14 },
    confirmTitle: { fontWeight: "500", fontSize: 15, marginBottom: 6 },
    confirmSub: { fontSize: 13, textAlign: "center", lineHeight: 20, marginBottom: 20 },
    confirmRemoveBtn: { width: "100%", paddingVertical: 11, borderRadius: 10, alignItems: "center", backgroundColor: "rgba(229,57,53,0.08)", borderWidth: 1, borderColor: "rgba(229,57,53,0.3)", marginBottom: 8 },
    confirmRemoveText: { color: "#e53935", fontWeight: "500", fontSize: 13.5 },
    confirmCancelBtn: { width: "100%", paddingVertical: 11, borderRadius: 10, alignItems: "center", borderWidth: 1 },
    confirmCancelText: { fontWeight: "500", fontSize: 13.5 },
});