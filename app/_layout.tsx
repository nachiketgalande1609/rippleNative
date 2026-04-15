import { useEffect, useRef, useState } from "react";
import { Stack, useRouter, usePathname } from "expo-router";
import { View, Text, Image, TouchableOpacity, Modal, StyleSheet, Animated } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import AsyncStorage from "@react-native-async-storage/async-storage";
import socket from "../services/socket";
import { getNotificationsCount } from "../services/api";
import { useGlobalStore } from "../store/store";
import { useThemeColors } from "../hooks/useThemeColors";
import VideoCallModal from "../components/VideoCallModal";
import NavBar from "../components/Navbar";
import MobileTopBar from "../components/MobileTopBar";
import { useFonts } from "expo-font";

const AUTH_ROUTES = ["/login", "/register", "/reset-password", "/verify-email"];

type User = {
    id: number;
    username: string;
    profile_picture: string;
    isOnline: boolean;
    latest_message: string;
    latest_message_timestamp: string;
    unread_count: number;
};

export default function RootLayout() {
    const colors = useThemeColors();
    const router = useRouter();
    const pathname = usePathname();
    const [fontsLoaded] = useFonts({
        MomoSignature: require("../assets/fonts/MomoSignature.ttf"),
    });


    const currentUserRef = useRef<any>(null);
    const { user, unreadNotificationsCount, setUnreadNotificationsCount, unreadMessagesCount, setUnreadMessagesCount, postUploading, loadUser } =
        useGlobalStore();

    const [authChecked, setAuthChecked] = useState(false);
    const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
    const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
    const [pc, setPc] = useState<any>(null);
    const [localStream, setLocalStream] = useState<any>(null);
    const [remoteStream, setRemoteStream] = useState<any>(null);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [callParticipantId, setCallParticipantId] = useState<number | null>(null);
    const [incomingCall, setIncomingCall] = useState<{
        from: number;
        signal: any;
        callerUsername: string;
        callerProfilePicture: string;
    } | null>(null);

    const pendingCandidates = useRef<any[]>([]);
    const uploadProgress = useRef(new Animated.Value(0)).current;

    const isAuthRoute = AUTH_ROUTES.some(r => pathname.startsWith(r));

    // ── Auth guard ──
    useEffect(() => {
        const checkAuth = async () => {
            const raw = await AsyncStorage.getItem("user");
            const token = await AsyncStorage.getItem("token");
            currentUserRef.current = raw ? JSON.parse(raw) : null;

            if ((!raw || !token) && !isAuthRoute) {
                router.replace("/login");
            } else if (raw && token && isAuthRoute) {
                router.replace("/");
            }
            // Load into global store
            await loadUser();
            setAuthChecked(true);
        };
        checkAuth();
    }, []);

    // ── Animate upload bar ──
    useEffect(() => {
        if (postUploading) {
            uploadProgress.setValue(0);
            Animated.loop(Animated.timing(uploadProgress, { toValue: 1, duration: 1500, useNativeDriver: true })).start();
        } else {
            uploadProgress.stopAnimation();
        }
    }, [postUploading]);

    // ── Socket registration ──
    useEffect(() => {
        const register = async () => {
            const raw = await AsyncStorage.getItem("user");
            const u = raw ? JSON.parse(raw) : null;
            if (u?.id) socket.emit("registerUser", u.id);
        };
        if (socket.connected) register();
        socket.on("connect", register);
        socket.io.on("reconnect", register);
        return () => {
            socket.off("connect", register);
            socket.io.off("reconnect", register);
        };
    }, []);

    // ── Online users ──
    useEffect(() => {
        socket.on("onlineUsers", (data) => setOnlineUsers(data));
        return () => { socket.off("onlineUsers"); };
    }, []);

    // ── Notification count ──
    useEffect(() => {
        if (!user) return;
        getNotificationsCount()
            .then((res) => {
                if (res?.success) {
                    setUnreadNotificationsCount(res.data.unread_notifications);
                    setUnreadMessagesCount(res.data.unread_messages);
                }
            })
            .catch(console.error);
    }, [user]);

    // ── Unread count socket ──
    useEffect(() => {
        if (!user) return;
        const handler = (data: { targetUserId: string; unreadCount: number }) => {
            if (String(data.targetUserId) === String(user.id)) setUnreadNotificationsCount(data.unreadCount);
        };
        socket.on("unreadCountResponse", handler);
        return () => { socket.off("unreadCountResponse", handler); };
    }, [user]);

    // ── Incoming call ──
    useEffect(() => {
        const handler = (data: any) => setIncomingCall(data);
        socket.on("callReceived", handler);
        return () => { socket.off("callReceived", handler); };
    }, []);

    // ── End call received ──
    useEffect(() => {
        const handler = () => {
            setIsVideoModalOpen(false);
            setCallParticipantId(null);
            setPc(null);
            setLocalStream(null);
            setRemoteStream(null);
        };
        socket.on("endCall", handler);
        return () => { socket.off("endCall", handler); };
    }, []);

    const handleRejectCall = () => {
        if (incomingCall) socket.emit("endCall", { to: incomingCall.from });
        setIncomingCall(null);
    };

    const handleEndCall = () => {
        if (callParticipantId) {
            socket.emit("endCall", { to: callParticipantId });
            setCallParticipantId(null);
        }
        setIsVideoModalOpen(false);
        setPc(null);
        setLocalStream(null);
        setRemoteStream(null);
    };

    const currentUser = currentUserRef.current;

    if (!authChecked) return null;

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <SafeAreaProvider>
                {/* Upload progress bar */}
                {postUploading && (
                    <View style={styles.uploadBar}>
                        <Animated.View
                            style={[
                                styles.uploadBarInner,
                                {
                                    transform: [{ translateX: uploadProgress.interpolate({ inputRange: [0, 1], outputRange: [-150, 300] }) }],
                                },
                            ]}
                        />
                    </View>
                )}

                {!isAuthRoute && (
                    <MobileTopBar unreadNotificationsCount={unreadNotificationsCount} />
                )}

                {/* Main screens */}
                <Stack screenOptions={{ headerShown: false }} />

                {/* Nav bar — only show on non-auth routes */}
                {!isAuthRoute && (
                    <NavBar
                        unreadMessagesCount={unreadMessagesCount}
                        unreadNotificationsCount={unreadNotificationsCount}
                        setUnreadMessagesCount={setUnreadMessagesCount}
                        onlineUsers={onlineUsers}
                        selectedUser={selectedUser}
                        setSelectedUser={setSelectedUser}
                    />
                )}

                {/* Incoming call modal */}
                <Modal visible={!!incomingCall} transparent animationType="fade">
                    <View style={styles.callBackdrop}>
                        <View style={[styles.callCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                            <Image
                                source={
                                    incomingCall?.callerProfilePicture
                                        ? { uri: incomingCall.callerProfilePicture }
                                        : require("../assets/profile_blank.png")
                                }
                                style={styles.callerAvatar}
                            />
                            <Text style={[styles.callerName, { color: colors.textPrimary }]}>{incomingCall?.callerUsername}</Text>
                            <Text style={[styles.callerSub, { color: colors.textSecondary }]}>is calling you</Text>
                            <View style={styles.callActions}>
                                <TouchableOpacity
                                    style={[styles.callBtn, styles.acceptBtn]}
                                    onPress={() => {
                                        if (!incomingCall) return;
                                        setCallParticipantId(incomingCall.from);
                                        setIsVideoModalOpen(true);
                                        setIncomingCall(null);
                                    }}
                                >
                                    <Text style={styles.callBtnText}>Accept</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.callBtn, styles.rejectBtn]} onPress={handleRejectCall}>
                                    <Text style={styles.callBtnText}>Reject</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>

                <VideoCallModal
                    open={isVideoModalOpen}
                    onClose={() => setIsVideoModalOpen(false)}
                    callerId={currentUser?.id}
                    receiverId={callParticipantId || 0}
                    localStream={localStream}
                    remoteStream={remoteStream}
                    pc={pc}
                    handleEndCall={handleEndCall}
                    localUsername={currentUser?.username}
                    localProfilePicture={currentUser?.profile_picture_url}
                    remoteUsername={incomingCall?.callerUsername ?? selectedUser?.username ?? "Remote"}
                    remoteProfilePicture={incomingCall?.callerProfilePicture ?? selectedUser?.profile_picture ?? undefined}
                />
            </SafeAreaProvider>
        </GestureHandlerRootView>
    );
}

const styles = StyleSheet.create({
    uploadBar: { position: "absolute", top: 0, left: 0, right: 0, height: 3, zIndex: 1000, overflow: "hidden" },
    uploadBarInner: { position: "absolute", top: 0, bottom: 0, width: 150, backgroundColor: "#7a60ff" },
    callBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "flex-end", padding: 16 },
    callCard: { width: "100%", borderRadius: 20, padding: 24, alignItems: "center", borderWidth: 1 },
    callerAvatar: { width: 100, height: 100, borderRadius: 50, marginBottom: 12 },
    callerName: { fontWeight: "600", fontSize: 16, marginBottom: 4 },
    callerSub: { fontSize: 14, marginBottom: 16 },
    callActions: { flexDirection: "row", gap: 12 },
    callBtn: { flex: 1, paddingVertical: 12, borderRadius: 15, alignItems: "center" },
    acceptBtn: { backgroundColor: "#4caf50" },
    rejectBtn: { backgroundColor: "#e53935" },
    callBtnText: { color: "#fff", fontWeight: "600", fontSize: 15 },
});