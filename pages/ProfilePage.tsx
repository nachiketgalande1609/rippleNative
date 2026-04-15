import React, { useState, useEffect, useCallback } from "react";
import {
    View,
    Text,
    Image,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    ActivityIndicator,
    Dimensions,
    Linking,
    Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
    getProfile, getUserPosts, followUser,
    cancelFollowRequest, getSavedPosts, unfollowUser,
} from "../services/api";
import { useGlobalStore } from "../store/store";
import { useThemeColors } from "../hooks/useThemeColors";
import FollowButton from "../components/FollowButton";
import MoreOptionsDialog from "../components/MoreOptionsDialog";
import CreatePostModal from "../components/CreatePostModal";

const { width: SW } = Dimensions.get("window");
const CELL = Math.floor((SW - 3) / 3);
const ACCENT = "#7c5cfc";

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

function formatCount(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return String(n);
}

// ── Profile Skeleton ───────────────────────────────────────────────────────────
function ProfileSkeleton({ colors }: { colors: any }) {
    const pulse = React.useRef(new Animated.Value(1)).current;
    useEffect(() => {
        Animated.loop(Animated.sequence([
            Animated.timing(pulse, { toValue: 0.4, duration: 750, useNativeDriver: true }),
            Animated.timing(pulse, { toValue: 1, duration: 750, useNativeDriver: true }),
        ])).start();
    }, []);

    return (
        <Animated.View style={{ opacity: pulse, paddingHorizontal: 16, paddingTop: 20, gap: 16 }}>
            {/* Avatar + stats row */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 24 }}>
                <View style={{ width: 86, height: 86, borderRadius: 43, backgroundColor: colors.hover }} />
                <View style={{ flex: 1, flexDirection: "row", justifyContent: "space-around" }}>
                    {[1, 2, 3].map((i) => (
                        <View key={i} style={{ alignItems: "center", gap: 6 }}>
                            <View style={{ width: 32, height: 18, borderRadius: 6, backgroundColor: colors.hover }} />
                            <View style={{ width: 52, height: 10, borderRadius: 5, backgroundColor: colors.hover }} />
                        </View>
                    ))}
                </View>
            </View>
            {/* Name */}
            <View style={{ gap: 7 }}>
                <View style={{ width: "45%", height: 14, borderRadius: 6, backgroundColor: colors.hover }} />
                <View style={{ width: "70%", height: 12, borderRadius: 6, backgroundColor: colors.hover }} />
                <View style={{ width: "55%", height: 12, borderRadius: 6, backgroundColor: colors.hover }} />
            </View>
            {/* Button */}
            <View style={{ width: "100%", height: 34, borderRadius: 10, backgroundColor: colors.hover }} />
            {/* Grid */}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 1.5, marginHorizontal: -16 }}>
                {Array(9).fill(0).map((_, i) => (
                    <View key={i} style={{ width: CELL, height: CELL, backgroundColor: colors.hover }} />
                ))}
            </View>
        </Animated.View>
    );
}

// ── Post Cell ──────────────────────────────────────────────────────────────────
function PostCell({ post, onPress }: { post: any; onPress: () => void }) {
    const colors = useThemeColors();
    const isVideo = post.file_url && /\.(mp4|mov|webm)$/i.test(post.file_url);

    return (
        <TouchableOpacity onPress={onPress} activeOpacity={0.9} style={[styles.cell, { backgroundColor: colors.hover }]}>
            {post.file_url ? (
                <Image source={{ uri: post.file_url }} style={styles.cellImage} resizeMode="cover" />
            ) : (
                <View style={[styles.cellImage, { alignItems: "center", justifyContent: "center" }]}>
                    <Ionicons name="camera-outline" size={22} color={colors.textDisabled} />
                </View>
            )}
            {isVideo && (
                <View style={styles.videoIcon}>
                    <Ionicons name="play" size={11} color="#fff" />
                </View>
            )}
        </TouchableOpacity>
    );
}

