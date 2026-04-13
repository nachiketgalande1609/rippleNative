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
import { useRouter } from "expo-router";
import { createPost } from "../services/api";
import { useGlobalStore } from "../store/store";
import { useThemeColors } from "../hooks/useThemeColors";

const ACCENT = "#7c5cfc";
const SUCCESS = "#16a34a";
const CAPTION_LIMIT = 2200;

interface CreatePostModalProps {
    open: boolean;
    handleClose: () => void;
}

interface PickedMedia {
    uri: string;
    name: string;
    type: "image" | "video";
    mimeType: string;
}

const CreatePostModal: React.FC<CreatePostModalProps> = ({ open, handleClose }) => {
    const colors = useThemeColors();
    const router = useRouter();
    const { user, setPostUploading } = useGlobalStore();

    const [currentUser, setCurrentUser] = useState<any>(null);
    const [postContent, setPostContent] = useState("");
    const [media, setMedia] = useState<PickedMedia | null>(null);
    const [location, setLocation] = useState("");
    const [loading, setLoading] = useState(false);
    const [posted, setPosted] = useState(false);

    const hasCaption = postContent.trim().length > 0;
    const hasFile = media !== null;
    const isReady = hasCaption && hasFile;
    const progress = (hasFile ? 50 : 0) + (hasCaption ? 50 : 0);
    const progressWidth = `${posted ? 100 : progress}%`;
    const progressColor = posted ? SUCCESS : ACCENT;

    const metaText = !hasFile && !hasCaption
        ? "Add a photo and caption to share"
        : !hasFile
        ? "Add a photo to continue"
        : !hasCaption
        ? "Write a caption to continue"
        : "Ready to share!";

    // Hashtag detection
    const hashtags = [...new Set(postContent.match(/#([a-zA-Z0-9_]+)/g) || [])];

    // Load user
    useEffect(() => {
        AsyncStorage.getItem("user").then((raw) => {
            if (raw) setCurrentUser(JSON.parse(raw));
        });
    }, []);

    // Reset on close
    useEffect(() => {
        if (!open) {
            const t = setTimeout(() => {
                setMedia(null);
                setPostContent("");
                setLocation("");
                setPosted(false);
            }, 300);
            return () => clearTimeout(t);
        }
    }, [open]);

    const handleModalClose = () => {
        setMedia(null);
        setPostContent("");
        setLocation("");
        handleClose();
    };

    // ── Media picker ──────────────────────────────────────────────────────────
    const pickMedia = async () => {
        Alert.alert("Add media", "Choose a source", [
            {
                text: "Photo Library",
                onPress: async () => {
                    const result = await ImagePicker.launchImageLibraryAsync({
                        mediaTypes: ImagePicker.MediaTypeOptions.All,
                        quality: 0.9,
                    });
                    if (!result.canceled && result.assets[0]) {
                        const asset = result.assets[0];
                        const isVid = asset.type === "video";
                        setMedia({
                            uri: asset.uri,
                            name: asset.fileName || (isVid ? "video.mp4" : "image.jpg"),
                            type: isVid ? "video" : "image",
                            mimeType: isVid ? "video/mp4" : "image/jpeg",
                        });
                    }
                },
            },
            {
                text: "Camera",
                onPress: async () => {
                    const perm = await ImagePicker.requestCameraPermissionsAsync();
                    if (!perm.granted) {
                        Alert.alert("Permission required", "Camera access is needed.");
                        return;
                    }
                    const result = await ImagePicker.launchCameraAsync({ quality: 0.9 });
                    if (!result.canceled && result.assets[0]) {
                        const asset = result.assets[0];
                        setMedia({
                            uri: asset.uri,
                            name: asset.fileName || "photo.jpg",
                            type: "image",
                            mimeType: "image/jpeg",
                        });
                    }
                },
            },
            { text: "Cancel", style: "cancel" },
        ]);
    };

    // ── Submit ────────────────────────────────────────────────────────────────
    const handleSubmit = async () => {
        if (!isReady || !user) return;
        try {
            setLoading(true);
            setPostUploading(true);
            router.push(`/profile/${currentUser?.id}`);

            const formData = new FormData();
            formData.append("user_id", user.id);
            formData.append("content", postContent);
            formData.append("location", location);
            if (media) {
                formData.append("media", {
                    uri: media.uri,
                    name: media.name,
                    type: media.mimeType,
                } as any);
            }

            const res = await createPost(formData);
            if (res?.success) {
                setPosted(true);
                setTimeout(() => handleModalClose(), 800);
            }
        } catch {
            Alert.alert("Error", "Failed to upload post. Please try again.");
        } finally {
            setLoading(false);
            setPostUploading(false);
        }
    };

    return (
        <Modal
            visible={open}
            transparent
            animationType="slide"
            onRequestClose={handleModalClose}
        >
            <Pressable style={styles.backdrop} onPress={handleModalClose} />

            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={styles.kavWrapper}
                pointerEvents="box-none"
            >
                <View style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>

                    {/* ── Header ── */}
                    <View style={[styles.header, { borderBottomColor: colors.border }]}>
                        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>New post</Text>
                        <View style={styles.headerRight}>
                            {/* User chip */}
                            <View style={[styles.userChip, { backgroundColor: colors.hover, borderColor: colors.border }]}>
                                <View style={styles.userChipAvatar}>
                                    <Text style={styles.userChipInitials}>
                                        {(currentUser?.username || "U").slice(0, 2).toUpperCase()}
                                    </Text>
                                </View>
                                <Text style={[styles.userChipName, { color: colors.textSecondary }]}>
                                    {currentUser?.username || "You"}
                                </Text>
                            </View>
                            <TouchableOpacity
                                onPress={handleModalClose}
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
                        <TouchableOpacity
                            onPress={media ? undefined : pickMedia}
                            activeOpacity={media ? 1 : 0.8}
                            style={[styles.dropZone, { backgroundColor: colors.hover, borderColor: colors.border }]}
                        >
                            {media ? (
                                <>
                                    {media.type === "video" ? (
                                        <Video
                                            source={{ uri: media.uri }}
                                            style={styles.previewMedia}
                                            resizeMode={ResizeMode.COVER}
                                            shouldPlay
                                            isMuted
                                            isLooping
                                        />
                                    ) : (
                                        <Image
                                            source={{ uri: media.uri }}
                                            style={styles.previewMedia}
                                            resizeMode="cover"
                                        />
                                    )}
                                    {/* Overlay actions */}
                                    <View style={styles.previewOverlay}>
                                        <TouchableOpacity onPress={pickMedia} style={styles.previewBtn} activeOpacity={0.8}>
                                            <MaterialIcons name="edit" size={12} color="#111" />
                                            <Text style={styles.previewBtnText}>Change</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            onPress={() => setMedia(null)}
                                            style={[styles.previewBtn, { backgroundColor: "rgba(255,255,255,0.92)" }]}
                                            activeOpacity={0.8}
                                        >
                                            <MaterialIcons name="delete-outline" size={12} color="#dc2626" />
                                            <Text style={[styles.previewBtnText, { color: "#dc2626" }]}>Remove</Text>
                                        </TouchableOpacity>
                                    </View>
                                </>
                            ) : (
                                <View style={styles.emptyZone}>
                                    <View style={[styles.uploadIconBox, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                                        <Ionicons name="image-outline" size={20} color={colors.textDisabled} />
                                    </View>
                                    <Text style={[styles.dropTitle, { color: colors.textPrimary }]}>Tap to add photo or video</Text>
                                    <Text style={[styles.dropSub, { color: colors.textDisabled }]}>From library or camera</Text>
                                    <View style={styles.extRow}>
                                        {["JPG", "PNG", "GIF", "MP4", "MOV"].map((ext) => (
                                            <View key={ext} style={[styles.extBadge, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                                                <Text style={[styles.extBadgeText, { color: colors.textDisabled }]}>{ext}</Text>
                                            </View>
                                        ))}
                                    </View>
                                </View>
                            )}
                        </TouchableOpacity>

                        {/* File name strip */}
                        <View style={[styles.fileStrip, { borderTopColor: colors.border }]}>
                            <Text style={[styles.fileName, { color: colors.textDisabled }]} numberOfLines={1}>
                                {media ? media.name : "No file selected"}
                            </Text>
                            {media && (
                                <TouchableOpacity onPress={() => setMedia(null)}>
                                    <Text style={[styles.removeText, { color: colors.error }]}>Remove</Text>
                                </TouchableOpacity>
                            )}
                        </View>

                        {/* Caption */}
                        <View style={[styles.section, { borderBottomColor: colors.border }]}>
                            <Text style={[styles.label, { color: colors.textDisabled }]}>CAPTION</Text>
                            <View style={[styles.captionBox, { backgroundColor: colors.hover, borderColor: colors.border }]}>
                                <TextInput
                                    style={[styles.captionInput, { color: colors.textPrimary }]}
                                    placeholder="Write a caption… use #hashtags"
                                    placeholderTextColor={colors.textDisabled}
                                    value={postContent}
                                    onChangeText={(t) => setPostContent(t.slice(0, CAPTION_LIMIT))}
                                    multiline
                                    numberOfLines={5}
                                    textAlignVertical="top"
                                />
                            </View>

                            {/* Hashtag chips */}
                            {hashtags.length > 0 && (
                                <View style={styles.hashtagRow}>
                                    {hashtags.map((tag) => (
                                        <View key={tag} style={styles.hashtagChip}>
                                            <Text style={styles.hashtagText}>{tag}</Text>
                                        </View>
                                    ))}
                                </View>
                            )}

                            <Text style={[styles.charCount, { color: colors.textDisabled }]}>
                                {postContent.length} / {CAPTION_LIMIT}
                            </Text>
                        </View>

                        {/* Location */}
                        <View style={[styles.section, { paddingBottom: 20 }]}>
                            <Text style={[styles.label, { color: colors.textDisabled }]}>LOCATION</Text>
                            <View style={[styles.locationBox, { backgroundColor: colors.hover, borderColor: colors.border }]}>
                                <Ionicons name="location-sharp" size={15} color={colors.textDisabled} />
                                <TextInput
                                    style={[styles.locationInput, { color: colors.textPrimary }]}
                                    placeholder="Add a location…"
                                    placeholderTextColor={colors.textDisabled}
                                    value={location}
                                    onChangeText={setLocation}
                                />
                            </View>
                        </View>
                    </ScrollView>

                    {/* ── Footer ── */}
                    <View style={[styles.footer, { borderTopColor: colors.border }]}>
                        <Text style={[styles.metaText, { color: isReady ? SUCCESS : colors.textDisabled }]}>
                            {posted ? "Post shared!" : metaText}
                        </Text>

                        <TouchableOpacity
                            onPress={handleSubmit}
                            disabled={!isReady || loading || posted}
                            activeOpacity={0.8}
                            style={[
                                styles.shareBtn,
                                { backgroundColor: posted ? SUCCESS : ACCENT },
                                (!isReady || loading || posted) && styles.shareBtnDisabled,
                            ]}
                        >
                            {loading ? (
                                <ActivityIndicator size={13} color="#fff" />
                            ) : (
                                <Ionicons name="send" size={13} color="#fff" />
                            )}
                            <Text style={styles.shareBtnText}>
                                {posted ? "Shared!" : loading ? "Sharing…" : "Share"}
                            </Text>
                        </TouchableOpacity>
                    </View>

                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
};

export default CreatePostModal;

// ── Styles ─────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.4)" },
    kavWrapper: { flex: 1, justifyContent: "flex-end" },

    sheet: {
        maxHeight: "94%",
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        borderWidth: 1,
        overflow: "hidden",
        flexShrink: 1,
    },

    // Header
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 11, borderBottomWidth: 1 },
    headerTitle: { fontWeight: "500", fontSize: 15 },
    headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
    userChip: { flexDirection: "row", alignItems: "center", gap: 7, borderRadius: 20, paddingVertical: 4, paddingRight: 10, paddingLeft: 4, borderWidth: 1 },
    userChipAvatar: { width: 22, height: 22, borderRadius: 11, backgroundColor: ACCENT, alignItems: "center", justifyContent: "center" },
    userChipInitials: { fontSize: 9, fontWeight: "600", color: "#fff" },
    userChipName: { fontSize: 12.5 },
    closeBtn: { width: 30, height: 30, borderRadius: 9, borderWidth: 1, alignItems: "center", justifyContent: "center" },

    // Progress
    progressTrack: { height: 2, width: "100%" },
    progressFill: { height: 2 },

    // Drop zone
    dropZone: { marginHorizontal: 16, marginTop: 16, borderRadius: 12, minHeight: 220, overflow: "hidden", alignItems: "center", justifyContent: "center", borderWidth: 1 },
    previewMedia: { width: "100%", height: 260 },
    previewOverlay: { position: "absolute", bottom: 10, left: 0, right: 0, flexDirection: "row", justifyContent: "center", gap: 8 },
    previewBtn: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(255,255,255,0.9)", paddingHorizontal: 14, paddingVertical: 6, borderRadius: 9 },
    previewBtnText: { fontSize: 12.5, fontWeight: "500", color: "#111" },

    // Empty
    emptyZone: { alignItems: "center", padding: 24 },
    uploadIconBox: { width: 48, height: 48, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center", marginBottom: 10 },
    dropTitle: { fontWeight: "500", fontSize: 14, marginBottom: 4 },
    dropSub: { fontSize: 12.5, marginBottom: 10 },
    extRow: { flexDirection: "row", gap: 5, flexWrap: "wrap", justifyContent: "center" },
    extBadge: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
    extBadgeText: { fontSize: 10.5, fontWeight: "500" },

    // File strip
    fileStrip: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 8, borderTopWidth: 1, marginTop: 0 },
    fileName: { fontSize: 12, fontStyle: "italic", flex: 1 },
    removeText: { fontSize: 12 },

    // Section
    section: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 14, borderBottomWidth: 1 },
    label: { fontSize: 11, fontWeight: "500", letterSpacing: 0.9, marginBottom: 7 },

    // Caption
    captionBox: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 10 },
    captionInput: { fontSize: 14, minHeight: 100, maxHeight: 160 },
    charCount: { fontSize: 10.5, textAlign: "right", marginTop: 5 },

    // Hashtags
    hashtagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
    hashtagChip: { backgroundColor: ACCENT + "12", borderWidth: 1, borderColor: ACCENT + "30", borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
    hashtagText: { color: ACCENT, fontSize: 11.5, fontWeight: "500" },

    // Location
    locationBox: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10 },
    locationInput: { flex: 1, fontSize: 14 },

    // Footer
    footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1, gap: 12 },
    metaText: { fontSize: 12.5, flex: 1 },
    shareBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 9 },
    shareBtnDisabled: { opacity: 0.5 },
    shareBtnText: { color: "#fff", fontSize: 13.5, fontWeight: "500" },
});