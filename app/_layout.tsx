import { useEffect, useRef, useState } from "react";
import { Stack, useRouter, usePathname } from "expo-router";
import * as Notifications from "expo-notifications";
import { View, Text, Image, TouchableOpacity, Modal, StyleSheet, Animated } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { RTCPeerConnection, RTCIceCandidate, RTCSessionDescription, mediaDevices, MediaStream } from "../services/webrtc";
import socket from "../services/socket";
import { getNotificationsCount } from "../services/api";
import { useGlobalStore } from "../store/store";
import { useThemeColors } from "../hooks/useThemeColors";
import VideoCallModal from "../components/VideoCallModal";
import NavBar from "../components/Navbar";
import MobileTopBar from "../components/MobileTopBar";
import { useFonts } from "expo-font";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "react-native";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";

const AUTH_ROUTES = ["/login", "/register", "/reset-password", "/verify-email"];

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

// ─── ICE servers (mirrors your web app) ──────────────────────────────────────
const ICE_SERVERS = {
    iceServers: [
        {
            urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"],
        },
        {
            urls: "turn:relay1.expressturn.com:3478",
            username: "efBWO11LZUDOHPDC84",
            credential: "y0Da1Uz9asLPxFpC",
        },
    ],
    iceCandidatePoolSize: 10,
};

type User = {
    id: number;
    username: string;
    profile_picture: string;
    isOnline: boolean;
    latest_message: string;
    latest_message_timestamp: string;
    unread_count: number;
};

// ─── Pulsing avatar for incoming-call sheet ───────────────────────────────────
function PulsingAvatar({ uri, fallback }: { uri?: string | null; fallback: any }) {
    const ring1 = useRef(new Animated.Value(1)).current;
    const ring2 = useRef(new Animated.Value(1)).current;
    const op1 = useRef(new Animated.Value(0.6)).current;
    const op2 = useRef(new Animated.Value(0.4)).current;

    useEffect(() => {
        const pulse = (scale: Animated.Value, opacity: Animated.Value, delay: number) =>
            Animated.loop(
                Animated.sequence([
                    Animated.delay(delay),
                    Animated.parallel([
                        Animated.timing(scale, {
                            toValue: 1.5,
                            duration: 1000,
                            useNativeDriver: true,
                        }),
                        Animated.timing(opacity, {
                            toValue: 0,
                            duration: 1000,
                            useNativeDriver: true,
                        }),
                    ]),
                    Animated.parallel([
                        Animated.timing(scale, {
                            toValue: 1,
                            duration: 0,
                            useNativeDriver: true,
                        }),
                        Animated.timing(opacity, {
                            toValue: 0.5,
                            duration: 0,
                            useNativeDriver: true,
                        }),
                    ]),
                ]),
            ).start();

        pulse(ring1, op1, 0);
        pulse(ring2, op2, 500);
    }, []);

    return (
        <View style={styles.avatarWrap}>
            <Animated.View style={[styles.pulseRing, { transform: [{ scale: ring1 }], opacity: op1 }]} />
            <Animated.View style={[styles.pulseRing, { transform: [{ scale: ring2 }], opacity: op2 }]} />
            <Image source={uri ? { uri } : fallback} style={styles.callerAvatar} />
        </View>
    );
}

async function showMessageNotification(preview: {
    senderId: number;
    senderUsername: string;
    messageText: string;
    senderProfilePicture?: string | null;
}) {
    await Notifications.scheduleNotificationAsync({
        content: {
            title: preview.senderUsername,
            body: preview.messageText || "Sent you a message",
            data: { senderId: preview.senderId },
            sound: true,
        },
        trigger: null, // fire immediately
    });
}

