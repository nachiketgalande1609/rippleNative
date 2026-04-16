import React, { useState, useEffect, useRef, useCallback } from "react";
import { PanResponder } from "react-native";

import { View, Text, Image, TouchableOpacity, Modal, StyleSheet, Dimensions, Pressable, ScrollView, ActivityIndicator, Animated } from "react-native";
import { Video, ResizeMode } from "expo-av";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { timeAgo } from "../utils/utils";
import socket from "../services/socket";
import BottomSheet, { BottomSheetScrollView } from "@gorhom/bottom-sheet";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const STORY_DURATION = 6000;

// ── Types ──────────────────────────────────────────────────────────────────────
interface Viewer {
    viewer_username: string;
    viewer_profile_picture: string;
    viewer_id: number;
}

interface Story {
    story_id: number;
    media_url: string;
    media_type: "image" | "video";
    created_at: string;
    viewers: Viewer[];
    caption?: string;
}

interface UserStories {
    user_id: number;
    username: string;
    profile_picture: string;
    stories: Story[];
}

interface StoryDialogProps {
    open: boolean;
    onClose: () => void;
    stories: UserStories[];
    selectedStoryIndex: number;
}

// ── Progress Segment ───────────────────────────────────────────────────────────
const ProgressSegment = ({ filled, active, progress }: { filled: boolean; active: boolean; progress: number }) => (
    <View style={styles.segmentTrack}>
        <View style={[styles.segmentFill, { width: filled ? "100%" : active ? `${progress}%` : "0%" }]} />
    </View>
);

// ── Viewer Row ─────────────────────────────────────────────────────────────────
const ViewerRow = ({ viewer, createdAt, onPress }: { viewer: Viewer; createdAt: string; onPress: () => void }) => (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={styles.viewerRow}>
        <Image
            source={viewer.viewer_profile_picture ? { uri: viewer.viewer_profile_picture } : require("../assets/profile_blank.png")}
            style={styles.viewerAvatar}
        />
        <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.viewerUsername} numberOfLines={1}>
                {viewer.viewer_username}
            </Text>
            <Text style={styles.viewerTime}>{timeAgo(createdAt)}</Text>
        </View>
    </TouchableOpacity>
);

