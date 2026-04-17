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
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
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

const ATTACH_OPTIONS = [
    { key: "photo", label: "Photo", icon: "image-outline" as const },
    { key: "video", label: "Video", icon: "videocam-outline" as const },
    { key: "file",  label: "File",  icon: "document-outline" as const },
    { key: "gif",   label: "GIF",   icon: "happy-outline" as const },
];

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
    const [menuOpen, setMenuOpen] = useState(false);
    const menuAnim = useRef(new Animated.Value(0)).current;

    const canSend = !!(inputMessage.trim() || selectedFile);

    const toggleMenu = () => {
        const toValue = menuOpen ? 0 : 1;
        Animated.spring(menuAnim, {
            toValue,
            damping: 18,
            stiffness: 260,
            useNativeDriver: true,
        }).start();
        setMenuOpen((prev) => !prev);
    };

    const closeMenu = () => {
        Animated.timing(menuAnim, {
            toValue: 0,
            duration: 160,
            useNativeDriver: true,
        }).start(() => setMenuOpen(false));
    };

    const handleAttach = async (key: string) => {
        closeMenu();
        if (key === "photo") {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                quality: 0.9,
            });
            if (!result.canceled && result.assets[0]) {
                const asset = result.assets[0];
                setSelectedFile({ uri: asset.uri, name: asset.fileName || "photo.jpg", type: "image/jpeg", mimeType: "image/jpeg" });
                setSelectedFileURL(asset.uri);
            }
        } else if (key === "video") {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Videos,
                quality: 0.9,
            });
            if (!result.canceled && result.assets[0]) {
                const asset = result.assets[0];
                setSelectedFile({ uri: asset.uri, name: asset.fileName || "video.mp4", type: "video/mp4", mimeType: "video/mp4" });
                setSelectedFileURL(asset.uri);
            }
        } else if (key === "file") {
            const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
            if (!result.canceled && result.assets[0]) {
                const asset = result.assets[0];
                setSelectedFile({ uri: asset.uri, name: asset.name, type: asset.mimeType || "application/octet-stream", mimeType: asset.mimeType });
                setSelectedFileURL(asset.uri);
            }
        } else if (key === "gif") {
            // Hook up your GIF picker here
        }
    };

    // Animate the + icon rotation
    const rotate = menuAnim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "45deg"] });
    const menuOpacity = menuAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
    const menuTranslateY = menuAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] });

    const isImage = selectedFile?.type?.startsWith("image");
    const surfaceBg = colors.isDark ? "#1c1c1e" : "#fff";

    return (
        <View style={[styles.wrapper, { backgroundColor: colors.isDark ? "#0d0d0d" : "#f2f2f7" }]}>

            {/* ── Attachment menu (slides up above input) ── */}
            {menuOpen && (
                <Animated.View
                    style={[
                        styles.attachMenu,
                        {
                            opacity: menuOpacity,
                            transform: [{ translateY: menuTranslateY }],
                        },
                    ]}
                >
                    {ATTACH_OPTIONS.map((opt) => (
                        <TouchableOpacity
                            key={opt.key}
                            onPress={() => handleAttach(opt.key)}
                            activeOpacity={0.7}
                            style={styles.attachOption}
                        >
                            <View style={[styles.attachIcon, { backgroundColor: surfaceBg, borderColor: colors.border }]}>
                                <Ionicons name={opt.icon} size={22} color={colors.textSecondary} />
                            </View>
                            <Text style={[styles.attachLabel, { color: colors.textDisabled }]}>{opt.label}</Text>
                        </TouchableOpacity>
                    ))}
                </Animated.View>
            )}

            {/* ── Reply strip ── */}
            {selectedMessageForReply && (
                <View style={[styles.replyStrip, { backgroundColor: surfaceBg, borderColor: colors.border }]}>
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
            {selectedFile && (
                <View style={[styles.fileStrip, { backgroundColor: surfaceBg, borderColor: colors.border }]}>
                    {isImage ? (
                        <Image source={{ uri: selectedFileURL }} style={styles.fileThumb} resizeMode="cover" />
                    ) : (
                        <View style={[styles.fileThumb, styles.fileThumbIcon, { backgroundColor: colors.surface }]}>
                            <MaterialIcons name="insert-drive-file" size={24} color={colors.textDisabled} />
                        </View>
                    )}
                    <View style={styles.fileInfo}>
                        <Text style={[styles.fileName, { color: colors.textPrimary }]} numberOfLines={1}>
                            {selectedFile.name || "Media"}
                        </Text>
                        <Text style={[styles.fileType, { color: colors.textDisabled }]}>
                            {selectedFile.type?.includes("video") ? "Video" : isImage ? "Image" : "File"}
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
                {/* Input pill — contains the + button on the left */}
                <View style={[styles.inputContainer, { backgroundColor: surfaceBg }]}>

                    {/* + / × toggle */}
                    <TouchableOpacity
                        onPress={toggleMenu}
                        disabled={!!(selectedFile)}
                        activeOpacity={0.7}
                        style={[styles.plusBtn, { opacity: selectedFile ? 0.3 : 1 }]}
                    >
                        <Animated.View style={{ transform: [{ rotate }] }}>
                            <Ionicons name="add" size={20} color={colors.textSecondary} />
                        </Animated.View>
                    </TouchableOpacity>

                    <TextInput
                        ref={inputRef}
                        style={[styles.input, { color: colors.textPrimary }]}
                        placeholder="Message…"
                        placeholderTextColor={colors.textDisabled}
                        value={inputMessage}
                        onChangeText={(t) => { setInputMessage(t); handleTyping(); if (menuOpen) closeMenu(); }}
                        multiline={false}
                        returnKeyType="send"
                        onSubmitEditing={() => { if (canSend) handleSendMessage(); }}
                    />

                    {/* Send button — only when content exists */}
                    {canSend && (
                        <TouchableOpacity
                            onPress={handleSendMessage}
                            disabled={isSendingMessage}
                            activeOpacity={0.8}
                            style={styles.sendBtn}
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

    // Attach menu
    attachMenu: {
        flexDirection: "row",
        gap: 8,
        paddingHorizontal: 4,
        paddingBottom: 2,
    },
    attachOption: {
        alignItems: "center",
        gap: 5,
    },
    attachIcon: {
        width: 52,
        height: 52,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 0.5,
    },
    attachLabel: {
        fontSize: 11,
    },

    // Reply strip
    replyStrip: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 14,
        borderWidth: 0.5,
        gap: 10,
    },
    replyLeft:  { flexDirection: "row", alignItems: "center", gap: 10, flex: 1, minWidth: 0 },
    replyBar:   { width: 3, height: 34, borderRadius: 2, backgroundColor: ACCENT, flexShrink: 0 },
    replyInfo:  { flex: 1, minWidth: 0 },
    replyTo:    { fontSize: 12, fontWeight: "700", color: ACCENT, marginBottom: 2 },
    replyMsg:   { fontSize: 12.5, lineHeight: 17 },

    // File preview
    fileStrip: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        padding: 8,
        borderRadius: 14,
        borderWidth: 0.5,
    },
    fileThumb:      { width: 48, height: 48, borderRadius: 10, flexShrink: 0 },
    fileThumbIcon:  { alignItems: "center", justifyContent: "center" },
    fileInfo:       { flex: 1, minWidth: 0 },
    fileName:       { fontSize: 13, fontWeight: "500" },
    fileType:       { fontSize: 11.5, marginTop: 2 },
    fileRemove:     { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", flexShrink: 0 },

    // Main row
    row: {
        flexDirection: "row",
        alignItems: "center",
    },

    // Input pill
    inputContainer: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        borderRadius: 22,
        paddingLeft: 4,
        paddingRight: 5,
        paddingVertical: 5,
        minHeight: 44,
    },

    // + button inside pill
    plusBtn: {
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
    },

    input: {
        flex: 1,
        fontSize: 15,
        paddingVertical: 0,
        paddingHorizontal: 8,
        maxHeight: 100,
    },

    // Send button inside pill
    sendBtn: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: ACCENT,
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
    },
});