// app/(tabs)/index.tsx  (or pages/HomePage.tsx)
import { useState, useEffect } from "react";
import { View, Text, ScrollView, FlatList, TouchableOpacity, Image, StyleSheet, ActivityIndicator, Dimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getPosts, getStories } from "../services/api";
import { useThemeColors } from "../hooks/useThemeColors";
import Post from "../components/Post";
import StoryDialog from "../components/StoryDialog";
import UploadStoryDialog from "../components/UploadStoryDialog";

const ACCENT = "#7c5cfc";

// ── Story Bubble ─────────────────────────────────────────────────
function StoryBubble({
    src,
    username,
    size = 58,
    onClick,
    hasRing = true,
}: {
    src?: string;
    username?: string;
    size?: number;
    onClick?: () => void;
    hasRing?: boolean;
}) {
    const colors = useThemeColors();
    return (
        <TouchableOpacity onPress={onClick} activeOpacity={0.8} style={styles.storyBubble}>
            {hasRing ? (
                <View style={[styles.storyRing, { width: size + 4, height: size + 4, borderRadius: (size + 4) / 2 }]}>
                    <Image
                        source={src ? { uri: src } : require("../assets/profile_blank.png")}
                        style={[styles.storyImg, { width: size, height: size, borderRadius: size / 2 }]}
                    />
                </View>
            ) : (
                <Image
                    source={src ? { uri: src } : require("../assets/profile_blank.png")}
                    style={[styles.storyImgNoRing, { width: size, height: size, borderRadius: size / 2, borderColor: colors.border }]}
                />
            )}
            {username && (
                <Text style={[styles.storyUsername, { color: colors.textSecondary, maxWidth: size + 8 }]} numberOfLines={1}>
                    {username}
                </Text>
            )}
        </TouchableOpacity>
    );
}

function StorySkeleton({ size = 58 }: { size?: number }) {
    const colors = useThemeColors();
    return (
        <View style={styles.storyBubble}>
            <View
                style={[styles.skeletonCircle, { width: size + 4, height: size + 4, borderRadius: (size + 4) / 2, backgroundColor: colors.hover }]}
            />
            <View style={[styles.skeletonText, { backgroundColor: colors.hover }]} />
        </View>
    );
}

