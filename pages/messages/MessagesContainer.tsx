import React, { useState, useRef, useCallback, useEffect } from "react";
import {
    View,
    Text,
    Image,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    ScrollView,
    Linking,
    Animated,
} from "react-native";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useThemeColors } from "../../hooks/useThemeColors";
import { getMessagesDataForSelectedUser } from "../../services/api";

const ACCENT = "#7c5cfc";

interface ReactionDetail {
    user_id: string;
    reaction: string;
    username: string;
    profile_picture: string;
}

type Message = {
    message_id: number;
    receiver_id: number;
    sender_id: number;
    message_text: string;
    timestamp: string;
    delivered?: boolean;
    read?: boolean;
    saved?: boolean;
    file_url: string;
    file_name: string | null;
    file_size: string | null;
    reply_to: number | null;
    media_height: number | null;
    media_width: number | null;
    reactions: ReactionDetail[];
    post?: {
        post_id: number;
        file_url: string;
        media_width: number;
        media_height: number;
        content: string;
        owner: { user_id: number; username: string; profile_picture: string };
    } | null;
};

type User = {
    id: number;
    username: string;
    profile_picture: string;
    isOnline: boolean;
    latest_message: string;
    latest_message_timestamp: string;
    unread_count: number;
};

interface Props {
    selectedUser: User | null;
    messages: Message[];
    currentUser: any;
    handleImageClick: (fileUrl: string) => void;
    handleReply: (msg: Message) => void;
    handleDeleteMessage: (msg: Message | null) => void;
    handleReaction: (messageId: number, reaction: string) => void;
    typingUser: number | null;
    initialMessageLoading: boolean;
}

function formatFileSize(size: string | null) {
    if (!size) return "N/A";
    const b = Number(size);
    return b < 1024 * 1024 ? (b / 1024).toFixed(1) + " KB" : (b / (1024 * 1024)).toFixed(1) + " MB";
}

function formatTime(ts: string) {
    return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
}

