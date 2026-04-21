import React, { useState, useEffect, useRef } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    FlatList,
    Image,
    StyleSheet,
    ActivityIndicator,
    Dimensions,
    ScrollView,
    Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useDebounce } from "../utils/utils";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
    getSearchResults,
    getSearchHistory,
    addToSearchHistory,
    deleteSearchHistoryItem,
    searchByHashtag,
    getHashtagSearchHistory,
    addToHashtagSearchHistory,
    deleteHashtagSearchHistoryItem,
} from "../services/api";
import { useThemeColors } from "../hooks/useThemeColors";

const { width: SW } = Dimensions.get("window");
const CELL = (SW - 4) / 3;
const ACCENT = "#7c5cfc";

// ── Skeleton row ───────────────────────────────────────────────────────────────
function SkeletonPulse({ children }: { children: React.ReactNode }) {
    const opacity = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(opacity, {
                    toValue: 0.4,
                    duration: 700,
                    useNativeDriver: true,
                }),
                Animated.timing(opacity, {
                    toValue: 1,
                    duration: 700,
                    useNativeDriver: true,
                }),
            ]),
        ).start();
    }, []);

    return <Animated.View style={{ opacity }}>{children}</Animated.View>;
}

// Wrap each skeleton:
function PeopleSkeletonRow({ colors }: { colors: any }) {
    return (
        <SkeletonPulse>
            <View style={styles.userRow}>
                <View style={[styles.skeletonAvatar, { backgroundColor: colors.hover }]} />
                <View style={{ flex: 1, gap: 7 }}>
                    <View style={[styles.skeletonLine, { width: "40%", backgroundColor: colors.hover }]} />
                    <View style={[styles.skeletonLine, { width: "60%", height: 10, backgroundColor: colors.hover }]} />
                </View>
            </View>
        </SkeletonPulse>
    );
}

function HistorySkeletonSection({ colors }: { colors: any }) {
    return (
        <SkeletonPulse>
            {/* "RECENT" label skeleton */}
            <View style={[styles.sectionHeader]}>
                <View
                    style={[
                        styles.skeletonAvatar,
                        {
                            width: 15,
                            height: 15,
                            borderRadius: 4,
                            backgroundColor: colors.hover,
                        },
                    ]}
                />
                <View style={[styles.skeletonLine, { width: 60, height: 10, backgroundColor: colors.hover }]} />
            </View>
            {/* Rows */}
            {[1, 2, 3].map((i) => (
                <View key={i} style={styles.userRow}>
                    <View style={[styles.skeletonAvatar, { backgroundColor: colors.hover }]} />
                    <View style={{ flex: 1, gap: 7 }}>
                        <View style={[styles.skeletonLine, { width: "40%", backgroundColor: colors.hover }]} />
                        <View style={[styles.skeletonLine, { width: "60%", height: 10, backgroundColor: colors.hover }]} />
                    </View>
                </View>
            ))}
        </SkeletonPulse>
    );
}

function HashtagSkeletonGrid({ colors }: { colors: any }) {
    return (
        <SkeletonPulse>
            <View
                style={[
                    styles.skeletonLine,
                    {
                        width: 60,
                        height: 10,
                        backgroundColor: colors.hover,
                        marginHorizontal: 16,
                        marginTop: 14,
                        marginBottom: 10,
                    },
                ]}
            />
            <View style={styles.grid}>
                {Array(9)
                    .fill(0)
                    .map((_, i) => (
                        <View key={i} style={[styles.gridCell, { backgroundColor: colors.hover }]} />
                    ))}
            </View>
        </SkeletonPulse>
    );
}

// ── Section header ─────────────────────────────────────────────────────────────
function SectionHeader({ icon, label, colors }: { icon: React.ReactNode; label: string; colors: any }) {
    return (
        <View style={styles.sectionHeader}>
            {icon}
            <Text style={[styles.sectionLabel, { color: colors.textDisabled }]}>{label.toUpperCase()}</Text>
        </View>
    );
}

