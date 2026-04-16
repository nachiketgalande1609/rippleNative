import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { getMutedUsers, toggleMuteUser } from "../../services/api";
import { useThemeColors } from "../../hooks/useThemeColors";
import { useGlobalStore } from "../../store/store";

const ACCENT = "#7c5cfc";

type User = {
  id: number;
  username: string;
  profile_picture: string;
  isOnline: boolean;
  latest_message: string;
  latest_message_timestamp: string;
  unread_count: number;
};

interface MessagesTopBarProps {
  selectedUser: User | null;
  openVideoCall: () => void;
  onMuteToggle: () => void;
  onBack: () => void;
}

const MessagesTopBar: React.FC<MessagesTopBarProps> = ({
  selectedUser,
  openVideoCall,
  onMuteToggle,
  onBack,
}) => {
  const colors = useThemeColors();
  const router = useRouter();

  const [optionsOpen, setOptionsOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [muteLoading, setMuteLoading] = useState(false);

  const { onlineUsers } = useGlobalStore();
  const isOnline = onlineUsers.map(String).includes(String(selectedUser?.id));

  useEffect(() => {
    if (!selectedUser) return;
    getMutedUsers()
      .then((ids) => setIsMuted(ids.includes(selectedUser.id)))
      .catch(console.error);
  }, [selectedUser?.id]);

  const handleToggleMute = async () => {
    if (!selectedUser || muteLoading) return;
    setMuteLoading(true);
    try {
      const result = await toggleMuteUser(selectedUser.id);
      setIsMuted(result.muted);
      onMuteToggle();
    } catch (e) {
      console.error(e);
    } finally {
      setMuteLoading(false);
      setOptionsOpen(false);
    }
  };

  return (
    <>
      <View
        style={[
          styles.bar,
          { backgroundColor: colors.surface, borderBottomColor: colors.border },
        ]}
      >
        {/* Back button */}
        <TouchableOpacity
          onPress={onBack}
          style={styles.backBtn}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={18} color={colors.textPrimary} />
        </TouchableOpacity>

        {/* Avatar + name + online indicator */}
        <TouchableOpacity
          onPress={() => router.push(`/profile/${selectedUser?.id}`)}
          style={styles.userInfo}
          activeOpacity={0.8}
        >
          <View style={styles.avatarWrap}>
            <Image
              source={
                selectedUser?.profile_picture
                  ? { uri: selectedUser.profile_picture }
                  : require("../../assets/profile_blank.png")
              }
              style={styles.avatar}
            />
            {/* Online dot */}
            {isOnline && (
              <View
                style={[styles.onlineDot, { borderColor: colors.surface }]}
              />
            )}
          </View>
          <View style={{ minWidth: 0, justifyContent: "center" }}>
            <Text
              style={[styles.username, { color: colors.textPrimary }]}
              numberOfLines={1}
            >
              {selectedUser?.username}
            </Text>
            <Text style={[styles.onlineText, { color: colors.textDisabled }]}>
              {isOnline ? "Online" : "Offline"}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Right actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            onPress={openVideoCall}
            style={[styles.actionBtn, { backgroundColor: colors.hover }]}
            activeOpacity={0.7}
          >
            <Ionicons name="videocam" size={18} color={colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setOptionsOpen(true)}
            style={[styles.actionBtn, { backgroundColor: colors.hover }]}
            activeOpacity={0.7}
          >
            <Ionicons
              name="ellipsis-horizontal"
              size={18}
              color={colors.textPrimary}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Options modal */}
      <Modal
        visible={optionsOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setOptionsOpen(false)}
      >
        <Pressable
          style={styles.backdrop}
          onPress={() => setOptionsOpen(false)}
        >
          <Pressable>
            <View
              style={[
                styles.optionsCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              {/* Mute / Unmute */}
              <TouchableOpacity
                onPress={handleToggleMute}
                activeOpacity={0.7}
                style={styles.optionRow}
              >
                <View
                  style={[
                    styles.optionIcon,
                    {
                      backgroundColor: isMuted
                        ? "rgba(124,92,252,0.12)"
                        : colors.hover,
                    },
                  ]}
                >
                  <Ionicons
                    name={isMuted ? "notifications" : "notifications-off"}
                    size={18}
                    color={isMuted ? ACCENT : colors.textSecondary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[styles.optionLabel, { color: colors.textPrimary }]}
                  >
                    {muteLoading
                      ? "Updating…"
                      : isMuted
                        ? "Unmute notifications"
                        : "Mute notifications"}
                  </Text>
                  <Text
                    style={[styles.optionSub, { color: colors.textDisabled }]}
                  >
                    {isMuted
                      ? "Turn notifications back on"
                      : `Silence messages from ${selectedUser?.username}`}
                  </Text>
                </View>
                {isMuted && (
                  <View style={styles.mutedBadge}>
                    <Text style={styles.mutedBadgeText}>Muted</Text>
                  </View>
                )}
              </TouchableOpacity>

              <View
                style={[styles.divider, { backgroundColor: colors.border }]}
              />

              {/* Cancel */}
              <TouchableOpacity
                onPress={() => setOptionsOpen(false)}
                activeOpacity={0.7}
                style={styles.optionRow}
              >
                <View
                  style={[styles.optionIcon, { backgroundColor: colors.hover }]}
                >
                  <Ionicons
                    name="close"
                    size={18}
                    color={colors.textDisabled}
                  />
                </View>
                <Text
                  style={[styles.optionLabel, { color: colors.textDisabled }]}
                >
                  Cancel
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
};

export default MessagesTopBar;

const styles = StyleSheet.create({
  bar: {
    paddingTop: 4,
    height: 56,
    flexDirection: "row",
    alignItems: "center", // ← this should center everything
    paddingHorizontal: 8,
    borderBottomWidth: 0.5,
    gap: 6,
    marginRight: 0,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    alignSelf: "center", // ← add this
  },
  userInfo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center", // ← center avatar with text vertically
    gap: 10,
    minWidth: 0,
  },
  avatarWrap: {
    position: "relative",
    flexShrink: 0,
    alignSelf: "center", // ← force center
  },
  avatar: { width: 38, height: 38, borderRadius: 19 },
  onlineDot: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: "#22c55e",
    borderWidth: 2,
  },
  username: { fontWeight: "600", fontSize: 14.5 },
  onlineText: { fontSize: 11.5, marginTop: 1 },

  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 0,
  },
  actionBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center", // ← add this
  },

  // Modal
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  optionsCard: {
    width: 310,
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  optionIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  optionLabel: { fontWeight: "500", fontSize: 14 },
  optionSub: { fontSize: 12, marginTop: 2 },
  mutedBadge: {
    backgroundColor: "rgba(124,92,252,0.12)",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  mutedBadgeText: { fontSize: 11, fontWeight: "600", color: ACCENT },
  divider: { height: 0.5, marginHorizontal: 16 },
});