export default function RootLayout() {
    const colors = useThemeColors();
    const router = useRouter();
    const pathname = usePathname();
    const [fontsLoaded] = useFonts({
        MomoSignature: require("../assets/fonts/MomoSignature.ttf"),
    });
    const insets = useSafeAreaInsets();

    const currentUserRef = useRef<any>(null);
    const {
        user,
        unreadNotificationsCount,
        setUnreadNotificationsCount,
        unreadMessagesCount,
        setUnreadMessagesCount,
        postUploading,
        loadUser,
        onlineUsers,
        setOnlineUsers,
        setOnVideoCall,
    } = useGlobalStore();

    const [authChecked, setAuthChecked] = useState(false);
    const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);

    // ── WebRTC state ──────────────────────────────────────────────────────────
    const [pc, setPc] = useState<RTCPeerConnection | null>(null);
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
    const pendingCandidates = useRef<any[]>([]);
    const pcRef = useRef<RTCPeerConnection | null>(null); // always-fresh ref for socket handlers

    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [callParticipantId, setCallParticipantId] = useState<number | null>(null);
    const [incomingCall, setIncomingCall] = useState<{
        from: number;
        signal: any;
        callerUsername: string;
        callerProfilePicture: string;
    } | null>(null);
    const [remoteCallInfo, setRemoteCallInfo] = useState<{
        username: string;
        profilePicture?: string;
    } | null>(null);

    const uploadProgress = useRef(new Animated.Value(0)).current;
    const isAuthRoute = AUTH_ROUTES.some((r) => pathname.startsWith(r));

    const notificationListener = useRef<any>(null);
    const responseListener = useRef<any>(null);

    useEffect(() => {
        Notifications.requestPermissionsAsync();

        // Fires when user taps the notification
        responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
            const senderId = response.notification.request.content.data?.senderId;
            if (senderId) router.push(`/messages/${senderId}`);
        });

        return () => {
            responseListener.current?.remove();
            notificationListener.current?.remove();
        };
    }, []);

    // ─── Keep pcRef in sync ───────────────────────────────────────────────────
    useEffect(() => {
        pcRef.current = pc;
    }, [pc]);

    // ─── Helpers ──────────────────────────────────────────────────────────────

    /** Get local camera + mic stream */
    const getLocalStream = async (): Promise<MediaStream> => {
        const stream = await mediaDevices.getUserMedia({
            audio: true,
            video: {
                facingMode: "user",
                width: { ideal: 1280 },
                height: { ideal: 720 },
            },
        });
        return stream as MediaStream;
    };

    /** Create a new RTCPeerConnection and wire up common handlers */
    const createPc = (remoteUserId: number): RTCPeerConnection => {
        const newPc = new RTCPeerConnection(ICE_SERVERS);

        (newPc as any).addEventListener("icecandidate", (event: any) => {
            if (event.candidate) {
                socket.emit("iceCandidate", {
                    to: remoteUserId,
                    candidate: event.candidate,
                });
            }
        });

        // react-native-webrtc requires addEventListener for track + connectionstatechange
        (newPc as any).addEventListener("track", (event: any) => {
            if (event.streams && event.streams[0]) {
                setRemoteStream(event.streams[0] as MediaStream);
            }
        });

        (newPc as any).addEventListener("connectionstatechange", () => {
            console.log("[WebRTC] connection state:", (newPc as any).connectionState);
        });

        return newPc;
    };

    /** Flush any ICE candidates that arrived before setRemoteDescription */
    const flushPendingCandidates = async (targetPc: RTCPeerConnection) => {
        for (const c of pendingCandidates.current) {
            try {
                await targetPc.addIceCandidate(new RTCIceCandidate(c));
            } catch (e) {
                console.warn("[WebRTC] addIceCandidate (pending) error:", e);
            }
        }
        pendingCandidates.current = [];
    };

    /** Tear down streams and peer connection cleanly */
    const cleanupCall = () => {
        localStream?.getTracks().forEach((t: any) => t.stop());
        pcRef.current?.close();
        pcRef.current = null;
        setPc(null);
        setLocalStream(null);
        setRemoteStream(null);
        pendingCandidates.current = [];
    };

    // ─── Auth guard ───────────────────────────────────────────────────────────
    useEffect(() => {
        const checkAuth = async () => {
            const raw = await AsyncStorage.getItem("user");
            const token = await AsyncStorage.getItem("token");
            currentUserRef.current = raw ? JSON.parse(raw) : null;

            await loadUser();
            setAuthChecked(true);

            if ((!raw || !token) && !isAuthRoute) {
                router.replace("/login");
            } else if (raw && token && isAuthRoute) {
                router.replace("/home");
            }
        };
        checkAuth();
    }, []);

    // ─── Expose video-call trigger to the store (used by MessagesPage) ─────────
    useEffect(() => {
        setOnVideoCall((userId: number) => {
            handleOutgoingCall(userId);
        });
        return () => setOnVideoCall(null);
    }, [selectedUser]); // rebuild when selectedUser changes so closure is fresh

    // ─── Upload bar animation ─────────────────────────────────────────────────
    useEffect(() => {
        if (postUploading) {
            uploadProgress.setValue(0);
            Animated.loop(
                Animated.timing(uploadProgress, {
                    toValue: 1,
                    duration: 1500,
                    useNativeDriver: true,
                }),
            ).start();
        } else {
            uploadProgress.stopAnimation();
        }
    }, [postUploading]);

    // ─── Socket registration ──────────────────────────────────────────────────
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

    // ─── Online users ─────────────────────────────────────────────────────────
    useEffect(() => {
        socket.on("onlineUsers", (data) => setOnlineUsers(data));
        return () => {
            socket.off("onlineUsers");
        };
    }, []);

    // ─── Notification count ───────────────────────────────────────────────────
    useEffect(() => {
        if (!user) return;
        const handler = (_data: any) => {
            const current = useGlobalStore.getState().unreadNotificationsCount ?? 0;
            setUnreadNotificationsCount(current + 1);
        };
        socket.on("newNotification", handler);
        return () => {
            socket.off("newNotification", handler);
        };
    }, [user]);

    useEffect(() => {
        if (!user) return;
        const handler = () => {
            const current = useGlobalStore.getState().unreadNotificationsCount ?? 0;
            setUnreadNotificationsCount(current + 1);
        };
        socket.on("unreadCountResponse", handler);
        return () => {
            socket.off("unreadCountResponse", handler);
        };
    }, [user]);

    useEffect(() => {
        if (!user) return;
        const handler = () => {
            const current = useGlobalStore.getState().unreadNotificationsCount ?? 0;
            setUnreadNotificationsCount(current + 1);
        };
        socket.on("newNotification", handler);
        return () => {
            socket.off("newNotification", handler);
        };
    }, [user]);

    // ─── Incoming call ────────────────────────────────────────────────────────
    useEffect(() => {
        const handler = (data: any) => setIncomingCall(data);
        socket.on("callReceived", handler);
        return () => {
            socket.off("callReceived", handler);
        };
    }, []);

    // ─── ICE candidate received ───────────────────────────────────────────────
    // Uses pcRef so the handler always sees the latest pc instance
    useEffect(() => {
        const handler = async (data: { candidate: any }) => {
            const activePc = pcRef.current;
            if (!activePc) return;
            if (activePc.remoteDescription) {
                try {
                    await activePc.addIceCandidate(new RTCIceCandidate(data.candidate));
                } catch (e) {
                    console.warn("[WebRTC] addIceCandidate error:", e);
                }
            } else {
                // Buffer until remote description is set
                pendingCandidates.current.push(data.candidate);
            }
        };
        socket.on("iceCandidateReceived", handler);
        return () => {
            socket.off("iceCandidateReceived", handler);
        };
    }, []);

    // ─── Call answered (caller receives the callee's answer) ──────────────────
    useEffect(() => {
        const handler = async (data: { signal: any }) => {
            const activePc = pcRef.current;
            if (!activePc) return;
            try {
                await activePc.setRemoteDescription(new RTCSessionDescription(data.signal));
                await flushPendingCandidates(activePc);
            } catch (e) {
                console.error("[WebRTC] setRemoteDescription (answer) error:", e);
            }
        };
        socket.on("callAnswered", handler);
        return () => {
            socket.off("callAnswered", handler);
        };
    }, []);

    // ─── Remote end call ──────────────────────────────────────────────────────
    useEffect(() => {
        const handler = () => {
            cleanupCall();
            setIsVideoModalOpen(false);
            setCallParticipantId(null);
            setRemoteCallInfo(null);
        };
        socket.on("endCall", handler);
        return () => {
            socket.off("endCall", handler);
        };
    }, []);

    // ─── CALLER: initiate outgoing call ───────────────────────────────────────
    const handleOutgoingCall = async (userId: number) => {
        const currentUser = currentUserRef.current;
        if (!currentUser) return;

        setCallParticipantId(userId);
        setIsVideoModalOpen(true);

        const newPc = createPc(userId);
        pcRef.current = newPc;
        setPc(newPc);

        try {
            const stream = await getLocalStream();
            setLocalStream(stream);
            stream.getTracks().forEach((track: any) => newPc.addTrack(track, stream));

            const offer = await newPc.createOffer({});
            await newPc.setLocalDescription(offer);

            socket.emit("callUser", {
                from: currentUser.id,
                to: userId,
                signal: newPc.localDescription,
                callerUsername: currentUser.username,
                callerProfilePicture: currentUser.profile_picture_url,
            });
        } catch (err) {
            console.error("[WebRTC] handleOutgoingCall error:", err);
            cleanupCall();
            setIsVideoModalOpen(false);
            setCallParticipantId(null);
        }
    };

    // ─── CALLEE: accept incoming call ────────────────────────────────────────
    const handleAcceptCall = async () => {
        if (!incomingCall) return;

        setRemoteCallInfo({
            username: incomingCall.callerUsername,
            profilePicture: incomingCall.callerProfilePicture,
        });
        setCallParticipantId(incomingCall.from);
        setIsVideoModalOpen(true);

        const newPc = createPc(incomingCall.from);
        pcRef.current = newPc;
        setPc(newPc);

        // Capture the incoming signal before clearing state
        const incomingSignal = incomingCall.signal;
        const callerId = incomingCall.from;
        setIncomingCall(null);

        try {
            const stream = await getLocalStream();
            setLocalStream(stream);
            stream.getTracks().forEach((track: any) => newPc.addTrack(track, stream));

            await newPc.setRemoteDescription(new RTCSessionDescription(incomingSignal));
            await flushPendingCandidates(newPc);

            const answer = await newPc.createAnswer();
            await newPc.setLocalDescription(answer);

            socket.emit("answerCall", {
                to: callerId,
                signal: newPc.localDescription,
            });
        } catch (err) {
            console.error("[WebRTC] handleAcceptCall error:", err);
            cleanupCall();
            setIsVideoModalOpen(false);
            setCallParticipantId(null);
        }
    };

    // ─── Reject incoming call ─────────────────────────────────────────────────
    const handleRejectCall = () => {
        if (incomingCall) socket.emit("endCall", { to: incomingCall.from });
        setIncomingCall(null);
    };

    // ─── End active call ──────────────────────────────────────────────────────
    const handleEndCall = () => {
        if (callParticipantId) {
            socket.emit("endCall", { to: callParticipantId });
        }
        cleanupCall();
        setIsVideoModalOpen(false);
        setCallParticipantId(null);
        setRemoteCallInfo(null);
    };

    const currentUser = currentUserRef.current;
    if (!authChecked) return null;

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <SafeAreaProvider>
                <StatusBar barStyle={colors.isDark ? "light-content" : "dark-content"} backgroundColor="transparent" translucent />

                {/* Upload progress bar */}
                {postUploading && (
                    <View style={styles.uploadBar}>
                        <Animated.View
                            style={[
                                styles.uploadBarInner,
                                {
                                    transform: [
                                        {
                                            translateX: uploadProgress.interpolate({
                                                inputRange: [0, 1],
                                                outputRange: [-150, 300],
                                            }),
                                        },
                                    ],
                                },
                            ]}
                        />
                    </View>
                )}

                {!isAuthRoute && (
                    <View style={{ paddingTop: insets.top, backgroundColor: colors.surface }}>
                        <MobileTopBar unreadNotificationsCount={unreadNotificationsCount} />
                    </View>
                )}

                {/* Main screens */}
                <Stack screenOptions={{ headerShown: false }}>
                    <Stack.Screen name="home" />
                    <Stack.Screen name="login" />
                    <Stack.Screen name="register" />
                </Stack>

                {/* Nav bar — only show on non-auth routes */}
                {!isAuthRoute && (
                    <NavBar
                        unreadMessagesCount={unreadMessagesCount}
                        unreadNotificationsCount={unreadNotificationsCount}
                        setUnreadMessagesCount={setUnreadMessagesCount}
                        onlineUsers={onlineUsers}
                        selectedUser={selectedUser}
                        setSelectedUser={setSelectedUser}
                        onVideoCall={(userId: number) => handleOutgoingCall(userId)}
                    />
                )}

                {/* ── Incoming call bottom sheet ── */}
                <Modal visible={!!incomingCall} transparent animationType="slide">
                    <View style={styles.callBackdrop}>
                        <View style={{ flex: 1 }} />
                        <View style={[styles.callCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                            <View style={[styles.dragHandle, { backgroundColor: colors.border }]} />

                            <Text style={[styles.incomingLabel, { color: colors.textSecondary }]}>Incoming video call</Text>

                            <PulsingAvatar uri={incomingCall?.callerProfilePicture} fallback={require("../assets/profile_blank.png")} />

                            <Text style={[styles.callerName, { color: colors.textPrimary }]}>{incomingCall?.callerUsername}</Text>

                            <View style={styles.callActions}>
                                {/* Reject */}
                                <View style={styles.callBtnWrap}>
                                    <TouchableOpacity style={[styles.callBtn, styles.rejectBtn]} onPress={handleRejectCall} activeOpacity={0.8}>
                                        <MaterialIcons name="call-end" size={28} color="#fff" />
                                    </TouchableOpacity>
                                    <Text style={[styles.callBtnLabel, { color: colors.textSecondary }]}>Decline</Text>
                                </View>

                                {/* Accept */}
                                <View style={styles.callBtnWrap}>
                                    <TouchableOpacity style={[styles.callBtn, styles.acceptBtn]} onPress={handleAcceptCall} activeOpacity={0.8}>
                                        <Ionicons name="videocam" size={26} color="#fff" />
                                    </TouchableOpacity>
                                    <Text style={[styles.callBtnLabel, { color: colors.textSecondary }]}>Accept</Text>
                                </View>
                            </View>
                        </View>
                    </View>
                </Modal>

                {/* ── Active video call modal ── */}
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
                    remoteUsername={remoteCallInfo?.username ?? selectedUser?.username ?? "Remote"}
                    remoteProfilePicture={remoteCallInfo?.profilePicture ?? selectedUser?.profile_picture ?? undefined}
                />
            </SafeAreaProvider>
        </GestureHandlerRootView>
    );
}