// ── Typing indicator ───────────────────────────────────────────────────────────
function TypingIndicator({ colors }: { colors: any }) {
    const dot1 = useRef(new Animated.Value(0)).current;
    const dot2 = useRef(new Animated.Value(0)).current;
    const dot3 = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const anim = (d: Animated.Value, delay: number) =>
            Animated.loop(
                Animated.sequence([
                    Animated.delay(delay),
                    Animated.timing(d, { toValue: -4, duration: 300, useNativeDriver: true }),
                    Animated.timing(d, { toValue: 0, duration: 300, useNativeDriver: true }),
                ])
            );
        Animated.parallel([anim(dot1, 0), anim(dot2, 150), anim(dot3, 300)]).start();
    }, []);

    return (
        <View style={[styles.typingRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {[dot1, dot2, dot3].map((d, i) => (
                <Animated.View key={i} style={[styles.typingDot, { backgroundColor: colors.textDisabled, transform: [{ translateY: d }] }]} />
            ))}
        </View>
    );
}

// ── Skeleton ───────────────────────────────────────────────────────────────────
function MessageSkeleton({ colors }: { colors: any }) {
    return (
        <View style={{ padding: 12, gap: 10 }}>
            {[true, false, true, false, true, false, true].map((self, i) => (
                <View key={i} style={[styles.skeletonRow, { justifyContent: self ? "flex-end" : "flex-start" }]}>
                    {!self && <View style={[styles.skeletonAvatar, { backgroundColor: colors.hover }]} />}
                    <View style={[styles.skeletonBubble, { backgroundColor: colors.hover, width: 80 + i * 20 }]} />
                </View>
            ))}
        </View>
    );
}

// ── Message Bubble ─────────────────────────────────────────────────────────────
function MessageBubble({
    msg, self, selectedUser, currentUser, allMessages, colors, isDark,
    onReply, onDelete, onImagePress, onPostPress, onReact,
}: {
    msg: Message; self: boolean; selectedUser: User; currentUser: any;
    allMessages: Message[]; colors: any; isDark: boolean;
    onReply: (m: Message) => void; onDelete: (m: Message) => void;
    onImagePress: (url: string) => void; onPostPress: (id: number) => void;
    onReact: (id: number, r: string) => void;
}) {
    const [showActions, setShowActions] = useState(false);
    const selfBg = ACCENT;
    const otherBg = colors.surface;
    const mediaW = 220;
    const originalMessage = msg.reply_to ? allMessages.find((m) => m.message_id === msg.reply_to) : null;
    const isImage = msg.file_url?.match(/\.(jpeg|jpg|png|gif|bmp|webp)$/i);
    const isVideo = msg.file_url?.match(/\.(mp4|webm|ogg|mov)$/i);

    return (
        // Outer View — actionsRow is a sibling of msgRow so it never shifts the bubble
        <View style={{ marginBottom: 4 }}>

            {/* ── Message row ── */}
            <View style={[styles.msgRow, { justifyContent: self ? "flex-end" : "flex-start" }]}>
                {!self && (
                    <Image
                        source={selectedUser.profile_picture ? { uri: selectedUser.profile_picture } : require("../../assets/profile_blank.png")}
                        style={styles.msgAvatar}
                    />
                )}

                <View style={{ maxWidth: "75%", alignItems: self ? "flex-end" : "flex-start" }}>
                    {/* Reply quote */}
                    {originalMessage && (
                        <View style={[styles.replyQuote, { backgroundColor: isDark ? "rgba(124,92,252,0.1)" : "rgba(124,92,252,0.07)" }]}>
                            <Text style={styles.replyQuoteUser}>
                                {originalMessage.sender_id === currentUser.id ? "You" : selectedUser.username}
                            </Text>
                            <Text style={[styles.replyQuoteText, { color: colors.textSecondary }]} numberOfLines={1}>
                                {originalMessage.message_text?.slice(0, 55) + (originalMessage.message_text?.length > 55 ? "…" : "")}
                            </Text>
                        </View>
                    )}

                    {/* Shared post */}
                    {msg.post && (
                        <TouchableOpacity
                            onPress={() => onPostPress(msg.post!.post_id)}
                            activeOpacity={0.85}
                            style={[styles.postCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                        >
                            {msg.post.owner && (
                                <View style={[styles.postCardHeader, { borderBottomColor: colors.border }]}>
                                    <Image source={{ uri: msg.post.owner.profile_picture }} style={styles.postCardAvatar} />
                                    <Text style={[styles.postCardOwner, { color: colors.textPrimary }]}>{msg.post.owner.username}</Text>
                                </View>
                            )}
                            {msg.post.file_url && (
                                <Image source={{ uri: msg.post.file_url }} style={{ width: mediaW, height: 160 }} resizeMode="cover" />
                            )}
                            {msg.post.content && (
                                <View style={{ padding: 10 }}>
                                    <Text style={[styles.postCardContent, { color: colors.textSecondary }]} numberOfLines={2}>
                                        <Text style={{ fontWeight: "500", color: colors.textPrimary }}>{msg.post.owner.username} </Text>
                                        {msg.post.content}
                                    </Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    )}

                    {/* Image */}
                    {msg.file_url && isImage && (
                        <TouchableOpacity onPress={() => onImagePress(msg.file_url)} activeOpacity={0.9} style={[styles.mediaWrap, { borderColor: colors.border }]}>
                            <Image
                                source={{ uri: msg.file_url }}
                                style={{
                                    width: mediaW,
                                    height: msg.media_width && msg.media_height ? (msg.media_height / msg.media_width) * mediaW : 180,
                                    borderRadius: 12,
                                }}
                                resizeMode="cover"
                            />
                        </TouchableOpacity>
                    )}

                    {/* File */}
                    {msg.file_url && !isImage && !isVideo && (
                        <TouchableOpacity
                            onPress={() => Linking.openURL(msg.file_url)}
                            style={[styles.fileBubble, { backgroundColor: colors.surface, borderColor: colors.border }]}
                            activeOpacity={0.8}
                        >
                            <MaterialIcons name="insert-drive-file" size={26} color={colors.textDisabled} />
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.fileName, { color: colors.textPrimary }]} numberOfLines={1}>{msg.file_name}</Text>
                                <Text style={[styles.fileSize, { color: colors.textDisabled }]}>{formatFileSize(msg.file_size)}</Text>
                            </View>
                        </TouchableOpacity>
                    )}

                    {/* Text bubble */}
                    {!!msg.message_text && (
                        <TouchableOpacity
                            onLongPress={() => setShowActions((v) => !v)}
                            activeOpacity={1}
                            delayLongPress={300}
                        >
                            <View style={[
                                styles.bubble,
                                {
                                    backgroundColor: self ? selfBg : otherBg,
                                    borderRadius: 14,
                                    borderTopRightRadius: self ? 4 : 14,
                                    borderTopLeftRadius: self ? 14 : 4,
                                    borderWidth: self ? 0 : 1,
                                    borderColor: colors.border,
                                },
                            ]}>
                                <Text style={[styles.bubbleText, { color: self ? "#fff" : colors.textPrimary }]}>
                                    {msg.message_text}
                                </Text>
                                <Text style={[styles.bubbleTime, { color: self ? "rgba(255,255,255,0.65)" : colors.textDisabled, textAlign: "right" }]}>
                                    {formatTime(msg.timestamp)}
                                </Text>
                            </View>
                        </TouchableOpacity>
                    )}

                    {/* Reactions */}
                    {msg.reactions?.length > 0 && (
                        <View style={[styles.reactions, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                            {msg.reactions.map((r, i) => (
                                <Text key={i} style={styles.reactionEmoji}>{r.reaction}</Text>
                            ))}
                        </View>
                    )}
                </View>

                {/* Read tick */}
                {self && (
                    <View style={styles.tick}>
                        {msg.read
                            ? <Ionicons name="checkmark-done" size={13} color={ACCENT} />
                            : msg.delivered
                            ? <Ionicons name="checkmark-done" size={13} color={colors.textDisabled} />
                            : msg.saved
                            ? <Ionicons name="checkmark" size={13} color={colors.textDisabled} />
                            : <Ionicons name="time-outline" size={12} color={colors.textDisabled} />}
                    </View>
                )}
            </View>

            {/* ── Actions — sibling row, never shifts the bubble above ── */}
            {showActions && !!msg.message_text && (
                <View style={[
                    styles.actionsRow,
                    {
                        justifyContent: self ? "flex-end" : "flex-start",
                        paddingRight: self ? 24 : 0,
                        paddingLeft: self ? 0 : 32,
                    },
                ]}>
                    {self && (
                        <TouchableOpacity
                            onPress={() => { onDelete(msg); setShowActions(false); }}
                            style={[styles.actionChip, { backgroundColor: colors.hover, borderColor: colors.border }]}
                        >
                            <Ionicons name="trash-outline" size={14} color="#e53935" />
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity
                        onPress={() => { onReply(msg); setShowActions(false); }}
                        style={[styles.actionChip, { backgroundColor: colors.hover, borderColor: colors.border }]}
                    >
                        <Ionicons name="return-up-back-outline" size={14} color={colors.textSecondary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => setShowActions(false)}
                        style={[styles.actionChip, { backgroundColor: colors.hover, borderColor: colors.border }]}
                    >
                        <Ionicons name="close" size={14} color={colors.textDisabled} />
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
}

// ── Main Component ─────────────────────────────────────────────────────────────
const MessagesContainer: React.FC<Props> = ({
    selectedUser, messages, currentUser, handleImageClick,
    handleReply, handleDeleteMessage, handleReaction, typingUser, initialMessageLoading,
}) => {
    const colors = useThemeColors();
    const router = useRouter();
    const isDark = colors.isDark;
    const scrollRef = useRef<ScrollView>(null);

    const [olderMessages, setOlderMessages] = useState<Message[]>([]);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const offsetRef = useRef(0);
    const hasMoreRef = useRef(true);
    const isLoadingRef = useRef(false);

    useEffect(() => {
        setOlderMessages([]);
        offsetRef.current = 0;
        hasMoreRef.current = true;
        isLoadingRef.current = false;
    }, [selectedUser?.id]);

    const currentIds = new Set(messages.map((m) => m.message_id));
    const dedupedOlder = olderMessages.filter((m) => !currentIds.has(m.message_id));
    const allMessages = [...dedupedOlder, ...messages];

    const loadMore = useCallback(async () => {
        if (!selectedUser || isLoadingRef.current || !hasMoreRef.current) return;
        isLoadingRef.current = true;
        setIsLoadingMore(true);
        const nextOffset = offsetRef.current + 20;
        try {
            const res = await getMessagesDataForSelectedUser(selectedUser.id, nextOffset, 20);
            const fetched: Message[] = res.data ?? [];
            if (fetched.length === 0) {
                hasMoreRef.current = false;
            } else {
                const chrono = [...fetched].reverse();
                setOlderMessages((prev) => {
                    const prevIds = new Set(prev.map((m) => m.message_id));
                    return [...chrono.filter((m) => !prevIds.has(m.message_id)), ...prev];
                });
                offsetRef.current = nextOffset;
                if (fetched.length < 20) hasMoreRef.current = false;
            }
        } catch (e) { console.error(e); }
        finally { isLoadingRef.current = false; setIsLoadingMore(false); }
    }, [selectedUser]);

    useEffect(() => {
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }, [messages.length]);

    if (initialMessageLoading) return <MessageSkeleton colors={colors} />;

    if (!selectedUser) {
        return (
            <View style={styles.emptyState}>
                <View style={[styles.emptyIcon, { backgroundColor: isDark ? "rgba(124,92,252,0.12)" : "rgba(124,92,252,0.08)" }]}>
                    <Ionicons name="chatbubble-outline" size={28} color={ACCENT} style={{ opacity: 0.8 }} />
                </View>
                <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No conversation selected</Text>
                <Text style={[styles.emptySub, { color: colors.textDisabled }]}>Pick someone to message</Text>
            </View>
        );
    }

    return (
        <ScrollView
            ref={scrollRef}
            style={[styles.root, { backgroundColor: isDark ? colors.bg : "#f7f7f8" }]}
            contentContainerStyle={{ padding: 12, paddingBottom: 20 }}
            showsVerticalScrollIndicator={false}
            onScroll={({ nativeEvent }) => {
                if (nativeEvent.contentOffset.y < 80) loadMore();
            }}
            scrollEventThrottle={200}
        >
            {isLoadingMore && (
                <View style={{ alignItems: "center", paddingVertical: 10 }}>
                    <ActivityIndicator size="small" color={colors.textDisabled} />
                </View>
            )}

            {!isLoadingMore && !hasMoreRef.current && allMessages.length > 0 && (
                <View style={{ alignItems: "center", paddingVertical: 12 }}>
                    <View style={[styles.beginPill, { backgroundColor: colors.hover }]}>
                        <Text style={[styles.beginText, { color: colors.textDisabled }]}>Beginning of conversation</Text>
                    </View>
                </View>
            )}

            {allMessages.map((msg) => (
                <MessageBubble
                    key={msg.message_id}
                    msg={msg}
                    self={msg.sender_id === currentUser?.id}
                    selectedUser={selectedUser}
                    currentUser={currentUser}
                    allMessages={allMessages}
                    colors={colors}
                    isDark={isDark}
                    onReply={handleReply}
                    onDelete={handleDeleteMessage}
                    onImagePress={handleImageClick}
                    onPostPress={(id) => router.push(`/posts/${id}`)}
                    onReact={handleReaction}
                />
            ))}

            {typingUser === selectedUser.id && <TypingIndicator colors={colors} />}
        </ScrollView>
    );
};

export default MessagesContainer;

const styles = StyleSheet.create({
    root: { flex: 1 },

    msgRow: { flexDirection: "row", alignItems: "flex-end", gap: 6 },
    msgAvatar: { width: 26, height: 26, borderRadius: 13, flexShrink: 0, marginBottom: 2 },

    replyQuote: { paddingHorizontal: 10, paddingVertical: 6, borderLeftWidth: 3, borderLeftColor: ACCENT, borderRadius: 8, marginBottom: 3 },
    replyQuoteUser: { fontSize: 11, fontWeight: "600", color: ACCENT, marginBottom: 2 },
    replyQuoteText: { fontSize: 12 },

    postCard: { borderRadius: 12, borderWidth: 1, overflow: "hidden", marginBottom: 3 },
    postCardHeader: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 7, borderBottomWidth: 1, gap: 7 },
    postCardAvatar: { width: 22, height: 22, borderRadius: 11 },
    postCardOwner: { fontSize: 12.5, fontWeight: "500" },
    postCardContent: { fontSize: 12.5 },

    mediaWrap: { borderRadius: 12, overflow: "hidden", borderWidth: 1, marginBottom: 3 },

    fileBubble: { flexDirection: "row", alignItems: "center", gap: 10, padding: 10, borderRadius: 12, borderWidth: 1, marginBottom: 3, width: 200 },
    fileName: { fontSize: 12.5, fontWeight: "500" },
    fileSize: { fontSize: 11 },

    bubble: { paddingHorizontal: 12, paddingVertical: 8 },
    bubbleText: { fontSize: 14, lineHeight: 21 },
    bubbleTime: { fontSize: 10.5, marginTop: 3 },

    actionsRow: { flexDirection: "row", gap: 6, marginTop: 3, marginBottom: 2 },
    actionChip: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, alignItems: "center", justifyContent: "center" },

    reactions: { flexDirection: "row", borderRadius: 20, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2, marginTop: 3 },
    reactionEmoji: { fontSize: 14 },

    tick: { marginBottom: 4, alignSelf: "flex-end" },

    typingRow: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14, borderWidth: 1, marginTop: 4 },
    typingDot: { width: 6, height: 6, borderRadius: 3 },

    skeletonRow: { flexDirection: "row", alignItems: "flex-end", gap: 8, marginBottom: 8 },
    skeletonAvatar: { width: 26, height: 26, borderRadius: 13 },
    skeletonBubble: { height: 38, borderRadius: 14 },

    beginPill: { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20 },
    beginText: { fontSize: 11 },

    emptyState: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, padding: 32 },
    emptyIcon: { width: 64, height: 64, borderRadius: 20, alignItems: "center", justifyContent: "center" },
    emptyTitle: { fontWeight: "500", fontSize: 15 },
    emptySub: { fontSize: 13 },
});