// ── Empty state ────────────────────────────────────────────────────────────────
function EmptyState({ icon, primary, secondary, colors }: { icon: React.ReactNode; primary: string; secondary: string; colors: any }) {
    return (
        <View style={styles.emptyState}>
            {icon}
            <Text style={[styles.emptyPrimary, { color: colors.textSecondary }]}>{primary}</Text>
            <Text style={[styles.emptySecondary, { color: colors.textDisabled }]}>{secondary}</Text>
        </View>
    );
}

// ── User row ───────────────────────────────────────────────────────────────────
function UserRow({ user, onPress, onDelete, colors }: { user: any; onPress: () => void; onDelete?: () => void; colors: any }) {
    return (
        <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={styles.userRow}>
            <Image source={user.profile_picture ? { uri: user.profile_picture } : require("../assets/profile_blank.png")} style={styles.userAvatar} />
            <View style={{ flex: 1 }}>
                <Text style={[styles.userName, { color: colors.textPrimary }]}>{user.username}</Text>
                <Text style={[styles.userEmail, { color: colors.textSecondary }]}>{user.email}</Text>
            </View>
            {onDelete && (
                <TouchableOpacity
                    onPress={(e) => {
                        onDelete();
                    }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={[styles.deleteBtn]}
                    activeOpacity={0.7}
                >
                    <Ionicons name="close" size={13} color={colors.textDisabled} />
                </TouchableOpacity>
            )}
        </TouchableOpacity>
    );
}

// ── Tag history row ────────────────────────────────────────────────────────────
function TagHistoryRow({ item, onPress, onDelete, colors }: { item: any; onPress: () => void; onDelete: () => void; colors: any }) {
    return (
        <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={styles.userRow}>
            <View style={[styles.tagIcon, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Ionicons name="pricetag" size={15} color={ACCENT} />
            </View>
            <Text style={[styles.userName, { color: colors.textPrimary, flex: 1 }]}>
                {" "}
                {/* ← add flex: 1 */}#{item.tag}
            </Text>
            <TouchableOpacity onPress={onDelete} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={[styles.deleteBtn]} activeOpacity={0.7}>
                <Ionicons name="close" size={13} color={colors.textDisabled} />
            </TouchableOpacity>
        </TouchableOpacity>
    );
}

// ── Hashtag post grid ──────────────────────────────────────────────────────────
function HashtagPostGrid({ posts, onPostPress, colors }: { posts: any[]; onPostPress: (id: number) => void; colors: any }) {
    return (
        <View>
            <Text style={[styles.postCount, { color: colors.textDisabled }]}>
                {posts.length} POST{posts.length !== 1 ? "S" : ""}
            </Text>
            <View style={styles.grid}>
                {posts.map((post) => (
                    <TouchableOpacity
                        key={post.id}
                        onPress={() => onPostPress(post.id)}
                        activeOpacity={0.85}
                        style={[styles.gridCell, { backgroundColor: colors.surface }]}
                    >
                        {post.file_url ? (
                            <Image source={{ uri: post.file_url }} style={styles.gridImage} resizeMode="cover" />
                        ) : (
                            <View style={[styles.gridImage, { alignItems: "center", justifyContent: "center" }]}>
                                <Ionicons name="image-outline" size={20} color={colors.textDisabled} />
                            </View>
                        )}
                        {post.file_url?.match(/\.(mp4|webm|ogg|mov)$/i) && (
                            <View style={styles.videoIndicator}>
                                <Ionicons name="play" size={10} color="#fff" />
                            </View>
                        )}
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function SearchPage() {
    const colors = useThemeColors();
    const router = useRouter();

    const [activeTab, setActiveTab] = useState<0 | 1>(0);

    // People
    const [userQuery, setUserQuery] = useState("");
    const [userResults, setUserResults] = useState<any[]>([]);
    const [userLoading, setUserLoading] = useState(false);
    const [history, setHistory] = useState<any[]>([]);
    const [historyLoading, setHistoryLoading] = useState(true);

    // Hashtags
    const [tagQuery, setTagQuery] = useState("");
    const [tagResults, setTagResults] = useState<any[]>([]);
    const [tagLoading, setTagLoading] = useState(false);
    const [tagHistory, setTagHistory] = useState<any[]>([]);
    const [tagHistoryLoading, setTagHistoryLoading] = useState(true);

    const userInputRef = useRef<TextInput>(null);
    const tagInputRef = useRef<TextInput>(null);

    const debouncedUserQuery = useDebounce(userQuery, 750);
    const debouncedTagQuery = useDebounce(tagQuery, 750);
    const insets = useSafeAreaInsets();

    // Load history
    useEffect(() => {
        const load = async () => {
            try {
                const [userHist, tagHist] = await Promise.all([getSearchHistory(), getHashtagSearchHistory()]);
                setHistory(userHist.data || []);
                setTagHistory(tagHist.data || []);
            } catch (e) {
                console.error("Failed to load history:", e);
            } finally {
                setHistoryLoading(false);
                setTagHistoryLoading(false);
            }
        };
        load();
    }, []);

    // User search
    useEffect(() => {
        const run = async () => {
            if (!debouncedUserQuery) {
                setUserResults([]);
                return;
            }
            setUserLoading(true);
            try {
                const res = await getSearchResults(debouncedUserQuery);
                setUserResults(res.data.users || []);
            } catch (e) {
                console.error(e);
            } finally {
                setUserLoading(false);
            }
        };
        run();
    }, [debouncedUserQuery]);

    // Hashtag search
    useEffect(() => {
        const run = async () => {
            const raw = tagQuery.startsWith("#") ? tagQuery.slice(1) : tagQuery;
            if (!raw.trim()) {
                setTagResults([]);
                return;
            }
            setTagLoading(true);
            try {
                const res = await searchByHashtag(raw.trim());
                const posts = res.data.posts || [];
                setTagResults(posts);
                if (posts.length > 0) {
                    addToHashtagSearchHistory(raw.trim())
                        .then(() => getHashtagSearchHistory())
                        .then((r) => setTagHistory(r.data || []))
                        .catch(() => {});
                }
            } catch (e) {
                console.error(e);
            } finally {
                setTagLoading(false);
            }
        };
        run();
    }, [debouncedTagQuery]);

    const handleUserClick = (targetUser: any) => {
        router.push(`/profile/${targetUser.id}`);
        addToSearchHistory(targetUser.id)
            .then(() => getSearchHistory())
            .then((res) => setHistory(res.data || []))
            .catch(console.error);
    };

    const handleDeleteUserHistory = async (historyId: number) => {
        const deleted = history.find((i) => i.history_id === historyId);
        setHistory((p) => p.filter((i) => i.history_id !== historyId));
        try {
            await deleteSearchHistoryItem(historyId);
        } catch {
            if (deleted) setHistory((p) => [deleted, ...p]);
        }
    };

    const handleDeleteTagHistory = async (historyId: number) => {
        const deleted = tagHistory.find((i) => i.history_id === historyId);
        setTagHistory((p) => p.filter((i) => i.history_id !== historyId));
        try {
            await deleteHashtagSearchHistoryItem(historyId);
        } catch {
            if (deleted) setTagHistory((p) => [deleted, ...p]);
        }
    };

    const isUserSearching = !!debouncedUserQuery;
    const isTagSearching = !!debouncedTagQuery && !!(tagQuery.startsWith("#") ? tagQuery.slice(1) : tagQuery).trim();

    // ── People tab content ──
    const PeopleContent = () => {
        if (userLoading && isUserSearching) {
            return (
                <>
                    {[1, 2, 3, 4, 5].map((i) => (
                        <PeopleSkeletonRow key={i} colors={colors} />
                    ))}
                </>
            );
        }
        if (isUserSearching && userResults.length > 0) {
            return (
                <>
                    {userResults.map((u) => (
                        <UserRow key={u.id} user={u} onPress={() => handleUserClick(u)} colors={colors} />
                    ))}
                </>
            );
        }
        if (isUserSearching && !userLoading && userResults.length === 0) {
            return (
                <EmptyState
                    icon={<Ionicons name="person-outline" size={40} color={colors.textDisabled} />}
                    primary={`No results for "${debouncedUserQuery}"`}
                    secondary="Try a different username or email"
                    colors={colors}
                />
            );
        }
        if (historyLoading) {
            return <HistorySkeletonSection colors={colors} />;
        }
        if (history.length > 0) {
            return (
                <>
                    <SectionHeader icon={<Ionicons name="time-outline" size={15} color={colors.textDisabled} />} label="Recent" colors={colors} />
                    {history.map((item) => (
                        <UserRow
                            key={item.history_id}
                            user={item}
                            onPress={() => handleUserClick(item)}
                            onDelete={() => handleDeleteUserHistory(item.history_id)}
                            colors={colors}
                        />
                    ))}
                </>
            );
        }
        return (
            <EmptyState
                icon={<Ionicons name="search-outline" size={36} color={colors.textDisabled} />}
                primary="Search for people"
                secondary="Find users by username or email"
                colors={colors}
            />
        );
    };

    // ── Hashtag tab content ──
    const HashtagContent = () => {
        if (tagLoading && isTagSearching) {
            return <HashtagSkeletonGrid colors={colors} />;
        }
        if (isTagSearching && tagResults.length > 0) {
            return <HashtagPostGrid posts={tagResults} onPostPress={(id) => router.push(`/posts/${id}`)} colors={colors} />;
        }
        if (isTagSearching && !tagLoading && tagResults.length === 0) {
            const raw = tagQuery.startsWith("#") ? tagQuery.slice(1) : tagQuery;
            return (
                <EmptyState
                    icon={<Ionicons name="pricetag-outline" size={40} color={colors.textDisabled} />}
                    primary={`No posts for #${raw}`}
                    secondary="Try a different hashtag"
                    colors={colors}
                />
            );
        }
        if (tagHistoryLoading) {
            return <HistorySkeletonSection colors={colors} />;
        }
        if (tagHistory.length > 0) {
            return (
                <>
                    <SectionHeader icon={<Ionicons name="time-outline" size={15} color={colors.textDisabled} />} label="Recent" colors={colors} />
                    {tagHistory.map((item) => (
                        <TagHistoryRow
                            key={item.history_id}
                            item={item}
                            onPress={() => setTagQuery(item.tag)}
                            onDelete={() => handleDeleteTagHistory(item.history_id)}
                            colors={colors}
                        />
                    ))}
                </>
            );
        }
        return (
            <EmptyState
                icon={<Ionicons name="pricetag-outline" size={36} color={colors.textDisabled} />}
                primary="Search by hashtag"
                secondary="Find posts tagged with a specific topic"
                colors={colors}
            />
        );
    };

    const isLoading = activeTab === 0 ? userLoading : tagLoading;

    return (
        <SafeAreaView style={[styles.root, { backgroundColor: colors.bg, marginTop: -insets.top }]} edges={["top"]}>
            {/* ── Sticky header ── */}
            <View style={[styles.header, { backgroundColor: colors.bg, borderBottomColor: colors.border }]}>
                {/* Search input */}
                <View style={styles.inputWrapper}>
                    <View
                        style={[
                            styles.inputRow,
                            {
                                backgroundColor: colors.surface,
                                borderColor: activeTab === 1 ? ACCENT + "40" : colors.border,
                            },
                        ]}
                    >
                        {activeTab === 0 ? (
                            <Ionicons name="search-outline" size={18} color={colors.textDisabled} />
                        ) : (
                            <Ionicons name="pricetag" size={18} color={ACCENT} />
                        )}
                        <TextInput
                            ref={activeTab === 0 ? userInputRef : tagInputRef}
                            style={[styles.input, { color: colors.textPrimary }]}
                            placeholder={activeTab === 0 ? "Search people…" : "Search #hashtags…"}
                            placeholderTextColor={colors.textDisabled}
                            value={activeTab === 0 ? userQuery : tagQuery}
                            onChangeText={activeTab === 0 ? setUserQuery : setTagQuery}
                            autoCapitalize="none"
                            returnKeyType="search"
                        />
                        {isLoading ? (
                            <ActivityIndicator size="small" color={colors.textDisabled} />
                        ) : (activeTab === 0 ? userQuery : tagQuery) ? (
                            <TouchableOpacity
                                onPress={() => (activeTab === 0 ? setUserQuery("") : setTagQuery(""))}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                                <Ionicons name="close-circle" size={16} color={colors.textDisabled} />
                            </TouchableOpacity>
                        ) : null}
                    </View>
                </View>

                {/* Tabs */}
                <View style={[styles.tabs, { borderBottomColor: colors.border }]}>
                    {[
                        { label: "People", icon: "search-outline" as const },
                        { label: "Hashtags", icon: "pricetag-outline" as const },
                    ].map((tab, i) => (
                        <TouchableOpacity
                            key={tab.label}
                            onPress={() => setActiveTab(i as 0 | 1)}
                            activeOpacity={0.8}
                            style={[
                                styles.tab,
                                activeTab === i && {
                                    borderBottomWidth: 1.5,
                                    borderBottomColor: ACCENT,
                                },
                            ]}
                        >
                            <Ionicons name={tab.icon} size={14} color={activeTab === i ? colors.textPrimary : colors.textDisabled} />
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
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {/* ── Content ── */}
            <ScrollView
                style={{ flex: 1 }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 100 }}
            >
                <View style={{ paddingTop: 8 }}>{activeTab === 0 ? <PeopleContent /> : <HashtagContent />}</View>
            </ScrollView>
        </SafeAreaView>
    );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    root: { flex: 1 },

    // Header
    header: { borderBottomWidth: 1 },
    inputWrapper: {
        paddingHorizontal: 12,
        paddingTop: 10,
        paddingBottom: 10,
    },
    inputRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        borderRadius: 30,
        borderWidth: 1,
        paddingHorizontal: 12,
        height: 42,
    },
    input: { flex: 1, fontSize: 14.5 },
    // Tabs
    tabs: { flexDirection: "row", borderBottomWidth: 1 },
    tab: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        height: 44,
        borderBottomWidth: 0,
        borderBottomColor: "transparent",
    },
    tabLabel: { fontSize: 13.5, letterSpacing: 0.1 },

    // Section header
    sectionHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingHorizontal: 20,
        paddingTop: 8,
        paddingBottom: 4,
    },
    sectionLabel: { fontSize: 11, fontWeight: "600", letterSpacing: 0.9 },

    // Skeleton
    skeletonRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 10,
    },
    skeletonAvatar: { width: 40, height: 40, borderRadius: 20 },
    skeletonLine: { height: 12, borderRadius: 6 },

    // User row
    userRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 10,
    },
    userAvatar: { width: 40, height: 40, borderRadius: 20 },
    userName: { fontSize: 14, fontWeight: "500", lineHeight: 20 },
    userEmail: { fontSize: 12.5 },
    deleteBtn: {
        width: 26,
        height: 26,
        borderRadius: 13,
        alignItems: "center",
        justifyContent: "center",
    },

    // Tag
    tagIcon: {
        width: 38,
        height: 38,
        borderRadius: 19,
        borderWidth: 1,
        alignItems: "center",
        justifyContent: "center",
    },

    // Empty state
    emptyState: { alignItems: "center", paddingVertical: 56, gap: 8 },
    emptyPrimary: { fontSize: 14.5, fontWeight: "500" },
    emptySecondary: { fontSize: 13 },

    // Grid
    postCount: {
        fontSize: 11,
        fontWeight: "600",
        letterSpacing: 0.9,
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 8,
    },
    grid: { flexDirection: "row", flexWrap: "wrap", gap: 2 },
    gridCell: { width: CELL, height: CELL, overflow: "hidden" },
    gridImage: { width: "100%", height: "100%" },
    videoIndicator: {
        position: "absolute",
        top: 5,
        right: 5,
        backgroundColor: "rgba(0,0,0,0.5)",
        borderRadius: 8,
        padding: 3,
    },
});
