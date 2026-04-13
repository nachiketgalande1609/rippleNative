import React, { useState, useEffect, useCallback } from "react";
import {
    View,
    Text,
    Image,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    FlatList,
    ActivityIndicator,
    Dimensions,
    Linking,
    Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
    getProfile,
    getUserPosts,
    followUser,
    cancelFollowRequest,
    getSavedPosts,
    unfollowUser,
} from "../services/api";
import { useGlobalStore } from "../store/store";
import { useThemeColors } from "../hooks/useThemeColors";
import FollowButton from "../components/FollowButton";
import MoreOptionsDialog from "../components/MoreOptionsDialog";
import CreatePostModal from "../components/CreatePostModal";

const { width: SW } = Dimensions.get("window");
const CELL = (SW - 3) / 3; // 3-col grid with 1.5px gaps

interface Profile {
    id?: number;
    username: string;
    email: string;
    bio?: string;
    profile_picture?: string;
    followers_count: number;
    following_count: number;
    posts_count: number;
    is_request_active: boolean;
    follow_status: string;
    is_following: boolean;
    is_private: boolean;
    is_verified?: boolean;
    website?: string;
    location?: string;
    created_at?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function formatCount(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return String(n);
}

function formatDate(d?: string) {
    if (!d) return "";
    return new Date(d).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

// ── Stat Box ───────────────────────────────────────────────────────────────────
function StatBox({ value, label, onPress }: { value: number; label: string; onPress?: () => void }) {
    const colors = useThemeColors();
    return (
        <TouchableOpacity onPress={onPress} activeOpacity={onPress ? 0.7 : 1} style={styles.statBox}>
            <Text style={[styles.statValue, { color: colors.textPrimary }]}>{formatCount(value)}</Text>
            <Text style={[styles.statLabel, { color: colors.textDisabled }]}>{label.toUpperCase()}</Text>
        </TouchableOpacity>
    );
}

// ── Post Cell ──────────────────────────────────────────────────────────────────
function PostCell({ post, onPress }: { post: any; onPress: () => void }) {
    const colors = useThemeColors();
    const isVideo = post.file_url && /\.(mp4|mov|webm)$/i.test(post.file_url);

    return (
        <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={[styles.cell, { backgroundColor: colors.hover }]}>
            {post.file_url ? (
                <Image source={{ uri: post.file_url }} style={styles.cellImage} resizeMode="cover" />
            ) : (
                <View style={[styles.cellImage, { alignItems: "center", justifyContent: "center" }]}>
                    <Ionicons name="camera-outline" size={20} color={colors.textDisabled} />
                </View>
            )}
            {isVideo && (
                <View style={styles.videoIcon}>
                    <Ionicons name="play" size={12} color="#fff" />
                </View>
            )}
            {/* Like/comment overlay */}
            <View style={styles.cellOverlay}>
                <View style={styles.cellStat}>
                    <Ionicons name="heart" size={12} color="#fff" />
                    <Text style={styles.cellStatText}>{post.likes_count || 0}</Text>
                </View>
                <View style={styles.cellStat}>
                    <Ionicons name="chatbubble" size={12} color="#fff" />
                    <Text style={styles.cellStatText}>{post.comments_count || 0}</Text>
                </View>
            </View>
        </TouchableOpacity>
    );
}

// ── Empty State ────────────────────────────────────────────────────────────────
function EmptyState({ icon, title, subtitle, action }: { icon: React.ReactNode; title: string; subtitle: string; action?: React.ReactNode }) {
    const colors = useThemeColors();
    return (
        <View style={styles.emptyState}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.hover, borderColor: colors.border }]}>{icon}</View>
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>{title}</Text>
            <Text style={[styles.emptySub, { color: colors.textSecondary }]}>{subtitle}</Text>
            {action && <View style={{ marginTop: 20 }}>{action}</View>}
        </View>
    );
}

// ── Skeleton ───────────────────────────────────────────────────────────────────
function Skeleton({ width, height, circle = false, style }: { width: number | string; height: number; circle?: boolean; style?: any }) {
    const colors = useThemeColors();
    return (
        <View style={[{ width: width as any, height, borderRadius: circle ? 999 : 8, backgroundColor: colors.hover }, style]} />
    );
}