// ── Main Component ─────────────────────────────────────────────────────────────
const StoryDialog: React.FC<StoryDialogProps> = ({ open, onClose, stories, selectedStoryIndex }) => {
    const router = useRouter();

    const [currentUser, setCurrentUser] = useState<any>(null);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [progress, setProgress] = useState(0);
    const [selectedUserStories, setSelectedUserStories] = useState<Story[]>([]);
    const [isMediaLoaded, setIsMediaLoaded] = useState(false);
    const [paused, setPaused] = useState(false);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [showControls, setShowControls] = useState(true);
    const [isMuted, setIsMuted] = useState(true);

    const progressAnim = useRef(new Animated.Value(0)).current;
    const animationRef = useRef<Animated.CompositeAnimation | null>(null);
    const controlsTimeout = useRef<ReturnType<typeof setTimeout>>();
    const longPressTimeout = useRef<ReturnType<typeof setTimeout>>();
    const isLongPress = useRef(false);
    const videoRef = useRef<Video>(null);
    const bottomSheetRef = useRef<BottomSheet>(null);

    const panResponder = useRef(
        PanResponder.create({
            onMoveShouldSetPanResponder: (_, gestureState) => {
                return gestureState.dy > 10 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
            },
            onPanResponderRelease: (_, gestureState) => {
                if (gestureState.dy > 80) {
                    handleClose();
                }
            },
        }),
    ).current;

    // Load current user
    useEffect(() => {
        AsyncStorage.getItem("user").then((raw) => {
            if (raw) setCurrentUser(JSON.parse(raw));
        });
    }, []);

    // Open/close bottom sheet
    useEffect(() => {
        if (drawerOpen) bottomSheetRef.current?.expand();
        else bottomSheetRef.current?.close();
    }, [drawerOpen]);

    const cancelAnimation = useCallback(() => {
        animationRef.current?.stop();
        animationRef.current = null;
    }, []);

    const handleClose = useCallback(() => {
        cancelAnimation();
        setProgress(0);
        setDrawerOpen(false);
        setPaused(false);
        onClose();
    }, [onClose, cancelAnimation]);

    const handleNext = useCallback(() => {
        cancelAnimation();
        if (currentIndex < selectedUserStories.length - 1) {
            setProgress(0);
            progressAnim.setValue(0);
            setIsMediaLoaded(false);
            setPaused(false);
            setCurrentIndex((p) => p + 1);
        } else {
            handleClose();
        }
    }, [currentIndex, selectedUserStories.length, handleClose, cancelAnimation, progressAnim]);

    const handlePrev = useCallback(() => {
        cancelAnimation();
        if (currentIndex > 0) {
            setProgress(0);
            progressAnim.setValue(0);
            setIsMediaLoaded(false);
            setPaused(false);
            setCurrentIndex((p) => p - 1);
        }
    }, [currentIndex, cancelAnimation, progressAnim]);

    const handleDrawerToggle = useCallback(() => {
        setDrawerOpen((prev) => {
            setPaused(!prev);
            return !prev;
        });
    }, []);

    const resetControlsTimer = useCallback(() => {
        if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
        setShowControls(true);
        if (!paused) {
            controlsTimeout.current = setTimeout(() => setShowControls(false), 2500);
        }
    }, [paused]);

    const handlePauseToggle = useCallback(() => {
        setPaused((p) => !p);
        resetControlsTimer(); // ← add this
    }, [resetControlsTimer]);

    // Story group change
    useEffect(() => {
        if (open && stories.length && selectedStoryIndex < stories.length) {
            const group = stories[selectedStoryIndex];
            setSelectedUserStories(group.stories);
            setCurrentIndex(0);
            setIsMediaLoaded(false);
            setPaused(false);
            setShowControls(true);
            setIsMuted(true);
            progressAnim.setValue(0);

            if (group.user_id !== currentUser?.id) {
                socket.emit("viewStory", {
                    user_id: currentUser?.id,
                    story_id: group.stories[0]?.story_id,
                });
            }
        }
    }, [open, selectedStoryIndex, stories, currentUser?.id]);

    // Media loaded → reset progress anim
    useEffect(() => {
        if (!open || !selectedUserStories.length) return;
        setProgress(0);
        progressAnim.setValue(0);
        setIsMediaLoaded(false);
    }, [currentIndex, open, selectedUserStories]);

    // Progress animation
    useEffect(() => {
        if (!open || !isMediaLoaded || paused) {
            cancelAnimation();
            return;
        }
        cancelAnimation();
        progressAnim.setValue(0);

        const anim = Animated.timing(progressAnim, {
            toValue: 100,
            duration: STORY_DURATION,
            useNativeDriver: false,
        });
        animationRef.current = anim;

        anim.start(({ finished }) => {
            if (!finished) return;
            if (currentIndex < selectedUserStories.length - 1) {
                setCurrentIndex((p) => p + 1);
                setIsMediaLoaded(false);
                setProgress(0);
            } else {
                handleClose();
            }
        });

        const listener = progressAnim.addListener(({ value }) => setProgress(value));
        return () => {
            progressAnim.removeListener(listener);
            cancelAnimation();
        };
    }, [currentIndex, open, isMediaLoaded, paused, selectedUserStories.length, handleClose]);

    if (!open) return null;
    if (!selectedUserStories.length || !selectedUserStories[currentIndex]) return null;

    const currentStory = selectedUserStories[currentIndex];
    const currentGroup = stories[selectedStoryIndex];
    const viewerCount = currentStory?.viewers?.length || 0;

    return (
        <Modal visible={open} animationType="fade" onRequestClose={handleClose} statusBarTranslucent>
            <View style={styles.root} {...panResponder.panHandlers}>
                {/* ── Ambient background ── */}
                {currentStory.media_type === "image" && <Image source={{ uri: currentStory.media_url }} style={styles.ambientBg} blurRadius={20} />}
                <View style={styles.ambientOverlay} />

                {/* ── Progress bars ── */}
                <View style={styles.progressRow}>
                    {selectedUserStories.map((_, idx) => (
                        <ProgressSegment key={idx} filled={idx < currentIndex} active={idx === currentIndex} progress={progress} />
                    ))}
                </View>

                {/* ── Header ── */}
                {showControls && (
                    <View style={styles.header}>
                        <TouchableOpacity
                            style={styles.headerUser}
                            onPress={() => router.push(`/profile/${currentGroup.user_id}`)}
                            activeOpacity={0.8}
                        >
                            <Image
                                source={currentGroup.profile_picture ? { uri: currentGroup.profile_picture } : require("../assets/profile_blank.png")}
                                style={styles.headerAvatar}
                            />
                            <View style={{ minWidth: 0 }}>
                                <Text style={styles.headerUsername} numberOfLines={1}>
                                    {currentGroup.username}
                                </Text>
                                <Text style={styles.headerTime}>{timeAgo(currentStory.created_at)}</Text>
                            </View>
                        </TouchableOpacity>

                        <View style={styles.headerActions}>
                            <TouchableOpacity onPress={handlePauseToggle} style={styles.headerBtn}>
                                <Ionicons name={paused ? "play" : "pause"} size={18} color="rgba(255,255,255,0.85)" />
                            </TouchableOpacity>

                            {currentStory.media_type === "video" && (
                                <TouchableOpacity onPress={() => setIsMuted((m) => !m)} style={styles.headerBtn}>
                                    <Ionicons name={isMuted ? "volume-mute" : "volume-high"} size={18} color="rgba(255,255,255,0.85)" />
                                </TouchableOpacity>
                            )}

                            <TouchableOpacity onPress={handleClose} style={styles.headerBtn}>
                                <Ionicons name="close" size={18} color="rgba(255,255,255,0.85)" />
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                {/* ── Media ── */}
                <Pressable
                    style={styles.mediaArea}
                    onPress={resetControlsTimer}
                    onLongPress={() => {
                        isLongPress.current = true;
                        setPaused(true);
                        setShowControls(false);
                    }}
                    onPressOut={() => {
                        if (isLongPress.current) {
                            isLongPress.current = false;
                            setPaused(false);
                            resetControlsTimer(); // ← instead of setShowControls(true)
                        }
                    }}
                >
                    {currentStory.media_type === "image" ? (
                        <Image
                            key={currentStory.story_id}
                            source={{ uri: currentStory.media_url }}
                            style={[styles.media, { opacity: isMediaLoaded ? 1 : 0 }]}
                            resizeMode="contain"
                            onLoad={() => setIsMediaLoaded(true)}
                        />
                    ) : (
                        <Video
                            ref={videoRef}
                            key={currentStory.story_id}
                            source={{ uri: currentStory.media_url }}
                            style={[styles.media, { opacity: isMediaLoaded ? 1 : 0 }]}
                            resizeMode={ResizeMode.COVER}
                            shouldPlay={!paused}
                            isMuted={isMuted}
                            isLooping={false}
                            onReadyForDisplay={() => setIsMediaLoaded(true)}
                            onPlaybackStatusUpdate={(status) => {
                                if (status.isLoaded && status.didJustFinish) handleNext();
                            }}
                        />
                    )}

                    {/* Loading spinner */}
                    {!isMediaLoaded && (
                        <View style={styles.spinner}>
                            <ActivityIndicator size="small" color="rgba(255,255,255,0.9)" />
                        </View>
                    )}

                    {/* Tap zones */}
                    <View style={styles.tapZones} pointerEvents="box-none">
                        <TouchableOpacity
                            style={{ flex: 1 }}
                            activeOpacity={1}
                            onPress={() => {
                                if (!isLongPress.current) {
                                    resetControlsTimer();
                                    handlePrev();
                                }
                            }}
                        />
                        <TouchableOpacity
                            style={{ flex: 2 }}
                            activeOpacity={1}
                            onPress={() => {
                                if (!isLongPress.current) {
                                    resetControlsTimer();
                                    handleNext();
                                }
                            }}
                        />
                    </View>

                    {/* Paused overlay */}
                    {paused && (
                        <View style={styles.pausedOverlay}>
                            <View style={styles.pausedIcon}>
                                <Ionicons name="play" size={32} color="white" />
                            </View>
                        </View>
                    )}

                    {/* Caption */}
                    {!!currentStory.caption && (
                        <View style={styles.captionWrapper} pointerEvents="none">
                            <Text style={styles.captionText}>{currentStory.caption}</Text>
                        </View>
                    )}
                </Pressable>

                {/* ── Views pill ── */}
                <View style={styles.viewsPill}>
                    <TouchableOpacity onPress={handleDrawerToggle} activeOpacity={0.8} style={styles.viewsPillInner}>
                        <Ionicons name="eye-outline" size={14} color="rgba(255,255,255,0.75)" />
                        <Text style={styles.viewsText}>
                            {viewerCount} {viewerCount === 1 ? "view" : "views"}
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* ── Viewers Bottom Sheet ── */}
                {drawerOpen && <Pressable style={styles.sheetBackdrop} onPress={handleDrawerToggle} />}
                <BottomSheet
                    ref={bottomSheetRef}
                    snapPoints={["65%"]}
                    onClose={() => setDrawerOpen(false)}
                    enablePanDownToClose
                    backgroundStyle={styles.sheetBg}
                    handleIndicatorStyle={{ backgroundColor: "rgba(255,255,255,0.2)" }}
                    index={-1}
                >
                    {/* Sheet header */}
                    <View style={styles.sheetHeader}>
                        <View style={styles.sheetHeaderLeft}>
                            <Ionicons name="eye-outline" size={16} color="rgba(255,255,255,0.5)" />
                            <Text style={styles.sheetHeaderTitle}>
                                {viewerCount} {viewerCount === 1 ? "View" : "Views"}
                            </Text>
                        </View>
                        <TouchableOpacity onPress={handleDrawerToggle} style={{ padding: 4 }}>
                            <Ionicons name="close" size={16} color="rgba(255,255,255,0.5)" />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.sheetDivider} />

                    <BottomSheetScrollView contentContainerStyle={{ paddingVertical: 8 }}>
                        {viewerCount > 0 ? (
                            currentStory.viewers.map((viewer, i) => (
                                <ViewerRow
                                    key={i}
                                    viewer={viewer}
                                    createdAt={currentStory.created_at}
                                    onPress={() => {
                                        handleDrawerToggle();
                                        router.push(`/profile/${viewer.viewer_id}`);
                                    }}
                                />
                            ))
                        ) : (
                            <View style={styles.emptyViewers}>
                                <Ionicons name="eye-outline" size={40} color="rgba(255,255,255,0.15)" />
                                <Text style={styles.emptyViewersTitle}>No views yet</Text>
                                <Text style={styles.emptyViewersSub}>Be the first to share this story</Text>
                            </View>
                        )}
                    </BottomSheetScrollView>
                </BottomSheet>
            </View>
        </Modal>
    );
};