// ── HomePage ─────────────────────────────────────────────────────
export default function HomePage() {
    const colors = useThemeColors();
    const [posts, setPosts] = useState<any[]>([]);
    const [loadingPosts, setLoadingPosts] = useState(true);
    const [currentUser, setCurrentUser] = useState<any>(null);

    const [openStoryDialog, setOpenStoryDialog] = useState(false);
    const [openUploadDialog, setOpenUploadDialog] = useState(false);
    const [selectedStoryIndex, setSelectedStoryIndex] = useState(0);
    const [selfStories, setSelfStories] = useState<any[]>([]);
    const [followingStories, setFollowingStories] = useState<any[]>([]);
    const [fetchingStories, setFetchingStories] = useState(true);

    useEffect(() => {
        const load = async () => {
            const raw = await AsyncStorage.getItem("user");
            if (raw) setCurrentUser(JSON.parse(raw));
        };
        load();
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
        try {
            setFetchingStories(true);
            const res = await getStories();
            const group = (arr: any[]) =>
                Object.values(
                    arr.reduce((acc: any, story: any) => {
                        const uid = story.user_id;
                        if (!acc[uid]) acc[uid] = { user_id: uid, username: story.username, profile_picture: story.profile_picture, stories: [] };
                        acc[uid].stories.push(story);
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

    useEffect(() => {
        fetchPosts();
        fetchStories();
    }, []);

    const renderPostSkeleton = () => (
        <View style={[styles.skeletonPost, { borderBottomColor: colors.border }]}>
            <View style={styles.skeletonHeader}>
                <View style={[styles.skeletonAvatar, { backgroundColor: colors.hover }]} />
                <View style={{ flex: 1, gap: 6 }}>
                    <View style={[styles.skeletonLine, { width: "32%", backgroundColor: colors.hover }]} />
                    <View style={[styles.skeletonLine, { width: "18%", height: 9, backgroundColor: colors.hover }]} />
                </View>
            </View>
            <View style={[styles.skeletonImage, { backgroundColor: colors.hover }]} />
        </View>
    );

    return (
        <SafeAreaView style={[styles.root, { backgroundColor: colors.bg }]} edges={["top"]}>
            <FlatList
                data={loadingPosts ? [] : posts}
                keyExtractor={(item) => String(item.id)}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 80 }}
                ListHeaderComponent={
                    <>
                        {/* ── Stories row ── */}
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storiesRow}>
                            {/* Self bubble */}
                            <View style={{ position: "relative" }}>
                                <StoryBubble
                                    src={currentUser?.profile_picture_url}
                                    size={52}
                                    hasRing={selfStories.length > 0}
                                    onClick={() =>
                                        selfStories.length > 0 ? (setSelectedStoryIndex(0), setOpenStoryDialog(true)) : setOpenUploadDialog(true)
                                    }
                                />
                                <TouchableOpacity onPress={() => setOpenUploadDialog(true)} style={styles.addStoryBtn} activeOpacity={0.8}>
                                    <Ionicons name="add" size={12} color="#fff" />
                                </TouchableOpacity>
                            </View>

                            {/* Following stories */}
                            {fetchingStories
                                ? Array.from({ length: 5 }).map((_, i) => <StorySkeleton key={i} size={52} />)
                                : followingStories.map((us, idx) => (
                                      <StoryBubble
                                          key={us.user_id}
                                          src={us.profile_picture}
                                          size={52}
                                          username={us.username}
                                          onClick={() => {
                                              setSelectedStoryIndex(selfStories.length + idx);
                                              setOpenStoryDialog(true);
                                          }}
                                      />
                                  ))}
                        </ScrollView>
                    </>
                }
                ListEmptyComponent={
                    loadingPosts ? (
                        <>
                            {[0, 1, 2].map((i) => (
                                <View key={i}>{renderPostSkeleton()}</View>
                            ))}
                        </>
                    ) : (
                        // ── Empty state ──
                        <View style={styles.emptyState}>
                            <View style={[styles.emptyIcon, { backgroundColor: colors.isDark ? "rgba(124,92,252,0.12)" : "rgba(124,92,252,0.08)" }]}>
                                <Ionicons name="sad-outline" size={32} color={ACCENT} />
                            </View>
                            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>Nothing here yet</Text>
                            <Text style={[styles.emptySubtitle, { color: colors.textDisabled }]}>
                                Follow people or share something to get started.
                            </Text>
                            <TouchableOpacity onPress={() => setOpenUploadDialog(true)} style={styles.emptyBtn} activeOpacity={0.8}>
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
    storiesRow: { flexDirection: "row", gap: 16, paddingHorizontal: 12, paddingVertical: 12 },
    storyBubble: { alignItems: "center", gap: 5, flexShrink: 0 },
    storyRing: {
        padding: 2,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 2,
        borderColor: ACCENT,
    },
    storyImg: { resizeMode: "cover" },
    storyImgNoRing: { resizeMode: "cover", borderWidth: 1 },
    storyUsername: { fontSize: 11, fontWeight: "400", textAlign: "center" },
    skeletonCircle: {},
    skeletonText: { width: 40, height: 8, borderRadius: 4, marginTop: 4 },
    skeletonPost: { borderBottomWidth: 1, paddingBottom: 8 },
    skeletonHeader: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14 },
    skeletonAvatar: { width: 34, height: 34, borderRadius: 17 },
    skeletonLine: { height: 12, borderRadius: 6 },
    skeletonImage: { height: 260 },
    addStoryBtn: {
        position: "absolute",
        bottom: 20,
        right: -2,
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: ACCENT,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 2,
        borderColor: "#fff",
    },
    emptyState: { alignItems: "center", justifyContent: "center", minHeight: 400, paddingHorizontal: 32 },
    emptyIcon: { width: 64, height: 64, borderRadius: 18, alignItems: "center", justifyContent: "center", marginBottom: 16 },
    emptyTitle: { fontWeight: "500", fontSize: 15, marginBottom: 6 },
    emptySubtitle: { fontSize: 13, lineHeight: 20, maxWidth: 240, textAlign: "center" },
    emptyBtn: { marginTop: 20, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10, backgroundColor: ACCENT },
    emptyBtnText: { color: "#fff", fontWeight: "500", fontSize: 13 },
});
