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
    Keyboard,
    Platform,
    Alert,
    Dimensions,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialIcons, Feather } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getPost, likePost, addComment, savePost, deletePost, updatePost, deleteComment } from "../services/api";
import { useThemeColors } from "../hooks/useThemeColors";

const ACCENT = "#7c5cfc";
const { width: SW } = Dimensions.get("window");

// ── Avatar with accent ring (Instagram story style) ────────────────────────────
function AvatarRing({ uri, size = 40, onPress, ringColor = ACCENT }: { uri?: string; size?: number; onPress?: () => void; ringColor?: string }) {
    const ring = (
        <View
            style={{
                width: size + 8,
                height: size + 8,
                borderRadius: (size + 8) / 2,
                borderWidth: 2.5,
                borderColor: ringColor,
                alignItems: "center",
                justifyContent: "center",
            }}
        >
            <Image source={uri ? { uri } : require("../assets/profile_blank.png")} style={{ width: size, height: size, borderRadius: size / 2 }} />
        </View>
    );
    if (onPress)
        return (
            <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
                {ring}
            </TouchableOpacity>
        );
    return <View>{ring}</View>;
}

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
        variant === "danger" ? "#e53935" : variant === "warning" ? "#f59e0b" : variant === "muted" ? colors.textDisabled : colors.textPrimary;
    return (
        <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={styles.sheetBtn}>
            <View style={[styles.sheetBtnIcon, { backgroundColor: variant === "danger" ? "rgba(229,57,53,0.08)" : colors.hover }]}>{icon}</View>
            <Text style={[styles.sheetBtnLabel, { color: labelColor }]}>{label}</Text>
        </TouchableOpacity>
    );
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
        <View style={[styles.commentRow, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => onProfilePress(comment.user_id)} activeOpacity={0.8} style={{ flexShrink: 0 }}>
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
                    <Ionicons name="trash-outline" size={14} color={colors.textDisabled} />
                </TouchableOpacity>
            )}
        </View>
    );
}

