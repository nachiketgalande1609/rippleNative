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
} from "react-native";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { Video, ResizeMode, AVPlaybackStatus } from "expo-av";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Dimensions } from "react-native";
import {
  deletePost,
  likePost,
  addComment,
  updatePost,
  savePost,
  deleteComment,
  getFollowingUsers,
} from "../services/api";
import { useThemeColors } from "../hooks/useThemeColors";
import ScrollableCommentsDrawer from "../components/Scrollablecommentsdrawer";
import socket from "../services/socket";

const SW = Dimensions.get("window").width;
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

// ── Options sheet button ───────────────────────────────────────────────────────
function SheetBtn({
  icon,
  label,
  onPress,
  variant = "default",
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  variant?: "default" | "danger" | "warning" | "muted";
}) {
  const colors = useThemeColors();
  const labelColor =
    variant === "danger"
      ? "#e53935"
      : variant === "warning"
        ? "#f59e0b"
        : variant === "muted"
          ? colors.textDisabled
          : colors.textSecondary;
  const iconBg =
    variant === "danger"
      ? "rgba(229,57,53,0.08)"
      : variant === "warning"
        ? "rgba(245,158,11,0.08)"
        : colors.hover;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={styles.sheetBtn}
    >
      <View
        style={[
          styles.sheetBtnIcon,
          { backgroundColor: iconBg, borderColor: colors.border },
        ]}
      >
        {icon}
      </View>
      <Text style={[styles.sheetBtnLabel, { color: labelColor }]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ── Main PostCard ──────────────────────────────────────────────────────────────
const PostCard: React.FC<PostProps> = ({ post, fetchPosts }) => {
  const colors = useThemeColors();
  const router = useRouter();

  const [commentText, setCommentText] = useState("");
  const [commentCount, setCommentCount] = useState(post.comment_count);
  const [likeCount, setLikeCount] = useState(post.like_count);
  const [postComments, setPostComments] = useState(post.comments);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [isLiked, setIsLiked] = useState(post.liked_by_current_user);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(post.content);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isImageLoading, setIsImageLoading] = useState(true);
  const [selectedCommentId, setSelectedCommentId] = useState<number | null>(
    null,
  );
  const [isSaved, setIsSaved] = useState(post.saved_by_current_user);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [usersList, setUsersList] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const videoRef = useRef<Video>(null);

  // Double tap
  const lastTap = useRef<number>(0);
  const heartScale = useRef(new Animated.Value(0)).current;
  const heartOpacity = useRef(new Animated.Value(0)).current;
  const [showHeart, setShowHeart] = useState(false);

  // Like animation
  const likeScale = useRef(new Animated.Value(1)).current;
  const commentInputRef = useRef<TextInput>(null);

  const [currentUser, setCurrentUser] = useState<any>(null);
  React.useEffect(() => {
    AsyncStorage.getItem("user").then((raw) => {
      if (raw) setCurrentUser(JSON.parse(raw));
    });
  }, []);

  const isOwner = currentUser?.id === post.user_id;
  const isVideo = post.file_url
    ? /\.(mp4|mov|webm)$/i.test(post.file_url)
    : false;
  const filteredUsers = usersList.filter((u) =>
    u.username.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  // ── Double tap like ──
  const handleDoubleTap = async () => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      setShowHeart(true);
      heartScale.setValue(0);
      heartOpacity.setValue(0);
      Animated.sequence([
        Animated.parallel([
          Animated.spring(heartScale, {
            toValue: 1,
            speed: 18,
            bounciness: 16,
            useNativeDriver: true,
          }),
          Animated.timing(heartOpacity, {
            toValue: 1,
            duration: 80,
            useNativeDriver: true,
          }),
        ]),
        Animated.delay(650),
        Animated.parallel([
          Animated.timing(heartScale, {
            toValue: 1.25,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(heartOpacity, {
            toValue: 0,
            duration: 280,
            useNativeDriver: true,
          }),
        ]),
      ]).start(() => setShowHeart(false));
      if (!isLiked) await handleLike();
    }
    lastTap.current = now;
  };

  // ── Handlers ──
  const animateLike = () => {
    Animated.sequence([
      Animated.spring(likeScale, {
        toValue: 1.5,
        useNativeDriver: true,
        speed: 50,
      }),
      Animated.spring(likeScale, {
        toValue: 0.9,
        useNativeDriver: true,
        speed: 50,
      }),
      Animated.spring(likeScale, {
        toValue: 1,
        useNativeDriver: true,
        speed: 50,
      }),
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

  const handleShare = async () => {
    try {
      const res = await getFollowingUsers();
      if (res.success) {
        setUsersList(res.data);
        setShareModalOpen(true);
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
    setShareModalOpen(false);
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
        setOptionsOpen(false);
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

  return (
    <>
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.isDark ? "#000" : "#fff",
            borderBottomColor: colors.border,
          },
        ]}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.push(`/profile/${post.user_id}`)}
            activeOpacity={0.8}
            style={styles.headerLeft}
          >
            <Image
              source={
                post.profile_picture
                  ? { uri: post.profile_picture }
                  : require("../assets/profile_blank.png")
              }
              style={styles.avatar}
            />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                style={[styles.username, { color: colors.textPrimary }]}
                numberOfLines={1}
              >
                {post.username}
              </Text>
              {!!post.location && (
                <View style={styles.locationRow}>
                  <Ionicons name="location-sharp" size={10} color={ACCENT} />
                  <Text
                    style={[styles.location, { color: colors.textDisabled }]}
                    numberOfLines={1}
                  >
                    {post.location}
                  </Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
          {isOwner && (
            <TouchableOpacity
              onPress={() => setOptionsOpen(true)}
              style={styles.moreBtn}
              activeOpacity={0.7}
            >
              <Ionicons
                name="ellipsis-horizontal"
                size={20}
                color={colors.textDisabled}
              />
            </TouchableOpacity>
          )}
        </View>

        {/* ── Media ── */}
        {!!post.file_url && (
          <View style={styles.mediaWrap}>
            {isVideo ? (
              <Pressable
                onPress={() =>
                  isPlaying
                    ? videoRef.current?.pauseAsync()
                    : videoRef.current?.playAsync()
                }
                style={{
                  width: "100%",
                  height: 300,
                  backgroundColor: "#000",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Video
                  ref={videoRef}
                  source={{ uri: post.file_url }}
                  style={{ width: "100%", height: "100%" }}
                  resizeMode={ResizeMode.CONTAIN}
                  isMuted={isMuted}
                  isLooping
                  useNativeControls={false}
                  onPlaybackStatusUpdate={(s: AVPlaybackStatus) => {
                    if (s.isLoaded) setIsPlaying(s.isPlaying);
                  }}
                />
                {!isPlaying && (
                  <View style={styles.videoOverlay}>
                    <View style={styles.playBtn}>
                      <Ionicons name="play" size={26} color="#fff" />
                    </View>
                  </View>
                )}
                <TouchableOpacity
                  onPress={() => setIsMuted((m) => !m)}
                  style={styles.muteBtn}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={isMuted ? "volume-mute" : "volume-high"}
                    size={14}
                    color="#fff"
                  />
                </TouchableOpacity>
              </Pressable>
            ) : (
              <Pressable onPress={handleDoubleTap}>
                {isImageLoading && (
                  <View style={styles.imageLoader}>
                    <ActivityIndicator
                      size="small"
                      color={colors.textDisabled}
                    />
                  </View>
                )}
                <Image
                  source={{ uri: post.file_url }}
                  style={[
                    styles.mediaImage,
                    {
                      height:
                        post.media_width && post.media_height
                          ? Math.round(
                              (post.media_height / post.media_width) * SW,
                            )
                          : SW,
                      opacity: isImageLoading ? 0 : 1,
                    },
                  ]}
                  resizeMode="cover"
                  onLoad={() => setIsImageLoading(false)}
                />
                {showHeart && (
                  <View style={styles.heartOverlay} pointerEvents="none">
                    <Animated.View
                      style={{
                        opacity: heartOpacity,
                        transform: [{ scale: heartScale }],
                      }}
                    >
                      <Ionicons name="heart" size={88} color="#e53935" />
                      <View style={styles.heartGlow} />
                    </Animated.View>
                  </View>
                )}
              </Pressable>
            )}
          </View>
        )}

        {/* ── Actions ── */}
        <View style={styles.actions}>
          <View style={styles.actionsLeft}>
            {/* Like */}
            <View style={styles.actionGroup}>
              <Animated.View style={{ transform: [{ scale: likeScale }] }}>
                <TouchableOpacity
                  onPress={handleLike}
                  activeOpacity={0.7}
                  style={styles.actionBtn}
                >
                  <Ionicons
                    name={isLiked ? "heart" : "heart-outline"}
                    size={26}
                    color={isLiked ? "#e53935" : colors.textDisabled}
                  />
                </TouchableOpacity>
              </Animated.View>
              {likeCount > 0 && (
                <Text
                  style={[styles.actionCount, { color: colors.textSecondary }]}
                >
                  {likeCount}
                </Text>
              )}
            </View>

            {/* Comment */}
            <View style={styles.actionGroup}>
              <TouchableOpacity
                onPress={() => {
                  setDrawerOpen(true);
                }}
                activeOpacity={0.7}
                style={styles.actionBtn}
              >
                <Ionicons
                  name="chatbubble-outline"
                  size={26}
                  color={colors.textDisabled}
                />
              </TouchableOpacity>
              {commentCount > 0 && (
                <Text
                  style={[styles.actionCount, { color: colors.textSecondary }]}
                >
                  {commentCount}
                </Text>
              )}
            </View>

            {/* Share */}
            <TouchableOpacity
              onPress={handleShare}
              activeOpacity={0.7}
              style={styles.actionBtn}
            >
              <Ionicons
                name="paper-plane-outline"
                size={26}
                color={colors.textDisabled}
              />
            </TouchableOpacity>
          </View>

          {/* Save */}
          <TouchableOpacity
            onPress={handleSavePost}
            activeOpacity={0.7}
            style={styles.actionBtn}
          >
            <Ionicons
              name={isSaved ? "bookmark" : "bookmark-outline"}
              size={26}
              color={isSaved ? ACCENT : colors.textDisabled}
            />
          </TouchableOpacity>
        </View>

        {/* ── Caption + timeAgo ── */}
        <View style={styles.captionBlock}>
          {!!post.content && (
            <Text style={[styles.captionText, { color: colors.textPrimary }]}>
              <Text
                onPress={() => router.push(`/profile/${post.user_id}`)}
                style={styles.captionUsername}
              >
                {post.username}{" "}
              </Text>
              <Text style={{ color: colors.textSecondary }}>
                {post.content}
              </Text>
            </Text>
          )}
          {commentCount > 0 && (
            <TouchableOpacity
              onPress={() => setDrawerOpen(true)}
              activeOpacity={0.7}
            >
              <Text
                style={[styles.viewComments, { color: colors.textDisabled }]}
              >
                View all {commentCount} comment{commentCount !== 1 ? "s" : ""}
              </Text>
            </TouchableOpacity>
          )}
          <Text style={[styles.timeAgo, { color: colors.textDisabled }]}>
            {post.timeAgo}
          </Text>
        </View>
      </View>

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
              <View
                style={[
                  styles.optionsCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                <SheetBtn
                  icon={
                    <MaterialIcons
                      name="edit"
                      size={16}
                      color={colors.textSecondary}
                    />
                  }
                  label="Edit caption"
                  onPress={() => {
                    setIsEditing(true);
                    setEditedContent(post.content);
                    setOptionsOpen(false);
                  }}
                />
                <SheetBtn
                  icon={
                    <MaterialIcons
                      name={confirmDelete ? "warning" : "delete"}
                      size={16}
                      color="#e53935"
                    />
                  }
                  label={confirmDelete ? "Tap again to confirm" : "Delete post"}
                  onPress={() =>
                    confirmDelete ? handleDelete() : setConfirmDelete(true)
                  }
                  variant={confirmDelete ? "warning" : "danger"}
                />
                <View
                  style={[
                    styles.sheetDivider,
                    { backgroundColor: colors.border },
                  ]}
                />
                <SheetBtn
                  icon={
                    <Ionicons
                      name="close"
                      size={16}
                      color={colors.textDisabled}
                    />
                  }
                  label="Cancel"
                  onPress={() => {
                    setOptionsOpen(false);
                    setConfirmDelete(false);
                  }}
                  variant="muted"
                />
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      )}

      {/* ── Edit modal ── */}
      <Modal
        visible={isEditing}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setIsEditing(false);
        }}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setIsEditing(false)}
        >
          <Pressable>
            <View
              style={[
                styles.editCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              {!!post.file_url && !isVideo && (
                <View>
                  <Image
                    source={{ uri: post.file_url }}
                    style={styles.editPreview}
                    resizeMode="cover"
                  />
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
                <Text
                  style={[styles.editLabel, { color: colors.textDisabled }]}
                >
                  EDIT CAPTION
                </Text>
                <View
                  style={[
                    styles.editInputWrap,
                    {
                      backgroundColor: colors.hover,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <TextInput
                    style={[styles.editInput, { color: colors.textPrimary }]}
                    multiline
                    value={editedContent}
                    onChangeText={setEditedContent}
                    placeholder="Write a caption…"
                    placeholderTextColor={colors.textDisabled}
                    autoFocus
                  />
                </View>
                <View style={styles.editActions}>
                  <TouchableOpacity
                    onPress={() => setIsEditing(false)}
                    style={[styles.editBtn, { borderColor: colors.border }]}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.editBtnText,
                        { color: colors.textSecondary },
                      ]}
                    >
                      Cancel
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleSaveEdit}
                    disabled={editedContent === post.content}
                    style={[
                      styles.editBtn,
                      styles.editSaveBtn,
                      { opacity: editedContent === post.content ? 0.4 : 1 },
                    ]}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.editSaveBtnText}>Save</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Share modal ── */}
      <Modal
        visible={shareModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShareModalOpen(false);
          setSearchTerm("");
        }}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => {
            setShareModalOpen(false);
            setSearchTerm("");
          }}
        >
          <Pressable>
            <View
              style={[
                styles.shareCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.shareTitle, { color: colors.textPrimary }]}>
                Share with
              </Text>
              <View
                style={[
                  styles.shareSearch,
                  { backgroundColor: colors.hover, borderColor: colors.border },
                ]}
              >
                <Ionicons
                  name="search-outline"
                  size={16}
                  color={colors.textDisabled}
                />
                <TextInput
                  style={[
                    styles.shareSearchInput,
                    { color: colors.textPrimary },
                  ]}
                  placeholder="Search people…"
                  placeholderTextColor={colors.textDisabled}
                  value={searchTerm}
                  onChangeText={setSearchTerm}
                />
              </View>
              <ScrollView
                style={{ maxHeight: 280 }}
                showsVerticalScrollIndicator={false}
              >
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
                        style={styles.shareAvatar}
                      />
                      <Text
                        style={[
                          styles.shareUsername,
                          { color: colors.textPrimary },
                        ]}
                      >
                        {user.username}
                      </Text>
                      <View
                        style={[
                          styles.shareSendBtn,
                          {
                            backgroundColor: ACCENT + "18",
                            borderColor: ACCENT + "40",
                          },
                        ]}
                      >
                        <Text style={[styles.shareSendText, { color: ACCENT }]}>
                          Send
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))
                ) : (
                  <View style={styles.shareEmpty}>
                    <Ionicons
                      name="person-outline"
                      size={32}
                      color={colors.textDisabled}
                    />
                    <Text
                      style={[
                        styles.shareEmptyText,
                        { color: colors.textDisabled },
                      ]}
                    >
                      No users found
                    </Text>
                  </View>
                )}
              </ScrollView>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Comments drawer ── */}
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
  card: { width: "100%", borderBottomWidth: 0.5 },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "rgba(124,92,252,0.3)",
  },
  username: { fontWeight: "600", fontSize: 13.5 },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 1,
  },
  location: { fontSize: 10.5 },
  moreBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },

  // Media
  mediaWrap: { width: "100%" },
  mediaImage: { width: "100%" },
  imageLoader: {
    position: "absolute",
    inset: 0,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  videoOverlay: {
    position: "absolute",
    inset: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.18)",
  },
  playBtn: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  muteBtn: {
    position: "absolute",
    bottom: 10,
    right: 10,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },

  // Heart overlay
  heartOverlay: {
    position: "absolute",
    inset: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  heartGlow: {
    position: "absolute",
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "rgba(229,57,53,0.2)",
    shadowColor: "#e53935",
    shadowOpacity: 0.9,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 0 },
    elevation: 15,
    zIndex: -1,
  },

  // Actions
  actions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 4,
  },
  actionsLeft: { flexDirection: "row", alignItems: "center", gap: 4 },
  actionGroup: { flexDirection: "row", alignItems: "center", gap: 3 },
  actionBtn: { padding: 6, paddingRight: 3 },
  actionCount: { fontSize: 13, fontWeight: "500", marginRight: 8 },

  // Caption
  captionBlock: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    paddingTop: 2,
    gap: 3,
  },
  captionText: { fontSize: 13.5, lineHeight: 20 },
  captionUsername: { fontWeight: "700", fontSize: 13.5, color: "#f0f0f0" },
  viewComments: { fontSize: 13, marginTop: 1 },
  timeAgo: { fontSize: 10.5, marginTop: 2, letterSpacing: 0.2 },

  // Modals
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },

  // Options sheet
  optionsCard: { width: 300, borderRadius: 18, borderWidth: 1, padding: 6 },
  sheetBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 12,
  },
  sheetBtnIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetBtnLabel: { fontWeight: "500", fontSize: 14.5 },
  sheetDivider: { height: 0.5, marginHorizontal: 10, marginVertical: 4 },

  // Edit modal
  editCard: {
    width: "92%",
    maxWidth: 460,
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
  },
  editPreview: { width: "100%", height: 180 },
  editPreviewOverlay: {
    position: "absolute",
    inset: 0,
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  editCloseBtn: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  editBody: { padding: 18, gap: 12 },
  editLabel: { fontSize: 10.5, fontWeight: "600", letterSpacing: 1 },
  editInputWrap: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  editInput: { fontSize: 14.5, lineHeight: 22, minHeight: 72 },
  editActions: { flexDirection: "row", gap: 10, justifyContent: "flex-end" },
  editBtn: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
  },
  editBtnText: { fontWeight: "500", fontSize: 14 },
  editSaveBtn: { backgroundColor: ACCENT, borderColor: ACCENT },
  editSaveBtnText: { color: "#fff", fontWeight: "600", fontSize: 14 },

  // Share modal
  shareCard: {
    width: 320,
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
    paddingTop: 16,
  },
  shareTitle: {
    fontWeight: "600",
    fontSize: 15,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  shareSearch: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 12,
    marginBottom: 8,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  shareSearchInput: { flex: 1, fontSize: 13.5 },
  shareUserRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  shareAvatar: { width: 36, height: 36, borderRadius: 18 },
  shareUsername: { flex: 1, fontWeight: "500", fontSize: 13.5 },
  shareSendBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  shareSendText: { fontWeight: "600", fontSize: 12 },
  shareEmpty: { alignItems: "center", paddingVertical: 36, gap: 8 },
  shareEmptyText: { fontSize: 13 },
});
