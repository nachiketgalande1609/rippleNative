import { useState, useEffect, useRef } from "react";
import { View, Text, ScrollView, FlatList, TouchableOpacity, Image, StyleSheet, Animated, Dimensions, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getPosts, getStories } from "../services/api";
import { useThemeColors } from "../hooks/useThemeColors";
import Post from "../components/Post";
import StoryDialog from "../components/StoryDialog";
import UploadStoryDialog from "../components/UploadStoryDialog";

const ACCENT = "#7c5cfc";
const { width: SW } = Dimensions.get("window");

// ── Pulse wrapper ──────────────────────────────────────────────────────────────
function Pulse({ children }: { children: React.ReactNode }) {
    const opacity = useRef(new Animated.Value(1)).current;
    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(opacity, {
                    toValue: 0.35,
                    duration: 800,
                    useNativeDriver: true,
                }),
                Animated.timing(opacity, {
                    toValue: 1,
                    duration: 800,
                    useNativeDriver: true,
                }),
            ]),
        ).start();
    }, []);
    return <Animated.View style={{ opacity }}>{children}</Animated.View>;
}

// ── Story bubble ───────────────────────────────────────────────────────────────
function StoryBubble({
    src,
    username,
    size = 60,
    onClick,
    hasRing = true,
    isOwn = false,
}: {
    src?: string;
    username?: string;
    size?: number;
    onClick?: () => void;
    hasRing?: boolean;
    isOwn?: boolean;
}) {
    const colors = useThemeColors();
    return (
        <TouchableOpacity onPress={onClick} activeOpacity={0.8} style={styles.storyWrap}>
            <View
                style={[
                    styles.storyRingOuter,
                    { width: size + 6, height: size + 6, borderRadius: (size + 6) / 2 },
                    hasRing ? { borderWidth: 2.5, borderColor: ACCENT } : { borderWidth: 1.5, borderColor: colors.border },
                ]}
            >
                <Image
                    source={src ? { uri: src } : require("../assets/profile_blank.png")}
                    style={{ width: size, height: size, borderRadius: size / 2 }}
                    resizeMode="cover"
                />
            </View>
            {isOwn && (
                <View style={styles.addDot}>
                    <Ionicons name="add" size={11} color="#fff" />
                </View>
            )}
            {username && (
                <Text style={[styles.storyLabel, { color: colors.textSecondary, maxWidth: size + 10 }]} numberOfLines={1}>
                    {username}
                </Text>
            )}
        </TouchableOpacity>
    );
}

// ── Story skeleton ─────────────────────────────────────────────────────────────
function StorySkeleton({ size = 60 }: { size?: number }) {
    const colors = useThemeColors();
    return (
        <View style={styles.storyWrap}>
            <View
                style={[
                    styles.skeletonCircle,
                    {
                        width: size + 6,
                        height: size + 6,
                        borderRadius: (size + 6) / 2,
                        backgroundColor: colors.hover,
                    },
                ]}
            />
            <View style={[styles.skeletonLabel, { backgroundColor: colors.hover }]} />
        </View>
    );
}

