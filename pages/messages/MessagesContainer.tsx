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
  Modal,
  Pressable,
  Dimensions,
} from "react-native";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useThemeColors } from "../../hooks/useThemeColors";
import { getMessagesDataForSelectedUser } from "../../services/api";

const ACCENT = "#7c5cfc";
const { width: SCREEN_W } = Dimensions.get("window");

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
  return b < 1024 * 1024
    ? (b / 1024).toFixed(1) + " KB"
    : (b / (1024 * 1024)).toFixed(1) + " MB";
}

function formatTime(ts: string) {
  return new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function formatDetailTime(ts: string) {
  const d = new Date(ts);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  const timeStr = d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  const dateStr = isToday
    ? "Today"
    : d.toLocaleDateString([], { month: "short", day: "numeric" });
  return { time: timeStr, date: dateStr };
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
          Animated.timing(d, {
            toValue: -4,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(d, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ]),
      );
    Animated.parallel([
      anim(dot1, 0),
      anim(dot2, 150),
      anim(dot3, 300),
    ]).start();
  }, []);

  return (
    <View
      style={[
        styles.typingRow,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          marginLeft: 32,
        },
      ]}
    >
      {[dot1, dot2, dot3].map((d, i) => (
        <Animated.View
          key={i}
          style={[
            styles.typingDot,
            {
              backgroundColor: colors.textDisabled,
              transform: [{ translateY: d }],
            },
          ]}
        />
      ))}
    </View>
  );
}

// ── Skeleton ───────────────────────────────────────────────────────────────────
function MessageSkeleton({ colors }: { colors: any }) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.4,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);

  return (
    <Animated.View style={[styles.skeletonFill, { opacity: pulse }]}>
      {[true, false, true, false, true, false, true].map((self, i) => (
        <View
          key={i}
          style={[
            styles.skeletonRow,
            { justifyContent: self ? "flex-end" : "flex-start" },
          ]}
        >
          {!self && (
            <View
              style={[styles.skeletonAvatar, { backgroundColor: colors.hover }]}
            />
          )}
          <View
            style={[
              styles.skeletonBubble,
              { backgroundColor: colors.hover, width: 80 + i * 22 },
            ]}
          />
        </View>
      ))}
    </Animated.View>
  );
}

