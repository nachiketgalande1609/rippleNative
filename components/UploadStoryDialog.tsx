import React, { useState, useEffect } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    Modal,
    StyleSheet,
    ScrollView,
    Image,
    ActivityIndicator,
    Alert,
    Pressable,
    KeyboardAvoidingView,
    Platform,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Video, ResizeMode } from "expo-av";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { uploadStory } from "../services/api";
import { useThemeColors } from "../hooks/useThemeColors";

const ACCENT = "#7c5cfc";
const SUCCESS = "#16a34a";
const CAPTION_LIMIT = 500;

interface UploadStoryDialogProps {
    open: boolean;
    onClose: () => void;
    fetchStories: () => Promise<void>;
}

interface MediaFile {
    uri: string;
    name: string;
    type: "image" | "video";
    mimeType: string;
}

const UploadStoryDialog: React.FC<UploadStoryDialogProps> = ({ open, onClose, fetchStories }) => {
    const colors = useThemeColors();

    const [currentUser, setCurrentUser] = useState<any>(null);
    const [media, setMedia] = useState<MediaFile | null>(null);
    const [caption, setCaption] = useState("");
    const [loading, setLoading] = useState(false);
    const [posted, setPosted] = useState(false);

    useEffect(() => {
        AsyncStorage.getItem("user").then((raw) => {
            if (raw) setCurrentUser(JSON.parse(raw));
        });
    }, []);

    useEffect(() => {
        if (!open) {
            const t = setTimeout(() => {
                setMedia(null);
                setCaption("");
                setPosted(false);
            }, 300);
            return () => clearTimeout(t);
        }
    }, [open]);

    const isVideo = media?.type === "video";
    const isReady = !!media;
    const progress = media ? (caption.trim() ? 100 : 60) : 0;

    const metaText = !media
        ? "Add a photo or video to share"
        : !caption.trim()
        ? "Optionally add a caption"
        : "Ready to share!";

    const metaColor = isReady
        ? caption.trim() ? SUCCESS : colors.textSecondary
        : colors.textDisabled;

    // ── Media picker ──────────────────────────────────────────────────────────
    const handlePickMedia = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
            Alert.alert("Permission required", "Allow access to your photo library to upload a story.");
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.All,
            quality: 0.9,
            allowsEditing: false,
        });
        if (!result.canceled && result.assets.length > 0) {
            const asset = result.assets[0];
            const isVid = asset.type === "video";
            const name = asset.uri.split("/").pop() || "media";
            setMedia({
                uri: asset.uri,
                name,
                type: isVid ? "video" : "image",
                mimeType: isVid ? "video/mp4" : "image/jpeg",
            });
        }
    };

    const handleClose = () => {
        setMedia(null);
        setCaption("");
        onClose();
    };

    const handleUpload = async () => {
        if (!media || !currentUser) return;
        setLoading(true);
        try {
            const formData = new FormData();
            formData.append("user_id", String(currentUser.id));
            formData.append("caption", caption);
            formData.append("media", {
                uri: media.uri,
                name: media.name,
                type: media.mimeType,
            } as any);

            const response = await uploadStory(formData);
            if (response?.success) {
                setPosted(true);
                setTimeout(() => { handleClose(); fetchStories(); }, 800);
            }
        } catch (error) {
            console.error("Failed to upload story:", error);
            Alert.alert("Error", "Failed to upload story. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const progressColor = posted ? SUCCESS : ACCENT;
    const progressWidth = `${posted ? 100 : progress}%`;

    return (
        <Modal visible={open} transparent animationType="slide" onRequestClose={handleClose}>
            <Pressable style={styles.backdrop} onPress={handleClose} />

            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={styles.sheetWrapper}
            >
                <View style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>

                    {/* ── Header ── */}
                    <View style={[styles.header, { borderBottomColor: colors.border }]}>
                        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>New story</Text>
                        <View style={styles.headerRight}>
                            {/* User chip */}
                            <View style={[styles.userChip, { backgroundColor: colors.hover, borderColor: colors.border }]}>
                                <View style={styles.userInitialCircle}>
                                    <Text style={styles.userInitialText}>
                                        {(currentUser?.username || "U").slice(0, 2).toUpperCase()}
                                    </Text>
                                </View>
                                <Text style={[styles.userChipText, { color: colors.textSecondary }]}>
                                    {currentUser?.username || "You"}
                                </Text>
                            </View>

                            <TouchableOpacity
                                onPress={handleClose}
                                style={[styles.closeBtn, { borderColor: colors.border }]}
                                activeOpacity={0.7}
                            >
                                <Ionicons name="close" size={14} color={colors.textDisabled} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* ── Progress bar ── */}
                    <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
                        <View style={[styles.progressFill, { width: progressWidth as any, backgroundColor: progressColor }]} />
                    </View>

                    {/* ── Scrollable body ── */}
                    <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">

                        {/* Media zone */}
                        <View style={[
                            styles.mediaZone,
                            { backgroundColor: colors.hover, borderColor: colors.border },
                            media ? { minHeight: 220 } : { minHeight: 160 },
                        ]}>
                            {media ? (
                                <>
                                    {isVideo ? (
                                        <Video
                                            source={{ uri: media.uri }}
                                            style={styles.mediaPreview}
                                            resizeMode={ResizeMode.COVER}
                                            useNativeControls
                                        />
                                    ) : (
                                        <Image
                                            source={{ uri: media.uri }}
                                            style={styles.mediaPreview}
                                            resizeMode="cover"
                                        />
                                    )}
                                    {/* Overlay actions */}
                                    <View style={styles.mediaOverlay}>
                                        <TouchableOpacity
                                            onPress={handlePickMedia}
                                            style={styles.mediaOverlayBtn}
                                            activeOpacity={0.85}
                                        >
                                            <MaterialIcons name="edit" size={12} color="#111" />
                                            <Text style={styles.mediaOverlayBtnText}>Change</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            onPress={() => setMedia(null)}
                                            style={styles.mediaOverlayBtn}
                                            activeOpacity={0.85}
                                        >
                                            <MaterialIcons name="delete-outline" size={12} color="#dc2626" />
                                            <Text style={[styles.mediaOverlayBtnText, { color: "#dc2626" }]}>Remove</Text>
                                        </TouchableOpacity>
                                    </View>
                                </>
                            ) : (
                                <TouchableOpacity
                                    onPress={handlePickMedia}
                                    activeOpacity={0.7}
                                    style={styles.emptyZone}
                                >
                                    <View style={[styles.uploadIconBox, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                                        <Ionicons name="cloud-upload-outline" size={20} color={colors.textDisabled} />
                                    </View>
                                    <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>Tap to add media</Text>
                                    <Text style={[styles.emptySubtitle, { color: colors.textDisabled }]}>Photos and videos supported</Text>
                                    <View style={styles.extRow}>
                                        {["JPG", "PNG", "GIF", "MP4", "MOV"].map((ext) => (
                                            <View key={ext} style={[styles.extBadge, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                                                <Text style={[styles.extBadgeText, { color: colors.textDisabled }]}>{ext}</Text>
                                            </View>
                                        ))}
                                    </View>
                                </TouchableOpacity>
                            )}
                        </View>

                        {/* File name strip */}
                        {media && (
                            <View style={styles.fileStrip}>
                                <View style={styles.fileStripLeft}>
                                    <Ionicons
                                        name={isVideo ? "videocam-outline" : "image-outline"}
                                        size={13}
                                        color={colors.textDisabled}
                                    />
                                    <Text style={[styles.fileName, { color: colors.textDisabled }]} numberOfLines={1}>
                                        {media.name}
                                    </Text>
                                </View>
                                <TouchableOpacity onPress={() => setMedia(null)}>
                                    <Text style={styles.removeText}>Remove</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        {/* Caption */}
                        <View style={styles.captionSection}>
                            <Text style={[styles.captionLabel, { color: colors.textDisabled }]}>CAPTION</Text>
                            <View style={[styles.captionInputWrapper, { backgroundColor: colors.hover, borderColor: colors.border }]}>
                                <TextInput
                                    style={[styles.captionInput, { color: colors.textPrimary }]}
                                    placeholder="Write a caption…"
                                    placeholderTextColor={colors.textDisabled}
                                    value={caption}
                                    onChangeText={(t) => setCaption(t.slice(0, CAPTION_LIMIT))}
                                    multiline
                                    numberOfLines={3}
                                    textAlignVertical="top"
                                />
                            </View>
                            <Text style={[styles.charCount, { color: colors.textDisabled }]}>
                                {caption.length} / {CAPTION_LIMIT}
                            </Text>
                        </View>
                    </ScrollView>

                    {/* ── Footer ── */}
                    <View style={[styles.footer, { borderTopColor: colors.border }]}>
                        <Text style={[styles.metaText, { color: metaColor }]} numberOfLines={1}>
                            {posted ? "Story shared!" : metaText}
                        </Text>
                        <View style={styles.footerBtns}>
                            <TouchableOpacity
                                onPress={handleClose}
                                style={[styles.cancelBtn, { borderColor: colors.border }]}
                                activeOpacity={0.7}
                            >
                                <Text style={[styles.cancelBtnText, { color: colors.textSecondary }]}>Cancel</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={handleUpload}
                                disabled={!isReady || loading || posted}
                                activeOpacity={0.85}
                                style={[
                                    styles.shareBtn,
                                    { backgroundColor: posted ? SUCCESS : ACCENT },
                                    (!isReady || loading || posted) && styles.shareBtnDisabled,
                                ]}
                            >
                                {loading
                                    ? <ActivityIndicator size={13} color="#fff" />
                                    : <Ionicons name="send" size={13} color="#fff" />
                                }
                                <Text style={styles.shareBtnText}>
                                    {posted ? "Shared!" : loading ? "Sharing…" : "Share story"}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
};

export default UploadStoryDialog;

// ── Styles ─────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.4)" },
    sheetWrapper: { flex: 1, justifyContent: "flex-end" },
    sheet: { borderTopLeftRadius: 16, borderTopRightRadius: 16, borderWidth: 1, borderBottomWidth: 0, maxHeight: "92%", overflow: "hidden" },

    // Header
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 11, borderBottomWidth: 1 },
    headerTitle: { fontWeight: "500", fontSize: 15 },
    headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
    userChip: { flexDirection: "row", alignItems: "center", gap: 7, borderRadius: 20, paddingVertical: 4, paddingRight: 10, paddingLeft: 4, borderWidth: 1 },
    userInitialCircle: { width: 22, height: 22, borderRadius: 11, backgroundColor: ACCENT, alignItems: "center", justifyContent: "center" },
    userInitialText: { color: "#fff", fontSize: 9, fontWeight: "600" },
    userChipText: { fontSize: 13 },
    closeBtn: { width: 30, height: 30, borderRadius: 9, borderWidth: 1, alignItems: "center", justifyContent: "center" },

    // Progress
    progressTrack: { height: 2 },
    progressFill: { height: 2 },

    // Media zone
    mediaZone: { margin: 16, borderRadius: 12, overflow: "hidden", borderWidth: 1, alignItems: "center", justifyContent: "center" },
    mediaPreview: { width: "100%", height: 220 },
    mediaOverlay: { position: "absolute", bottom: 10, right: 10, flexDirection: "row", gap: 8 },
    mediaOverlayBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(255,255,255,0.9)", paddingHorizontal: 12, paddingVertical: 5, borderRadius: 9 },
    mediaOverlayBtnText: { fontSize: 12.5, fontWeight: "500", color: "#111" },

    // Empty zone
    emptyZone: { alignItems: "center", paddingVertical: 28, paddingHorizontal: 24, width: "100%" },
    uploadIconBox: { width: 48, height: 48, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center", marginBottom: 10 },
    emptyTitle: { fontWeight: "500", fontSize: 14, marginBottom: 4 },
    emptySubtitle: { fontSize: 13, marginBottom: 12 },
    extRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, justifyContent: "center" },
    extBadge: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
    extBadgeText: { fontSize: 11, fontWeight: "500" },

    // File strip
    fileStrip: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 4, paddingBottom: 2 },
    fileStripLeft: { flexDirection: "row", alignItems: "center", gap: 5, flex: 1 },
    fileName: { fontSize: 12, fontStyle: "italic", flex: 1 },
    removeText: { fontSize: 12, color: "#dc2626" },

    // Caption
    captionSection: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 16 },
    captionLabel: { fontSize: 11, fontWeight: "500", letterSpacing: 0.8, marginBottom: 7 },
    captionInputWrapper: { borderRadius: 10, borderWidth: 1, padding: 10 },
    captionInput: { fontSize: 14, minHeight: 72, lineHeight: 20 },
    charCount: { fontSize: 11, textAlign: "right", marginTop: 5 },

    // Footer
    footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1, gap: 12 },
    metaText: { fontSize: 12.5, flex: 1 },
    footerBtns: { flexDirection: "row", gap: 8 },
    cancelBtn: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 8, alignItems: "center", justifyContent: "center" },
    cancelBtnText: { fontSize: 13.5, fontWeight: "500" },
    shareBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 },
    shareBtnDisabled: { backgroundColor: `${ACCENT}60` },
    shareBtnText: { color: "#fff", fontSize: 13.5, fontWeight: "500" },
});