import { useEffect, useRef, useState } from "react";
import { Stack, useRouter, usePathname } from "expo-router";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Animated,
} from "react-native";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "react-native";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";

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

function PulsingAvatar({
  uri,
  fallback,
}: {
  uri?: string | null;
  fallback: any;
}) {
  const ring1 = useRef(new Animated.Value(1)).current;
  const ring2 = useRef(new Animated.Value(1)).current;
  const op1 = useRef(new Animated.Value(0.6)).current;
  const op2 = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const pulse = (
      scale: Animated.Value,
      opacity: Animated.Value,
      delay: number,
    ) =>
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
      <Animated.View
        style={[
          styles.pulseRing,
          { transform: [{ scale: ring1 }], opacity: op1 },
        ]}
      />
      <Animated.View
        style={[
          styles.pulseRing,
          { transform: [{ scale: ring2 }], opacity: op2 },
        ]}
      />
      <Image source={uri ? { uri } : fallback} style={styles.callerAvatar} />
    </View>
  );
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
  const [pc, setPc] = useState<any>(null);
  const [localStream, setLocalStream] = useState<any>(null);
  const [remoteStream, setRemoteStream] = useState<any>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [callParticipantId, setCallParticipantId] = useState<number | null>(
    null,
  );
  const [incomingCall, setIncomingCall] = useState<{
    from: number;
    signal: any;
    callerUsername: string;
    callerProfilePicture: string;
  } | null>(null);

  const pendingCandidates = useRef<any[]>([]);
  const uploadProgress = useRef(new Animated.Value(0)).current;

  const isAuthRoute = AUTH_ROUTES.some((r) => pathname.startsWith(r));

  const handleOpenVideoCall = (userId: number) => {
    setCallParticipantId(userId);
    setIsVideoModalOpen(true);
  };

  const [remoteCallInfo, setRemoteCallInfo] = useState<{
    username: string;
    profilePicture?: string;
  } | null>(null);

  // ── Auth guard ──
  useEffect(() => {
    const checkAuth = async () => {
      const raw = await AsyncStorage.getItem("user");
      const token = await AsyncStorage.getItem("token");
      currentUserRef.current = raw ? JSON.parse(raw) : null;

      await loadUser(); // ← move this BEFORE the redirects
      setAuthChecked(true);

      if ((!raw || !token) && !isAuthRoute) {
        router.replace("/login");
      } else if (raw && token && isAuthRoute) {
        router.replace("/home"); // ← changed from "/"
      }
    };
    checkAuth();
  }, []);

  useEffect(() => {
    setOnVideoCall((userId: number) => {
      setCallParticipantId(userId);
      setIsVideoModalOpen(true);
    });
    return () => setOnVideoCall(null);
  }, []);

  useEffect(() => {
    if (!user) return;
    const handler = (data: any) => {
      // Increment count when a new notification is pushed
      setUnreadNotificationsCount((prev) => (prev ?? 0) + 1);
    };
    socket.on("newNotification", handler);
    return () => {
      socket.off("newNotification", handler);
    };
  }, [user]);

  // ── Animate upload bar ──
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
    const handler = () => {
      console.log("Notification Received");

      const current = useGlobalStore.getState().unreadNotificationsCount ?? 0;
      setUnreadNotificationsCount(current + 1);
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
    return () => {
      socket.off("endCall", handler);
    };
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
    setRemoteCallInfo(null); // ← add this
    setPc(null);
    setLocalStream(null);
    setRemoteStream(null);
  };

  const currentUser = currentUserRef.current;

  if (!authChecked) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar
          barStyle={colors.isDark ? "light-content" : "dark-content"}
          backgroundColor="transparent"
          translucent
        />
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
          <View
            style={{ paddingTop: insets.top, backgroundColor: colors.surface }}
          >
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
            onVideoCall={handleOpenVideoCall}
          />
        )}
        {/* Incoming call modal */}
        <Modal visible={!!incomingCall} transparent animationType="slide">
          <View style={styles.callBackdrop}>
            {/* Blurred/dimmed tap-to-dismiss area */}
            <View style={{ flex: 1 }} />

            <View
              style={[
                styles.callCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              {/* Drag handle */}
              <View
                style={[styles.dragHandle, { backgroundColor: colors.border }]}
              />

              {/* Caller info */}
              <Text
                style={[styles.incomingLabel, { color: colors.textSecondary }]}
              >
                Incoming video call
              </Text>

              {/* Pulsing avatar */}
              <PulsingAvatar
                uri={incomingCall?.callerProfilePicture}
                fallback={require("../assets/profile_blank.png")}
              />

              <Text style={[styles.callerName, { color: colors.textPrimary }]}>
                {incomingCall?.callerUsername}
              </Text>

              {/* Action buttons */}
              <View style={styles.callActions}>
                {/* Reject */}
                <View style={styles.callBtnWrap}>
                  <TouchableOpacity
                    style={[styles.callBtn, styles.rejectBtn]}
                    onPress={handleRejectCall}
                    activeOpacity={0.8}
                  >
                    <MaterialIcons name="call-end" size={28} color="#fff" />
                  </TouchableOpacity>
                  <Text
                    style={[
                      styles.callBtnLabel,
                      { color: colors.textSecondary },
                    ]}
                  >
                    Decline
                  </Text>
                </View>

                {/* Accept */}
                <View style={styles.callBtnWrap}>
                  <TouchableOpacity
                    style={[styles.callBtn, styles.acceptBtn]}
                    onPress={() => {
                      if (!incomingCall) return;
                      setRemoteCallInfo({
                        username: incomingCall.callerUsername,
                        profilePicture: incomingCall.callerProfilePicture,
                      });
                      setCallParticipantId(incomingCall.from);
                      setIsVideoModalOpen(true);
                      setIncomingCall(null);
                    }}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="videocam" size={26} color="#fff" />
                  </TouchableOpacity>
                  <Text
                    style={[
                      styles.callBtnLabel,
                      { color: colors.textSecondary },
                    ]}
                  >
                    Accept
                  </Text>
                </View>
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
          remoteUsername={
            remoteCallInfo?.username ?? selectedUser?.username ?? "Remote"
          }
          remoteProfilePicture={
            remoteCallInfo?.profilePicture ??
            selectedUser?.profile_picture ??
            undefined
          }
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
    paddingBottom: 44, // accounts for home indicator
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
  // Remove callerSub since we moved it to incomingLabel
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
