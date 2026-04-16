import React, { useRef, useState } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    Image,
    Animated,
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

export default function MessageInput({
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
}: Props) {
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
        <View style={[styles.wrapper, { backgroundColor: colors.isDark ? "#0d0d0d" : "#f2f2f7" }]}>

            {/* ── Reply strip ── */}
            {selectedMessageForReply && (
                <View style={[styles.replyStrip, { backgroundColor: colors.isDark ? "#1c1c1e" : "#fff", borderColor: colors.border }]}>
                    <View style={styles.replyLeft}>
                        <View style={styles.replyBar} />
                        <View style={styles.replyInfo}>
                            <Text style={styles.replyTo}>
                                {selectedMessageForReply.sender_id === currentUserId ? "You" : selectedUser?.username}
                            </Text>
                            <Text style={[styles.replyMsg, { color: colors.textDisabled }]} numberOfLines={1}>
                                {selectedMessageForReply.message_text?.slice(0, 60)}
                                {(selectedMessageForReply.message_text?.length ?? 0) > 60 ? "…" : ""}
                            </Text>
                        </View>
                    </View>
                    <TouchableOpacity onPress={cancelReply} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <Ionicons name="close-circle" size={20} color={colors.textDisabled} />
                    </TouchableOpacity>
                </View>
            )}

            {/* ── File preview ── */}
            {selectedFile && selectedFileURL && (
                <View style={[styles.fileStrip, { backgroundColor: colors.isDark ? "#1c1c1e" : "#fff", borderColor: colors.border }]}>
                    <Image source={{ uri: selectedFileURL }} style={styles.fileThumb} resizeMode="cover" />
                    <View style={styles.fileInfo}>
                        <Text style={[styles.fileName, { color: colors.textPrimary }]} numberOfLines={1}>
                            {selectedFile.name || "Media"}
                        </Text>
                        <Text style={[styles.fileType, { color: colors.textDisabled }]}>
                            {selectedFile.type?.includes("video") ? "Video" : "Image"}
                        </Text>
                    </View>
                    <TouchableOpacity
                        onPress={() => { setSelectedFile(null); setSelectedFileURL(""); }}
                        style={[styles.fileRemove, { backgroundColor: colors.hover }]}
                    >
                        <Ionicons name="close" size={14} color={colors.textSecondary} />
                    </TouchableOpacity>
                </View>
            )}

            {/* ── Main input row ── */}
            <View style={styles.row}>
                {/* Media button */}
                <TouchableOpacity
                    onPress={pickMedia}
                    disabled={!!(selectedFile || selectedFileURL)}
                    activeOpacity={0.7}
                    style={[
                        styles.mediaBtn,
                        {
                            backgroundColor: colors.isDark ? "#2c2c2e" : "#fff",
                            opacity: selectedFile ? 0.4 : 1,
                        },
                    ]}
                >
                    <Ionicons name="image-outline" size={20} color={ACCENT} />
                </TouchableOpacity>

                {/* Input container */}
                <View style={[
                    styles.inputContainer,
                    { backgroundColor: colors.isDark ? "#1c1c1e" : "#fff" },
                ]}>
                    <TextInput
                        ref={inputRef}
                        style={[styles.input, { color: colors.textPrimary }]}
                        placeholder="Message..."
                        placeholderTextColor={colors.textDisabled}
                        value={inputMessage}
                        onChangeText={(t) => { setInputMessage(t); handleTyping(); }}
                        multiline={false}
                        returnKeyType="send"
                        onSubmitEditing={() => { if (canSend) handleSendMessage(); }}
                    />

                    {/* Send inside pill — only shows when there's content */}
                    {canSend && (
                        <TouchableOpacity
                            onPress={handleSendMessage}
                            disabled={isSendingMessage}
                            activeOpacity={0.8}
                            style={styles.sendInner}
                        >
                            {isSendingMessage
                                ? <ActivityIndicator size={13} color="#fff" />
                                : <Ionicons name="arrow-up" size={16} color="#fff" />
                            }
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        paddingHorizontal: 12,
        paddingTop: 8,
        paddingBottom: 10,
        gap: 8,
    },

    // Reply strip
    replyStrip: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 14,
        borderWidth: 1,
        gap: 10,
    },
    replyLeft:  { flexDirection: "row", alignItems: "center", gap: 10, flex: 1, minWidth: 0 },
    replyBar:   { width: 3, height: 34, borderRadius: 2, backgroundColor: ACCENT, flexShrink: 0 },
    replyInfo:  { flex: 1, minWidth: 0 },
    replyTo:    { fontSize: 12, fontWeight: "700", color: ACCENT, marginBottom: 2 },
    replyMsg:   { fontSize: 12.5, lineHeight: 17 },

    // File strip
    fileStrip: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        padding: 8,
        borderRadius: 14,
        borderWidth: 1,
    },
    fileThumb:  { width: 48, height: 48, borderRadius: 10 },
    fileInfo:   { flex: 1, minWidth: 0 },
    fileName:   { fontSize: 13, fontWeight: "500" },
    fileType:   { fontSize: 11.5, marginTop: 2 },
    fileRemove: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", flexShrink: 0 },

    // Main row
    row: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },

    // Media button — small floating circle
    mediaBtn: {
        width: 38,
        height: 38,
        borderRadius: 19,
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        shadowColor: "#000",
        shadowOpacity: 0.06,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
        elevation: 2,
    },

    // Input pill
    inputContainer: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        borderRadius: 22,
        paddingLeft: 16,
        paddingRight: 5,
        paddingVertical: 5,
        minHeight: 44,
        shadowColor: "#000",
        shadowOpacity: 0.06,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
        elevation: 2,
    },
    input: {
        flex: 1,
        fontSize: 15,
        paddingVertical: 0,
        maxHeight: 100,
    },

    // Send button inside the pill
    sendInner: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: ACCENT,
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        shadowColor: ACCENT,
        shadowOpacity: 0.4,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
        elevation: 4,
    },
});