// ── Stat Item ──────────────────────────────────────────────────────────────────
function StatItem({ value, label, onPress, colors }: { value: number; label: string; onPress?: () => void; colors: any }) {
    return (
        <TouchableOpacity onPress={onPress} activeOpacity={onPress ? 0.7 : 1} style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.textPrimary }]}>{formatCount(value)}</Text>
            <Text style={[styles.statLabel, { color: colors.textDisabled }]}>{label}</Text>
        </TouchableOpacity>
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
    const [fetchingProfile, setFetchingProfile] = useState(true);
    const [fetchingPosts, setFetchingPosts] = useState(false);
    const [fetchingSaved, setFetchingSaved] = useState(false);
    const [followLoading, setFollowLoading] = useState(false);
    const [tab, setTab] = useState(0);
    const [modalOpen, setModalOpen] = useState(false);

    useEffect(() => {
        AsyncStorage.getItem("user").then((raw) => { if (raw) setCurrentUser(JSON.parse(raw)); });
    }, []);

    const isOwnProfile = currentUser?.id == userId;
    const canViewPosts = profileData && (isOwnProfile || !profileData.is_private || profileData.is_following);

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
    useEffect(() => { if (!postUploading && canViewPosts) fetchUserPosts(); }, [postUploading]);
    useEffect(() => { if (tab === 1 && isOwnProfile && savedPosts.length === 0) fetchSaved(); }, [tab, isOwnProfile]);

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

    const activePosts = tab === 0 ? posts : savedPosts;
    const isFetchingActive = tab === 0 ? fetchingPosts : fetchingSaved;

    return (
        <SafeAreaView style={[styles.root, { backgroundColor: colors.bg }]} edges={[]}>
            {/* ── Top bar ── */}
            <View style={[styles.topBar, { backgroundColor: colors.surface + "f0", borderBottomColor: colors.border }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} activeOpacity={0.7}>
                    <Ionicons name="arrow-back" size={21} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text style={[styles.topBarUsername, { color: colors.textPrimary }]} numberOfLines={1}>
                    {profileData?.username ?? ""}
                </Text>
                <TouchableOpacity onPress={() => setOpenDialog(true)} style={styles.iconBtn} activeOpacity={0.7}>
                    <Ionicons name="ellipsis-horizontal" size={21} color={colors.textDisabled} />
                </TouchableOpacity>
            </View>

            {fetchingProfile ? (
                <ScrollView showsVerticalScrollIndicator={false}>
                    <ProfileSkeleton colors={colors} />
                </ScrollView>
            ) : (
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
                    {/* ── Header block ── */}
                    <View style={[styles.headerBlock, { backgroundColor: colors.surface }]}>

                        {/* ── Avatar + Stats row ── */}
                        <View style={styles.avatarStatsRow}>
                            {/* Avatar */}
                            <View style={styles.avatarWrap}>
                                <Image
                                    source={
                                        profileData?.profile_picture
                                            ? { uri: profileData.profile_picture }
                                            : require("../assets/profile_blank.png")
                                    }
                                    style={styles.avatar}
                                />
                                {profileData?.is_verified && (
                                    <View style={styles.verifiedBadge}>
                                        <Ionicons name="checkmark-circle" size={18} color="#1d9bf0" />
                                    </View>
                                )}
                            </View>

                            {/* Stats */}
                            <View style={styles.statsRow}>
                                <StatItem value={profileData?.posts_count || 0} label="Posts" colors={colors} />
                                <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
                                <StatItem
                                    value={profileData?.followers_count || 0}
                                    label="Followers"
                                    onPress={() => router.push(`/profile/${userId}/followers`)}
                                    colors={colors}
                                />
                                <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
                                <StatItem
                                    value={profileData?.following_count || 0}
                                    label="Following"
                                    onPress={() => router.push(`/profile/${userId}/following`)}
                                    colors={colors}
                                />
                            </View>
                        </View>

                        {/* ── Name + bio ── */}
                        <View style={styles.nameBlock}>
                            <View style={styles.nameRow}>
                                <Text style={[styles.username, { color: colors.textPrimary }]}>{profileData?.username}</Text>
                                {profileData?.is_verified && (
                                    <Ionicons name="checkmark-circle" size={14} color="#1d9bf0" />
                                )}
                            </View>

                            {!!profileData?.bio?.trim() && (
                                <Text style={[styles.bio, { color: colors.textSecondary }]}>{profileData.bio}</Text>
                            )}

                            {/* Meta row */}
                            <View style={styles.metaRow}>
                                {profileData?.location && (
                                    <View style={styles.metaItem}>
                                        <Ionicons name="location-outline" size={13} color={colors.textDisabled} />
                                        <Text style={[styles.metaText, { color: colors.textDisabled }]}>{profileData.location}</Text>
                                    </View>
                                )}
                                {profileData?.website && (
                                    <TouchableOpacity
                                        style={styles.metaItem}
                                        onPress={() => profileData.website && Linking.openURL(profileData.website)}
                                        activeOpacity={0.7}
                                    >
                                        <Ionicons name="link-outline" size={13} color={ACCENT} />
                                        <Text style={[styles.metaText, { color: ACCENT, fontWeight: "500" }]}>
                                            {profileData.website.replace(/^https?:\/\//, "")}
                                        </Text>
                                    </TouchableOpacity>
                                )}
                                {profileData?.created_at && (
                                    <View style={styles.metaItem}>
                                        <Ionicons name="calendar-outline" size={13} color={colors.textDisabled} />
                                        <Text style={[styles.metaText, { color: colors.textDisabled }]}>
                                            Joined {new Date(profileData.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                                        </Text>
                                    </View>
                                )}
                            </View>
                        </View>

                        {/* ── Action buttons ── */}
                        <View style={styles.actionButtons}>
                            {isOwnProfile ? (
                                <>
                                    <TouchableOpacity
                                        onPress={() => router.push("/settings")}
                                        activeOpacity={0.8}
                                        style={[styles.actionBtn, { backgroundColor: colors.hover, borderColor: colors.border }]}
                                    >
                                        <Text style={[styles.actionBtnText, { color: colors.textPrimary }]}>Edit profile</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={() => setModalOpen(true)}
                                        activeOpacity={0.8}
                                        style={[styles.actionBtn, { backgroundColor: colors.hover, borderColor: colors.border }]}
                                    >
                                        <Text style={[styles.actionBtnText, { color: colors.textPrimary }]}>Add post</Text>
                                    </TouchableOpacity>
                                </>
                            ) : currentUser?.id ? (
                                <>
                                    <View style={{ flex: 1 }}>
                                        <FollowButton
                                            isFollowing={isFollowing}
                                            profileData={profileData}
                                            followButtonLoading={followLoading}
                                            handleFollow={handleFollow}
                                            handleCancelRequest={handleCancelRequest}
                                            handleUnfollow={handleUnfollow}
                                        />
                                    </View>
                                    <TouchableOpacity
                                        onPress={() => router.push(`/messages/${userId}`)}
                                        activeOpacity={0.8}
                                        style={[styles.actionBtn, { flex: 1, backgroundColor: colors.hover, borderColor: colors.border }]}
                                    >
                                        <Ionicons name="chatbubble-outline" size={15} color={colors.textPrimary} />
                                        <Text style={[styles.actionBtnText, { color: colors.textPrimary }]}>Message</Text>
                                    </TouchableOpacity>
                                </>
                            ) : null}
                        </View>
                    </View>

                    {/* ── Tabs ── */}
                    <View style={[styles.tabs, { backgroundColor: colors.surface, borderBottomColor: colors.border, borderTopColor: colors.border }]}>
                        <TouchableOpacity
                            onPress={() => setTab(0)}
                            activeOpacity={0.8}
                            style={[styles.tab, tab === 0 && { borderBottomWidth: 2, borderBottomColor: colors.textPrimary }]}
                        >
                            <Ionicons name={tab === 0 ? "grid" : "grid-outline"} size={20} color={tab === 0 ? colors.textPrimary : colors.textDisabled} />
                        </TouchableOpacity>
                        {isOwnProfile && (
                            <TouchableOpacity
                                onPress={() => setTab(1)}
                                activeOpacity={0.8}
                                style={[styles.tab, tab === 1 && { borderBottomWidth: 2, borderBottomColor: colors.textPrimary }]}
                            >
                                <Ionicons name={tab === 1 ? "bookmark" : "bookmark-outline"} size={20} color={tab === 1 ? colors.textPrimary : colors.textDisabled} />
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
                        <View style={[styles.emptyState, { backgroundColor: colors.surface }]}>
                            <View style={[styles.emptyIconWrap, { backgroundColor: colors.hover, borderColor: colors.border }]}>
                                <Ionicons name="lock-closed-outline" size={26} color={colors.textDisabled} />
                            </View>
                            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>This account is private</Text>
                            <Text style={[styles.emptySub, { color: colors.textDisabled }]}>Follow to see their photos and videos</Text>
                        </View>
                    ) : activePosts.length === 0 ? (
                        <View style={[styles.emptyState, { backgroundColor: colors.surface }]}>
                            <View style={[styles.emptyIconWrap, { backgroundColor: colors.hover, borderColor: colors.border }]}>
                                <Ionicons name={tab === 0 ? "camera-outline" : "bookmark-outline"} size={26} color={colors.textDisabled} />
                            </View>
                            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
                                {tab === 0 ? "No posts yet" : "Nothing saved yet"}
                            </Text>
                            <Text style={[styles.emptySub, { color: colors.textDisabled }]}>
                                {tab === 0
                                    ? isOwnProfile ? "Share your first photo or video" : "Nothing here yet"
                                    : "Posts you save will appear here"}
                            </Text>
                            {isOwnProfile && tab === 0 && (
                                <TouchableOpacity
                                    onPress={() => setModalOpen(true)}
                                    activeOpacity={0.85}
                                    style={[styles.createBtn, { backgroundColor: ACCENT }]}
                                >
                                    <Text style={styles.createBtnText}>Create your first post</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    ) : (
                        <View style={styles.grid}>
                            {activePosts.map((post) => (
                                <PostCell key={post.id} post={post} onPress={() => router.push(`/posts/${post.id}`)} />
                            ))}
                        </View>
                    )}
                </ScrollView>
            )}

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

const styles = StyleSheet.create({
    root: { flex: 1 },

    // Top bar
    topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", height: 52, paddingHorizontal: 8, borderBottomWidth: 0.5 },
    iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
    topBarUsername: { fontWeight: "600", fontSize: 15, flex: 1, textAlign: "center" },

    // Header block
    headerBlock: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 16 },

    // Avatar + stats
    avatarStatsRow: { flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 14 },
    avatarWrap: { position: "relative" },
    avatar: { width: 86, height: 86, borderRadius: 43, borderWidth: 3, borderColor: "rgba(124,92,252,0.25)" },
    verifiedBadge: { position: "absolute", bottom: 0, right: 0, backgroundColor: "#fff", borderRadius: 11 },

    // Stats
    statsRow: { flex: 1, flexDirection: "row", alignItems: "center" },
    statItem: { flex: 1, alignItems: "center", gap: 3 },
    statValue: { fontWeight: "700", fontSize: 18 },
    statLabel: { fontSize: 11.5, fontWeight: "400" },
    statDivider: { width: 0.5, height: 28, opacity: 0.5 },

    // Name block
    nameBlock: { gap: 5, marginBottom: 14 },
    nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    username: { fontWeight: "700", fontSize: 15 },
    bio: { fontSize: 13.5, lineHeight: 20 },
    metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 4 },
    metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
    metaText: { fontSize: 12.5 },

    // Action buttons
    actionButtons: { flexDirection: "row", gap: 8 },
    actionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 34, borderRadius: 8, borderWidth: 1 },
    actionBtnText: { fontWeight: "500", fontSize: 13.5 },

    // Tabs
    tabs: { flexDirection: "row", borderBottomWidth: 0.5, borderTopWidth: 0.5, marginTop: 4 },
    tab: { flex: 1, alignItems: "center", justifyContent: "center", height: 44, borderBottomWidth: 0 },

    // Grid
    grid: { flexDirection: "row", flexWrap: "wrap" },
    cell: { width: CELL, height: CELL, margin: 0.5, overflow: "hidden" },
    cellImage: { width: "100%", height: "100%" },
    videoIcon: { position: "absolute", top: 6, right: 6, backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 8, padding: 3 },

    // Empty state
    emptyState: { alignItems: "center", paddingVertical: 72, paddingHorizontal: 32, gap: 10 },
    emptyIconWrap: { width: 64, height: 64, borderRadius: 32, borderWidth: 1, alignItems: "center", justifyContent: "center", marginBottom: 6 },
    emptyTitle: { fontWeight: "600", fontSize: 16 },
    emptySub: { fontSize: 13.5, textAlign: "center", lineHeight: 20 },
    createBtn: { marginTop: 12, paddingHorizontal: 24, paddingVertical: 11, borderRadius: 10 },
    createBtnText: { color: "#fff", fontWeight: "600", fontSize: 14 },
});