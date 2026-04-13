import React, { useEffect, useRef, useState } from "react";
import {
    View,
    Text,
    Image,
    TextInput,
    TouchableOpacity,
    Modal,
    ScrollView,
    StyleSheet,
    Animated,
    Pressable,
    KeyboardAvoidingView,
    Platform,
} from "react-native";
import BottomSheet, { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { toggleLikeComment } from "../services/api";
import { useThemeColors } from "../hooks/useThemeColors";

// ── Types ──────────────────────────────────────────────────────────────────────
interface Comment {
    id: number;
    post_id: string;
    user_id: string;
    content: string;
    parent_comment_id: null | number;
    created_at: string;
    updated_at: string;
    commenter_username: string;
    commenter_profile_picture: string;
    timeAgo: string;
    likes_count: number;
    liked_by_user: boolean;
}

interface ScrollableCommentsDrawerProps {
    drawerOpen: boolean;
    setDrawerOpen: (open: boolean) => void;
    postComments: Comment[];
    handleComment: () => void;
    commentText: string;
    setCommentText: (text: string) => void;
    commentInputRef: React.RefObject<TextInput>;
    content: string;
    username: string;
    avatarUrl: string | undefined;
    setSelectedCommentId: (id: number | null) => void;
    handleDeleteComment: () => void;
}

// ── DialogButton ───────────────────────────────────────────────────────────────
function DialogButton({
    icon,
    label,
    onPress,
    danger = false,
    warning = false,
    muted = false,
}: {
    icon: React.ReactNode;
    label: string;
    onPress: () => void;
    danger?: boolean;
    warning?: boolean;
    muted?: boolean;
}) {
    const colors = useThemeColors();
    const iconBg = danger || warning ? "rgba(229,57,53,0.08)" : colors.hover;
    const labelColor = warning
        ? colors.textPrimary
        : danger
        ? "#e53935"
        : muted
        ? colors.textDisabled
        : colors.textSecondary;

    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.7}
            style={[styles.dialogBtn, warning && { backgroundColor: "rgba(229,57,53,0.18)" }]}
        >
            <View style={[styles.dialogBtnIcon, { backgroundColor: iconBg }]}>{icon}</View>
            <Text style={[styles.dialogBtnLabel, { color: labelColor }]}>{label}</Text>
        </TouchableOpacity>
    );
}

