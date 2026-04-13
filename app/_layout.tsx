// app/_layout.tsx
import { useEffect, useRef, useState } from "react";
import { Stack, useRouter, usePathname } from "expo-router";
import { View, Text, Image, TouchableOpacity, Modal, StyleSheet, Animated } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import socket from "../services/socket";
import { getNotificationsCount } from "../services/api";
import { useGlobalStore } from "../store/store";
import { useThemeColors } from "../hooks/useThemeColors";
import VideoCallModal from "../components/VideoCallModal";
import NavBar from "../components/navbar/NavBar";

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

    const currentUserRef = useRef<any>(null);
    const { user, unreadNotificationsCount, setUnreadNotificationsCount, unreadMessagesCount, setUnreadMessagesCount, postUploading } =
        useGlobalStore();

    const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
    const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
    const [pc, setPc] = useState<RTCPeerConnection | null>(null);
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [callParticipantId, setCallParticipantId] = useState<number | null>(null);
    const [incomingCall, setIncomingCall] = useState<{
        from: number;
        signal: RTCSessionDescriptionInit;
        callerUsername: string;
        callerProfilePicture: string;
    } | null>(null);

    const pendingCandidates = useRef<RTCIceCandidateInit[]>([]);
    const uploadProgress = useRef(new Animated.Value(0)).current;

    // ── Load current user from AsyncStorage ──
    useEffect(() => {
        const load = async () => {
            const raw = await AsyncStorage.getItem("user");
            currentUserRef.current = raw ? JSON.parse(raw) : null;
        };
        load();
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

    const iceServers = {
        iceServers: [
            { urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"] },
            { urls: "turn:relay1.expressturn.com:3478", username: "efBWO11LZUDOHPDC84", credential: "y0Da1Uz9asLPxFpC" },
        ],
        iceCandidatePoolSize: 10,
    };

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
        return () => {
            socket.off("onlineUsers");
        };
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
        return () => {
            socket.off("unreadCountResponse", handler);
        };
    }, [user]);

    // ── Incoming call ──
    useEffect(() => {
        const handler = (data: any) => setIncomingCall(data);
        socket.on("callReceived", handler);
        return () => {
            socket.off("callReceived", handler);
        };
    }, []);

    // ── ICE candidates ──
    useEffect(() => {
        const handler = (data: { candidate: RTCIceCandidateInit }) => {
            if (pc?.remoteDescription) {
                pc.addIceCandidate(new RTCIceCandidate(data.candidate)).catch(console.error);
            } else {
                pendingCandidates.current.push(data.candidate);
            }
        };
        socket.on("iceCandidateReceived", handler);
        return () => {
            socket.off("iceCandidateReceived", handler);
        };
    }, [pc]);

    // ── Call answered ──
    useEffect(() => {
        socket.on("callAnswered", async (data: { signal: RTCSessionDescriptionInit }) => {
            if (!pc) return;
            await pc.setRemoteDescription(new RTCSessionDescription(data.signal));
            pendingCandidates.current.forEach((c) => pc.addIceCandidate(new RTCIceCandidate(c)).catch(console.error));
            pendingCandidates.current = [];
        });
        return () => {
            socket.off("callAnswered");
        };
    }, [pc]);

    // ── End call received ──
    useEffect(() => {
        const handler = () => {
            setIsVideoModalOpen(false);
            setCallParticipantId(null);
            pc?.close();
            setPc(null);
            localStream?.getTracks().forEach((t) => t.stop());
            setLocalStream(null);
            setRemoteStream(null);
        };
        socket.on("endCall", handler);
        return () => {
            socket.off("endCall", handler);
        };
    }, [pc, localStream]);

    const handleAcceptCall = async () => {
        if (!incomingCall) return;
        setCallParticipantId(incomingCall.from);
        setIsVideoModalOpen(true);
        const newPc = new RTCPeerConnection(iceServers);
        setPc(newPc);
        newPc.ontrack = (e) => setRemoteStream(e.streams[0]);
        newPc.onicecandidate = (e) => {
            if (e.candidate) socket.emit("iceCandidate", { to: incomingCall.from, candidate: e.candidate });
        };
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            setLocalStream(stream);
            stream.getTracks().forEach((t) => newPc.addTrack(t, stream));
        } catch (err) {
            console.error(err);
        }
        await newPc.setRemoteDescription(new RTCSessionDescription(incomingCall.signal));
        pendingCandidates.current.forEach((c) => newPc.addIceCandidate(new RTCIceCandidate(c)).catch(console.error));
        pendingCandidates.current = [];
        const answer = await newPc.createAnswer();
        await newPc.setLocalDescription(answer);
        socket.emit("answerCall", { to: incomingCall.from, signal: newPc.localDescription });
        setIncomingCall(null);
    };

    const handleRejectCall = () => {
        if (incomingCall) socket.emit("endCall", { to: incomingCall.from });
        setIncomingCall(null);
    };

    const handleEndCall = () => {
        if (callParticipantId) {
            socket.emit("endCall", { to: callParticipantId });
            localStream?.getTracks().forEach((t) => t.stop());
            remoteStream?.getTracks().forEach((t) => t.stop());
            pc?.close();
            setPc(null);
            setLocalStream(null);
            setRemoteStream(null);
            setCallParticipantId(null);
        }
        setIsVideoModalOpen(false);
    };

    const currentUser = currentUserRef.current;

    return (
        <SafeAreaProvider>
            {/* Upload progress bar */}
            {postUploading && (
                <View style={styles.uploadBar}>
                    <Animated.View
                        style={[
                            styles.uploadBarInner,
                            {
                                transform: [{ translateX: uploadProgress.interpolate({ inputRange: [0, 1], outputRange: [-300, 300] }) }],
                            },
                        ]}
                    />
                </View>
            )}

            {/* Main screens */}
            <Stack screenOptions={{ headerShown: false }} />

            {/* Bottom / side nav */}
            <NavBar
                unreadMessagesCount={unreadMessagesCount}
                unreadNotificationsCount={unreadNotificationsCount}
                setUnreadMessagesCount={setUnreadMessagesCount}
                onlineUsers={onlineUsers}
                selectedUser={selectedUser}
                setSelectedUser={setSelectedUser}
            />

            {/* Incoming call modal */}
            <Modal visible={!!incomingCall} transparent animationType="fade">
                <View style={styles.callBackdrop}>
                    <View style={[styles.callCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <Image
                            source={
                                incomingCall?.callerProfilePicture
                                    ? { uri: incomingCall.callerProfilePicture }
                                    : require("../static/profile_blank.png")
                            }
                            style={styles.callerAvatar}
                        />
                        <Text style={[styles.callerName, { color: colors.textPrimary }]}>{incomingCall?.callerUsername}</Text>
                        <Text style={[styles.callerSub, { color: colors.textSecondary }]}>is calling you</Text>
                        <View style={styles.callActions}>
                            <TouchableOpacity style={[styles.callBtn, styles.acceptBtn]} onPress={handleAcceptCall}>
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
    );
}

const styles = StyleSheet.create({
    uploadBar: { position: "absolute", top: 0, left: 0, right: 0, height: 3, zIndex: 1000, overflow: "hidden" },
    uploadBarInner: { position: "absolute", top: 0, bottom: 0, width: 150, background: "linear-gradient(90deg, #7a60ff, #ff8800)" },
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
