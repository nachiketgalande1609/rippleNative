import React, { useState, useEffect, useRef } from "react";
import {
    View,
    Text,
    Image,
    TouchableOpacity,
    TextInput,
    Modal,
    ScrollView,
    StyleSheet,
    ActivityIndicator,
    Animated,
    Pressable,
    KeyboardAvoidingView,
    Platform,
    Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
    getPost,
    likePost,
    addComment,
    savePost,
    deletePost,
    updatePost,
    deleteComment,
} from "../services/api";
import { useThemeColors } from "../hooks/useThemeColors";

const ACCENT = "#D4A96A";
const ACCENT_DIM = "rgba(212,169,106,0.15)";

// ── Sheet Button ───────────────────────────────────────────────────────────────
function SheetButton({
    icon,
    label,
    onPress,
    variant = "default",
    colors,
}: {
    icon: React.ReactNode;
    label: string;
    onPress: () => void;
    variant?: "default" | "danger" | "warning" | "muted";
    colors: any;
}) {
    const labelColor =
        variant === "danger" ? colors.error :
        variant === "warning" ? "#f59e0b" :
        variant === "muted" ? colors.textDisabled :
        colors.textSecondary;

    return (
        <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={styles.sheetBtn}>
            <View style={[styles.sheetBtnIcon, { backgroundColor: colors.hover, borderColor: colors.border }]}>
                {icon}
            </View>
            <Text style={[styles.sheetBtnLabel, { color: labelColor }]}>{label}</Text>
        </TouchableOpacity>
    );
}

function SheetDivider({ colors }: { colors: any }) {
    return <View style={[styles.sheetDivider, { backgroundColor: colors.border }]} />;
}

// ── Comment Item ───────────────────────────────────────────────────────────────
function CommentItem({
    comment,
    isOwner,
    onDelete,
    colors,
    onProfilePress,
}: {
    comment: any;
    isOwner: boolean;
    onDelete: (id: number) => void;
    colors: any;
    onProfilePress: (userId: string) => void;
}) {
    return (
        <View style={styles.commentRow}>
            <TouchableOpacity onPress={() => onProfilePress(comment.user_id)} activeOpacity={0.8}>
                <Image
                    source={
                        comment.commenter_profile_picture
                            ? { uri: comment.commenter_profile_picture }
                            : require("../assets/profile_blank.png")
                    }
                    style={[styles.commentAvatar, { borderColor: colors.border }]}
                />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
                <Text style={[styles.commentText, { color: colors.textSecondary }]}>
                    <Text
                        style={[styles.commentUsername, { color: colors.textPrimary }]}
                        onPress={() => onProfilePress(comment.user_id)}
                    >
                        {comment.commenter_username}{" "}
                    </Text>
                    {comment.content}
                </Text>
                <Text style={[styles.commentTime, { color: colors.textDisabled }]}>{comment.timeAgo}</Text>
            </View>
            {isOwner && (
                <TouchableOpacity
                    onPress={() => onDelete(comment.id)}
                    style={styles.deleteCommentBtn}
                    activeOpacity={0.7}
                >
                    <Ionicons name="trash-outline" size={14} color={colors.textDisabled} />
                </TouchableOpacity>
            )}
        </View>
    );
}

