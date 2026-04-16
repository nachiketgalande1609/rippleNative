import React, { useState, useEffect, useRef } from "react";
import {
    View, Text, Image, TouchableOpacity, TextInput, Modal,
    ScrollView, StyleSheet, ActivityIndicator, Animated,
    Pressable, KeyboardAvoidingView, Platform, Alert, Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
    getPost, likePost, addComment, savePost,
    deletePost, updatePost, deleteComment,
} from "../services/api";
import { useThemeColors } from "../hooks/useThemeColors";

const ACCENT = "#7c5cfc";
const { width: SW } = Dimensions.get("window");

// ── Sheet Button ───────────────────────────────────────────────────────────────
function SheetButton({ icon, label, onPress, variant = "default", colors }: {
    icon: React.ReactNode; label: string; onPress: () => void;
    variant?: "default" | "danger" | "warning" | "muted"; colors: any;
}) {
    const labelColor =
        variant === "danger"  ? "#e53935" :
        variant === "warning" ? "#f59e0b" :
        variant === "muted"   ? colors.textDisabled :
        colors.textPrimary;
    return (
        <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={styles.sheetBtn}>
            <View style={[styles.sheetBtnIcon, { backgroundColor: variant === "danger" ? "rgba(229,57,53,0.08)" : colors.hover }]}>
                {icon}
            </View>
            <Text style={[styles.sheetBtnLabel, { color: labelColor }]}>{label}</Text>
        </TouchableOpacity>
    );
}

// ── Comment Item ───────────────────────────────────────────────────────────────
function CommentItem({ comment, isOwner, onDelete, colors, onProfilePress }: {
    comment: any; isOwner: boolean; onDelete: (id: number) => void;
    colors: any; onProfilePress: (userId: string) => void;
}) {
    return (
        <View style={[styles.commentRow, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => onProfilePress(comment.user_id)} activeOpacity={0.8}>
                <Image
                    source={comment.commenter_profile_picture ? { uri: comment.commenter_profile_picture } : require("../assets/profile_blank.png")}
                    style={[styles.commentAvatar, { borderColor: colors.border }]}
                />
            </TouchableOpacity>
            <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.commentText, { color: colors.textSecondary }]}>
                    <Text style={[styles.commentUsername, { color: colors.textPrimary }]} onPress={() => onProfilePress(comment.user_id)}>
                        {comment.commenter_username}{" "}
                    </Text>
                    {comment.content}
                </Text>
                <Text style={[styles.commentTime, { color: colors.textDisabled }]}>{comment.timeAgo}</Text>
            </View>
            {isOwner && (
                <TouchableOpacity onPress={() => onDelete(comment.id)} style={styles.deleteCommentBtn} activeOpacity={0.7}>
                    <Ionicons name="trash-outline" size={13} color={colors.textDisabled} />
                </TouchableOpacity>
            )}
        </View>
    );
}