export default StoryDialog;

// ── Styles ─────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: "#0a0a0a" },

    // Ambient
    ambientBg: { ...StyleSheet.absoluteFillObject, width: "100%", height: "100%" },
    ambientOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.5)" },

    // Progress
    progressRow: { position: "absolute", top: 52, left: 12, right: 12, flexDirection: "row", gap: 4, zIndex: 20 },
    segmentTrack: { flex: 1, height: 2.5, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.25)", overflow: "hidden" },
    segmentFill: { position: "absolute", top: 0, bottom: 0, left: 0, backgroundColor: "white", borderRadius: 2 },

    // Header
    header: {
        position: "absolute",
        top: 62,
        left: 0,
        right: 0,
        paddingHorizontal: 12,
        paddingBottom: 14,
        paddingTop: 8,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        zIndex: 15,
    },
    headerUser: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, minWidth: 0 },
    headerAvatar: { width: 38, height: 38, borderRadius: 19, borderWidth: 2, borderColor: "rgba(255,255,255,0.9)" },
    headerUsername: { color: "white", fontWeight: "700", fontSize: 14, letterSpacing: -0.1 },
    headerTime: { color: "rgba(255,255,255,0.55)", fontSize: 11, marginTop: 2 },
    headerActions: { flexDirection: "row", alignItems: "center", gap: 4 },
    headerBtn: { padding: 6 },

    // Media
    mediaArea: { flex: 1, alignItems: "center", justifyContent: "center", overflow: "hidden" },
    media: { width: SCREEN_WIDTH, height: SCREEN_HEIGHT },
    spinner: { position: "absolute", top: "50%", left: "50%", transform: [{ translateX: -12 }, { translateY: -12 }] },

    // Tap zones
    tapZones: { ...StyleSheet.absoluteFillObject, flexDirection: "row", zIndex: 5 },

    // Paused
    pausedOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(0,0,0,0.45)",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 6,
    },
    pausedIcon: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: "rgba(255,255,255,0.12)",
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.2)",
    },

    // Caption
    captionWrapper: { position: "absolute", bottom: 0, left: 0, right: 0, paddingHorizontal: 16, paddingBottom: 20, paddingTop: 48, zIndex: 4 },
    captionText: { color: "white", fontSize: 14, lineHeight: 22, fontWeight: "400" },

    // Views pill
    viewsPill: { position: "absolute", bottom: 28, left: 0, right: 0, alignItems: "center", zIndex: 20 },
    viewsPillInner: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 30,
        backgroundColor: "rgba(255,255,255,0.12)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.16)",
    },
    viewsText: { color: "rgba(255,255,255,0.9)", fontSize: 13, fontWeight: "600" },

    // Bottom sheet
    sheetBackdrop: { ...StyleSheet.absoluteFillObject, zIndex: 30 },
    sheetBg: { backgroundColor: "rgba(16,16,18,0.97)" },
    sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 12 },
    sheetHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
    sheetHeaderTitle: { color: "white", fontWeight: "700", fontSize: 16 },
    sheetDivider: { height: 1, backgroundColor: "rgba(255,255,255,0.07)", marginHorizontal: 0 },

    // Viewers
    viewerRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14 },
    viewerAvatar: { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.15)" },
    viewerUsername: { color: "white", fontWeight: "600", fontSize: 14.5 },
    viewerTime: { color: "rgba(255,255,255,0.45)", fontSize: 11.5, marginTop: 2 },
    emptyViewers: { alignItems: "center", paddingVertical: 48, gap: 10 },
    emptyViewersTitle: { color: "rgba(255,255,255,0.3)", fontSize: 14 },
    emptyViewersSub: { color: "rgba(255,255,255,0.2)", fontSize: 12.5 },
});
