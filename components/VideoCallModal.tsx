import React, { useEffect, useRef, useState, useCallback } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    Modal,
    StyleSheet,
    ScrollView,
    TextInput,
    Animated,
    Dimensions,
    Image,
    PanResponder,
    KeyboardAvoidingView,
    Platform,
} from "react-native";
import { Ionicons, MaterialIcons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width: SW, height: SH } = Dimensions.get("window");
const BLUE = "#378ADD";
const GREEN = "#4ade80";
const RED = "#E24B4A";
const AMBER = "#EF9F27";

// ── Types ──────────────────────────────────────────────────────────────────────
interface Participant {
    id: number;
    initials: string;
    name: string;
    role?: string;
    isMuted?: boolean;
    isSpeaking?: boolean;
}

interface ChatMessage {
    id: number;
    sender: string;
    text: string;
    isSelf?: boolean;
    timestamp: string;
}

interface VideoCallModalProps {
    open: boolean;
    onClose: () => void;
    callerId: number;
    receiverId: number;
    localStream: any | null;
    remoteStream: any | null;
    pc: any | null;
    handleEndCall: () => void;
    localUsername?: string;
    localProfilePicture?: string;
    remoteUsername?: string;
    remoteProfilePicture?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function formatTime(seconds: number): string {
    const m = String(Math.floor(seconds / 60)).padStart(2, "0");
    const s = String(seconds % 60).padStart(2, "0");
    return `${m}:${s}`;
}

function nowTime(): string {
    return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function getInitials(name: string): string {
    return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}

// ── Avatar Circle ──────────────────────────────────────────────────────────────
function AvatarCircle({ initials, size = 72, color = BLUE }: { initials: string; size?: number; color?: string }) {
    return (
        <View style={[styles.avatarCircle, { width: size, height: size, borderRadius: size / 2, borderColor: color + "44", backgroundColor: color + "22" }]}>
            <Text style={[styles.avatarText, { fontSize: size * 0.33, color }]}>{initials}</Text>
        </View>
    );
}

// ── Control Button ─────────────────────────────────────────────────────────────
function CtrlBtn({ onPress, active = false, children, style }: { onPress: () => void; active?: boolean; children: React.ReactNode; style?: any }) {
    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.7}
            style={[styles.ctrlBtn, active && styles.ctrlBtnActive, style]}
        >
            {children}
        </TouchableOpacity>
    );
}

function RoundBtn({ onPress, danger = false, off = false, children }: { onPress: () => void; danger?: boolean; off?: boolean; children: React.ReactNode }) {
    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.8}
            style={[styles.roundBtn, (danger || off) && { backgroundColor: RED, borderWidth: 0 }]}
        >
            {children}
        </TouchableOpacity>
    );
}