// ── Main ───────────────────────────────────────────────────────────────────────
const ProfilePage = () => {
    const colors = useThemeColors();
    const router = useRouter();
    const { userId } = useLocalSearchParams<{ userId: string }>();
    const { postUploading } = useGlobalStore();

    const [currentUser, setCurrentUser] = useState<any>(null);
    const [profileData, setProfileData] = useState<Profile | null>(null);
    const [posts, setPosts] = useState<any[]>([]);
    const [savedPosts, setSavedPosts] = useState<any[]>([]);
    const [isFollowing, setIsFollowing] = useState(false);
    const [openDialog, setOpenDialog] = useState(false);
    const [fetchingProfile, setFetchingProfile] = useState(false);
    const [fetchingPosts, setFetchingPosts] = useState(false);
    const [fetchingSaved, setFetchingSaved] = useState(false);
    const [followLoading, setFollowLoading] = useState(false);
    const [tab, setTab] = useState(0);
    const [modalOpen, setModalOpen] = useState(false);

    const isOwnProfile = currentUser?.id == userId;
    const canViewPosts = profileData && (isOwnProfile || !profileData.is_private || profileData.is_following);

    useEffect(() => {
        AsyncStorage.getItem("user").then((raw) => { if (raw) setCurrentUser(JSON.parse(raw)); });
    }, []);

    const fetchProfile = useCallback(async () => {
        if (!userId) return;
        try {
            setFetchingProfile(true);
            const res = await getProfile(userId);
            setProfileData(res.data);
            setIsFollowing(res.data.is_following);
        } catch (e) { console.error(e); }
        finally { setFetchingProfile(false); }
    }, [userId]);

    const fetchUserPosts = useCallback(async () => {
        if (!userId) return;
        try {
            setFetchingPosts(true);
            const res = await getUserPosts(userId);
            setPosts(res.data);
        } catch (e) { console.error(e); }
        finally { setFetchingPosts(false); }
    }, [userId]);

    const fetchSaved = useCallback(async () => {
        if (!isOwnProfile) return;
        try {
            setFetchingSaved(true);
            const res = await getSavedPosts();
            setSavedPosts(res.data);
        } catch (e) { console.error(e); }
        finally { setFetchingSaved(false); }
    }, [isOwnProfile]);

    useEffect(() => { fetchProfile(); fetchUserPosts(); }, [userId]);

    useEffect(() => {
        if (!postUploading && canViewPosts) fetchUserPosts();
    }, [postUploading]);

    useEffect(() => {
        if (tab === 1 && isOwnProfile && savedPosts.length === 0) fetchSaved();
    }, [tab, isOwnProfile]);

    const handleFollow = async () => {
        if (!currentUser?.id || !userId) return;
        setFollowLoading(true);
        try {
            const res = await followUser(currentUser.id.toString(), userId);
            if (res?.success) {
                setIsFollowing(true);
                setProfileData((p) => p ? { ...p, is_following: true, is_request_active: true, followers_count: p.followers_count + 1 } : p);
            }
        } catch (e) { console.error(e); }
        finally { setFollowLoading(false); }
    };

    const handleCancelRequest = async () => {
        if (!currentUser?.id || !userId) return;
        setFollowLoading(true);
        try {
            const res = await cancelFollowRequest(currentUser.id, userId);
            if (res?.success) {
                setIsFollowing(false);
                setProfileData((p) => p ? { ...p, is_following: false, is_request_active: false, followers_count: p.followers_count - 1 } : p);
            }
        } catch (e) { console.error(e); }
        finally { setFollowLoading(false); }
    };

    const handleUnfollow = async () => {
        if (!currentUser?.id || !userId) return;
        setFollowLoading(true);
        try {
            const res = await unfollowUser(currentUser.id.toString(), userId);
            if (res?.success) {
                setIsFollowing(false);
                setProfileData((p) => p ? { ...p, is_following: false, is_request_active: false, followers_count: p.followers_count - 1 } : p);
            }
        } catch (e) { console.error(e); }
        finally { setFollowLoading(false); }
    };

    // ── Loading ──
    if (fetchingProfile) {
        return (
            <SafeAreaView style={[styles.root, { backgroundColor: colors.bg }]} edges={["top"]}>
                <View style={[styles.topBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
                    </TouchableOpacity>
                </View>
                <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
                    <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
                        <Skeleton width={80} height={80} circle />
                        <View style={{ flex: 1, gap: 8, paddingTop: 8 }}>
                            <Skeleton width="50%" height={16} />
                            <Skeleton width="35%" height={12} />
                            <Skeleton width="70%" height={11} />
                        </View>
                    </View>
                    <Skeleton width="100%" height={48} />
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 1.5 }}>
                        {Array(9).fill(0).map((_, i) => (
                            <Skeleton key={i} width={CELL} height={CELL} style={{ borderRadius: 0 }} />
                        ))}
                    </View>
                </ScrollView>
            </SafeAreaView>
        );
    }

    const activePosts = tab === 0 ? posts : savedPosts;
    const isFetchingActive = tab === 0 ? fetchingPosts : fetchingSaved;

    return (
        <SafeAreaView style={[styles.root, { backgroundColor: colors.bg }]} edges={["top"]}>
            {/* ── Top bar ── */}
            <View style={[styles.topBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
                </TouchableOpacity>
                <View style={styles.topBarCenter}>
                    {profileData?.profile_picture && (
                        <Image source={{ uri: profileData.profile_picture }} style={styles.topBarAvatar} />
                    )}
                    <Text style={[styles.topBarUsername, { color: colors.textPrimary }]} numberOfLines={1}>
                        {profileData?.username}
                    </Text>
                    {profileData?.is_verified && (
                        <Ionicons name="checkmark-circle" size={13} color="#1d9bf0" />
                    )}
                </View>
                <TouchableOpacity onPress={() => setOpenDialog(true)} style={styles.backBtn}>
                    <Ionicons name="ellipsis-horizontal" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
                {/* ── Profile header ── */}
                <View style={[styles.profileHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
                    {/* Avatar row */}
                    <View style={styles.avatarRow}>
                        <View>
                            <Image
                                source={
                                    profileData?.profile_picture
                                        ? { uri: profileData.profile_picture }
                                        : require("../assets/profile_blank.png")
                                }
                                style={[styles.avatar, { borderColor: colors.border }]}
                            />
                            {profileData?.is_verified && (
                                <View style={styles.verifiedBadge}>
                                    <Ionicons name="checkmark-circle" size={16} color="#1d9bf0" />
                                </View>
                            )}
                        </View>

                        {/* Action buttons */}
                        <View style={styles.actionRow}>
                            {!isOwnProfile && currentUser?.id && (
                                <>
                                    <TouchableOpacity
                                        onPress={() => router.push(`/messages/${userId}`)}
                                        style={[styles.msgBtn, { borderColor: colors.border }]}
                                        activeOpacity={0.7}
                                    >
                                        <Ionicons name="mail-outline" size={17} color={colors.textSecondary} />
                                    </TouchableOpacity>
                                    <FollowButton
                                        isFollowing={isFollowing}
                                        profileData={profileData}
                                        followButtonLoading={followLoading}
                                        handleFollow={handleFollow}
                                        handleCancelRequest={handleCancelRequest}
                                        handleUnfollow={handleUnfollow}
                                    />
                                </>
                            )}
                            {isOwnProfile && (
                                <TouchableOpacity
                                    onPress={() => router.push("/settings")}
                                    style={[styles.editBtn, { borderColor: colors.border }]}
                                    activeOpacity={0.8}
                                >
                                    <Text style={[styles.editBtnText, { color: colors.textPrimary }]}>Edit profile</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>

                    {/* Username */}
                    <View style={styles.nameRow}>
                        <Text style={[styles.username, { color: colors.textPrimary }]}>{profileData?.username}</Text>
                        {profileData?.is_verified && <Ionicons name="checkmark-circle" size={15} color="#1d9bf0" />}
                    </View>

                    {/* Bio */}
                    {profileData?.bio ? (
                        <Text style={[styles.bio, { color: colors.textPrimary }]}>{profileData.bio}</Text>
                    ) : isOwnProfile ? (
                        <TouchableOpacity onPress={() => router.push("/settings")} activeOpacity={0.7}>
                            <Text style={[styles.bio, { color: colors.textDisabled }]}>+ Add a bio</Text>
                        </TouchableOpacity>
                    ) : null}

                    {/* Meta */}
                    <View style={styles.metaRow}>
                        {profileData?.location && (
                            <View style={styles.metaItem}>
                                <Text style={{ fontSize: 12 }}>📍</Text>
                                <Text style={[styles.metaText, { color: colors.textSecondary }]}>{profileData.location}</Text>
                            </View>
                        )}
                        {profileData?.website && (
                            <TouchableOpacity
                                style={styles.metaItem}
                                onPress={() => profileData.website && Linking.openURL(profileData.website)}
                                activeOpacity={0.7}
                            >
                                <Ionicons name="link" size={12} color="#7c5cfc" />
                                <Text style={[styles.metaText, { color: "#7c5cfc", fontWeight: "500" }]}>
                                    {profileData.website.replace(/^https?:\/\//, "")}
                                </Text>
                            </TouchableOpacity>
                        )}
                        {profileData?.created_at && (
                            <View style={styles.metaItem}>
                                <Ionicons name="calendar-outline" size={12} color={colors.textDisabled} />
                                <Text style={[styles.metaText, { color: colors.textDisabled }]}>
                                    Joined {formatDate(profileData.created_at)}
                                </Text>
                            </View>
                        )}
                    </View>

                    {/* Stats */}
                    <View style={[styles.statsRow, { borderTopColor: colors.border }]}>
                        {[
                            { value: profileData?.posts_count || 0, label: "Posts" },
                            { value: profileData?.followers_count || 0, label: "Followers", onPress: () => router.push(`/profile/${userId}/followers`) },
                            { value: profileData?.following_count || 0, label: "Following", onPress: () => router.push(`/profile/${userId}/following`) },
                        ].map((s, i, arr) => (
                            <View key={s.label} style={[styles.statWrap, i < arr.length - 1 && { borderRightWidth: 0.5, borderRightColor: colors.border }]}>
                                <StatBox {...s} />
                            </View>
                        ))}
                    </View>
                </View>

                {/* ── Tabs ── */}
                <View style={[styles.tabs, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
                    <TouchableOpacity onPress={() => setTab(0)} style={[styles.tab, tab === 0 && { borderBottomWidth: 1.5, borderBottomColor: colors.textPrimary }]} activeOpacity={0.8}>
                        <Ionicons name="grid-outline" size={14} color={tab === 0 ? colors.textPrimary : colors.textDisabled} />
                        <Text style={[styles.tabLabel, { color: tab === 0 ? colors.textPrimary : colors.textDisabled, fontWeight: tab === 0 ? "600" : "500" }]}>Posts</Text>
                    </TouchableOpacity>
                    {isOwnProfile && (
                        <TouchableOpacity onPress={() => setTab(1)} style={[styles.tab, tab === 1 && { borderBottomWidth: 1.5, borderBottomColor: colors.textPrimary }]} activeOpacity={0.8}>
                            <Ionicons name="bookmark-outline" size={14} color={tab === 1 ? colors.textPrimary : colors.textDisabled} />
                            <Text style={[styles.tabLabel, { color: tab === 1 ? colors.textPrimary : colors.textDisabled, fontWeight: tab === 1 ? "600" : "500" }]}>Saved</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* ── Grid ── */}
                {isFetchingActive ? (
                    <View style={styles.grid}>
                        {Array(9).fill(0).map((_, i) => (
                            <View key={i} style={[styles.cell, { backgroundColor: colors.hover }]} />
                        ))}
                    </View>
                ) : !canViewPosts && tab === 0 ? (
                    <View style={{ backgroundColor: colors.surface }}>
                        <EmptyState
                            icon={<Ionicons name="lock-closed-outline" size={22} color={colors.textDisabled} />}
                            title="This account is private"
                            subtitle="Follow to see their photos and videos"
                        />
                    </View>
                ) : activePosts.length === 0 ? (
                    <View style={{ backgroundColor: colors.surface }}>
                        <EmptyState
                            icon={<Ionicons name={tab === 0 ? "camera-outline" : "bookmark-outline"} size={22} color={colors.textDisabled} />}
                            title={tab === 0 ? "No posts yet" : "Nothing saved yet"}
                            subtitle={
                                tab === 0
                                    ? isOwnProfile ? "Share your first photo or video" : "Nothing here yet"
                                    : "Posts you save will appear here"
                            }
                            action={
                                isOwnProfile && tab === 0 ? (
                                    <TouchableOpacity
                                        onPress={() => setModalOpen(true)}
                                        activeOpacity={0.85}
                                        style={[styles.createBtn, { backgroundColor: colors.textPrimary }]}
                                    >
                                        <Text style={[styles.createBtnText, { color: colors.bg }]}>Create your first post</Text>
                                    </TouchableOpacity>
                                ) : undefined
                            }
                        />
                    </View>
                ) : (
                    <View style={styles.grid}>
                        {activePosts.map((post, i) => (
                            <PostCell
                                key={post.id}
                                post={post}
                                onPress={() => router.push(`/posts/${post.id}`)}
                            />
                        ))}
                    </View>
                )}
            </ScrollView>

            <MoreOptionsDialog
                openDialog={openDialog}
                handleCloseDialog={() => setOpenDialog(false)}
                userId={userId}
                fetchProfile={fetchProfile}
                fetchUserPosts={fetchUserPosts}
                isFollowing={profileData?.is_following}
            />

            <CreatePostModal open={modalOpen} handleClose={() => setModalOpen(false)} />
        </SafeAreaView>
    );
};

export default ProfilePage;

// ── Styles ─────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    root: { flex: 1 },

    // Top bar
    topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", height: 50, borderBottomWidth: 0.5, paddingHorizontal: 4 },
    backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
    topBarCenter: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
    topBarAvatar: { width: 26, height: 26, borderRadius: 13 },
    topBarUsername: { fontWeight: "600", fontSize: 14, maxWidth: 160 },

    // Profile header
    profileHeader: { borderBottomWidth: 0.5, paddingHorizontal: 16, paddingTop: 20, paddingBottom: 0 },
    avatarRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 },
    avatar: { width: 82, height: 82, borderRadius: 41, borderWidth: 2.5 },
    verifiedBadge: { position: "absolute", bottom: 0, right: 0, backgroundColor: "#fff", borderRadius: 10 },
    actionRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingTop: 4 },
    msgBtn: { width: 32, height: 32, borderRadius: 8, borderWidth: 0.5, alignItems: "center", justifyContent: "center" },
    editBtn: { height: 32, paddingHorizontal: 16, borderRadius: 8, borderWidth: 0.5, alignItems: "center", justifyContent: "center" },
    editBtnText: { fontWeight: "500", fontSize: 13 },

    nameRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
    username: { fontWeight: "700", fontSize: 16 },
    bio: { fontSize: 13.5, lineHeight: 20, marginBottom: 10 },

    metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 14 },
    metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
    metaText: { fontSize: 12.5 },

    statsRow: { flexDirection: "row", borderTopWidth: 0.5, marginHorizontal: -16 },
    statWrap: { flex: 1 },
    statBox: { alignItems: "center", paddingVertical: 14, paddingHorizontal: 8 },
    statValue: { fontWeight: "600", fontSize: 18, lineHeight: 22 },
    statLabel: { fontSize: 9.5, fontWeight: "500", letterSpacing: 0.8, marginTop: 3 },

    // Tabs
    tabs: { flexDirection: "row", borderBottomWidth: 0.5 },
    tab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 44, borderBottomWidth: 0, borderBottomColor: "transparent" },
    tabLabel: { fontSize: 13, letterSpacing: 0.2 },

    // Grid
    grid: { flexDirection: "row", flexWrap: "wrap", gap: 1.5, padding: 1.5 },
    cell: { width: CELL, height: CELL, borderRadius: 0, overflow: "hidden" },
    cellImage: { width: "100%", height: "100%" },
    videoIcon: { position: "absolute", top: 6, right: 6, backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 10, padding: 3 },
    cellOverlay: { position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.38)", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 14, opacity: 0 },
    cellStat: { flexDirection: "row", alignItems: "center", gap: 4 },
    cellStatText: { color: "#fff", fontWeight: "600", fontSize: 11 },

    // Empty
    emptyState: { alignItems: "center", paddingVertical: 64, paddingHorizontal: 32 },
    emptyIcon: { width: 56, height: 56, borderRadius: 28, borderWidth: 1, alignItems: "center", justifyContent: "center", marginBottom: 16 },
    emptyTitle: { fontWeight: "600", fontSize: 15, marginBottom: 6 },
    emptySub: { fontSize: 13, textAlign: "center", lineHeight: 20 },

    // Create btn
    createBtn: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8 },
    createBtnText: { fontWeight: "600", fontSize: 13 },
});