// ── Message Details Sheet ──────────────────────────────────────────────────────
function MessageDetailsSheet({
  visible,
  msg,
  colors,
  isDark,
  onClose,
}: {
  visible: boolean;
  msg: Message | null;
  colors: any;
  isDark: boolean;
  onClose: () => void;
}) {
  const slideAnim = useRef(new Animated.Value(300)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        damping: 20,
        stiffness: 200,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 300,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  if (!msg) return null;

  const sent = formatDetailTime(msg.timestamp);
  // Simulate delivered/read times (offset by a few seconds for demo;
  // replace with real timestamps from your message object if available)
  const deliveredTs = new Date(
    new Date(msg.timestamp).getTime() + 2000,
  ).toISOString();
  const readTs = msg.read
    ? new Date(new Date(msg.timestamp).getTime() + 15000).toISOString()
    : null;
  const delivered = msg.delivered ? formatDetailTime(deliveredTs) : null;
  const read = readTs ? formatDetailTime(readTs) : null;

  const rows: {
    icon: string;
    iconColor: string;
    bgColor: string;
    label: string;
    info: { time: string; date: string } | null;
    pending?: boolean;
  }[] = [
    {
      icon: "checkmark",
      iconColor: colors.textDisabled,
      bgColor: colors.hover,
      label: "Sent",
      info: sent,
    },
    {
      icon: "checkmark-done",
      iconColor: msg.delivered ? colors.textDisabled : colors.textDisabled,
      bgColor: colors.hover,
      label: "Delivered",
      info: delivered,
      pending: !msg.delivered,
    },
    {
      icon: "checkmark-done",
      iconColor: ACCENT,
      bgColor: isDark ? "rgba(124,92,252,0.15)" : "rgba(124,92,252,0.08)",
      label: "Read",
      info: read,
      pending: !msg.read,
    },
  ];

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.sheetBackdrop} onPress={onClose}>
        <Animated.View
          style={[
            styles.sheetContainer,
            {
              backgroundColor: colors.bg,
              borderTopColor: colors.border,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <Pressable onPress={(e) => e.stopPropagation()}>
            {/* Handle */}
            <View
              style={[styles.sheetHandle, { backgroundColor: colors.border }]}
            />

            {/* Title */}
            <Text style={[styles.sheetTitle, { color: colors.textPrimary }]}>
              Message info
            </Text>

            {/* Bubble preview */}
            {!!msg.message_text && (
              <View style={styles.sheetBubbleWrap}>
                <View style={styles.sheetBubble}>
                  <Text style={styles.sheetBubbleText} numberOfLines={3}>
                    {msg.message_text}
                  </Text>
                </View>
              </View>
            )}

            {/* Divider */}
            <View
              style={[styles.sheetDivider, { backgroundColor: colors.border }]}
            />

            {/* Detail rows */}
            {rows.map((row, i) => (
              <View
                key={i}
                style={[
                  styles.detailRow,
                  { borderBottomColor: colors.border },
                  i === rows.length - 1 && { borderBottomWidth: 0 },
                ]}
              >
                <View
                  style={[
                    styles.detailIconWrap,
                    { backgroundColor: row.bgColor },
                  ]}
                >
                  <Ionicons
                    name={row.icon as any}
                    size={15}
                    color={row.pending ? colors.textDisabled : row.iconColor}
                  />
                </View>
                <Text
                  style={[styles.detailLabel, { color: colors.textSecondary }]}
                >
                  {row.label}
                </Text>
                {row.pending || !row.info ? (
                  <Text
                    style={[
                      styles.detailPending,
                      { color: colors.textDisabled },
                    ]}
                  >
                    Pending
                  </Text>
                ) : (
                  <View style={styles.detailTimeWrap}>
                    <Text
                      style={[styles.detailTime, { color: colors.textPrimary }]}
                    >
                      {row.info.time}
                    </Text>
                    <Text
                      style={[
                        styles.detailDate,
                        { color: colors.textDisabled },
                      ]}
                    >
                      {row.info.date}
                    </Text>
                  </View>
                )}
              </View>
            ))}
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

// ── Popup Menu ─────────────────────────────────────────────────────────────────
const REACTIONS = ["❤️", "😂", "😮", "😢", "👍", "🙏"];

function PopupMenu({
  visible,
  position,
  isSelf,
  colors,
  isDark,
  onReply,
  onDelete,
  onReact,
  onInfo,
  onClose,
}: {
  visible: boolean;
  position: { top: number; left: number; width: number; height: number };
  isSelf: boolean;
  colors: any;
  isDark: boolean;
  onReply: () => void;
  onDelete: () => void;
  onReact: (r: string) => void;
  onInfo: () => void;
  onClose: () => void;
}) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 160,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          damping: 18,
          stiffness: 280,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.85);
    }
  }, [visible]);

  // Calculate popup position: prefer above the bubble, fall back to below
  const POPUP_W = 200;
  const EMOJI_H = 52;
  const MENU_H = isSelf ? 184 : 140; // approx
  const GAP = 8;
  const PADDING = 12;

  const spaceAbove = position.top - EMOJI_H - MENU_H - GAP * 2;
  const showAbove = spaceAbove > 20;

  const popupTop = showAbove
    ? position.top - EMOJI_H - MENU_H - GAP * 2
    : position.top + position.height + GAP;

  const rawLeft = isSelf
    ? position.left + position.width - POPUP_W
    : position.left;
  const clampedLeft = Math.max(
    PADDING,
    Math.min(rawLeft, SCREEN_W - POPUP_W - PADDING),
  );

  const menuItems = [
    {
      icon: "return-up-back-outline" as const,
      label: "Reply",
      onPress: onReply,
    },
    {
      icon: "information-circle-outline" as const,
      label: "Message info",
      onPress: onInfo,
    },
    { icon: "copy-outline" as const, label: "Copy text", onPress: onClose },
    { icon: "arrow-redo-outline" as const, label: "Forward", onPress: onClose },
    ...(isSelf
      ? [
          {
            icon: "trash-outline" as const,
            label: "Delete",
            onPress: onDelete,
            danger: true,
          },
        ]
      : []),
  ];

  if (!visible) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.popupBackdrop} onPress={onClose}>
        <Animated.View
          style={[
            styles.popupWrapper,
            {
              top: popupTop,
              left: clampedLeft,
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {/* Emoji reaction strip */}
          <View
            style={[
              styles.emojiStrip,
              {
                backgroundColor: colors.bg,
                borderColor: colors.border,
                shadowColor: isDark ? "#000" : "#888",
              },
            ]}
          >
            {REACTIONS.map((emoji, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => onReact(emoji)}
                style={styles.emojiBtnWrap}
                activeOpacity={0.7}
              >
                <Text style={styles.emojiText}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Action menu */}
          <View
            style={[
              styles.actionMenu,
              {
                backgroundColor: colors.bg,
                borderColor: colors.border,
                shadowColor: isDark ? "#000" : "#888",
              },
            ]}
          >
            {menuItems.map((item, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => {
                  onClose();
                  item.onPress();
                }}
                activeOpacity={0.7}
                style={[
                  styles.actionItem,
                  { borderBottomColor: colors.border },
                  i === menuItems.length - 1 && { borderBottomWidth: 0 },
                ]}
              >
                <Ionicons
                  name={item.icon}
                  size={16}
                  color={
                    (item as any).danger ? "#e53935" : colors.textSecondary
                  }
                />
                <Text
                  style={[
                    styles.actionLabel,
                    {
                      color: (item as any).danger
                        ? "#e53935"
                        : colors.textPrimary,
                    },
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

// ── Message Bubble ─────────────────────────────────────────────────────────────
function MessageBubble({
  msg,
  self,
  selectedUser,
  currentUser,
  allMessages,
  colors,
  isDark,
  onReply,
  onDelete,
  onImagePress,
  onPostPress,
  onReact,
}: {
  msg: Message;
  self: boolean;
  selectedUser: User;
  currentUser: any;
  allMessages: Message[];
  colors: any;
  isDark: boolean;
  onReply: (m: Message) => void;
  onDelete: (m: Message) => void;
  onImagePress: (url: string) => void;
  onPostPress: (id: number) => void;
  onReact: (id: number, r: string) => void;
}) {
  const [showPopup, setShowPopup] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [popupPos, setPopupPos] = useState({
    top: 0,
    left: 0,
    width: 0,
    height: 0,
  });
  const bubbleRef = useRef<View>(null);

  const selfBg = ACCENT;
  const otherBg = colors.surface;
  const mediaW = 260;

  const originalMessage = msg.reply_to
    ? allMessages.find((m) => m.message_id === msg.reply_to)
    : null;
  const isImage = msg.file_url?.match(/\.(jpeg|jpg|png|gif|bmp|webp)$/i);
  const isVideo = msg.file_url?.match(/\.(mp4|webm|ogg|mov)$/i);

  const openPopup = () => {
    bubbleRef.current?.measureInWindow((x, y, width, height) => {
      setPopupPos({ top: y, left: x, width, height });
      setShowPopup(true);
    });
  };

  return (
    <View style={{ marginBottom: 10 }}>
      {/* ── Message row ── */}
      <View
        style={[
          styles.msgRow,
          { justifyContent: self ? "flex-end" : "flex-start" },
        ]}
      >
        {!self && (
          <Image
            source={
              selectedUser.profile_picture
                ? { uri: selectedUser.profile_picture }
                : require("../../assets/profile_blank.png")
            }
            style={styles.msgAvatar}
          />
        )}

        <View
          style={{
            maxWidth: "75%",
            alignItems: self ? "flex-end" : "flex-start",
          }}
        >
          {/* Reply quote */}
          {originalMessage && (
            <View
              style={[
                styles.replyQuote,
                {
                  backgroundColor: isDark
                    ? "rgba(124,92,252,0.1)"
                    : "rgba(124,92,252,0.07)",
                },
              ]}
            >
              <Text style={styles.replyQuoteUser}>
                {originalMessage.sender_id === currentUser.id
                  ? "You"
                  : selectedUser.username}
              </Text>
              <Text
                style={[styles.replyQuoteText, { color: colors.textSecondary }]}
                numberOfLines={1}
              >
                {originalMessage.message_text?.slice(0, 55) +
                  (originalMessage.message_text?.length > 55 ? "…" : "")}
              </Text>
            </View>
          )}

          {/* Shared post */}
          {msg.post && (
            <TouchableOpacity
              onPress={() => onPostPress(msg.post!.post_id)}
              activeOpacity={0.85}
              style={[
                styles.postCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              {msg.post.owner && (
                <View
                  style={[
                    styles.postCardHeader,
                    { borderBottomColor: colors.border },
                  ]}
                >
                  <Image
                    source={{ uri: msg.post.owner.profile_picture }}
                    style={styles.postCardAvatar}
                  />
                  <Text
                    style={[
                      styles.postCardOwner,
                      { color: colors.textPrimary },
                    ]}
                  >
                    {msg.post.owner.username}
                  </Text>
                </View>
              )}
              {msg.post.file_url && (
                <Image
                  source={{ uri: msg.post.file_url }}
                  style={{
                    width: mediaW,
                    height:
                      msg.post.media_width && msg.post.media_height
                        ? (msg.post.media_height / msg.post.media_width) *
                          mediaW
                        : mediaW,
                  }}
                  resizeMode="cover"
                />
              )}
              {msg.post.content && (
                <View style={{ padding: 10 }}>
                  <Text
                    style={[
                      styles.postCardContent,
                      { color: colors.textSecondary },
                    ]}
                    numberOfLines={2}
                  >
                    <Text
                      style={{ fontWeight: "500", color: colors.textPrimary }}
                    >
                      {msg.post.owner.username}{" "}
                    </Text>
                    {msg.post.content}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          )}

          {/* Image */}
          {msg.file_url && isImage && (
            <TouchableOpacity
              onPress={() => onImagePress(msg.file_url)}
              activeOpacity={0.9}
              style={[styles.mediaWrap, { borderColor: colors.border }]}
            >
              <Image
                source={{ uri: msg.file_url }}
                style={{
                  width: mediaW,
                  height:
                    msg.media_width && msg.media_height
                      ? (msg.media_height / msg.media_width) * mediaW
                      : 180,
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
              style={[
                styles.fileBubble,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
              activeOpacity={0.8}
            >
              <MaterialIcons
                name="insert-drive-file"
                size={26}
                color={colors.textDisabled}
              />
              <View style={{ flex: 1 }}>
                <Text
                  style={[styles.fileName, { color: colors.textPrimary }]}
                  numberOfLines={1}
                >
                  {msg.file_name}
                </Text>
                <Text style={[styles.fileSize, { color: colors.textDisabled }]}>
                  {formatFileSize(msg.file_size)}
                </Text>
              </View>
            </TouchableOpacity>
          )}

          {/* Text bubble */}
          {!!msg.message_text && (
            <TouchableOpacity
              ref={bubbleRef as any}
              onLongPress={openPopup}
              activeOpacity={1}
              delayLongPress={280}
            >
              <View
                style={[
                  styles.bubble,
                  {
                    backgroundColor: self ? selfBg : otherBg,
                    borderRadius: 14,
                    borderTopRightRadius: self ? 4 : 14,
                    borderTopLeftRadius: self ? 14 : 4,
                    borderWidth: self ? 0 : 1,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.bubbleText,
                    { color: self ? "#fff" : colors.textPrimary },
                  ]}
                >
                  {msg.message_text}
                </Text>
                <Text
                  style={[
                    styles.bubbleTime,
                    {
                      color: self
                        ? "rgba(255,255,255,0.65)"
                        : colors.textDisabled,
                      textAlign: "right",
                    },
                  ]}
                >
                  {formatTime(msg.timestamp)}
                </Text>
              </View>
            </TouchableOpacity>
          )}

          {/* Reactions */}
          {msg.reactions?.length > 0 && (
            <View
              style={[
                styles.reactions,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              {msg.reactions.map((r, i) => (
                <Text key={i} style={styles.reactionEmoji}>
                  {r.reaction}
                </Text>
              ))}
            </View>
          )}
        </View>

        {/* Read tick */}
        {self && (
          <View style={styles.tick}>
            {msg.read ? (
              <Ionicons name="checkmark-done" size={13} color={ACCENT} />
            ) : msg.delivered ? (
              <Ionicons
                name="checkmark-done"
                size={13}
                color={colors.textDisabled}
              />
            ) : msg.saved ? (
              <Ionicons
                name="checkmark"
                size={13}
                color={colors.textDisabled}
              />
            ) : (
              <Ionicons
                name="time-outline"
                size={12}
                color={colors.textDisabled}
              />
            )}
          </View>
        )}
      </View>

      {/* ── Popup Menu Modal ── */}
      <PopupMenu
        visible={showPopup}
        position={popupPos}
        isSelf={self}
        colors={colors}
        isDark={isDark}
        onClose={() => setShowPopup(false)}
        onReply={() => onReply(msg)}
        onDelete={() => onDelete(msg)}
        onReact={(r) => onReact(msg.message_id, r)}
        onInfo={() => setShowDetails(true)}
      />

      {/* ── Message Details Sheet ── */}
      <MessageDetailsSheet
        visible={showDetails}
        msg={msg}
        colors={colors}
        isDark={isDark}
        onClose={() => setShowDetails(false)}
      />
    </View>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
const MessagesContainer: React.FC<Props> = ({
  selectedUser,
  messages,
  currentUser,
  handleImageClick,
  handleReply,
  handleDeleteMessage,
  handleReaction,
  typingUser,
  initialMessageLoading,
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
  const dedupedOlder = olderMessages.filter(
    (m) => !currentIds.has(m.message_id),
  );
  const allMessages = [...dedupedOlder, ...messages];

  const loadMore = useCallback(async () => {
    if (!selectedUser || isLoadingRef.current || !hasMoreRef.current) return;
    isLoadingRef.current = true;
    setIsLoadingMore(true);
    const nextOffset = offsetRef.current + 20;
    try {
      const res = await getMessagesDataForSelectedUser(
        selectedUser.id,
        nextOffset,
        20,
      );
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
    } catch (e) {
      console.error(e);
    } finally {
      isLoadingRef.current = false;
      setIsLoadingMore(false);
    }
  }, [selectedUser]);

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages.length]);

  if (initialMessageLoading) {
    return <MessageSkeleton colors={colors} />;
  }

  if (!selectedUser) {
    return (
      <View style={styles.emptyState}>
        <View
          style={[
            styles.emptyIcon,
            {
              backgroundColor: isDark
                ? "rgba(124,92,252,0.12)"
                : "rgba(124,92,252,0.08)",
            },
          ]}
        >
          <Ionicons
            name="chatbubble-outline"
            size={28}
            color={ACCENT}
            style={{ opacity: 0.8 }}
          />
        </View>
        <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
          No conversation selected
        </Text>
        <Text style={[styles.emptySub, { color: colors.textDisabled }]}>
          Pick someone to message
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      ref={scrollRef}
      style={[styles.root, { backgroundColor: isDark ? colors.bg : "#f7f7f8" }]}
      contentContainerStyle={{ padding: 12, paddingBottom: 44 }}
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
            <Text style={[styles.beginText, { color: colors.textDisabled }]}>
              Beginning of conversation
            </Text>
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
  msgAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    flexShrink: 0,
    marginBottom: 2,
  },

  replyQuote: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderLeftWidth: 3,
    borderLeftColor: ACCENT,
    borderRadius: 8,
    marginBottom: 3,
  },
  replyQuoteUser: {
    fontSize: 11,
    fontWeight: "600",
    color: ACCENT,
    marginBottom: 2,
  },
  replyQuoteText: { fontSize: 12 },

  postCard: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 3,
  },
  postCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderBottomWidth: 1,
    gap: 7,
  },
  postCardAvatar: { width: 22, height: 22, borderRadius: 11 },
  postCardOwner: { fontSize: 12.5, fontWeight: "500" },
  postCardContent: { fontSize: 12.5 },

  mediaWrap: {
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    marginBottom: 3,
  },

  fileBubble: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 3,
    width: 200,
  },
  fileName: { fontSize: 12.5, fontWeight: "500" },
  fileSize: { fontSize: 11 },

  bubble: { paddingHorizontal: 12, paddingVertical: 8 },
  bubbleText: { fontSize: 14, lineHeight: 21 },
  bubbleTime: { fontSize: 10.5, marginTop: 3 },

  reactions: {
    flexDirection: "row",
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: -4,
  },
  reactionEmoji: { fontSize: 14 },

  tick: { marginBottom: 4, alignSelf: "flex-end" },

  typingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 4,
  },
  typingDot: { width: 6, height: 6, borderRadius: 3 },

  skeletonRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    marginBottom: 8,
  },
  skeletonAvatar: { width: 26, height: 26, borderRadius: 13 },
  skeletonBubble: { height: 38, borderRadius: 14 },

  beginPill: { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20 },
  beginText: { fontSize: 11 },

  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    padding: 32,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: { fontWeight: "500", fontSize: 15 },
  emptySub: { fontSize: 13 },
  skeletonFill: { flex: 1, padding: 12, gap: 10 },

  // ── Popup ──
  popupBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  popupWrapper: {
    position: "absolute",
    width: 200,
    gap: 6,
  },
  emojiStrip: {
    flexDirection: "row",
    borderRadius: 28,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 6,
    justifyContent: "space-between",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
  emojiBtnWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  emojiText: { fontSize: 20 },
  actionMenu: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
  actionItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  actionLabel: { fontSize: 14 },

  // ── Details sheet ──
  sheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  },
  sheetContainer: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    paddingHorizontal: 20,
    paddingBottom: 36,
    paddingTop: 12,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 14,
  },
  sheetBubbleWrap: {
    alignItems: "flex-end",
    marginBottom: 16,
  },
  sheetBubble: {
    backgroundColor: ACCENT,
    borderRadius: 14,
    borderTopRightRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 9,
    maxWidth: "85%",
  },
  sheetBubbleText: {
    fontSize: 13.5,
    color: "#fff",
    lineHeight: 19,
  },
  sheetDivider: {
    height: 1,
    marginBottom: 4,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 13,
    borderBottomWidth: 1,
  },
  detailIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  detailLabel: { fontSize: 14, flex: 1 },
  detailPending: { fontSize: 13 },
  detailTimeWrap: { alignItems: "flex-end" },
  detailTime: { fontSize: 13, fontWeight: "500" },
  detailDate: { fontSize: 11, marginTop: 1 },
});