// ── Skeleton ───────────────────────────────────────────────────────────────────
function Skeleton({ colors }: { colors: any }) {
    const pulse = useRef(new Animated.Value(1)).current;
    useEffect(() => {
        Animated.loop(Animated.sequence([
            Animated.timing(pulse, { toValue: 0.4, duration: 750, useNativeDriver: true }),
            Animated.timing(pulse, { toValue: 1,   duration: 750, useNativeDriver: true }),
        ])).start();
    }, []);
    return (
        <Animated.View style={{ flex: 1, opacity: pulse }}>
            <View style={[{ height: 320, backgroundColor: colors.hover }]} />
            <View style={{ padding: 16, gap: 12 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <View style={[styles.skeletonCircle, { backgroundColor: colors.hover }]} />
                    <View style={{ flex: 1, gap: 7 }}>
                        <View style={[styles.skeletonLine, { width: "40%", backgroundColor: colors.hover }]} />
                        <View style={[styles.skeletonLine, { width: "25%", height: 10, backgroundColor: colors.hover }]} />
                    </View>
                </View>
                {[1, 2, 3].map((i) => (
                    <View key={i} style={[styles.skeletonLine, { width: i === 3 ? "60%" : "100%", backgroundColor: colors.hover }]} />
                ))}
            </View>
        </Animated.View>
    );
}

// ── Main ───────────────────────────────────────────────────────────────────────
const PostDetailPage = () => {
    const colors = useThemeColors();
    const router = useRouter();
    const { postId } = useLocalSearchParams<{ postId: string }>();

    const [currentUser,    setCurrentUser]    = useState<any>(null);
    const [post,           setPost]           = useState<any>(null);
    const [loading,        setLoading]        = useState(true);
    const [isLiked,        setIsLiked]        = useState(false);
    const [likeCount,      setLikeCount]      = useState(0);
    const [isSaved,        setIsSaved]        = useState(false);
    const [commentText,    setCommentText]    = useState("");
    const [comments,       setComments]       = useState<any[]>([]);
    const [commentCount,   setCommentCount]   = useState(0);
    const [optionsOpen,    setOptionsOpen]    = useState(false);
    const [confirmDelete,  setConfirmDelete]  = useState(false);
    const [isEditing,      setIsEditing]      = useState(false);
    const [editedContent,  setEditedContent]  = useState("");
    const [submitting,     setSubmitting]     = useState(false);

    const likeScale   = useRef(new Animated.Value(1)).current;
    const heartOpacity = useRef(new Animated.Value(0)).current;
    const heartScale  = useRef(new Animated.Value(0.5)).current;
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
            Animated.spring(likeScale, { toValue: 0.9, useNativeDriver: true, speed: 50 }),
            Animated.spring(likeScale, { toValue: 1,   useNativeDriver: true, speed: 50 }),
        ]).start();
    };

    const handleLike = async () => {
        const prev = isLiked; const prevCount = likeCount;
        setIsLiked(!prev); setLikeCount(prev ? prevCount - 1 : prevCount + 1);
        if (!prev) animateLike();
        try { await likePost(post.id); }
        catch { setIsLiked(prev); setLikeCount(prevCount); }
    };

    const handleSave = async () => {
        const prev = isSaved; setIsSaved(!prev);
        try { const res = await savePost(post.id); if (!res.success) setIsSaved(prev); }
        catch { setIsSaved(prev); }
    };

    const handleComment = async () => {
        if (!commentText.trim() || submitting) return;
        const newComment = {
            id: Date.now(), post_id: post.id, user_id: currentUser?.id,
            content: commentText, commenter_username: currentUser?.username,
            commenter_profile_picture: currentUser?.profile_picture_url,
            timeAgo: "Just now",
        };
        setComments((p) => [newComment, ...p]);
        setCommentCount((c) => c + 1);
        setCommentText("");
        setSubmitting(true);
        try {
            const res = await addComment(post.id, commentText);
            if (res?.success) fetchPost(); else throw new Error();
        } catch {
            setComments((p) => p.filter((c) => c.id !== newComment.id));
            setCommentCount((c) => c - 1);
        } finally { setSubmitting(false); }
    };

    const handleDeleteComment = async (commentId: number) => {
        const toDelete = comments.find((c) => c.id === commentId);
        setComments((p) => p.filter((c) => c.id !== commentId));
        setCommentCount((c) => c - 1);
        try { const res = await deleteComment(commentId); if (!res?.success) throw new Error(); }
        catch { if (toDelete) setComments((p) => [toDelete, ...p]); setCommentCount((c) => c + 1); }
    };

    const handleDeletePost = async () => {
        try { const res = await deletePost(post.id); if (res?.success) { setOptionsOpen(false); router.back(); } }
        catch { Alert.alert("Error", "Failed to delete post."); }
    };

    const handleSaveEdit = async () => {
        try { const res = await updatePost(post.id, editedContent); if (res?.success) { setIsEditing(false); fetchPost(); } }
        catch (e) { console.error(e); }
    };

    // Dynamic image height from aspect ratio
    const imageHeight = post?.media_width && post?.media_height
        ? Math.round((post.media_height / post.media_width) * SW)
        : 320;

    const canSend = commentText.trim().length > 0;

    if (loading) {
        return (
            <SafeAreaView style={[styles.root, { backgroundColor: colors.bg }]} edges={["top"]}>
                <View style={[styles.topNav, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
                    </TouchableOpacity>
                    <Text style={[styles.navTitle, { color: colors.textPrimary }]}>Post</Text>
                    <View style={{ width: 36 }} />
                </View>
                <Skeleton colors={colors} />
            </SafeAreaView>
        );
    }

    if (!post) {
        return (
            <SafeAreaView style={[styles.root, { backgroundColor: colors.bg }]} edges={["top"]}>
                <View style={styles.notFound}>
                    <Text style={[{ color: colors.textDisabled, fontSize: 14 }]}>Post not found</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.root, { backgroundColor: colors.bg, marginBottom: 62 }]} edges={["top"]}>
            {/* ── Top nav ── */}
            <View style={[styles.topNav, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
                    <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text style={[styles.navTitle, { color: colors.textPrimary }]}>Post</Text>
                {isOwner ? (
                    <TouchableOpacity onPress={() => setOptionsOpen(true)} style={styles.backBtn} activeOpacity={0.7}>
                        <Ionicons name="ellipsis-horizontal" size={20} color={colors.textPrimary} />
                    </TouchableOpacity>
                ) : (
                    <View style={{ width: 36 }} />
                )}
            </View>

            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 0 }}>

                    {/* ── Author row ── */}
                    <View style={[styles.authorRow, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
                        <TouchableOpacity onPress={() => router.push(`/profile/${post.user_id}`)} style={styles.authorLeft} activeOpacity={0.8}>
                            <Image
                                source={post.profile_picture ? { uri: post.profile_picture } : require("../assets/profile_blank.png")}
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
                        <Text style={[styles.postTime, { color: colors.textDisabled }]}>{post.timeAgo}</Text>
                    </View>

                    {/* ── Image ── */}
                    {post.file_url && !isVideo && (
                        <Image
                            source={{ uri: post.file_url }}
                            style={{ width: SW, height: imageHeight }}
                            resizeMode="cover"
                        />
                    )}

                    {/* ── Actions ── */}
                    <View style={[styles.actionsRow, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
                        <View style={styles.actionsLeft}>
                            <Animated.View style={{ transform: [{ scale: likeScale }] }}>
                                <TouchableOpacity onPress={handleLike} activeOpacity={1} style={styles.actionBtn}>
                                    <Ionicons name={isLiked ? "heart" : "heart-outline"} size={23} color={isLiked ? "#e53935" : colors.textDisabled} />
                                </TouchableOpacity>
                            </Animated.View>
                            {likeCount > 0 && <Text style={[styles.actionCount, { color: colors.textSecondary }]}>{likeCount}</Text>}

                            <TouchableOpacity onPress={() => commentInputRef.current?.focus()} activeOpacity={1} style={[styles.actionBtn, { marginLeft: 4 }]}>
                                <Ionicons name="chatbubble-outline" size={21} color={colors.textDisabled} />
                            </TouchableOpacity>
                            {commentCount > 0 && <Text style={[styles.actionCount, { color: colors.textSecondary }]}>{commentCount}</Text>}
                        </View>

                        <TouchableOpacity onPress={handleSave} activeOpacity={1} style={styles.actionBtn}>
                            <Ionicons name={isSaved ? "bookmark" : "bookmark-outline"} size={23} color={isSaved ? ACCENT : colors.textDisabled} />
                        </TouchableOpacity>
                    </View>

                    {/* ── Caption ── */}
                    {!!post.content && (
                        <View style={[styles.captionSection, { borderBottomColor: colors.border }]}>
                            <Text style={[styles.captionText, { color: colors.textSecondary }]}>
                                <Text style={[styles.captionUsername, { color: colors.textPrimary }]} onPress={() => router.push(`/profile/${post.user_id}`)}>
                                    {post.username}{" "}
                                </Text>
                                {post.content}
                            </Text>
                        </View>
                    )}

                    {/* ── Comments header ── */}
                    <View style={[styles.commentsHeader, { borderBottomColor: colors.border }]}>
                        <Text style={[styles.commentsTitle, { color: colors.textPrimary }]}>
                            Comments {commentCount > 0 ? `(${commentCount})` : ""}
                        </Text>
                    </View>

                    {/* ── Comments list ── */}
                    {comments.length === 0 ? (
                        <View style={styles.emptyComments}>
                            <Ionicons name="chatbubble-ellipses-outline" size={28} color={colors.textDisabled} style={{ opacity: 0.5 }} />
                            <Text style={[styles.emptyCommentText, { color: colors.textDisabled }]}>Be the first to comment</Text>
                        </View>
                    ) : (
                        <View style={[styles.commentsList, { backgroundColor: colors.surface }]}>
                            {comments.map((comment) => (
                                <CommentItem
                                    key={comment.id}
                                    comment={comment}
                                    isOwner={currentUser?.id === comment.user_id || isOwner}
                                    onDelete={handleDeleteComment}
                                    colors={colors}
                                    onProfilePress={(uid) => router.push(`/profile/${uid}`)}
                                />
                            ))}
                        </View>
                    )}
                </ScrollView>

                {/* ── Comment input ── */}
                <View style={[styles.inputBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
                    <Image
                        source={currentUser?.profile_picture_url ? { uri: currentUser.profile_picture_url } : require("../assets/profile_blank.png")}
                        style={[styles.inputAvatar, { borderColor: colors.border }]}
                    />
                    <TextInput
                        ref={commentInputRef}
                        style={[styles.commentInput, { color: colors.textPrimary }]}
                        placeholder="Add a comment…"
                        placeholderTextColor={colors.textDisabled}
                        value={commentText}
                        onChangeText={setCommentText}
                        returnKeyType="send"
                        onSubmitEditing={handleComment}
                        multiline={false}
                    />
                    <TouchableOpacity
                        onPress={handleComment}
                        disabled={!canSend || submitting}
                        activeOpacity={0.8}
                    >
                        {submitting
                            ? <ActivityIndicator size={14} color={ACCENT} />
                            : <Text style={[styles.sendText, { color: canSend ? ACCENT : colors.textDisabled, fontWeight: canSend ? "600" : "400" }]}>Post</Text>
                        }
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
                                    onPress={() => { setIsEditing(true); setEditedContent(post.content); setOptionsOpen(false); }}
                                    colors={colors}
                                />
                                <SheetButton
                                    icon={confirmDelete
                                        ? <MaterialIcons name="warning" size={16} color="#f59e0b" />
                                        : <MaterialIcons name="delete" size={16} color="#e53935" />
                                    }
                                    label={confirmDelete ? "Confirm delete" : "Delete post"}
                                    onPress={() => confirmDelete ? handleDeletePost() : setConfirmDelete(true)}
                                    variant={confirmDelete ? "warning" : "danger"}
                                    colors={colors}
                                />
                                <View style={[{ height: 1, marginHorizontal: 12, marginVertical: 4, backgroundColor: colors.border }]} />
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
            <Modal visible={isEditing} transparent animationType="fade" onRequestClose={() => setIsEditing(false)}>
                <Pressable style={styles.modalBackdrop} onPress={() => setIsEditing(false)}>
                    <Pressable>
                        <View style={[styles.editCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                            {!!post.file_url && (
                                <View>
                                    <Image source={{ uri: post.file_url }} style={styles.editPreview} resizeMode="cover" />
                                    <TouchableOpacity onPress={() => setIsEditing(false)} style={styles.editCloseBtn}>
                                        <Ionicons name="close" size={14} color="#fff" />
                                    </TouchableOpacity>
                                </View>
                            )}
                            <View style={styles.editBody}>
                                <Text style={[styles.editLabel, { color: colors.textDisabled }]}>CAPTION</Text>
                                <TextInput
                                    style={[styles.editInput, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.hover }]}
                                    multiline
                                    value={editedContent}
                                    onChangeText={setEditedContent}
                                    placeholder="Write a caption…"
                                    placeholderTextColor={colors.textDisabled}
                                />
                                <View style={styles.editActions}>
                                    <TouchableOpacity onPress={() => setIsEditing(false)} style={[styles.editBtn, { backgroundColor: colors.hover }]} activeOpacity={0.7}>
                                        <Text style={[{ fontSize: 13.5, fontWeight: "500", color: colors.textDisabled }]}>Cancel</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={handleSaveEdit}
                                        disabled={editedContent === post.content}
                                        style={[styles.editBtn, { backgroundColor: ACCENT, opacity: editedContent === post.content ? 0.4 : 1 }]}
                                        activeOpacity={0.85}
                                    >
                                        <Text style={{ fontSize: 13.5, fontWeight: "600", color: "#fff" }}>Save</Text>
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

const styles = StyleSheet.create({
    root:     { flex: 1, },
    notFound: { flex: 1, alignItems: "center", justifyContent: "center" },

    // Top nav
    topNav:   { height: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 4, borderBottomWidth: 0.5 },
    backBtn:  { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
    navTitle: { fontWeight: "600", fontSize: 15 },

    // Author
    authorRow:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 0 },
    authorLeft:  { flexDirection: "row", alignItems: "center", gap: 10, flex: 1, minWidth: 0 },
    authorAvatar:{ width: 36, height: 36, borderRadius: 18, borderWidth: 1.5 },
    authorName:  { fontWeight: "600", fontSize: 13.5 },
    locationRow: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 2 },
    locationText:{ fontSize: 11 },
    postTime:    { fontSize: 11.5, flexShrink: 0 },

    // Actions
    actionsRow:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 8, paddingVertical: 4, borderBottomWidth: 0.5 },
    actionsLeft: { flexDirection: "row", alignItems: "center" },
    actionBtn:   { padding: 7 },
    actionCount: { fontSize: 13, fontWeight: "500", marginRight: 4 },

    // Caption
    captionSection:  { paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 0.5 },
    captionText:     { fontSize: 13.5, lineHeight: 21 },
    captionUsername: { fontWeight: "700" },

    // Comments
    commentsHeader: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5 },
    commentsTitle:  { fontSize: 13, fontWeight: "600", letterSpacing: 0.1 },
    commentsList:   {},
    commentRow:     { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 0.5 },
    commentAvatar:  { width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, flexShrink: 0 },
    commentText:    { fontSize: 13.5, lineHeight: 20 },
    commentUsername:{ fontWeight: "700" },
    commentTime:    { fontSize: 11, marginTop: 3 },
    deleteCommentBtn: { padding: 6 },
    emptyComments:  { alignItems: "center", paddingVertical: 48, gap: 10 },
    emptyCommentText: { fontSize: 13.5 },

    // Input bar
    inputBar:    { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 0.5 },
    inputAvatar: { width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, flexShrink: 0 },
    commentInput:{ flex: 1, fontSize: 14, height: 36, paddingVertical: 0 },
    sendText:    { fontSize: 14, flexShrink: 0 },

    // Modals
    modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center", padding: 16 },
    optionsCard:   { width: 300, borderRadius: 18, borderWidth: 1, padding: 6 },
    sheetBtn:      { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12 },
    sheetBtnIcon:  { width: 32, height: 32, borderRadius: 9, alignItems: "center", justifyContent: "center" },
    sheetBtnLabel: { fontWeight: "500", fontSize: 14 },

    // Edit modal
    editCard:    { width: "92%", maxWidth: 460, borderRadius: 18, borderWidth: 1, overflow: "hidden" },
    editPreview: { width: "100%", height: 180 },
    editCloseBtn:{ position: "absolute", top: 10, right: 10, backgroundColor: "rgba(0,0,0,0.55)", width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
    editBody:    { padding: 18, gap: 12 },
    editLabel:   { fontSize: 10.5, fontWeight: "600", letterSpacing: 1 },
    editInput:   { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14.5, lineHeight: 22, minHeight: 72 },
    editActions: { flexDirection: "row", justifyContent: "flex-end", gap: 8 },
    editBtn:     { borderRadius: 10, paddingHorizontal: 18, paddingVertical: 9 },

    // Skeleton
    skeletonCircle: { width: 36, height: 36, borderRadius: 18, flexShrink: 0 },
    skeletonLine:   { height: 13, borderRadius: 6 },
});