// ── Post skeleton ──────────────────────────────────────────────────────────────
function PostSkeleton({ colors }: { colors: any }) {
    return (
        <Pulse>
            <View style={[styles.skeletonCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                {/* Header */}
                <View style={styles.skeletonHeader}>
                    <View style={[styles.skeletonAvatar, { backgroundColor: colors.hover }]} />
                    <View style={{ flex: 1, gap: 7 }}>
                        <View style={[styles.skeletonLine, { width: "45%", backgroundColor: colors.hover }]} />
                        <View style={[styles.skeletonLine, { width: "25%", height: 9, backgroundColor: colors.hover }]} />
                    </View>
                    <View
                        style={[
                            {
                                width: 20,
                                height: 20,
                                borderRadius: 4,
                                backgroundColor: colors.hover,
                            },
                        ]}
                    />
                </View>
                {/* Image */}
                <View style={[styles.skeletonImg, { backgroundColor: colors.hover }]} />
                {/* Actions */}
                <View style={styles.skeletonActions}>
                    {[56, 40, 32].map((w, i) => (
                        <View key={i} style={[styles.skeletonLine, { width: w, height: 13, backgroundColor: colors.hover }]} />
                    ))}
                </View>
                {/* Caption */}
                <View style={[styles.skeletonCaption, { gap: 6 }]}>
                    <View style={[styles.skeletonLine, { width: "80%", backgroundColor: colors.hover }]} />
                    <View style={[styles.skeletonLine, { width: "55%", height: 10, backgroundColor: colors.hover }]} />
                </View>
            </View>
        </Pulse>
    );
}

// ── Stories section skeleton ───────────────────────────────────────────────────
function StoriesSkeletonRow() {
    const colors = useThemeColors();
    return (
        <Pulse>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storiesRow} pointerEvents="none">
                {Array(6)
                    .fill(0)
                    .map((_, i) => (
                        <StorySkeleton key={i} size={60} />
                    ))}
            </ScrollView>
        </Pulse>
    );
}

// ── HomePage ───────────────────────────────────────────────────────────────────
export default function HomePage() {
    const colors = useThemeColors();
    const insets = useSafeAreaInsets();

    const [posts, setPosts] = useState<any[]>([]);
    const [loadingPosts, setLoadingPosts] = useState(true);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [openStoryDialog, setOpenStoryDialog] = useState(false);
    const [openUploadDialog, setOpenUploadDialog] = useState(false);
    const [selectedStoryIndex, setSelectedStoryIndex] = useState(0);
    const [selfStories, setSelfStories] = useState<any[]>([]);
    const [followingStories, setFollowingStories] = useState<any[]>([]);
    const [fetchingStories, setFetchingStories] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const onRefresh = async () => {
        setRefreshing(true);
        await Promise.all([fetchPosts(), fetchStories()]);
        setRefreshing(false);
    };

    useEffect(() => {
        AsyncStorage.getItem("user").then((raw) => {
            if (raw) setCurrentUser(JSON.parse(raw));
        });
        fetchPosts();
        fetchStories();
    }, []);

    const fetchPosts = async () => {
        try {
            const res = await getPosts();
            setPosts(res.data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingPosts(false);
        }
    };

    const fetchStories = async () => {
        setFetchingStories(true);
        try {
            const res = await getStories();
            const group = (arr: any[]) =>
                Object.values(
                    arr.reduce((acc: any, s: any) => {
                        if (!acc[s.user_id])
                            acc[s.user_id] = {
                                user_id: s.user_id,
                                username: s.username,
                                profile_picture: s.profile_picture,
                                stories: [],
                            };
                        acc[s.user_id].stories.push(s);
                        return acc;
                    }, {}),
                );
            setSelfStories(group(res.data.selfStory || []));
            setFollowingStories(group(res.data.stories || []));
        } catch (e) {
            console.error(e);
        } finally {
            setFetchingStories(false);
        }
    };

    const StoriesHeader = () => (
        <>
            {/* ── Stories ── */}
            <View style={[styles.storiesSection, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
                {fetchingStories ? (
                    <StoriesSkeletonRow />
                ) : (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storiesRow}>
                        {/* Own bubble */}
                        <StoryBubble
                            src={currentUser?.profile_picture_url}
                            size={60}
                            username="Your story"
                            hasRing={selfStories.length > 0}
                            isOwn
                            onClick={() =>
                                selfStories.length > 0 ? (setSelectedStoryIndex(0), setOpenStoryDialog(true)) : setOpenUploadDialog(true)
                            }
                        />

                        {/* Following stories */}
                        {followingStories.map((us, idx) => (
                            <StoryBubble
                                key={us.user_id}
                                src={us.profile_picture}
                                size={60}
                                username={us.username}
                                onClick={() => {
                                    setSelectedStoryIndex(selfStories.length + idx);
                                    setOpenStoryDialog(true);
                                }}
                            />
                        ))}
                    </ScrollView>
                )}
            </View>
        </>
    );

    return (
        <SafeAreaView style={[styles.root, { backgroundColor: colors.bg, marginTop: -insets.top }]} edges={["top"]}>
            <FlatList
                data={loadingPosts ? ([] as any[]) : posts}
                keyExtractor={(item) => String(item.id)}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 100 }}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={ACCENT}
                        colors={[ACCENT]} // Android
                    />
                }
                ListHeaderComponent={<StoriesHeader />}
                ListEmptyComponent={
                    loadingPosts ? (
                        // Post skeletons
                        <View style={{ paddingTop: 4 }}>
                            {[0, 1, 2].map((i) => (
                                <PostSkeleton key={i} colors={colors} />
                            ))}
                        </View>
                    ) : (
                        // Empty state
                        <View style={styles.emptyState}>
                            <View
                                style={[
                                    styles.emptyIconWrap,
                                    {
                                        backgroundColor: colors.isDark ? "rgba(124,92,252,0.1)" : "rgba(124,92,252,0.07)",
                                        borderColor: "rgba(124,92,252,0.2)",
                                    },
                                ]}
                            >
                                <Ionicons name="telescope-outline" size={30} color={ACCENT} />
                            </View>
                            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>Nothing here yet</Text>
                            <Text style={[styles.emptySub, { color: colors.textDisabled }]}>
                                Follow people or share something{"\n"}to get started.
                            </Text>
                            <TouchableOpacity onPress={() => setOpenUploadDialog(true)} activeOpacity={0.85} style={styles.emptyBtn}>
                                <Text style={styles.emptyBtnText}>Share a story</Text>
                            </TouchableOpacity>
                        </View>
                    )
                }
                renderItem={({ item: post }) => <Post post={post} fetchPosts={fetchPosts} />}
            />

            <StoryDialog
                open={openStoryDialog}
                onClose={() => setOpenStoryDialog(false)}
                stories={[...selfStories, ...followingStories]}
                selectedStoryIndex={selectedStoryIndex}
            />
            <UploadStoryDialog open={openUploadDialog} onClose={() => setOpenUploadDialog(false)} fetchStories={fetchStories} />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1 },

    // Stories section
    storiesSection: { borderBottomWidth: 0.5 },
    storiesRow: {
        flexDirection: "row",
        gap: 18,
        paddingHorizontal: 14,
        paddingVertical: 14,
    },

    // Story bubble
    storyWrap: { alignItems: "center", gap: 6, flexShrink: 0 },
    storyRingOuter: {
        alignItems: "center",
        justifyContent: "center",
        padding: 2,
    },
    storyLabel: { fontSize: 11, fontWeight: "400", textAlign: "center" },
    addDot: {
        position: "absolute",
        bottom: 16,
        right: -1,
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: ACCENT,
        alignItems: "center",
        justifyContent: "center",
    },

    // Story skeleton
    skeletonCircle: { flexShrink: 0 },
    skeletonLabel: { width: 44, height: 9, borderRadius: 5, marginTop: 2 },

    // Feed label
    feedLabel: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderBottomWidth: 0.5,
    },
    feedLabelText: {
        fontSize: 11,
        fontWeight: "600",
        letterSpacing: 0.8,
        textTransform: "uppercase",
    },

    // Post skeleton
    skeletonCard: {
        borderBottomWidth: 0.5,
        paddingBottom: 0,
        marginBottom: 0,
    },
    skeletonHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        padding: 14,
        paddingBottom: 10,
    },
    skeletonAvatar: { width: 36, height: 36, borderRadius: 18, flexShrink: 0 },
    skeletonLine: { height: 13, borderRadius: 6 },
    skeletonImg: { width: "100%", height: 280 },
    skeletonActions: {
        flexDirection: "row",
        gap: 14,
        paddingHorizontal: 14,
        paddingTop: 10,
        paddingBottom: 6,
    },
    skeletonCaption: { paddingHorizontal: 14, paddingBottom: 16, paddingTop: 4 },

    // Empty state
    emptyState: { alignItems: "center", paddingTop: 80, paddingHorizontal: 40 },
    emptyIconWrap: {
        width: 72,
        height: 72,
        borderRadius: 22,
        borderWidth: 1,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 20,
    },
    emptyTitle: { fontSize: 17, fontWeight: "600", marginBottom: 8 },
    emptySub: {
        fontSize: 13.5,
        textAlign: "center",
        lineHeight: 21,
        marginBottom: 28,
    },
    emptyBtn: {
        backgroundColor: ACCENT,
        paddingHorizontal: 28,
        paddingVertical: 12,
        borderRadius: 12,
    },
    emptyBtnText: { color: "#fff", fontWeight: "600", fontSize: 14 },
});
