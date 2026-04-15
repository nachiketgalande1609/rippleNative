import React, { useState, useRef } from "react";
import {
    View,
    Text,
    Image,
    TouchableOpacity,
    TextInput,
    Modal,
    StyleSheet,
    Animated,
    Pressable,
    ActivityIndicator,
    ScrollView,
    Alert,
} from "react-native";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { Video, ResizeMode, AVPlaybackStatus } from "expo-av";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { deletePost, likePost, addComment, updatePost, savePost, deleteComment, getFollowingUsers } from "../services/api";
import { useThemeColors } from "../hooks/useThemeColors";
import ScrollableCommentsDrawer from "../components/Scrollablecommentsdrawer";
import socket from "../services/socket";

const ACCENT = "#7c5cfc";

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

interface Post {
    username: string;
    content: string;
    like_count: number;
    avatarUrl?: string;
    file_url?: string;
    timeAgo: string;
    id: string;
    userId: string;
    liked_by_current_user: boolean;
    media_height: number;
    media_width: number;
    savedByCurrentUser: boolean;
    profile_picture: string;
    user_id: number;
    comment_count: number;
    saved_by_current_user: boolean;
    location: string;
    comments: Comment[];
}

type User = {
    id: number;
    username: string;
    profile_picture: string;
    isOnline: boolean;
    latest_message: string;
    latest_message_timestamp: string;
    unread_count: number;
};

interface PostProps {
    post: Post;
    fetchPosts: () => Promise<void>;
}

// ── DialogBtn ──────────────────────────────────────────────────────────────────
function DialogBtn({
    icon,
    label,
    onPress,
    danger = false,
    warning = false,
    muted = false,
    disabled = false,
}: {
    icon: React.ReactNode;
    label: string;
    onPress: () => void;
    danger?: boolean;
    warning?: boolean;
    muted?: boolean;
    disabled?: boolean;
}) {
    const colors = useThemeColors();
    const iconBg = danger || warning ? "rgba(229,57,53,0.08)" : colors.hover;
    const iconColor = danger || warning ? "#e53935" : muted ? colors.textDisabled : colors.textSecondary;
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
            disabled={disabled}
            activeOpacity={0.7}
            style={[
                styles.dialogBtn,
                warning && { backgroundColor: "rgba(229,57,53,0.09)" },
                disabled && { opacity: 0.4 },
            ]}
        >
            <View style={[styles.dialogBtnIcon, { backgroundColor: iconBg }]}>
                <View style={{ tintColor: iconColor }}>{icon}</View>
            </View>
            <Text style={[styles.dialogBtnLabel, { color: labelColor }]}>{label}</Text>
        </TouchableOpacity>
    );
}

function DialogDivider() {
    const colors = useThemeColors();
    return <View style={[styles.dialogDivider, { backgroundColor: colors.border }]} />;
}

