import React, { useRef, useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useThemeColors } from "../../hooks/useThemeColors";

const ACCENT = "#7c5cfc";

type Message = {
  message_id: number;
  sender_id: number;
  message_text: string;
  timestamp: string;
  file_url: string;
  reply_to: number | null;
  reactions: any[];
  [key: string]: any;
};

type User = {
  id: number;
  username: string;
  profile_picture: string;
  [key: string]: any;
};

type Props = {
  selectedFile: any | null;
  setSelectedFile: (f: any) => void;
  selectedFileURL: string;
  setSelectedFileURL: (u: string) => void;
  inputMessage: string;
  setInputMessage: (m: string) => void;
  handleTyping: () => void;
  handleSendMessage: () => Promise<void>;
  isSendingMessage: boolean;
  selectedMessageForReply: Message | null;
  cancelReply: () => void;
  selectedUser: User | null;
  currentUserId?: number;
};

const MessageInput: React.FC<Props> = ({
  selectedFile,
  setSelectedFile,
  selectedFileURL,
  setSelectedFileURL,
  inputMessage,
  setInputMessage,
  handleTyping,
  handleSendMessage,
  isSendingMessage,
  selectedMessageForReply,
  cancelReply,
  selectedUser,
  currentUserId,
}) => {
  const colors = useThemeColors();
  const inputRef = useRef<TextInput>(null);
  const canSend = !!(inputMessage.trim() || selectedFile);

  const pickMedia = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.9,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setSelectedFile({
        uri: asset.uri,
        name: asset.fileName || "media",
        type: asset.type === "video" ? "video/mp4" : "image/jpeg",
        mimeType: asset.type === "video" ? "video/mp4" : "image/jpeg",
      });
      setSelectedFileURL(asset.uri);
    }
  };

  return (
    <View
      style={[
        styles.root,
        { backgroundColor: colors.surface, borderTopColor: colors.border },
      ]}
    >
      {/* Reply preview */}
      {selectedMessageForReply && (
        <View
          style={[
            styles.replyPreview,
            {
              backgroundColor: colors.isDark
                ? "rgba(124,92,252,0.1)"
                : "rgba(124,92,252,0.07)",
            },
          ]}
        >
          <View style={styles.replyContent}>
            <Text style={styles.replyLabel}>
              {selectedMessageForReply.sender_id === currentUserId
                ? "You"
                : selectedUser?.username}
            </Text>
            <Text
              style={[styles.replyText, { color: colors.textSecondary }]}
              numberOfLines={1}
            >
              {selectedMessageForReply.message_text?.length > 65
                ? selectedMessageForReply.message_text.slice(0, 65) + "…"
                : selectedMessageForReply.message_text}
            </Text>
          </View>
          <TouchableOpacity
            onPress={cancelReply}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close" size={16} color={colors.textDisabled} />
          </TouchableOpacity>
        </View>
      )}

      {/* File preview */}
      {selectedFile && selectedFileURL && (
        <View
          style={[
            styles.filePreview,
            { backgroundColor: colors.hover, borderColor: colors.border },
          ]}
        >
          <Image
            source={{ uri: selectedFileURL }}
            style={styles.filePreviewImage}
            resizeMode="cover"
          />
          <TouchableOpacity
            onPress={() => {
              setSelectedFile(null);
              setSelectedFileURL("");
            }}
            style={[
              styles.fileRemoveBtn,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Ionicons name="close" size={12} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      )}

      {/* Input row */}
      <View style={styles.inputRow}>
        {/* Attach */}
        <TouchableOpacity
          onPress={pickMedia}
          disabled={!!(selectedFile || selectedFileURL)}
          style={[styles.iconBtn, { opacity: selectedFile ? 0.4 : 1 }]}
          activeOpacity={0.7}
        >
          <Ionicons name="attach" size={20} color={colors.textDisabled} />
        </TouchableOpacity>

        {/* Plain single-line input */}
        <View
          style={[
            styles.inputPill,
            {
              backgroundColor: colors.isDark ? "#000" : colors.hover,
              borderColor: colors.border,
            },
          ]}
        >
          <TextInput
            ref={inputRef}
            style={[styles.input, { color: colors.textPrimary }]}
            placeholder="Message…"
            placeholderTextColor={colors.textDisabled}
            value={inputMessage}
            onChangeText={(t) => {
              setInputMessage(t);
              handleTyping();
            }}
            multiline={false}
            returnKeyType="send"
            onSubmitEditing={() => {
              if (canSend) handleSendMessage();
            }}
          />
        </View>

        {/* Send text button */}
        <TouchableOpacity
          onPress={() => canSend && handleSendMessage()}
          disabled={isSendingMessage || !canSend}
          activeOpacity={0.7}
        >
          {isSendingMessage ? (
            <ActivityIndicator size={14} color={ACCENT} />
          ) : (
            <TouchableOpacity
              onPress={() => canSend && handleSendMessage()}
              disabled={isSendingMessage || !canSend}
              activeOpacity={0.7}
              style={[
                styles.sendBtn,
                { backgroundColor: canSend ? ACCENT : colors.hover },
              ]}
            >
              {isSendingMessage ? (
                <ActivityIndicator size={14} color="#fff" />
              ) : (
                <Ionicons
                  name="send"
                  size={15}
                  color={canSend ? "#fff" : colors.textDisabled}
                />
              )}
            </TouchableOpacity>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default MessageInput;

const styles = StyleSheet.create({
  root: { flexShrink: 0, marginBottom: -3 },
  replyPreview: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 12,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderLeftWidth: 3,
    borderLeftColor: ACCENT,
    borderRadius: 8,
    gap: 8,
  },
  replyContent: { flex: 1, overflow: "hidden" },
  replyLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: ACCENT,
    marginBottom: 2,
  },
  replyText: { fontSize: 12.5 },

  filePreview: {
    marginHorizontal: 12,
    marginTop: 10,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    alignSelf: "flex-start",
    position: "relative",
  },
  filePreviewImage: { width: 120, height: 90, borderRadius: 8 },
  fileRemoveBtn: {
    position: "absolute",
    top: -8,
    right: -8,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  iconBtn: {
    width: 26,
    height: 26,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  inputPill: {
    flex: 1,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  input: {
    flex: 1,
    fontSize: 14,
    height: 40,
    paddingVertical: 0,
  },
  sendText: {
    fontSize: 14,
    flexShrink: 0,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
});