const styles = StyleSheet.create({
    callBackdrop: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.5)",
        justifyContent: "flex-end",
    },
    callCard: {
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        borderWidth: 0.5,
        paddingTop: 12,
        paddingBottom: 44,
        paddingHorizontal: 24,
        alignItems: "center",
        gap: 8,
    },
    dragHandle: {
        width: 36,
        height: 4,
        borderRadius: 2,
        marginBottom: 16,
    },
    incomingLabel: {
        fontSize: 13,
        letterSpacing: 0.3,
        marginBottom: 20,
    },
    avatarWrap: {
        width: 100,
        height: 100,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 16,
    },
    pulseRing: {
        position: "absolute",
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: "#4caf50",
    },
    callerAvatar: {
        width: 90,
        height: 90,
        borderRadius: 45,
    },
    callerName: {
        fontSize: 22,
        fontWeight: "600",
        marginBottom: 32,
    },
    callActions: {
        flexDirection: "row",
        gap: 48,
        marginTop: 8,
    },
    callBtnWrap: {
        alignItems: "center",
        gap: 10,
    },
    callBtn: {
        width: 64,
        height: 64,
        borderRadius: 32,
        alignItems: "center",
        justifyContent: "center",
    },
    acceptBtn: { backgroundColor: "#4caf50" },
    rejectBtn: { backgroundColor: "#e53935" },
    callBtnLabel: {
        fontSize: 13,
        fontWeight: "500",
    },
    uploadBar: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: 3,
        zIndex: 1000,
        overflow: "hidden",
    },
    uploadBarInner: {
        position: "absolute",
        top: 0,
        bottom: 0,
        width: 150,
        backgroundColor: "#7a60ff",
    },
    callBtnText: { color: "#fff", fontWeight: "600", fontSize: 15 },
});