// ── Skeleton ───────────────────────────────────────────────────────────────────
function LoadingSkeleton({ colors }: { colors: any }) {
    return (
        <View style={[styles.skeletonRoot, { backgroundColor: colors.bg }]}>
            <View style={[styles.skeletonHeader, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
                <View style={[styles.skeletonCircle, { backgroundColor: colors.hover }]} />
                <View style={[styles.skeletonLine, { width: 80, backgroundColor: colors.hover }]} />
            </View>
            <View style={[styles.skeletonImage, { backgroundColor: colors.hover }]} />
            <View style={[styles.skeletonSide, { backgroundColor: colors.surface }]}>
                <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
                    <View style={[styles.skeletonCircleLg, { backgroundColor: colors.hover }]} />
                    <View style={{ flex: 1, gap: 7 }}>
                        <View style={[styles.skeletonLine, { width: "45%", backgroundColor: colors.hover }]} />
                        <View style={[styles.skeletonLine, { width: "30%", height: 10, backgroundColor: colors.hover }]} />
                    </View>
                </View>
                {[1, 2, 3, 4, 5].map((i) => (
                    <View key={i} style={[styles.skeletonLine, { backgroundColor: colors.hover, marginBottom: 10 }]} />
                ))}
            </View>
        </View>
    );
}

// ── Main Component ─────────────────────────────────────────────────────────────
const PostDetailPage = () => {
    const colors = useThemeColors();
    const router = useRouter();
    const { postId } = useLocalSearchParams<{ postId: string }>();

    const [currentUser, setCurrentUser] = useState<any>(null);
    const [post, setPost] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isLiked, setIsLiked] = useState(false);
    const [likeCount, setLikeCount] = useState(0);
    const [isSaved, setIsSaved] = useState(false);
    const [commentText, setCommentText] = useState("");
    const [comments, setComments] = useState<any[]>([]);
    const [commentCount, setCommentCount] = useState(0);
    const [optionsOpen, setOptionsOpen] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editedContent, setEditedContent] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const likeScale = useRef(new Animated.Value(1)).current;
    const heartOpacity = useRef(new Animated.Value(0)).current;
    const heartScale = useRef(new Animated.Value(0.5)).current;
    const commentInputRef = useRef<TextInput>(null);

    useEffect(() => {
        AsyncStorage.getItem("user").then((raw) => { if (raw) setCurrentUser(JSON.parse(raw)); });
    }, []);

    const isOwner = currentUser?.id === post?.user_id;
    const isVideo = post?.file_url && /\.(mp4|mov|webm)$/i.test(post.file_url);

    const fetchPost = async () => {
        if (!postId) return;
        try {
            setLoading(true);
            const res = await getPost(postId);
            const data = res.data;
            setPost(data);
            setIsLiked(data.liked_by_current_user);
            setLikeCount(data.like_count);
            setIsSaved(data.saved_by_current_user);
            setComments(data.comments || []);
            setCommentCount(data.comment_count || 0);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchPost(); }, [postId]);

    const animateLike = () => {
        Animated.sequence([
            Animated.spring(likeScale, { toValue: 1.4, useNativeDriver: true, speed: 50 }),
            Animated.spring(likeScale, { toValue: 0.88, useNativeDriver: true, speed: 50 }),
            Animated.spring(likeScale, { toValue: 1, useNativeDriver: true, speed: 50 }),
        ]).start();
    };

    const showHeart = () => {
        heartOpacity.setValue(1);
        heartScale.setValue(0.5);
        Animated.parallel([
            Animated.spring(heartScale, { toValue: 1.3, useNativeDriver: true, speed: 30 }),
        ]).start(() => {
            setTimeout(() => {
                Animated.timing(heartOpacity, { toValue: 0, duration: 300, useNativeDriver: true }).start();
            }, 400);
        });
    };

    const handleLike = async () => {
        const prev = isLiked;
        const prevCount = likeCount;
        setIsLiked(!prev);
        setLikeCount(prev ? prevCount - 1 : prevCount + 1);
        if (!prev) animateLike();
        try { await likePost(post.id); }
        catch { setIsLiked(prev); setLikeCount(prevCount); }
    };

    const handleDoubleTapLike = async () => {
        showHeart();
        if (!isLiked) await handleLike();
    };

    const handleSave = async () => {
        const prev = isSaved;
        setIsSaved(!prev);
        try {
            const res = await savePost(post.id);
            if (!res.success) setIsSaved(prev);
        } catch { setIsSaved(prev); }
    };

    const handleComment = async () => {
        if (!commentText.trim() || submitting) return;
        const newComment = {
            id: Date.now(),
            post_id: post.id,
            user_id: currentUser?.id,
            content: commentText,
            parent_comment_id: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            commenter_username: currentUser?.username,
            commenter_profile_picture: currentUser?.profile_picture_url,
            timeAgo: "Just now",
            likes_count: 0,
            liked_by_user: false,
        };
        setComments((p) => [newComment, ...p]);
        setCommentCount((c) => c + 1);
        setCommentText("");
        setSubmitting(true);
        try {
            const res = await addComment(post.id, commentText);
            if (res?.success) fetchPost();
            else throw new Error();
        } catch {
            setComments((p) => p.filter((c) => c.id !== newComment.id));
            setCommentCount((c) => c - 1);
            Alert.alert("Error", "Failed to add comment.");
        } finally { setSubmitting(false); }
    };

    const handleDeleteComment = async (commentId: number) => {
        const toDelete = comments.find((c) => c.id === commentId);
        setComments((p) => p.filter((c) => c.id !== commentId));
        setCommentCount((c) => c - 1);
        try {
            const res = await deleteComment(commentId);
            if (!res?.success) throw new Error();
        } catch {
            if (toDelete) setComments((p) => [toDelete, ...p]);
            setCommentCount((c) => c + 1);
        }
    };

    const handleDeletePost = async () => {
        try {
            const res = await deletePost(post.id);
            if (res?.success) { setOptionsOpen(false); router.back(); }
        } catch { Alert.alert("Error", "Failed to delete post."); }
    };

    const handleSaveEdit = async () => {
        try {
            const res = await updatePost(post.id, editedContent);
            if (res?.success) { setIsEditing(false); fetchPost(); }
        } catch (e) { console.error(e); }
    };

    if (loading) return <LoadingSkeleton colors={colors} />;

    if (!post) {
        return (
            <SafeAreaView style={[styles.root, { backgroundColor: colors.bg }]} edges={["top"]}>
                <View style={styles.notFound}>
                    <Text style={[styles.notFoundText, { color: colors.textDisabled }]}>Post not found</Text>
                    <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
                        <Ionicons name="arrow-back" size={22} color={colors.textSecondary} />
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.root, { backgroundColor: colors.bg }]} edges={["top"]}>
            {/* ── Top nav ── */}
            <View style={[styles.topNav, { backgroundColor: colors.surface + "eb", borderBottomColor: colors.border }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
                    <Ionicons name="arrow-back" size={19} color={colors.textSecondary} />
                </TouchableOpacity>
                <Text style={[styles.navTitle, { color: colors.textPrimary }]}>Post</Text>
                <View style={{ width: 36 }} />
            </View>

            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
                <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
                    {/* ── Media ── */}
                    {post.file_url && !isVideo && (
                        <Pressable
                            onPress={() => {}}
                            onLongPress={handleDoubleTapLike}
                            style={[styles.mediaContainer, { backgroundColor: colors.bg }]}
                        >
                            <Image
                                source={{ uri: post.file_url }}
                                style={styles.mediaImage}
                                resizeMode="contain"
                            />
                            {/* Heart overlay */}
                            <Animated.View style={[styles.heartOverlay, { opacity: heartOpacity, transform: [{ scale: heartScale }] }]}>
                                <Text style={styles.heartEmoji}>❤️</Text>
                            </Animated.View>
                        </Pressable>
                    )}

                    {/* ── Author header ── */}
                    <View style={[styles.authorRow, { backgroundColor: colors.surface, borderBottomColor: colors.border, borderTopColor: colors.border }]}>
                        <TouchableOpacity
                            onPress={() => router.push(`/profile/${post.user_id}`)}
                            style={styles.authorLeft}
                            activeOpacity={0.8}
                        >
                            <Image
                                source={
                                    post.profile_picture
                                        ? { uri: post.profile_picture }
                                        : require("../assets/profile_blank.png")
                                }
                                style={[styles.authorAvatar, { borderColor: colors.border }]}
                            />
                            <View style={{ minWidth: 0 }}>
                                <Text style={[styles.authorName, { color: colors.textPrimary }]} numberOfLines={1}>{post.username}</Text>
                                {post.location && (
                                    <View style={styles.locationRow}>
                                        <Ionicons name="location-sharp" size={10} color={ACCENT} />
                                        <Text style={[styles.locationText, { color: colors.textDisabled }]}>{post.location}</Text>
                                    </View>
                                )}
                            </View>
                        </TouchableOpacity>
                        {isOwner && (
                            <TouchableOpacity onPress={() => setOptionsOpen(true)} style={styles.moreBtn} activeOpacity={0.7}>
                                <Ionicons name="ellipsis-horizontal" size={19} color={colors.textDisabled} />
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* ── Caption ── */}
                    {!!post.content && (
                        <View style={[styles.captionSection, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
                            <Text style={[styles.captionText, { color: colors.textSecondary }]}>
                                <Text
                                    style={[styles.captionUsername, { color: colors.textPrimary }]}
                                    onPress={() => router.push(`/profile/${post.user_id}`)}
                                >
                                    {post.username}{" "}
                                </Text>
                                {post.content}
                            </Text>
                            <Text style={[styles.captionTime, { color: colors.textDisabled }]}>{post.timeAgo}</Text>
                        </View>
                    )}

                    {/* ── Actions ── */}
                    <View style={[styles.actionsRow, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
                        <View style={styles.actionsLeft}>
                            <Animated.View style={{ transform: [{ scale: likeScale }] }}>
                                <TouchableOpacity onPress={handleLike} activeOpacity={1} style={styles.actionBtn}>
                                    <Ionicons
                                        name={isLiked ? "heart" : "heart-outline"}
                                        size={22}
                                        color={isLiked ? "#e53935" : colors.textDisabled}
                                    />
                                </TouchableOpacity>
                            </Animated.View>
                            {likeCount > 0 && <Text style={[styles.actionCount, { color: colors.textSecondary }]}>{likeCount}</Text>}

                            <TouchableOpacity onPress={() => commentInputRef.current?.focus()} activeOpacity={1} style={[styles.actionBtn, { marginLeft: 6 }]}>
                                <Ionicons name="chatbubble-outline" size={20} color={colors.textDisabled} />
                            </TouchableOpacity>
                            {commentCount > 0 && <Text style={[styles.actionCount, { color: colors.textSecondary }]}>{commentCount}</Text>}
                        </View>

                        <TouchableOpacity onPress={handleSave} activeOpacity={1} style={styles.actionBtn}>
                            <Ionicons
                                name={isSaved ? "bookmark" : "bookmark-outline"}
                                size={22}
                                color={isSaved ? ACCENT : colors.textDisabled}
                            />
                        </TouchableOpacity>
                    </View>

                    {/* ── Comments ── */}
                    <View style={[styles.commentsSection, { backgroundColor: colors.surface }]}>
                        {comments.length === 0 ? (
                            <View style={styles.emptyComments}>
                                <View style={[styles.emptyCommentIcon, { backgroundColor: colors.hover, borderColor: colors.border }]}>
                                    <Ionicons name="chatbubble-outline" size={20} color={colors.textDisabled} />
                                </View>
                                <Text style={[styles.emptyCommentTitle, { color: colors.textSecondary }]}>No comments yet</Text>
                                <Text style={[styles.emptyCommentSub, { color: colors.textDisabled }]}>Start the conversation</Text>
                            </View>
                        ) : (
                            comments.map((comment) => (
                                <CommentItem
                                    key={comment.id}
                                    comment={comment}
                                    isOwner={currentUser?.id === comment.user_id || isOwner}
                                    onDelete={handleDeleteComment}
                                    colors={colors}
                                    onProfilePress={(uid) => router.push(`/profile/${uid}`)}
                                />
                            ))
                        )}
                    </View>
                </ScrollView>

                {/* ── Comment input ── */}
                <View style={[styles.commentInputBar, { backgroundColor: colors.bg, borderTopColor: colors.border }]}>
                    <Image
                        source={
                            currentUser?.profile_picture_url
                                ? { uri: currentUser.profile_picture_url }
                                : require("../assets/profile_blank.png")
                        }
                        style={[styles.inputAvatar, { borderColor: colors.border }]}
                    />
                    <View style={[styles.inputWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <TextInput
                            ref={commentInputRef}
                            style={[styles.commentInput, { color: colors.textPrimary }]}
                            placeholder="Add a comment…"
                            placeholderTextColor={colors.textDisabled}
                            value={commentText}
                            onChangeText={setCommentText}
                            returnKeyType="send"
                            onSubmitEditing={handleComment}
                            multiline
                        />
                    </View>
                    <TouchableOpacity
                        onPress={handleComment}
                        disabled={!commentText.trim() || submitting}
                        activeOpacity={0.8}
                        style={[
                            styles.sendBtn,
                            commentText.trim()
                                ? { backgroundColor: ACCENT_DIM, borderColor: "rgba(212,169,106,0.25)" }
                                : { backgroundColor: "transparent", borderColor: colors.border },
                        ]}
                    >
                        {submitting ? (
                            <ActivityIndicator size={14} color={ACCENT} />
                        ) : (
                            <Ionicons name="send" size={16} color={commentText.trim() ? ACCENT : colors.textDisabled} />
                        )}
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>

            {/* ── Options modal ── */}
            {isOwner && (
                <Modal visible={optionsOpen} transparent animationType="fade" onRequestClose={() => { setOptionsOpen(false); setConfirmDelete(false); }}>
                    <Pressable style={styles.modalBackdrop} onPress={() => { setOptionsOpen(false); setConfirmDelete(false); }}>
                        <Pressable>
                            <View style={[styles.optionsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                                <SheetButton
                                    icon={<MaterialIcons name="edit" size={16} color={colors.textSecondary} />}
                                    label="Edit caption"
                                    onPress={() => { setIsEditing(true); setEditedContent(post.content); setOptionsOpen(false); setConfirmDelete(false); }}
                                    colors={colors}
                                />
                                <SheetButton
                                    icon={
                                        confirmDelete
                                            ? <MaterialIcons name="warning" size={16} color="#f59e0b" />
                                            : <MaterialIcons name="delete" size={16} color={colors.error} />
                                    }
                                    label={confirmDelete ? "Tap again to confirm delete" : "Delete post"}
                                    onPress={() => confirmDelete ? handleDeletePost() : setConfirmDelete(true)}
                                    variant={confirmDelete ? "warning" : "danger"}
                                    colors={colors}
                                />
                                <SheetDivider colors={colors} />
                                <SheetButton
                                    icon={<Ionicons name="close" size={16} color={colors.textDisabled} />}
                                    label="Cancel"
                                    onPress={() => { setOptionsOpen(false); setConfirmDelete(false); }}
                                    variant="muted"
                                    colors={colors}
                                />
                            </View>
                        </Pressable>
                    </Pressable>
                </Modal>
            )}

            {/* ── Edit modal ── */}
            <Modal visible={isEditing} transparent animationType="fade" onRequestClose={() => { setIsEditing(false); setEditedContent(""); }}>
                <Pressable style={styles.modalBackdrop} onPress={() => { setIsEditing(false); setEditedContent(""); }}>
                    <Pressable>
                        <View style={[styles.editCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                            {/* Media preview */}
                            {!!post.file_url && (
                                <View style={{ position: "relative" }}>
                                    <Image source={{ uri: post.file_url }} style={styles.editPreview} resizeMode="cover" />
                                    <View style={styles.editPreviewOverlay} />
                                    <TouchableOpacity
                                        onPress={() => setIsEditing(false)}
                                        style={styles.editCloseBtn}
                                    >
                                        <Ionicons name="close" size={14} color="#fff" />
                                    </TouchableOpacity>
                                </View>
                            )}

                            <View style={styles.editBody}>
                                <Text style={[styles.editLabel, { color: colors.textDisabled }]}>EDIT CAPTION</Text>
                                <View style={[styles.editInputWrap, { backgroundColor: colors.hover, borderColor: colors.border }]}>
                                    <TextInput
                                        style={[styles.editInput, { color: colors.textPrimary }]}
                                        multiline
                                        value={editedContent}
                                        onChangeText={setEditedContent}
                                        placeholder="Write a caption…"
                                        placeholderTextColor={colors.textDisabled}
                                    />
                                </View>
                                <View style={styles.editActions}>
                                    <TouchableOpacity
                                        onPress={() => setIsEditing(false)}
                                        style={[styles.editCancelBtn, { backgroundColor: colors.hover }]}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={[styles.editCancelText, { color: colors.textDisabled }]}>Cancel</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={handleSaveEdit}
                                        disabled={editedContent === post.content}
                                        style={[styles.editSaveBtn, { backgroundColor: ACCENT, opacity: editedContent === post.content ? 0.4 : 1 }]}
                                        activeOpacity={0.8}
                                    >
                                        <Text style={styles.editSaveText}>Save</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    </Pressable>
                </Pressable>
            </Modal>
        </SafeAreaView>
    );
};

export default PostDetailPage;

// ── Styles ─────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    root: { flex: 1 },
    notFound: { flex: 1, alignItems: "center", justifyContent: "center" },
    notFoundText: { fontSize: 14.5 },

    // Top nav
    topNav: { height: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 8, borderBottomWidth: 1 },
    backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 10 },
    navTitle: { fontSize: 17, fontStyle: "italic", letterSpacing: -0.3 },

    // Media
    mediaContainer: { width: "100%", minHeight: 300, alignItems: "center", justifyContent: "center" },
    mediaImage: { width: "100%", height: 380 },
    heartOverlay: { position: "absolute", alignItems: "center", justifyContent: "center" },
    heartEmoji: { fontSize: 80 },

    // Author
    authorRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: 0.5, borderBottomWidth: 0.5 },
    authorLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1, minWidth: 0 },
    authorAvatar: { width: 40, height: 40, borderRadius: 20, borderWidth: 2 },
    authorName: { fontWeight: "600", fontSize: 14, letterSpacing: -0.1 },
    locationRow: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 2 },
    locationText: { fontSize: 11 },
    moreBtn: { padding: 6 },

    // Caption
    captionSection: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 0.5 },
    captionText: { fontSize: 14, lineHeight: 22 },
    captionUsername: { fontWeight: "600" },
    captionTime: { fontSize: 10.5, marginTop: 6, letterSpacing: 0.5 },

    // Actions
    actionsRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 10, paddingVertical: 6, borderBottomWidth: 0.5 },
    actionsLeft: { flexDirection: "row", alignItems: "center" },
    actionBtn: { padding: 7 },
    actionCount: { fontSize: 12.5, fontWeight: "500", marginRight: 6 },

    // Comments
    commentsSection: { paddingHorizontal: 8, paddingTop: 8, paddingBottom: 16 },
    commentRow: { flexDirection: "row", gap: 10, paddingVertical: 10, paddingHorizontal: 8, alignItems: "flex-start" },
    commentAvatar: { width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, flexShrink: 0, marginTop: 2 },
    commentText: { fontSize: 13.5, lineHeight: 20 },
    commentUsername: { fontWeight: "600" },
    commentTime: { fontSize: 11, marginTop: 3 },
    deleteCommentBtn: { padding: 6, alignSelf: "center" },

    // Empty comments
    emptyComments: { alignItems: "center", paddingVertical: 48, gap: 10 },
    emptyCommentIcon: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: "center", justifyContent: "center" },
    emptyCommentTitle: { fontWeight: "500", fontSize: 13.5 },
    emptyCommentSub: { fontSize: 12.5 },

    // Comment input bar
    commentInputBar: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1 },
    inputAvatar: { width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, flexShrink: 0 },
    inputWrap: { flex: 1, borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 6 },
    commentInput: { fontSize: 13.5, maxHeight: 80 },
    sendBtn: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, alignItems: "center", justifyContent: "center", flexShrink: 0 },

    // Modal shared
    modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.65)", alignItems: "center", justifyContent: "center", padding: 16 },

    // Options modal
    optionsCard: { width: 300, borderRadius: 18, borderWidth: 1, padding: 6 },
    sheetBtn: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
    sheetBtnIcon: { width: 32, height: 32, borderRadius: 9, borderWidth: 1, alignItems: "center", justifyContent: "center" },
    sheetBtnLabel: { fontWeight: "500", fontSize: 14 },
    sheetDivider: { height: 1, marginHorizontal: 12, marginVertical: 4 },

    // Edit modal
    editCard: { width: "90%", maxWidth: 460, borderRadius: 18, borderWidth: 1, overflow: "hidden" },
    editPreview: { width: "100%", height: 180 },
    editPreviewOverlay: { position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.3)" },
    editCloseBtn: { position: "absolute", top: 10, right: 10, backgroundColor: "rgba(0,0,0,0.5)", width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
    editBody: { padding: 20, gap: 14 },
    editLabel: { fontSize: 11, fontWeight: "600", letterSpacing: 1 },
    editInputWrap: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10 },
    editInput: { fontSize: 14.5, lineHeight: 22, minHeight: 72 },
    editActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10 },
    editCancelBtn: { borderRadius: 10, paddingHorizontal: 16, paddingVertical: 9 },
    editCancelText: { fontSize: 13.5, fontWeight: "500" },
    editSaveBtn: { borderRadius: 10, paddingHorizontal: 20, paddingVertical: 9 },
    editSaveText: { color: "#fff", fontSize: 13.5, fontWeight: "600" },

    // Skeleton
    skeletonRoot: { flex: 1 },
    skeletonHeader: { height: 56, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, borderBottomWidth: 1 },
    skeletonCircle: { width: 34, height: 34, borderRadius: 17 },
    skeletonCircleLg: { width: 42, height: 42, borderRadius: 21 },
    skeletonImage: { height: 320 },
    skeletonSide: { padding: 20 },
    skeletonLine: { height: 13, borderRadius: 6, marginBottom: 2 },
});