// ── Panel ──────────────────────────────────────────────────────────────────────
function SidePanel({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
    return (
        <View style={styles.sidePanel}>
            <View style={styles.panelHeader}>
                <Text style={styles.panelTitle}>{title.toUpperCase()}</Text>
                <TouchableOpacity onPress={onClose} style={{ padding: 4 }}>
                    <Ionicons name="close" size={16} color="rgba(255,255,255,0.4)" />
                </TouchableOpacity>
            </View>
            {children}
        </View>
    );
}

// ── Main Component ─────────────────────────────────────────────────────────────
const VideoCallModal: React.FC<VideoCallModalProps> = ({
    open,
    onClose,
    localStream,
    remoteStream,
    handleEndCall,
    localUsername = "You",
    localProfilePicture,
    remoteUsername = "Remote",
    remoteProfilePicture,
}) => {
    const insets = useSafeAreaInsets();

    const localInitials = getInitials(localUsername);
    const remoteInitials = getInitials(remoteUsername);

    const participants: Participant[] = [
        { id: 1, initials: remoteInitials, name: remoteUsername, role: "Host" },
        { id: 2, initials: localInitials, name: localUsername },
    ];

    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOn, setIsVideoOn] = useState(true);
    const [isSharing, setIsSharing] = useState(false);
    const [isHandRaised, setIsHandRaised] = useState(false);
    const [activePanel, setActivePanel] = useState<"participants" | "chat" | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [chatText, setChatText] = useState("");
    const [callSeconds, setCallSeconds] = useState(0);
    const [toast, setToast] = useState<string | null>(null);
    const [showHandOverlay, setShowHandOverlay] = useState(false);
    const [isSwapped, setIsSwapped] = useState(false);

    const toastOpacity = useRef(new Animated.Value(0)).current;
    const handScale = useRef(new Animated.Value(0.5)).current;
    const handOpacity = useRef(new Animated.Value(0)).current;

    // PiP position
    const PIP_W = 120, PIP_H = 85;
    const BAR_H = 76;
    const pipX = useRef(new Animated.Value(SW - PIP_W - 16)).current;
    const pipY = useRef(new Animated.Value(SH - PIP_H - BAR_H - 16)).current;

    const chatScrollRef = useRef<ScrollView>(null);
    const chatInputRef = useRef<TextInput>(null);

    // Timer
    useEffect(() => {
        if (!open) return;
        const interval = setInterval(() => setCallSeconds((s) => s + 1), 1000);
        return () => clearInterval(interval);
    }, [open]);

    // Toast helper
    const showToast = useCallback((msg: string) => {
        setToast(msg);
        toastOpacity.setValue(1);
        Animated.sequence([
            Animated.delay(1800),
            Animated.timing(toastOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
        ]).start(() => setToast(null));
    }, [toastOpacity]);

    // Hand overlay animation
    const triggerHandOverlay = useCallback(() => {
        setShowHandOverlay(true);
        handScale.setValue(0.5);
        handOpacity.setValue(1);
        Animated.sequence([
            Animated.spring(handScale, { toValue: 1.2, useNativeDriver: true, speed: 40 }),
            Animated.spring(handScale, { toValue: 0.95, useNativeDriver: true, speed: 40 }),
            Animated.delay(800),
            Animated.timing(handOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
        ]).start(() => setShowHandOverlay(false));
    }, [handScale, handOpacity]);

    // PiP pan responder
    const pipPanResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderGrant: () => {
                (pipX as any).stopAnimation();
                (pipY as any).stopAnimation();
            },
            onPanResponderMove: (_, g) => {
                pipX.setValue(Math.max(0, Math.min(SW - PIP_W, g.moveX - PIP_W / 2)));
                pipY.setValue(Math.max(0, Math.min(SH - PIP_H - BAR_H, g.moveY - PIP_H / 2)));
            },
            onPanResponderRelease: (_, g) => {
                // Snap to nearest corner
                const snapX = g.moveX > SW / 2 ? SW - PIP_W - 16 : 16;
                const snapY = g.moveY > SH / 2 ? SH - PIP_H - BAR_H - 16 : 56;
                Animated.parallel([
                    Animated.spring(pipX, { toValue: snapX, useNativeDriver: false }),
                    Animated.spring(pipY, { toValue: snapY, useNativeDriver: false }),
                ]).start();
            },
        })
    ).current;

    const toggleMic = () => {
        setIsMuted((v) => !v);
        showToast(isMuted ? "Mic on" : "Mic muted");
    };

    const toggleVideo = () => {
        setIsVideoOn((v) => !v);
        showToast(isVideoOn ? "Camera off" : "Camera on");
    };

    const toggleShare = () => {
        setIsSharing((v) => !v);
        showToast(isSharing ? "Screen sharing stopped" : "Screen sharing started");
    };

    const toggleHand = () => {
        setIsHandRaised((v) => !v);
        if (!isHandRaised) triggerHandOverlay();
        showToast(isHandRaised ? "Hand lowered" : "Hand raised");
    };

    const togglePanel = (panel: "participants" | "chat") => {
        setActivePanel((prev) => (prev === panel ? null : panel));
    };

    const sendMessage = () => {
        const text = chatText.trim();
        if (!text) return;
        setMessages((prev) => [...prev, { id: Date.now(), sender: "You", text, isSelf: true, timestamp: nowTime() }]);
        setChatText("");
        setTimeout(() => chatScrollRef.current?.scrollToEnd({ animated: true }), 100);
    };

    if (!open) return null;

    // ── Video placeholder (no stream) ──
    const RemotePlaceholder = () => (
        <View style={styles.placeholder}>
            {remoteProfilePicture ? (
                <Image source={{ uri: remoteProfilePicture }} style={[styles.placeholderAvatar, { borderColor: BLUE + "66" }]} />
            ) : (
                <AvatarCircle initials={remoteInitials} size={80} color={BLUE} />
            )}
            <Text style={styles.placeholderText}>{remoteUsername} · Camera off</Text>
        </View>
    );

    const LocalPlaceholder = () => (
        <View style={styles.placeholder}>
            {localProfilePicture ? (
                <Image source={{ uri: localProfilePicture }} style={[styles.placeholderAvatar, { borderColor: GREEN + "66" }]} />
            ) : (
                <AvatarCircle initials={localInitials} size={80} color={GREEN} />
            )}
            <Text style={styles.placeholderText}>{localUsername} · Camera {isVideoOn ? "on" : "off"}</Text>
        </View>
    );

    const PiPPlaceholder = ({ isLocal }: { isLocal: boolean }) => (
        <View style={[styles.placeholder, { backgroundColor: "#1e3a5f" }]}>
            {(isLocal ? localProfilePicture : remoteProfilePicture) ? (
                <Image
                    source={{ uri: isLocal ? localProfilePicture : remoteProfilePicture }}
                    style={{ width: 36, height: 36, borderRadius: 18 }}
                />
            ) : (
                <AvatarCircle initials={isLocal ? localInitials : remoteInitials} size={32} color={isLocal ? GREEN : BLUE} />
            )}
        </View>
    );

    return (
        <Modal visible={open} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
            <View style={[styles.root, { paddingTop: insets.top }]}>
                <View style={styles.container}>

                    {/* ── Main video area ── */}
                    <View style={styles.mainVideo}>
                        {/* Main feed */}
                        {isSwapped ? <LocalPlaceholder /> : <RemotePlaceholder />}

                        {/* Top bar */}
                        <View style={styles.topBar}>
                            <View style={styles.badge}>
                                <Text style={styles.badgeText}>{formatTime(callSeconds)}</Text>
                            </View>
                            <View style={[styles.badge, { position: "absolute", left: "50%", marginLeft: -40 }]}>
                                <Text style={styles.callerName}>{isSwapped ? localUsername : remoteUsername}</Text>
                            </View>
                            <View style={styles.topBarRight}>
                                <View style={styles.badge}>
                                    <Text style={[styles.badgeText, { color: GREEN }]}>HD · 1080p</Text>
                                </View>
                                <View style={[styles.badge, { flexDirection: "row", gap: 4 }]}>
                                    <Ionicons name="cellular" size={12} color={GREEN} />
                                    <Text style={[styles.badgeText, { color: GREEN }]}>Strong</Text>
                                </View>
                            </View>
                        </View>

                        {/* Hand overlay */}
                        {showHandOverlay && (
                            <Animated.View style={[styles.handOverlay, { transform: [{ scale: handScale }], opacity: handOpacity }]}>
                                <Text style={{ fontSize: 64 }}>✋</Text>
                            </Animated.View>
                        )}

                        {/* Toast */}
                        {toast && (
                            <Animated.View style={[styles.toast, { opacity: toastOpacity }]}>
                                <Text style={styles.toastText}>{toast}</Text>
                            </Animated.View>
                        )}

                        {/* PiP */}
                        <Animated.View
                            style={[styles.pip, { left: pipX, top: pipY }]}
                            {...pipPanResponder.panHandlers}
                        >
                            <TouchableOpacity
                                activeOpacity={0.9}
                                onPress={() => { setIsSwapped((v) => !v); showToast("Views swapped"); }}
                                style={{ flex: 1 }}
                            >
                                <PiPPlaceholder isLocal={!isSwapped} />
                                <View style={styles.pipLabel}>
                                    <Text style={styles.pipLabelText}>{isSwapped ? remoteUsername : localUsername}</Text>
                                </View>
                            </TouchableOpacity>
                        </Animated.View>
                    </View>

                    {/* ── Bottom controls ── */}
                    <View style={styles.bottomBar}>
                        {/* Left */}
                        <View style={styles.ctrlGroup}>
                            <CtrlBtn onPress={() => togglePanel("participants")} active={activePanel === "participants"}>
                                <Ionicons name="people" size={18} color={activePanel === "participants" ? BLUE : "rgba(255,255,255,0.75)"} />
                            </CtrlBtn>
                            <CtrlBtn onPress={() => togglePanel("chat")} active={activePanel === "chat"}>
                                <Ionicons name="chatbubble" size={18} color={activePanel === "chat" ? BLUE : "rgba(255,255,255,0.75)"} />
                            </CtrlBtn>
                            <CtrlBtn onPress={toggleShare} active={isSharing}>
                                <MaterialIcons name={isSharing ? "stop-screen-share" : "screen-share"} size={18} color={isSharing ? BLUE : "rgba(255,255,255,0.75)"} />
                            </CtrlBtn>
                        </View>

                        {/* Center */}
                        <View style={[styles.ctrlGroup, { gap: 10 }]}>
                            <RoundBtn onPress={toggleMic} off={isMuted}>
                                <Ionicons name={isMuted ? "mic-off" : "mic"} size={20} color="#fff" />
                            </RoundBtn>
                            <TouchableOpacity onPress={handleEndCall} activeOpacity={0.8} style={styles.endBtn}>
                                <MaterialIcons name="call-end" size={22} color="#fff" />
                            </TouchableOpacity>
                            <RoundBtn onPress={toggleVideo} off={!isVideoOn}>
                                <Ionicons name={isVideoOn ? "videocam" : "videocam-off"} size={20} color="#fff" />
                            </RoundBtn>
                        </View>

                        {/* Right */}
                        <View style={styles.ctrlGroup}>
                            <CtrlBtn
                                onPress={toggleHand}
                                active={isHandRaised}
                                style={isHandRaised && { backgroundColor: AMBER + "33", borderColor: AMBER + "66" }}
                            >
                                <MaterialCommunityIcons name="hand-wave" size={18} color={isHandRaised ? AMBER : "rgba(255,255,255,0.75)"} />
                            </CtrlBtn>
                            <CtrlBtn onPress={() => {}}>
                                <Ionicons name="ellipsis-vertical" size={18} color="rgba(255,255,255,0.75)" />
                            </CtrlBtn>
                        </View>
                    </View>

                    {/* ── Participants panel ── */}
                    {activePanel === "participants" && (
                        <SidePanel title={`Participants (${participants.length})`} onClose={() => setActivePanel(null)}>
                            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 10 }}>
                                {participants.map((p) => (
                                    <View key={p.id} style={styles.participantRow}>
                                        {(p.id === 1 ? remoteProfilePicture : localProfilePicture) ? (
                                            <Image
                                                source={{ uri: p.id === 1 ? remoteProfilePicture : localProfilePicture }}
                                                style={styles.participantAvatar}
                                            />
                                        ) : (
                                            <AvatarCircle initials={p.initials} size={34} color={p.id === 2 ? GREEN : BLUE} />
                                        )}
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.participantName} numberOfLines={1}>{p.name}</Text>
                                            <Text style={[styles.participantRole, { color: p.isSpeaking ? GREEN : "rgba(255,255,255,0.35)" }]}>
                                                {p.role ?? (p.isMuted ? "Muted" : p.isSpeaking ? "Speaking" : "")}
                                            </Text>
                                        </View>
                                        <Ionicons
                                            name={p.isMuted ? "mic-off" : "mic"}
                                            size={14}
                                            color={p.isMuted ? RED + "BB" : "rgba(255,255,255,0.3)"}
                                        />
                                    </View>
                                ))}
                            </ScrollView>
                        </SidePanel>
                    )}

                    {/* ── Chat panel ── */}
                    {activePanel === "chat" && (
                        <SidePanel title="Chat" onClose={() => setActivePanel(null)}>
                            <ScrollView
                                ref={chatScrollRef}
                                style={{ flex: 1 }}
                                contentContainerStyle={{ padding: 10, gap: 8 }}
                                onContentSizeChange={() => chatScrollRef.current?.scrollToEnd({ animated: true })}
                            >
                                {messages.map((msg) => (
                                    <View key={msg.id} style={[styles.bubble, msg.isSelf ? styles.bubbleSelf : styles.bubbleOther]}>
                                        {!msg.isSelf && (
                                            <Text style={styles.bubbleSender}>{msg.sender}</Text>
                                        )}
                                        <Text style={styles.bubbleText}>{msg.text}</Text>
                                        <Text style={[styles.bubbleTime, { textAlign: msg.isSelf ? "right" : "left" }]}>{msg.timestamp}</Text>
                                    </View>
                                ))}
                            </ScrollView>

                            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"}>
                                <View style={styles.chatInputRow}>
                                    <TextInput
                                        ref={chatInputRef}
                                        style={styles.chatInput}
                                        placeholder="Message..."
                                        placeholderTextColor="rgba(255,255,255,0.3)"
                                        value={chatText}
                                        onChangeText={setChatText}
                                        onSubmitEditing={sendMessage}
                                        returnKeyType="send"
                                    />
                                    <TouchableOpacity onPress={sendMessage} style={styles.chatSendBtn} activeOpacity={0.8}>
                                        <Ionicons name="send" size={14} color="#fff" />
                                    </TouchableOpacity>
                                </View>
                            </KeyboardAvoidingView>
                        </SidePanel>
                    )}
                </View>
            </View>
        </Modal>
    );
};

