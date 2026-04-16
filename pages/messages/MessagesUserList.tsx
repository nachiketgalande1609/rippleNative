import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  TextInput,
  FlatList,
  StyleSheet,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors } from "../../hooks/useThemeColors";
import { timeAgo } from "../../utils/utils";

type User = {
  id: number;
  username: string;
  profile_picture: string;
  isOnline: boolean;
  latest_message: string;
  latest_message_timestamp: string;
  unread_count: number;
};

type Props = {
  users: User[];
  onlineUsers: string[];
  handleUserClick: (userId: number) => void;
  activeUserId?: number;
  loading?: boolean;
};

const AVATAR_COLORS = [
  { bg: "#E6F1FB", color: "#185FA5" },
  { bg: "#EEEDFE", color: "#534AB7" },
  { bg: "#E1F5EE", color: "#0F6E56" },
  { bg: "#FAEEDA", color: "#854F0B" },
  { bg: "#FAECE7", color: "#993C1D" },
  { bg: "#FBEAF0", color: "#993556" },
  { bg: "#EAF3DE", color: "#3B6D11" },
  { bg: "#FCEBEB", color: "#A32D2D" },
];

function getAvatarColor(username: string) {
  const idx =
    username.split("").reduce((a, c) => a + c.charCodeAt(0), 0) %
    AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

function getInitials(username: string) {
  return username
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function SkeletonList({ colors }: { colors: any }) {
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

  return (
    <Animated.View style={{ opacity }}>
      {/* RECENT label skeleton */}
      <View style={[styles.sectionLabel, { paddingTop: 10 }]}>
        <View
          style={{
            height: 10,
            width: 52,
            borderRadius: 5,
            backgroundColor: colors.hover,
          }}
        />
      </View>

      {/* Rows */}
      <View style={{ paddingHorizontal: 8 }}>
        {Array(7)
          .fill(0)
          .map((_, i) => (
            <View
              key={i}
              style={[styles.userRow, { borderBottomColor: colors.border }]}
            >
              {/* Avatar */}
              <View
                style={[
                  styles.avatar,
                  { backgroundColor: colors.hover, borderRadius: 21 },
                ]}
              />
              {/* Content */}
              <View style={styles.userContent}>
                <View style={styles.userTopRow}>
                  <View
                    style={{
                      height: 13,
                      width: "38%",
                      borderRadius: 6,
                      backgroundColor: colors.hover,
                    }}
                  />
                  <View
                    style={{
                      height: 10,
                      width: 28,
                      borderRadius: 4,
                      backgroundColor: colors.hover,
                    }}
                  />
                </View>
                <View
                  style={{
                    height: 10,
                    width: "62%",
                    borderRadius: 6,
                    backgroundColor: colors.hover,
                  }}
                />
              </View>
              {/* Badge placeholder */}
              <View
                style={{
                  width: 17,
                  height: 17,
                  borderRadius: 99,
                  backgroundColor: colors.hover,
                }}
              />
            </View>
          ))}
      </View>
    </Animated.View>
  );
}

export default function MessagesUserList({
  users,
  onlineUsers = [],
  handleUserClick,
  activeUserId,
  loading = false,
}: Props) {
  const colors = useThemeColors();
  const [search, setSearch] = useState("");

  const sorted = useMemo(
    () =>
      [...users].sort(
        (a, b) =>
          new Date(b.latest_message_timestamp).getTime() -
          new Date(a.latest_message_timestamp).getTime(),
      ),
    [users],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q
      ? sorted.filter((u) => u.username.toLowerCase().includes(q))
      : sorted;
  }, [sorted, search]);

  const totalUnread = useMemo(
    () => users.reduce((n, u) => n + (u.unread_count || 0), 0),
    [users],
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
          Messages
        </Text>
        {!loading && totalUnread > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadBadgeText}>{totalUnread} new</Text>
          </View>
        )}
      </View>

      {/* Search */}
      <View style={[styles.searchWrap, { borderBottomColor: colors.border }]}>
        <View
          style={[
            styles.searchInner,
            { backgroundColor: colors.hover, borderColor: colors.border },
          ]}
        >
          <Ionicons
            name="search-outline"
            size={15}
            color={colors.textDisabled}
          />
          <TextInput
            style={[styles.searchInput, { color: colors.textPrimary }]}
            placeholder="Search messages…"
            placeholderTextColor={colors.textDisabled}
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
          />
          {!!search && (
            <TouchableOpacity
              onPress={() => setSearch("")}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name="close-circle"
                size={14}
                color={colors.textDisabled}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Body */}
      {loading ? (
        <SkeletonList colors={colors} />
      ) : filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons
            name="chatbubble-outline"
            size={38}
            color={colors.textDisabled}
            style={{ opacity: 0.4 }}
          />
          <Text style={[styles.emptyText, { color: colors.textDisabled }]}>
            {search ? "No results found" : "No conversations yet."}
          </Text>
        </View>
      ) : (
        <>
          <Text style={[styles.sectionLabel, { color: colors.textDisabled }]}>
            RECENT
          </Text>
          <FlatList
            data={filtered}
            keyExtractor={(item) => String(item.id)}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 100, paddingHorizontal: 8 }}
            renderItem={({ item: user }) => {
              const isOnline = onlineUsers
                .map(String)
                .includes(String(user.id));
              const isActive = activeUserId === user.id;
              const hasUnread = (user.unread_count || 0) > 0;
              const avatarColor = getAvatarColor(user.username);

              return (
                <TouchableOpacity
                  onPress={() => handleUserClick(user.id)}
                  activeOpacity={0.7}
                  style={[
                    styles.userRow,
                    { borderBottomColor: colors.border },
                    isActive && { backgroundColor: colors.selected },
                  ]}
                >
                  {/* Avatar */}
                  <View style={styles.avatarWrap}>
                    {user.profile_picture ? (
                      <Image
                        source={{ uri: user.profile_picture }}
                        style={styles.avatar}
                      />
                    ) : (
                      <View
                        style={[
                          styles.avatar,
                          styles.avatarInitials,
                          { backgroundColor: avatarColor.bg },
                        ]}
                      >
                        <Text
                          style={[
                            styles.initialsText,
                            { color: avatarColor.color },
                          ]}
                        >
                          {getInitials(user.username)}
                        </Text>
                      </View>
                    )}
                    {isOnline && (
                      <View
                        style={[styles.onlineDot, { borderColor: colors.bg }]}
                      />
                    )}
                  </View>

                  {/* Content */}
                  <View style={styles.userContent}>
                    <View style={styles.userTopRow}>
                      <Text
                        style={[
                          styles.userName,
                          {
                            color: colors.textPrimary,
                            fontWeight: hasUnread ? "600" : "500",
                          },
                        ]}
                        numberOfLines={1}
                      >
                        {user.username}
                      </Text>
                      <Text
                        style={[
                          styles.userTime,
                          {
                            color: hasUnread ? "#378ADD" : colors.textDisabled,
                            fontWeight: hasUnread ? "600" : "400",
                          },
                        ]}
                      >
                        {timeAgo(user.latest_message_timestamp)}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.userPreview,
                        {
                          color: hasUnread
                            ? colors.textSecondary
                            : colors.textDisabled,
                          fontWeight: hasUnread ? "500" : "400",
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {user.latest_message || "No messages yet"}
                    </Text>
                  </View>

                  {/* Unread badge */}
                  {hasUnread && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>
                        {user.unread_count > 99 ? "99+" : user.unread_count}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            }}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 0.5,
  },
  headerTitle: { fontSize: 15, fontWeight: "600", letterSpacing: -0.2 },
  unreadBadge: {
    backgroundColor: "rgba(55,138,221,0.12)",
    borderWidth: 1,
    borderColor: "rgba(55,138,221,0.3)",
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  unreadBadgeText: {
    fontSize: 10.5,
    fontWeight: "600",
    color: "#378ADD",
    letterSpacing: 0.2,
  },

  searchWrap: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 0.5,
  },
  searchInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  searchInput: { flex: 1, fontSize: 13 },

  sectionLabel: {
    fontSize: 10.5,
    fontWeight: "600",
    letterSpacing: 0.6,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 4,
  },

  userRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderBottomWidth: 0.5,
  },
  avatarWrap: { position: "relative", flexShrink: 0 },
  avatar: { width: 42, height: 42, borderRadius: 21 },
  avatarInitials: { alignItems: "center", justifyContent: "center" },
  initialsText: { fontSize: 13, fontWeight: "600" },
  onlineDot: {
    position: "absolute",
    bottom: 1,
    right: 1,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#22c55e",
    borderWidth: 2,
  },
  userContent: { flex: 1, minWidth: 0, gap: 2 },
  userTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  userName: { fontSize: 13.5, letterSpacing: -0.1, flex: 1 },
  userTime: { fontSize: 10.5, flexShrink: 0 },
  userPreview: { fontSize: 12, lineHeight: 17 },
  badge: {
    minWidth: 17,
    height: 17,
    borderRadius: 99,
    backgroundColor: "#378ADD",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "600" },

  skeletonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  skeletonAvatar: { width: 42, height: 42, borderRadius: 21, flexShrink: 0 },
  skeletonTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  skeletonLine: { height: 12, borderRadius: 6 },
  skeletonTime: { width: 26, height: 9, borderRadius: 4 },

  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    gap: 10,
  },
  emptyText: { fontSize: 13, textAlign: "center" },
});
