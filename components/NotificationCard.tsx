import React from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { timeAgo } from "../utils/utils";
import { useThemeColors } from "../hooks/useThemeColors";

const ACCENT = "#7c5cfc";

interface Notification {
  id: number;
  type: string;
  message: string;
  post_id: number | null;
  created_at: string;
  sender_id: string;
  username: string;
  profile_picture: string;
  file_url?: string;
  request_status: string;
  requester_id?: number;
  request_id: number;
}

interface NotificationCardProps {
  notification: Notification;
  onFollowBack: (userId: string) => void;
  onFollowRequestResponse: (
    request_id: number,
    response: "accepted" | "rejected",
  ) => void;
  followRequestAcceptLoading: boolean;
  followRequestRejectLoading: boolean;
}

// Returns icon name + background color per notification type
function getTypeIcon(type: string): { name: any; bg: string; color: string } {
  switch (type) {
    case "like":
      return { name: "heart", bg: "rgba(229,57,53,0.12)", color: "#e53935" };
    case "comment":
      return {
        name: "chatbubble",
        bg: "rgba(33,150,243,0.12)",
        color: "#2196f3",
      };
    case "follow":
      return { name: "person-add", bg: "rgba(124,92,252,0.12)", color: ACCENT };
    case "follow_request":
      return { name: "person-add", bg: "rgba(124,92,252,0.12)", color: ACCENT };
    case "mention":
      return { name: "at", bg: "rgba(255,152,0,0.12)", color: "#ff9800" };
    default:
      return {
        name: "notifications",
        bg: "rgba(158,158,158,0.12)",
        color: "#9e9e9e",
      };
  }
}

const NotificationCard: React.FC<NotificationCardProps> = ({
  notification,
  onFollowBack,
  onFollowRequestResponse,
  followRequestAcceptLoading,
  followRequestRejectLoading,
}) => {
  const colors = useThemeColors();
  const router = useRouter();

  const timeLabel = timeAgo(notification.created_at);
  const isAccepted = notification.request_status === "accepted";
  const isRejected = notification.request_status === "rejected";
  const isPending = notification.request_status === "pending";
  const typeIcon = getTypeIcon(notification.type);

  return (
    <TouchableOpacity
      onPress={() => router.push(`/profile/${notification.sender_id}`)}
      activeOpacity={0.7}
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      {/* Avatar with type badge */}
      <View style={styles.avatarWrap}>
        <Image
          source={
            notification.profile_picture
              ? { uri: notification.profile_picture }
              : require("../assets/profile_blank.png")
          }
          style={[styles.avatar, { borderColor: colors.border }]}
        />
        <View style={[styles.typeBadge, { backgroundColor: typeIcon.bg }]}>
          <Ionicons name={typeIcon.name} size={10} color={typeIcon.color} />
        </View>
      </View>

      {/* Text */}
      <View style={styles.textWrap}>
        <Text
          style={[styles.message, { color: colors.textPrimary }]}
          numberOfLines={2}
        >
          <Text style={styles.username}>{notification.username} </Text>
          <Text style={{ color: colors.textSecondary }}>
            {notification.message}
          </Text>
        </Text>
        <Text style={[styles.time, { color: colors.textDisabled }]}>
          {timeLabel === "Just Now" ? timeLabel : `${timeLabel} ago`}
        </Text>

        {/* Follow request action buttons — inside text col for better layout */}
        {notification.type === "follow_request" && isPending && (
          <View style={styles.requestBtns}>
            <TouchableOpacity
              onPress={() =>
                onFollowRequestResponse(notification.request_id, "accepted")
              }
              disabled={followRequestAcceptLoading}
              activeOpacity={0.85}
              style={[
                styles.acceptBtn,
                { backgroundColor: colors.textPrimary },
              ]}
            >
              {followRequestAcceptLoading ? (
                <ActivityIndicator size={12} color={colors.bg} />
              ) : (
                <Text style={[styles.acceptText, { color: colors.bg }]}>
                  Accept
                </Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() =>
                onFollowRequestResponse(notification.request_id, "rejected")
              }
              disabled={followRequestRejectLoading}
              activeOpacity={0.7}
              style={[
                styles.declineBtn,
                { borderColor: colors.border, backgroundColor: colors.hover },
              ]}
            >
              {followRequestRejectLoading ? (
                <ActivityIndicator size={12} color={colors.textDisabled} />
              ) : (
                <Text
                  style={[styles.declineText, { color: colors.textSecondary }]}
                >
                  Decline
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Right side */}
      <View style={styles.rightCol}>
        {/* Post thumbnail */}
        {(notification.type === "like" || notification.type === "comment") &&
          notification.file_url && (
            <View style={[styles.thumbWrap, { borderColor: colors.border }]}>
              <Image
                source={{ uri: notification.file_url }}
                style={styles.thumb}
                resizeMode="cover"
              />
            </View>
          )}

        {/* Follow back */}
        {notification.type === "follow" && (
          <TouchableOpacity
            onPress={() => {
              if (!isAccepted) onFollowBack(notification.sender_id);
            }}
            disabled={isAccepted}
            activeOpacity={0.8}
            style={[
              styles.followBackBtn,
              isAccepted
                ? { backgroundColor: colors.hover, borderColor: colors.border }
                : { backgroundColor: ACCENT },
            ]}
          >
            <Text
              style={[
                styles.followBackText,
                { color: isAccepted ? colors.textDisabled : "#fff" },
              ]}
            >
              {isAccepted ? "Following" : "Follow"}
            </Text>
          </TouchableOpacity>
        )}

        {/* Follow request status chip — moved here from textWrap */}
        {notification.type === "follow_request" && !isPending && (
          <View
            style={[
              styles.statusChip,
              { backgroundColor: colors.hover, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.statusText, { color: colors.textDisabled }]}>
              {isAccepted ? "Accepted" : isRejected ? "Declined" : ""}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

export default NotificationCard;

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: 6,
    borderRadius: 16,
    borderWidth: 1,
  },

  // Avatar
  avatarWrap: { position: "relative", flexShrink: 0, paddingTop: 2 },
  avatar: { width: 46, height: 46, borderRadius: 23, borderWidth: 1.5 },
  typeBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },

  // Text
  textWrap: { flex: 1, minWidth: 0, gap: 3 },
  message: { fontSize: 13.5, lineHeight: 20 },
  username: { fontWeight: "700" },
  time: { fontSize: 11.5 },

  // Request buttons
  requestBtns: { flexDirection: "row", gap: 8, marginTop: 8 },
  acceptBtn: {
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 7,
    alignItems: "center",
  },
  acceptText: { fontSize: 12.5, fontWeight: "600" },
  declineBtn: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 7,
    alignItems: "center",
  },
  declineText: { fontSize: 12.5, fontWeight: "500" },

  // Status chip
  statusChip: {
    alignSelf: "flex-start",
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginTop: 6,
  },
  statusText: { fontSize: 11.5 },

  // Right col
  rightCol: { flexShrink: 0, alignItems: "flex-end", paddingTop: 2 },

  // Follow back
  followBackBtn: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  followBackText: { fontSize: 12.5, fontWeight: "600" },

  // Thumbnail
  thumbWrap: {
    width: 46,
    height: 46,
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 1,
  },
  thumb: { width: "100%", height: "100%" },
});