export default VideoCallModal;

// ── Styles ─────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: "rgba(0,0,0,0.92)", alignItems: "center", justifyContent: "center" },
    container: { width: "100%", flex: 1, backgroundColor: "#0e0e0e", overflow: "hidden", flexDirection: "column" },

    // Main video
    mainVideo: { flex: 1, position: "relative", overflow: "hidden" },
    placeholder: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, backgroundColor: "#0f3460" },
    placeholderAvatar: { width: 80, height: 80, borderRadius: 40, borderWidth: 2 },
    placeholderText: { color: "rgba(255,255,255,0.4)", fontSize: 13, fontFamily: "monospace" },

    // Avatar
    avatarCircle: { alignItems: "center", justifyContent: "center", borderWidth: 2 },
    avatarText: { fontWeight: "600" },

    // Top bar
    topBar: { position: "absolute", top: 16, left: 16, right: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", zIndex: 20 },
    topBarRight: { flexDirection: "row", gap: 6 },
    badge: { backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, flexDirection: "row", alignItems: "center", gap: 4 },
    badgeText: { color: "rgba(255,255,255,0.5)", fontSize: 11, fontFamily: "monospace" },
    callerName: { color: "rgba(255,255,255,0.9)", fontSize: 13, fontWeight: "600", fontFamily: "monospace" },

    // Hand overlay
    handOverlay: { position: "absolute", top: "50%", left: "50%", marginLeft: -40, marginTop: -40, zIndex: 40 },

    // Toast
    toast: { position: "absolute", top: 54, alignSelf: "center", backgroundColor: "rgba(20,20,20,0.95)", borderRadius: 8, paddingHorizontal: 16, paddingVertical: 7, borderWidth: 0.5, borderColor: "rgba(255,255,255,0.12)", zIndex: 50 },
    toastText: { color: "rgba(255,255,255,0.85)", fontSize: 12, fontFamily: "monospace" },

    // PiP
    pip: { position: "absolute", width: 120, height: 85, borderRadius: 10, overflow: "hidden", borderWidth: 2, borderColor: BLUE + "77", backgroundColor: "#1e2a38", zIndex: 10 },
    pipLabel: { position: "absolute", bottom: 4, left: 6, backgroundColor: "rgba(0,0,0,0.65)", borderRadius: 4, paddingHorizontal: 4, paddingVertical: 2 },
    pipLabelText: { color: "rgba(255,255,255,0.7)", fontSize: 10, fontFamily: "monospace" },

    // Bottom bar
    bottomBar: { height: 76, backgroundColor: "rgba(5,5,5,0.88)", borderTopWidth: 0.5, borderTopColor: "rgba(255,255,255,0.07)", flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16 },
    ctrlGroup: { flexDirection: "row", alignItems: "center", gap: 6 },

    // Ctrl btn
    ctrlBtn: { width: 40, height: 40, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 0.5, borderColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" },
    ctrlBtnActive: { backgroundColor: BLUE + "40", borderColor: BLUE + "66" },

    // Round btn
    roundBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: "rgba(255,255,255,0.1)", borderWidth: 0.5, borderColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },

    // End btn
    endBtn: { width: 52, height: 52, borderRadius: 26, backgroundColor: RED, alignItems: "center", justifyContent: "center" },

    // Side panel
    sidePanel: { position: "absolute", top: 0, right: 0, width: 220, bottom: 76, backgroundColor: "rgba(8,8,8,0.96)", borderLeftWidth: 0.5, borderLeftColor: "rgba(255,255,255,0.08)", flexDirection: "column", zIndex: 15 },
    panelHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 14, paddingBottom: 10, borderBottomWidth: 0.5, borderBottomColor: "rgba(255,255,255,0.07)" },
    panelTitle: { color: "rgba(255,255,255,0.45)", fontSize: 10, fontWeight: "600", letterSpacing: 1.2, fontFamily: "monospace" },

    // Participants
    participantRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 8, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.03)", marginBottom: 6 },
    participantAvatar: { width: 34, height: 34, borderRadius: 17 },
    participantName: { color: "#fff", fontSize: 13, fontWeight: "500" },
    participantRole: { fontSize: 11 },

    // Chat
    bubble: { maxWidth: "85%", borderRadius: 12, padding: 8 },
    bubbleSelf: { alignSelf: "flex-end", backgroundColor: BLUE + "26", borderBottomRightRadius: 2 },
    bubbleOther: { alignSelf: "flex-start", backgroundColor: "rgba(255,255,255,0.06)", borderBottomLeftRadius: 2 },
    bubbleSender: { color: BLUE, fontSize: 10, fontWeight: "600", marginBottom: 4, fontFamily: "monospace" },
    bubbleText: { color: "rgba(255,255,255,0.85)", fontSize: 12, lineHeight: 18 },
    bubbleTime: { color: "rgba(255,255,255,0.25)", fontSize: 10, marginTop: 4, fontFamily: "monospace" },
    chatInputRow: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderTopWidth: 0.5, borderTopColor: "rgba(255,255,255,0.07)" },
    chatInput: { flex: 1, backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 0.5, borderColor: "rgba(255,255,255,0.1)", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7, color: "#fff", fontSize: 12 },
    chatSendBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: BLUE, alignItems: "center", justifyContent: "center" },
});