function DialogDivider() {
    const colors = useThemeColors();
    return <View style={[styles.dialogDivider, { backgroundColor: colors.border }]} />;
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function ScrollableCommentsDrawer({
    drawerOpen,
    setDrawerOpen,
    postComments,
    handleComment,
    commentText,
    setCommentText,
    commentInputRef,
    content,
    username,
    avatarUrl,
    setSelectedCommentId,
    handleDeleteComment,
}: ScrollableCommentsDrawerProps) {
    const colors = useThemeColors();

    const [currentUser, setCurrentUser] = useState<any>(null);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [likesState, setLikesState] = useState<Record<number, { liked: boolean; count: number }>>({});
    const likeScales = useRef<Record<number, Animated.Value>>({});

    const bottomSheetRef = useRef<BottomSheet>(null);
    const snapPoints = ["88%"];

    // Load current user
    useEffect(() => {
        AsyncStorage.getItem("user").then((raw) => {
            if (raw) setCurrentUser(JSON.parse(raw));
        });
    }, []);

    // Open / close bottom sheet
    useEffect(() => {
        if (drawerOpen) {
            bottomSheetRef.current?.expand();
        } else {
            bottomSheetRef.current?.close();
        }
    }, [drawerOpen]);

    // Focus input when drawer opens
    useEffect(() => {
        if (drawerOpen) {
            const t = setTimeout(() => commentInputRef.current?.focus(), 350);
            return () => clearTimeout(t);
        }
    }, [drawerOpen]);

    // Sync likes state from props
    useEffect(() => {
        const initial: Record<number, { liked: boolean; count: number }> = {};
        postComments.forEach((c) => {
            initial[c.id] = { liked: c.liked_by_user, count: c.likes_count };
            if (!likeScales.current[c.id]) {
                likeScales.current[c.id] = new Animated.Value(1);
            }
        });
        setLikesState(initial);
    }, [postComments]);

    const animateLike = (commentId: number) => {
        const scale = likeScales.current[commentId];
        if (!scale) return;
        Animated.sequence([
            Animated.spring(scale, { toValue: 1.6, useNativeDriver: true, speed: 50 }),
            Animated.spring(scale, { toValue: 0.85, useNativeDriver: true, speed: 50 }),
            Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 50 }),
        ]).start();
    };

    const handleToggleLike = async (commentId: number) => {
        const prev = likesState[commentId];
        const isLiked = prev?.liked;
        if (!isLiked) animateLike(commentId);
        setLikesState((s) => ({
            ...s,
            [commentId]: { liked: !isLiked, count: prev?.count + (isLiked ? -1 : 1) },
        }));
        try {
            const res = await toggleLikeComment(commentId);
            if (res.error) throw new Error();
        } catch {
            setLikesState((s) => ({
                ...s,
                [commentId]: { liked: isLiked, count: prev?.count },
            }));
        }
    };

    const handleOpenDialog = (commentId: number) => {
        setSelectedCommentId(commentId);
        setDialogOpen(true);
    };

    const handleCloseDialog = () => {
        setDialogOpen(false);
        setSelectedCommentId(null);
        setConfirmDelete(false);
    };

    const canSend = commentText.trim().length > 0;

    if (!drawerOpen) return null;

    return (
        <>
            {/* ── Backdrop ── */}
            <Pressable style={styles.backdrop} onPress={() => setDrawerOpen(false)} />

            {/* ── Bottom Sheet ── */}
            <BottomSheet
                ref={bottomSheetRef}
                snapPoints={snapPoints}
                onClose={() => setDrawerOpen(false)}
                enablePanDownToClose
                backgroundStyle={{ backgroundColor: colors.surface }}
                handleIndicatorStyle={{ backgroundColor: colors.border }}
            >
                {/* Header */}
                <View style={[styles.header, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Comments</Text>
                    {postComments.length > 0 && (
                        <View style={[styles.countBadge, { backgroundColor: colors.hover, borderColor: colors.border }]}>
                            <Text style={[styles.countBadgeText, { color: colors.textDisabled }]}>{postComments.length}</Text>
                        </View>
                    )}
                </View>

                {/* Scrollable Comments */}
                <BottomSheetScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: 100 }]}>
                    {/* Caption row */}
                    <View style={[styles.captionRow, { borderBottomColor: colors.border }]}>
                        <Image
                            source={avatarUrl ? { uri: avatarUrl } : require("../assets/profile_blank.png")}
                            style={[styles.captionAvatar, { borderColor: colors.border }]}
                        />
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.captionUsername, { color: colors.textPrimary }]}>{username}</Text>
                            <Text style={[styles.captionContent, { color: colors.textSecondary }]}>{content}</Text>
                        </View>
                    </View>

                    {/* Empty state */}
                    {postComments.length === 0 ? (
                        <View style={styles.emptyState}>
                            <View style={[styles.emptyIcon, { backgroundColor: colors.hover, borderColor: colors.border }]}>
                                <Ionicons name="chatbubble-outline" size={22} color={colors.textDisabled} />
                            </View>
                            <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>No comments yet</Text>
                            <Text style={[styles.emptySubtitle, { color: colors.textDisabled }]}>Be the first to comment</Text>
                        </View>
                    ) : (
                        postComments.map((comment) => {
                            const likeData = likesState[comment.id];
                            const isLiked = likeData?.liked;
                            const likeCount = likeData?.count ?? 0;
                            const isOwn = String(comment.user_id) === String(currentUser?.id);
                            const scale = likeScales.current[comment.id] || new Animated.Value(1);

                            return (
                                <View key={comment.id} style={styles.commentRow}>
                                    <Image
                                        source={
                                            comment.commenter_profile_picture
                                                ? { uri: comment.commenter_profile_picture }
                                                : require("../assets/profile_blank.png")
                                        }
                                        style={styles.commentAvatar}
                                    />
                                    <View style={{ flex: 1, minWidth: 0 }}>
                                        <View style={styles.commentMeta}>
                                            <Text style={[styles.commentUsername, { color: colors.textPrimary }]}>
                                                {comment.commenter_username}
                                            </Text>
                                            <Text style={[styles.commentTimeAgo, { color: colors.textDisabled }]}>
                                                {comment.timeAgo}
                                            </Text>
                                            {isOwn && (
                                                <TouchableOpacity
                                                    onPress={() => handleOpenDialog(comment.id)}
                                                    style={[styles.commentMenuBtn, { marginLeft: "auto" }]}
                                                    activeOpacity={0.7}
                                                >
                                                    <Ionicons name="ellipsis-horizontal" size={15} color={colors.textDisabled} />
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                        <View style={[styles.commentBubble, { backgroundColor: colors.hover }]}>
                                            <Text style={[styles.commentText, { color: colors.textPrimary }]}>
                                                {comment.content}
                                            </Text>
                                        </View>
                                    </View>

                                    {/* Like */}
                                    <View style={styles.commentLikeCol}>
                                        <Animated.View style={{ transform: [{ scale }] }}>
                                            <TouchableOpacity
                                                onPress={() => handleToggleLike(comment.id)}
                                                activeOpacity={1}
                                                style={styles.commentLikeBtn}
                                            >
                                                <Ionicons
                                                    name={isLiked ? "heart" : "heart-outline"}
                                                    size={15}
                                                    color={isLiked ? "#e53935" : colors.textDisabled}
                                                />
                                            </TouchableOpacity>
                                        </Animated.View>
                                        {likeCount > 0 && (
                                            <Text style={[styles.commentLikeCount, { color: isLiked ? "#e53935" : colors.textDisabled, fontWeight: isLiked ? "600" : "400" }]}>
                                                {likeCount}
                                            </Text>
                                        )}
                                    </View>
                                </View>
                            );
                        })
                    )}
                </BottomSheetScrollView>

                {/* ── Comment Input ── */}
                <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    style={[styles.inputWrapper, { borderTopColor: colors.border, backgroundColor: colors.bg }]}
                >
                    <View style={[styles.inputRow, { backgroundColor: colors.hover, borderColor: colors.border }]}>
                        <Image
                            source={
                                currentUser?.profile_picture_url
                                    ? { uri: currentUser.profile_picture_url }
                                    : require("../assets/profile_blank.png")
                            }
                            style={[styles.inputAvatar, { borderColor: colors.border }]}
                        />
                        <TextInput
                            ref={commentInputRef}
                            style={[styles.input, { color: colors.textPrimary }]}
                            placeholder="Add a comment…"
                            placeholderTextColor={colors.textDisabled}
                            value={commentText}
                            onChangeText={setCommentText}
                            multiline
                            returnKeyType="send"
                            onSubmitEditing={() => { if (canSend) handleComment(); }}
                        />
                        <TouchableOpacity
                            onPress={canSend ? handleComment : undefined}
                            activeOpacity={canSend ? 0.8 : 1}
                            style={[styles.sendBtn, { backgroundColor: canSend ? "#7c5cfc" : colors.hover }]}
                        >
                            <Ionicons name="send" size={14} color={canSend ? "#fff" : colors.textDisabled} />
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </BottomSheet>

            {/* ── Comment Options Modal ── */}
            <Modal visible={dialogOpen} transparent animationType="fade" onRequestClose={handleCloseDialog}>
                <Pressable style={styles.modalBackdrop} onPress={handleCloseDialog}>
                    <Pressable>
                        <View style={[styles.optionsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                            <DialogButton
                                icon={
                                    confirmDelete
                                        ? <MaterialIcons name="warning" size={17} color="#e53935" />
                                        : <MaterialIcons name="delete" size={17} color="#e53935" />
                                }
                                label={confirmDelete ? "Confirm delete" : "Delete comment"}
                                onPress={() => {
                                    if (confirmDelete) {
                                        handleDeleteComment();
                                        handleCloseDialog();
                                    } else {
                                        setConfirmDelete(true);
                                    }
                                }}
                                danger={!confirmDelete}
                                warning={confirmDelete}
                            />
                            <DialogDivider />
                            <DialogButton
                                icon={<Ionicons name="close" size={17} color={colors.textDisabled} />}
                                label="Cancel"
                                onPress={handleCloseDialog}
                                muted
                            />
                        </View>
                    </Pressable>
                </Pressable>
            </Modal>
        </>
    );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.45)" },

    // Header
    header: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, position: "relative" },
    headerTitle: { fontWeight: "700", fontSize: 14.5, letterSpacing: 0.1 },
    countBadge: { position: "absolute", right: 16, paddingHorizontal: 10, paddingVertical: 2, borderRadius: 20, borderWidth: 1 },
    countBadgeText: { fontSize: 11, fontWeight: "500" },

    // Scroll
    scrollContent: { paddingHorizontal: 16, paddingTop: 12 },

    // Caption
    captionRow: { flexDirection: "row", gap: 10, marginBottom: 16, paddingBottom: 16, borderBottomWidth: 1, alignItems: "flex-start" },
    captionAvatar: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, flexShrink: 0, marginTop: 2 },
    captionUsername: { fontWeight: "600", fontSize: 13, lineHeight: 18 },
    captionContent: { fontSize: 13, marginTop: 3, lineHeight: 20 },

    // Empty
    emptyState: { alignItems: "center", justifyContent: "center", paddingVertical: 48, gap: 12 },
    emptyIcon: { width: 52, height: 52, borderRadius: 16, alignItems: "center", justifyContent: "center", borderWidth: 1 },
    emptyTitle: { fontWeight: "500", fontSize: 13.5 },
    emptySubtitle: { fontSize: 12 },

    // Comment row
    commentRow: { flexDirection: "row", gap: 10, marginBottom: 18, alignItems: "flex-start" },
    commentAvatar: { width: 33, height: 33, borderRadius: 16.5, flexShrink: 0, marginTop: 2 },
    commentMeta: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 5 },
    commentUsername: { fontWeight: "600", fontSize: 12.5 },
    commentTimeAgo: { fontSize: 10.5 },
    commentMenuBtn: { padding: 4 },
    commentBubble: { borderRadius: 4, alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 7 },
    commentText: { fontSize: 13.5, lineHeight: 20 },
    commentLikeCol: { flexDirection: "column", alignItems: "center", flexShrink: 0, gap: 2, paddingTop: 4, minWidth: 28 },
    commentLikeBtn: { padding: 6 },
    commentLikeCount: { fontSize: 10, lineHeight: 12 },

    // Input
    inputWrapper: { position: "absolute", bottom: 0, left: 0, right: 0, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1 },
    inputRow: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 16, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6 },
    inputAvatar: { width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, flexShrink: 0 },
    input: { flex: 1, fontSize: 13.5, maxHeight: 100 },
    sendBtn: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center", flexShrink: 0 },

    // Options modal
    modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center", padding: 16 },
    optionsCard: { width: 300, borderRadius: 20, borderWidth: 1, padding: 6 },
    dialogBtn: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 11, borderRadius: 12 },
    dialogBtnIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
    dialogBtnLabel: { fontWeight: "500", fontSize: 14 },
    dialogDivider: { height: 1, marginHorizontal: 8, marginVertical: 4 },
});