// ── Post ───────────────────────────────────────────────────────────────────────
const PostCard: React.FC<PostProps> = ({ post, fetchPosts }) => {
    const colors = useThemeColors();
    const router = useRouter();

    const [commentText, setCommentText] = useState("");
    const [commentCount, setCommentCount] = useState(post.comment_count);
    const [likeCount, setLikeCount] = useState(post.like_count);
    const [postComments, setPostComments] = useState(post.comments);
    const [optionsDialogOpen, setOptionsDialogOpen] = useState(false);
    const [isLiked, setIsLiked] = useState(post.liked_by_current_user);
    const [isEditing, setIsEditing] = useState(false);
    const [editedContent, setEditedContent] = useState(post.content);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [isImageLoading, setIsImageLoading] = useState(true);
    const [selectedCommentId, setSelectedCommentId] = useState<number | null>(null);
    const [isSaved, setIsSaved] = useState(post.saved_by_current_user);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [usersModalOpen, setUsersModalOpen] = useState(false);
    const [usersList, setUsersList] = useState<User[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [isPlaying, setIsPlaying] = useState(false);
    const [isMuted, setIsMuted] = useState(true);
    const videoRef = useRef<Video>(null);

    const likeScale = useRef(new Animated.Value(1)).current;
    const commentInputRef = useRef<TextInput>(null);

    const [currentUser, setCurrentUser] = useState<any>(null);
    React.useEffect(() => {
        AsyncStorage.getItem("user").then((raw) => {
            if (raw) setCurrentUser(JSON.parse(raw));
        });
    }, []);

    const isOwner = currentUser?.id === post.user_id;

    const filteredUsers = usersList.filter((u) =>
        u.username.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // ── Handlers ──
    const animateLike = () => {
        Animated.sequence([
            Animated.spring(likeScale, { toValue: 1.45, useNativeDriver: true, speed: 50 }),
            Animated.spring(likeScale, { toValue: 0.9, useNativeDriver: true, speed: 50 }),
            Animated.spring(likeScale, { toValue: 1, useNativeDriver: true, speed: 50 }),
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

    const handlePaperPlaneClick = async () => {
        try {
            const res = await getFollowingUsers();
            if (res.success) {
                setUsersList(res.data);
                setUsersModalOpen(true);
            }
        } catch (e) {
            console.error(e);
        }
    };

    const handleUserClick = (user: User) => {
        socket.emit("sendMessage", {
            tempId: Date.now() + Math.floor(Math.random() * 1000),
            senderId: currentUser?.id,
            receiverId: user.id,
            postId: post.id,
        });
        setUsersModalOpen(false);
    };

    const handleComment = async () => {
        if (!commentText) return;
        const newComment: Comment = {
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
        setPostComments([newComment, ...postComments]);
        setCommentText("");
        setCommentCount(commentCount + 1);
        try {
            const res = await addComment(post.id, commentText);
            if (res?.success) fetchPosts();
            else throw new Error();
        } catch {
            setPostComments((p) => p.filter((c) => c.id !== newComment.id));
            setCommentCount(commentCount - 1);
        }
    };

    const handleDeleteComment = async () => {
        if (!selectedCommentId) return;
        const toDelete = postComments.find((c) => c.id === selectedCommentId);
        setPostComments(postComments.filter((c) => c.id !== selectedCommentId));
        try {
            const res = await deleteComment(selectedCommentId);
            if (res?.success) fetchPosts();
            else throw new Error();
        } catch {
            if (toDelete) setPostComments((p) => [toDelete, ...p]);
        }
    };

    const handleDelete = async () => {
        try {
            const res = await deletePost(post.id);
            if (res?.success) {
                setOptionsDialogOpen(false);
                setConfirmDelete(false);
                fetchPosts();
            }
        } catch {}
    };

    const handleSavePost = async () => {
        const prev = isSaved;
        setIsSaved(!prev);
        try {
            const res = await savePost(post.id);
            if (!res.success) setIsSaved(prev);
        } catch {
            setIsSaved(prev);
        }
    };

    const handleSaveEdit = async () => {
        try {
            const res = await updatePost(post.id, editedContent);
            if (res?.success) {
                setIsEditing(false);
                fetchPosts();
                setEditedContent("");
            }
        } catch (e) {
            console.error(e);
        }
    };

    // ── Media dimensions ──
    const isVideo = post.file_url ? /\.(mp4|mov|webm)$/i.test(post.file_url) : false;

    return (
        <>
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                {/* ── Header ── */}
                <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => router.push(`/profile/${post.user_id}`)}
                    style={styles.header}
                >
                    <View style={styles.headerLeft}>
                        <Image
                            source={
                                post.profile_picture
                                    ? { uri: post.profile_picture }
                                    : require("../assets/profile_blank.png")
                            }
                            style={[styles.avatar, { borderColor: colors.border }]}
                        />
                        <View>
                            <Text style={[styles.username, { color: colors.textPrimary }]}>{post.username}</Text>
                            {!!post.location && (
                                <View style={styles.locationRow}>
                                    <Ionicons name="location-sharp" size={10} color={colors.textDisabled} />
                                    <Text style={[styles.location, { color: colors.textDisabled }]}>{post.location}</Text>
                                </View>
                            )}
                        </View>
                    </View>
                    {isOwner && (
                        <TouchableOpacity
                            onPress={() => setOptionsDialogOpen(true)}
                            style={[styles.moreBtn, { backgroundColor: "transparent" }]}
                            activeOpacity={0.7}
                        >
                            <Ionicons name="ellipsis-horizontal" size={18} color={colors.textDisabled} />
                        </TouchableOpacity>
                    )}
                </TouchableOpacity>

                {/* ── Media ── */}
                {!!post.file_url && (
                    <View style={styles.mediaContainer}>
                        // Replace the entire video block:
                        {isVideo ? (
                            <Pressable
                                onPress={() => {
                                    if (isPlaying) {
                                        videoRef.current?.pauseAsync();
                                    } else {
                                        videoRef.current?.playAsync();
                                    }
                                }}
                                style={{ width: "100%", backgroundColor: "#000", justifyContent: "center", alignItems: "center", }}
                            >
                                <Video
                                    ref={videoRef}
                                    source={{ uri: post.file_url }}
                                    style={{
                                        width: "100%",
                                        height: 300,
                                    }}
                                    resizeMode={ResizeMode.CONTAIN}
                                    isMuted={isMuted}
                                    isLooping
                                    useNativeControls={false}
                                    onPlaybackStatusUpdate={(status: AVPlaybackStatus) => {
                                        if (status.isLoaded) setIsPlaying(status.isPlaying);
                                    }}
                                />

                                {/* Play/pause overlay — only show when paused */}
                                {!isPlaying && (
                                    <View style={{
                                        position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
                                        alignItems: "center", justifyContent: "center",
                                        backgroundColor: "rgba(0,0,0,0.2)",
                                    }}>
                                        <View style={{
                                            width: 56, height: 56, borderRadius: 28,
                                            backgroundColor: "rgba(0,0,0,0.55)",
                                            alignItems: "center", justifyContent: "center",
                                        }}>
                                            <Ionicons name="play" size={24} color="#fff" />
                                        </View>
                                    </View>
                                )}

                                {/* Mute button */}
                                <TouchableOpacity
                                    onPress={() => setIsMuted((m) => !m)}
                                    style={{
                                        position: "absolute", bottom: 10, right: 10,
                                        width: 30, height: 30, borderRadius: 15,
                                        backgroundColor: "rgba(0,0,0,0.5)",
                                        alignItems: "center", justifyContent: "center",
                                    }}
                                    activeOpacity={0.8}
                                >
                                    <Ionicons name={isMuted ? "volume-mute" : "volume-high"} size={14} color="#fff" />
                                </TouchableOpacity>
                            </Pressable>
                        ) : (
                            <Pressable onLongPress={async () => { if (!isLiked) await handleLike(); }}>
                                {isImageLoading && (
                                    <View style={styles.imageLoader}>
                                        <ActivityIndicator size="small" color={colors.textDisabled} />
                                    </View>
                                )}
                                <Image
                                    source={{ uri: post.file_url }}
                                    style={[styles.mediaImage, { opacity: isImageLoading ? 0 : 1 }]}
                                    resizeMode="contain"
                                    onLoad={() => setIsImageLoading(false)}
                                />
                            </Pressable>
                        )}
                    </View>
                )}

                {/* ── Actions ── */}
                <View style={styles.actions}>
                    <View style={styles.actionsLeft}>
                        {/* Like */}
                        <Animated.View style={{ transform: [{ scale: likeScale }] }}>
                            <TouchableOpacity onPress={handleLike} activeOpacity={1} style={styles.actionBtn}>
                                <Ionicons
                                    name={isLiked ? "heart" : "heart-outline"}
                                    size={21}
                                    color={isLiked ? "#e53935" : colors.textDisabled}
                                />
                            </TouchableOpacity>
                        </Animated.View>
                        <Text style={[styles.actionCount, { color: colors.textDisabled }]}>{likeCount}</Text>

                        {/* Comment */}
                        <TouchableOpacity
                            onPress={() => { commentInputRef.current?.focus(); setDrawerOpen(true); }}
                            activeOpacity={1}
                            style={styles.actionBtn}
                        >
                            <Ionicons name="chatbubble-outline" size={19} color={colors.textDisabled} />
                        </TouchableOpacity>
                        <Text style={[styles.actionCount, { color: colors.textDisabled }]}>{commentCount}</Text>

                        {/* Share */}
                        <TouchableOpacity onPress={handlePaperPlaneClick} activeOpacity={1} style={styles.actionBtn}>
                            <Ionicons name="send-outline" size={19} color={colors.textDisabled} />
                        </TouchableOpacity>
                    </View>

                    {/* Save */}
                    <TouchableOpacity onPress={handleSavePost} activeOpacity={1} style={styles.actionBtn}>
                        <Ionicons
                            name={isSaved ? "bookmark" : "bookmark-outline"}
                            size={21}
                            color={isSaved ? colors.textPrimary : colors.textDisabled}
                        />
                    </TouchableOpacity>
                </View>

                {/* ── Caption ── */}
                <View style={styles.caption}>
                    {!!post.content && (
                        <Text style={[styles.captionText, { color: colors.textSecondary }]}>
                            <Text
                                onPress={() => router.push(`/profile/${post.user_id}`)}
                                style={[styles.captionUsername, { color: colors.textPrimary }]}
                            >
                                {post.username}{" "}
                            </Text>
                            {post.content}
                        </Text>
                    )}
                    <Text style={[styles.timeAgo, { color: colors.textDisabled }]}>{post.timeAgo}</Text>
                </View>
            </View>

            {/* ── Edit Modal ── */}
            <Modal
                visible={isEditing}
                transparent
                animationType="fade"
                onRequestClose={() => { setIsEditing(false); setEditedContent(""); }}
            >
                <View style={styles.modalBackdrop}>
                    <View style={[styles.editCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        {!!post.file_url && (
                            <View style={{ position: "relative" }}>
                                <Image source={{ uri: post.file_url }} style={styles.editPreview} resizeMode="cover" />
                                <TouchableOpacity
                                    onPress={() => setIsEditing(false)}
                                    style={styles.editCloseBtn}
                                >
                                    <Ionicons name="close" size={14} color="#fff" />
                                </TouchableOpacity>
                            </View>
                        )}
                        <View style={[styles.editInputRow, { borderTopColor: colors.border, borderTopWidth: post.file_url ? 1 : 0 }]}>
                            <TextInput
                                style={[styles.editInput, { color: colors.textPrimary }]}
                                multiline
                                value={editedContent}
                                onChangeText={setEditedContent}
                                placeholder="Write a caption…"
                                placeholderTextColor={colors.textDisabled}
                            />
                            <TouchableOpacity
                                onPress={handleSaveEdit}
                                disabled={editedContent === post.content}
                                style={[
                                    styles.editSaveBtn,
                                    editedContent === post.content && { backgroundColor: colors.hover },
                                ]}
                                activeOpacity={0.8}
                            >
                                <Text style={[
                                    styles.editSaveBtnText,
                                    editedContent === post.content && { color: colors.textDisabled },
                                ]}>
                                    Save
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* ── Options Modal ── */}
            {isOwner && (
                <Modal
                    visible={optionsDialogOpen}
                    transparent
                    animationType="fade"
                    onRequestClose={() => { setOptionsDialogOpen(false); setConfirmDelete(false); }}
                >
                    <Pressable
                        style={styles.modalBackdrop}
                        onPress={() => { setOptionsDialogOpen(false); setConfirmDelete(false); }}
                    >
                        <Pressable>
                            <View style={[styles.optionsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                                <DialogBtn
                                    icon={<MaterialIcons name="edit" size={16} color={colors.textSecondary} />}
                                    label="Edit caption"
                                    onPress={() => {
                                        setIsEditing(true);
                                        setEditedContent(post.content);
                                        setOptionsDialogOpen(false);
                                        setConfirmDelete(false);
                                    }}
                                />
                                <DialogBtn
                                    icon={
                                        confirmDelete
                                            ? <MaterialIcons name="warning" size={16} color="#e53935" />
                                            : <MaterialIcons name="delete" size={16} color="#e53935" />
                                    }
                                    label={confirmDelete ? "Confirm delete" : "Delete post"}
                                    onPress={() => confirmDelete ? handleDelete() : setConfirmDelete(true)}
                                    danger={!confirmDelete}
                                    warning={confirmDelete}
                                />
                                <DialogDivider />
                                <DialogBtn
                                    icon={<Ionicons name="close" size={16} color={colors.textDisabled} />}
                                    label="Cancel"
                                    onPress={() => { setOptionsDialogOpen(false); setConfirmDelete(false); }}
                                    muted
                                />
                            </View>
                        </Pressable>
                    </Pressable>
                </Modal>
            )}

            {/* ── Share Modal ── */}
            <Modal
                visible={usersModalOpen}
                transparent
                animationType="fade"
                onRequestClose={() => { setUsersModalOpen(false); setSearchTerm(""); }}
            >
                <Pressable
                    style={styles.modalBackdrop}
                    onPress={() => { setUsersModalOpen(false); setSearchTerm(""); }}
                >
                    <Pressable>
                        <View style={[styles.shareCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                            {/* Search */}
                            <View style={[styles.shareSearch, { borderBottomColor: colors.border }]}>
                                <TextInput
                                    style={[styles.shareSearchInput, { color: colors.textPrimary }]}
                                    placeholder="Search…"
                                    placeholderTextColor={colors.textDisabled}
                                    value={searchTerm}
                                    onChangeText={setSearchTerm}
                                />
                            </View>

                            <ScrollView style={{ maxHeight: 300 }}>
                                {filteredUsers.length > 0 ? (
                                    filteredUsers.map((user) => (
                                        <TouchableOpacity
                                            key={user.id}
                                            onPress={() => handleUserClick(user)}
                                            activeOpacity={0.7}
                                            style={styles.shareUserRow}
                                        >
                                            <Image
                                                source={
                                                    user.profile_picture
                                                        ? { uri: user.profile_picture }
                                                        : require("../assets/profile_blank.png")
                                                }
                                                style={[styles.shareAvatar, { borderColor: colors.border }]}
                                            />
                                            <Text style={[styles.shareUsername, { color: colors.textPrimary }]}>
                                                {user.username}
                                            </Text>
                                        </TouchableOpacity>
                                    ))
                                ) : (
                                    <View style={styles.shareEmpty}>
                                        <Text style={[styles.shareEmptyText, { color: colors.textDisabled }]}>
                                            No users found
                                        </Text>
                                    </View>
                                )}
                            </ScrollView>
                        </View>
                    </Pressable>
                </Pressable>
            </Modal>

            {/* ── Comments Drawer ── */}
            <ScrollableCommentsDrawer
                drawerOpen={drawerOpen}
                setDrawerOpen={setDrawerOpen}
                postComments={postComments}
                handleComment={handleComment}
                commentText={commentText}
                setCommentText={setCommentText}
                commentInputRef={commentInputRef}
                content={post.content}
                username={post.username}
                avatarUrl={post.profile_picture}
                setSelectedCommentId={setSelectedCommentId}
                handleDeleteComment={handleDeleteComment}
            />
        </>
    );
};

export default PostCard;

// ── Styles ─────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    // Card
    card: { width: "100%", borderBottomWidth: 1, overflow: "hidden" },

    // Header
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 10 },
    headerLeft: { flexDirection: "row", alignItems: "center", gap: 9 },
    avatar: { width: 34, height: 34, borderRadius: 17, borderWidth: 1 },
    username: { fontWeight: "500", fontSize: 13.6, lineHeight: 18 },
    locationRow: { flexDirection: "row", alignItems: "center", gap: 2, marginTop: 1 },
    location: { fontSize: 10.5 },
    moreBtn: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" },

    // Media
    mediaContainer: { width: "100%", backgroundColor: "#000" },
    mediaImage: { width: "100%", height: 320 },
    mediaVideo: { width: "100%", aspectRatio: 9 / 16 },  // portrait like Instagram
    videoPlayOverlay: {
        position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
        alignItems: "center", justifyContent: "center",
        backgroundColor: "rgba(0,0,0,0.25)",
    },
    videoPlayBtn: {
        width: 64, height: 64, borderRadius: 32,
        backgroundColor: "rgba(0,0,0,0.5)",
        alignItems: "center", justifyContent: "center",
    },
    videoMuteBtn: {
        position: "absolute", bottom: 12, right: 12,
        width: 32, height: 32, borderRadius: 16,
        backgroundColor: "rgba(0,0,0,0.5)",
        alignItems: "center", justifyContent: "center",
    },
    imageLoader: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", zIndex: 1 },

    // Actions
    actions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 10, paddingTop: 5, paddingBottom: 2 },
    actionsLeft: { flexDirection: "row", alignItems: "center" },
    actionBtn: { padding: 6 },
    actionCount: { fontSize: 12, marginRight: 4, minWidth: 14 },

    // Caption
    caption: { paddingHorizontal: 14, paddingBottom: 14, paddingTop: 2 },
    captionText: { fontSize: 13.5, lineHeight: 20 },
    captionUsername: { fontWeight: "500" },
    timeAgo: { fontSize: 10.5, marginTop: 5 },

    // Modals shared
    modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center", padding: 16 },

    // Edit modal
    editCard: { width: "100%", maxWidth: 480, borderRadius: 16, borderWidth: 1, overflow: "hidden" },
    editPreview: { width: "100%", height: 180 },
    editCloseBtn: { position: "absolute", top: 8, right: 8, backgroundColor: "rgba(0,0,0,0.5)", width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
    editInputRow: { flexDirection: "row", alignItems: "flex-end", paddingHorizontal: 16, paddingVertical: 12, gap: 10 },
    editInput: { flex: 1, fontFamily: "System", fontSize: 14, minHeight: 36, maxHeight: 120 },
    editSaveBtn: { backgroundColor: ACCENT, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, flexShrink: 0 },
    editSaveBtnText: { color: "#fff", fontWeight: "500", fontSize: 13 },

    // Options modal
    optionsCard: { width: 300, borderRadius: 16, borderWidth: 1, padding: 6 },

    // DialogBtn
    dialogBtn: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10 },
    dialogBtnIcon: { width: 32, height: 32, borderRadius: 9, alignItems: "center", justifyContent: "center" },
    dialogBtnLabel: { fontWeight: "500", fontSize: 14 },
    dialogDivider: { height: 1, marginHorizontal: 4, marginVertical: 3 },

    // Share modal
    shareCard: { width: 320, borderRadius: 16, borderWidth: 1, overflow: "hidden" },
    shareSearch: { paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1 },
    shareSearchInput: { fontSize: 14 },
    shareUserRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 9 },
    shareAvatar: { width: 32, height: 32, borderRadius: 16, borderWidth: 1 },
    shareUsername: { fontWeight: "500", fontSize: 13.5 },
    shareEmpty: { paddingVertical: 32, alignItems: "center" },
    shareEmptyText: { fontSize: 13 },
});