// ── Skeleton ───────────────────────────────────────────────────────────────────
function Skeleton({ colors }: { colors: any }) {
    const pulse = useRef(new Animated.Value(1)).current;
    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulse, { toValue: 0.35, duration: 800, useNativeDriver: true }),
                Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
            ]),
        ).start();
    }, []);
    return (
        <Animated.View style={{ flex: 1, opacity: pulse }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 14 }}>
                <View style={[styles.skeletonCircle, { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.hover }]} />
                <View style={{ flex: 1, gap: 8 }}>
                    <View style={[styles.skeletonLine, { width: "38%", backgroundColor: colors.hover }]} />
                    <View style={[styles.skeletonLine, { width: "22%", height: 10, backgroundColor: colors.hover }]} />
                </View>
            </View>
            <View style={{ height: 360, backgroundColor: colors.hover }} />
            <View style={{ flexDirection: "row", paddingHorizontal: 14, paddingVertical: 14, gap: 18 }}>
                {[1, 2, 3].map((i) => (
                    <View key={i} style={[styles.skeletonCircle, { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.hover }]} />
                ))}
            </View>
            <View style={{ paddingHorizontal: 16, gap: 9 }}>
                <View style={[styles.skeletonLine, { width: "20%", height: 13, backgroundColor: colors.hover }]} />
                {[1, 2, 3].map((i) => (
                    <View key={i} style={[styles.skeletonLine, { width: i === 3 ? "55%" : "90%", backgroundColor: colors.hover }]} />
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
    const [captionExpanded, setCaptionExpanded] = useState(false);

    const likeScale = useRef(new Animated.Value(1)).current;
    const commentInputRef = useRef<TextInput>(null);
    const insets = useSafeAreaInsets();
    const keyboardPad = useRef(new Animated.Value(62)).current;

    useEffect(() => {
        const showEvt = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
        const hideEvt = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
        const s1 = Keyboard.addListener(showEvt, (e) => {
            Animated.timing(keyboardPad, {
                toValue: e.endCoordinates.height + 10,
                duration: e.duration ?? 250,
                useNativeDriver: false,
            }).start();
        });
        const s2 = Keyboard.addListener(hideEvt, (e) => {
            Animated.timing(keyboardPad, {
                toValue: 62,
                duration: e.duration ?? 250,
                useNativeDriver: false,
            }).start();
        });
        return () => {
            s1.remove();
            s2.remove();
        };
    }, []);

    useEffect(() => {
        AsyncStorage.getItem("user").then((raw) => {
            if (raw) setCurrentUser(JSON.parse(raw));
        });
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
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPost();
    }, [postId]);

    const animateLike = () => {
        Animated.sequence([
            Animated.spring(likeScale, { toValue: 1.5, useNativeDriver: true, speed: 40 }),
            Animated.spring(likeScale, { toValue: 0.85, useNativeDriver: true, speed: 55 }),
            Animated.spring(likeScale, { toValue: 1, useNativeDriver: true, speed: 55 }),
        ]).start();
    };

    const handleLike = async () => {
        const prev = isLiked;
        const prevCount = likeCount;
        setIsLiked(!prev);
        setLikeCount(prev ? prevCount - 1 : prevCount + 1);
        if (!prev) animateLike();
        try {
            await likePost(post.id);
        } catch {
            setIsLiked(prev);
            setLikeCount(prevCount);
        }
    };

    const handleSave = async () => {
        const prev = isSaved;
        setIsSaved(!prev);
        try {
            const res = await savePost(post.id);
            if (!res.success) setIsSaved(prev);
        } catch {
            setIsSaved(prev);
        }
    };

    const handleComment = async () => {
        if (!commentText.trim() || submitting) return;
        const newComment = {
            id: Date.now(),
            post_id: post.id,
            user_id: currentUser?.id,
            content: commentText,
            commenter_username: currentUser?.username,
            commenter_profile_picture: currentUser?.profile_picture_url,
            timeAgo: "Just now",
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
        } finally {
            setSubmitting(false);
        }
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
            if (res?.success) {
                setOptionsOpen(false);
                router.replace(`/profile/${post.user_id}`);
            }
        } catch {
            Alert.alert("Error", "Failed to delete post.");
        }
    };

    const handleSaveEdit = async () => {
        try {
            const res = await updatePost(post.id, editedContent);
            if (res?.success) {
                setIsEditing(false);
                fetchPost();
            }
        } catch (e) {
            console.error(e);
        }
    };

    const imageHeight = post?.media_width && post?.media_height ? Math.round((post.media_height / post.media_width) * SW) : 360;
    const canSend = commentText.trim().length > 0;

    const CAPTION_LIMIT = 120;
    const longCaption = (post?.content?.length ?? 0) > CAPTION_LIMIT;
    const formattedLikes = likeCount >= 1000 ? `${(likeCount / 1000).toFixed(1)}K` : likeCount > 0 ? String(likeCount) : null;

    if (loading) {
        return (
            <SafeAreaView style={[styles.root, { backgroundColor: colors.bg, marginTop: -insets.top }]} edges={["top"]}>
                <View style={[styles.topNav, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.navBtn}>
                        <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
                    </TouchableOpacity>
                    <Text style={[styles.navTitle, { color: colors.textPrimary }]}>Post</Text>
                    <View style={{ width: 44 }} />
                </View>
                <Skeleton colors={colors} />
            </SafeAreaView>
        );
    }

    if (!post) {
        return (
            <SafeAreaView style={[styles.root, { backgroundColor: colors.bg }]} edges={["top"]}>
                <View style={styles.notFound}>
                    <Ionicons name="image-outline" size={48} color={colors.textDisabled} style={{ opacity: 0.4, marginBottom: 14 }} />
                    <Text style={{ color: colors.textSecondary, fontSize: 16, fontWeight: "600" }}>Post not found</Text>
                    <Text style={{ color: colors.textDisabled, fontSize: 13, marginTop: 6 }}>This post may have been deleted</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.root, { backgroundColor: colors.bg, marginTop: -insets.top }]} edges={["top"]}>
            {/* ── Top nav ── */}
            <View style={[styles.topNav, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.navBtn} activeOpacity={0.7}>
                    <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text style={[styles.navTitle, { color: colors.textPrimary }]}>Post</Text>
                {isOwner ? (
                    <TouchableOpacity onPress={() => setOptionsOpen(true)} style={styles.navBtn} activeOpacity={0.7}>
                        <Ionicons name="ellipsis-horizontal" size={22} color={colors.textPrimary} />
                    </TouchableOpacity>
                ) : (
                    <View style={{ width: 44 }} />
                )}
            </View>

            <Animated.View style={{ flex: 1, paddingBottom: keyboardPad }}>
                <ScrollView showsVerticalScrollIndicator={false}>
                    {/* ── Author row ── */}
                    <View style={[styles.authorRow, { backgroundColor: colors.surface }]}>
                        <AvatarRing uri={post.profile_picture} size={40} onPress={() => router.push(`/profile/${post.user_id}`)} />
                        <TouchableOpacity onPress={() => router.push(`/profile/${post.user_id}`)} style={styles.authorMeta} activeOpacity={0.75}>
                            <Text style={[styles.authorName, { color: colors.textPrimary }]} numberOfLines={1}>
                                {post.username}
                            </Text>
                            {post.location ? (
                                <View style={styles.locationRow}>
                                    <Ionicons name="location-sharp" size={10} color={ACCENT} />
                                    <Text style={[styles.locationText, { color: colors.textDisabled }]}>{post.location}</Text>
                                </View>
                            ) : (
                                <Text style={[styles.locationText, { color: colors.textDisabled }]}>{post.timeAgo}</Text>
                            )}
                        </TouchableOpacity>
                        {post.location && <Text style={[styles.postTime, { color: colors.textDisabled }]}>{post.timeAgo}</Text>}
                    </View>

                    {/* ── Image ── */}
                    {post.file_url && !isVideo && (
                        <Image source={{ uri: post.file_url }} style={{ width: SW, height: imageHeight }} resizeMode="cover" />
                    )}

                    {/* ── Actions row ── */}
                    <View style={[styles.actionsRow, { backgroundColor: colors.surface }]}>
                        <View style={styles.actionsLeft}>
                            <Animated.View style={{ transform: [{ scale: likeScale }] }}>
                                <TouchableOpacity onPress={handleLike} activeOpacity={0.7} style={styles.actionBtn}>
                                    <Ionicons name={isLiked ? "heart" : "heart-outline"} size={28} color={isLiked ? "#e53935" : colors.textPrimary} />
                                </TouchableOpacity>
                            </Animated.View>
                            <TouchableOpacity onPress={() => commentInputRef.current?.focus()} activeOpacity={0.7} style={styles.actionBtn}>
                                <Ionicons name="chatbubble-outline" size={26} color={colors.textPrimary} />
                            </TouchableOpacity>
                            <TouchableOpacity activeOpacity={0.7} style={styles.actionBtn}>
                                <Feather name="send" size={24} color={colors.textPrimary} />
                            </TouchableOpacity>
                        </View>
                        <TouchableOpacity onPress={handleSave} activeOpacity={0.7} style={styles.actionBtn}>
                            <Ionicons name={isSaved ? "bookmark" : "bookmark-outline"} size={27} color={isSaved ? ACCENT : colors.textPrimary} />
                        </TouchableOpacity>
                    </View>

                    {/* ── Like count ── */}
                    {formattedLikes && (
                        <View style={[styles.likeRow, { backgroundColor: colors.surface }]}>
                            <Text style={[styles.likeCount, { color: colors.textPrimary }]}>
                                {formattedLikes} <Text style={{ fontWeight: "400" }}>{likeCount === 1 ? "like" : "likes"}</Text>
                            </Text>
                        </View>
                    )}

                    {/* ── Caption ── */}
                    {!!post.content && (
                        <View style={[styles.captionSection, { backgroundColor: colors.surface }]}>
                            <Text style={[styles.captionText, { color: colors.textSecondary }]}>
                                <Text
                                    style={[styles.captionUsername, { color: colors.textPrimary }]}
                                    onPress={() => router.push(`/profile/${post.user_id}`)}
                                >
                                    {post.username}{" "}
                                </Text>
                                {longCaption && !captionExpanded ? post.content.slice(0, CAPTION_LIMIT) + "…  " : post.content}
                                {longCaption && !captionExpanded && (
                                    <Text style={{ color: colors.textDisabled, fontSize: 13.5 }} onPress={() => setCaptionExpanded(true)}>
                                        more
                                    </Text>
                                )}
                            </Text>
                        </View>
                    )}

                    {/* ── Timestamp ── */}
                    <View style={[styles.timestampRow, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
                        <Text style={[styles.timestampText, { color: colors.textDisabled }]}>{post.timeAgo}</Text>
                    </View>

                    {/* ── Comments ── */}
                    <View style={{ backgroundColor: colors.surface }}>
                        {commentCount > 0 && (
                            <View style={[styles.commentsHeader, { borderBottomColor: colors.border }]}>
                                <Text style={[styles.commentsTitle, { color: colors.textPrimary }]}>
                                    {commentCount === 1 ? "1 comment" : `${commentCount} comments`}
                                </Text>
                            </View>
                        )}

                        {comments.length === 0 ? (
                            <View style={styles.emptyComments}>
                                <View style={[styles.emptyBubble, { backgroundColor: colors.hover }]}>
                                    <Ionicons name="chatbubble-ellipses-outline" size={28} color={colors.textDisabled} />
                                </View>
                                <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No comments yet</Text>
                                <Text style={[styles.emptySubtitle, { color: colors.textDisabled }]}>Be the first to comment</Text>
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

                {/* ── Comment input bar ── */}
                <View style={[styles.inputBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
                    <Image
                        source={currentUser?.profile_picture_url ? { uri: currentUser.profile_picture_url } : require("../assets/profile_blank.png")}
                        style={[styles.inputAvatar]}
                    />
                    <View style={[styles.inputPill, { backgroundColor: colors.hover, borderColor: colors.border }]}>
                        <TextInput
                            ref={commentInputRef}
                            style={[styles.inputField, { color: colors.textPrimary }]}
                            placeholder="Add a comment…"
                            placeholderTextColor={colors.textDisabled}
                            value={commentText}
                            onChangeText={setCommentText}
                            returnKeyType="send"
                            onSubmitEditing={handleComment}
                            multiline={false}
                        />
                    </View>
                    <TouchableOpacity
                        onPress={handleComment}
                        disabled={!canSend || submitting}
                        activeOpacity={0.8}
                        style={[styles.sendBtn, { backgroundColor: canSend ? ACCENT : colors.hover }]}
                    >
                        {submitting ? (
                            <ActivityIndicator size={14} color={canSend ? "#fff" : colors.textDisabled} />
                        ) : (
                            <Ionicons name="send" size={15} color={canSend ? "#fff" : colors.textDisabled} />
                        )}
                    </TouchableOpacity>
                </View>
            </Animated.View>

            {/* ── Options modal ── */}
            {isOwner && (
                <Modal
                    visible={optionsOpen}
                    transparent
                    animationType="fade"
                    onRequestClose={() => {
                        setOptionsOpen(false);
                        setConfirmDelete(false);
                    }}
                >
                    <Pressable
                        style={styles.modalBackdrop}
                        onPress={() => {
                            setOptionsOpen(false);
                            setConfirmDelete(false);
                        }}
                    >
                        <Pressable>
                            <View style={[styles.optionsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                                <SheetButton
                                    icon={<MaterialIcons name="edit" size={17} color={colors.textSecondary} />}
                                    label="Edit caption"
                                    onPress={() => {
                                        setIsEditing(true);
                                        setEditedContent(post.content);
                                        setOptionsOpen(false);
                                    }}
                                    colors={colors}
                                />
                                <SheetButton
                                    icon={
                                        confirmDelete ? (
                                            <MaterialIcons name="warning" size={17} color="#f59e0b" />
                                        ) : (
                                            <MaterialIcons name="delete" size={17} color="#e53935" />
                                        )
                                    }
                                    label={confirmDelete ? "Confirm delete" : "Delete post"}
                                    onPress={() => (confirmDelete ? handleDeletePost() : setConfirmDelete(true))}
                                    variant={confirmDelete ? "warning" : "danger"}
                                    colors={colors}
                                />
                                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                                <SheetButton
                                    icon={<Ionicons name="close" size={17} color={colors.textDisabled} />}
                                    label="Cancel"
                                    onPress={() => {
                                        setOptionsOpen(false);
                                        setConfirmDelete(false);
                                    }}
                                    variant="muted"
                                    colors={colors}
                                />
                            </View>
                        </Pressable>
                    </Pressable>
                </Modal>
            )}

            {/* ── Edit caption modal ── */}
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
                                    style={[
                                        styles.editInput,
                                        { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.hover },
                                    ]}
                                    multiline
                                    value={editedContent}
                                    onChangeText={setEditedContent}
                                    placeholder="Write a caption…"
                                    placeholderTextColor={colors.textDisabled}
                                />
                                <View style={styles.editActions}>
                                    <TouchableOpacity
                                        onPress={() => setIsEditing(false)}
                                        style={[styles.editBtn, { backgroundColor: colors.hover }]}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={{ fontSize: 14, fontWeight: "500", color: colors.textDisabled }}>Cancel</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={handleSaveEdit}
                                        disabled={editedContent === post.content}
                                        style={[styles.editBtn, { backgroundColor: ACCENT, opacity: editedContent === post.content ? 0.4 : 1 }]}
                                        activeOpacity={0.85}
                                    >
                                        <Text style={{ fontSize: 14, fontWeight: "700", color: "#fff" }}>Save</Text>
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
    root: { flex: 1 },
    notFound: { flex: 1, alignItems: "center", justifyContent: "center", paddingBottom: 60 },

    // ── Nav ──
    topNav: {
        height: 56,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 4,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    navBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
    navTitle: { fontWeight: "700", fontSize: 16, letterSpacing: 0.2 },

    // ── Author ──
    authorRow: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 14,
        paddingVertical: 12,
        gap: 12,
    },
    authorMeta: { flex: 1, minWidth: 0 },
    authorName: { fontWeight: "700", fontSize: 14 },
    locationRow: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 2 },
    locationText: { fontSize: 12 },
    postTime: { fontSize: 12, flexShrink: 0 },

    // ── Actions ──
    actionsRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 10,
        paddingTop: 4,
        paddingBottom: 2,
    },
    actionsLeft: { flexDirection: "row", alignItems: "center" },
    actionBtn: { padding: 8 },

    // ── Like count ──
    likeRow: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8 },
    likeCount: { fontSize: 14, fontWeight: "700" },

    // ── Caption ──
    captionSection: { paddingHorizontal: 16, paddingBottom: 10 },
    captionText: { fontSize: 14, lineHeight: 22 },
    captionUsername: { fontWeight: "700" },

    // ── Timestamp ──
    timestampRow: {
        paddingHorizontal: 16,
        paddingTop: 2,
        paddingBottom: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    timestampText: { fontSize: 11.5, letterSpacing: 0.1 },

    // ── Comments ──
    commentsHeader: {
        paddingHorizontal: 16,
        paddingVertical: 15,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    commentsTitle: { fontSize: 14, fontWeight: "700" },
    commentRow: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 13,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    commentAvatar: { width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, flexShrink: 0 },
    commentText: { fontSize: 14, lineHeight: 21 },
    commentUsername: { fontWeight: "700" },
    commentTime: { fontSize: 11.5, marginTop: 4 },
    deleteCommentBtn: { padding: 6, marginTop: 2 },
    emptyComments: { alignItems: "center", paddingVertical: 56, gap: 10 },
    emptyBubble: { width: 58, height: 58, borderRadius: 29, alignItems: "center", justifyContent: "center", marginBottom: 4 },
    emptyTitle: { fontSize: 15, fontWeight: "700" },
    emptySubtitle: { fontSize: 13 },

    // ── Input bar ──
    inputBar: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderTopWidth: StyleSheet.hairlineWidth,
    },
    inputAvatar: { width: 34, height: 34, borderRadius: 17, flexShrink: 0 },
    inputPill: {
        flex: 1,
        borderRadius: 24,
        borderWidth: 1,
        paddingHorizontal: 16,
        paddingVertical: Platform.OS === "ios" ? 9 : 4,
        justifyContent: "center",
    },
    inputField: { fontSize: 14, paddingVertical: 0, minHeight: 20 },
    sendBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
    },

    // ── Modals ──
    modalBackdrop: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.55)",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
    },
    optionsCard: { width: 300, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, padding: 6 },
    sheetBtn: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 14, paddingVertical: 13, borderRadius: 14 },
    sheetBtnIcon: { width: 36, height: 36, borderRadius: 11, alignItems: "center", justifyContent: "center" },
    sheetBtnLabel: { fontWeight: "500", fontSize: 15 },
    divider: { height: StyleSheet.hairlineWidth, marginHorizontal: 14, marginVertical: 4 },

    editCard: { width: "93%", maxWidth: 460, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
    editPreview: { width: "100%", height: 200 },
    editCloseBtn: {
        position: "absolute",
        top: 12,
        right: 12,
        backgroundColor: "rgba(0,0,0,0.6)",
        width: 30,
        height: 30,
        borderRadius: 15,
        alignItems: "center",
        justifyContent: "center",
    },
    editBody: { padding: 20, gap: 14 },
    editLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 1.3 },
    editInput: {
        borderRadius: 14,
        borderWidth: 1,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 15,
        lineHeight: 23,
        minHeight: 84,
    },
    editActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 2 },
    editBtn: { borderRadius: 12, paddingHorizontal: 20, paddingVertical: 11 },

    // ── Skeleton ──
    skeletonCircle: { flexShrink: 0 },
    skeletonLine: { height: 13, borderRadius: 7 },
});
