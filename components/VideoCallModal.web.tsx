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
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const RED = "#c0392b";
const BOTTOM_BAR_HEIGHT = 140;

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

function formatTime(seconds: number): string {
  const m = String(Math.floor(seconds / 60)).padStart(2, "0");
  const s = String(seconds % 60).padStart(2, "0");
  return `${m}:${s}`;
}

function nowTime(): string {
  return new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

// ─── Small reusable control button ───────────────────────────────────────────
function CtrlBtn({
  onPress,
  off = false,
  active = false,
  children,
}: {
  onPress: () => void;
  off?: boolean;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[
        styles.ctrlBtn,
        off && styles.ctrlBtnOff,
        active && styles.ctrlBtnActive,
      ]}
    >
      {children}
    </TouchableOpacity>
  );
}

function CtrlCol({
  label,
  children,
}: {
  label?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.ctrlCol}>
      {children}
      {label ? <Text style={styles.ctrlLbl}>{label}</Text> : null}
    </View>
  );
}

// ─── Avatar placeholder shown when camera is off / stream absent ──────────────
function AvatarPlaceholder({
  profilePicture,
  initials,
  label,
  size = 92,
}: {
  profilePicture?: string;
  initials: string;
  label?: string;
  size?: number;
}) {
  return (
    <View style={styles.placeholderWrap}>
      {profilePicture ? (
        <Image
          source={{ uri: profilePicture }}
          style={[
            styles.placeholderAvatar,
            { width: size, height: size, borderRadius: size / 2 },
          ]}
        />
      ) : (
        <View
          style={[
            styles.placeholderInitials,
            { width: size, height: size, borderRadius: size / 2 },
          ]}
        >
          <Text
            style={[styles.placeholderInitialsText, { fontSize: size * 0.33 }]}
          >
            {initials}
          </Text>
        </View>
      )}
      {label && <Text style={styles.placeholderLabel}>{label}</Text>}
    </View>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
const VideoCallModal: React.FC<VideoCallModalProps> = ({
  open,
  onClose,
  handleEndCall,
  localStream,
  remoteStream,
  localUsername = "You",
  localProfilePicture,
  remoteUsername = "Remote",
  remoteProfilePicture,
}) => {
  const insets = useSafeAreaInsets();
  const { width: SW, height: SH } = Dimensions.get("window");

  const localInitials = getInitials(localUsername);
  const remoteInitials = getInitials(remoteUsername);

  const PIP_W = 100;
  const PIP_H = 140;
  const pipInitX = SW - PIP_W - 16;
  const pipInitY = SH - BOTTOM_BAR_HEIGHT - PIP_H - 16;

  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isSpeaker, setIsSpeaker] = useState(true);
  const [callSeconds, setCallSeconds] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [isSwapped, setIsSwapped] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatText, setChatText] = useState("");

  const toastOpacity = useRef(new Animated.Value(0)).current;
  const chatScrollRef = useRef<ScrollView>(null);
  // Web-only: video element refs for assigning srcObject
  const mainVideoRef = useRef<HTMLVideoElement>(null);
  const pipVideoRef = useRef<HTMLVideoElement>(null);

  const pipX = useRef(new Animated.Value(pipInitX)).current;
  const pipY = useRef(new Animated.Value(pipInitY)).current;

  // ─── PiP drag-to-snap ────────────────────────────────────────────────────
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
        pipY.setValue(
          Math.max(
            insets.top + 60,
            Math.min(SH - BOTTOM_BAR_HEIGHT - PIP_H - 8, g.moveY - PIP_H / 2),
          ),
        );
      },
      onPanResponderRelease: (_, g) => {
        const snapX = g.moveX > SW / 2 ? SW - PIP_W - 16 : 16;
        const snapY =
          g.moveY > (SH - BOTTOM_BAR_HEIGHT) / 2
            ? SH - BOTTOM_BAR_HEIGHT - PIP_H - 16
            : insets.top + 60;
        Animated.parallel([
          Animated.spring(pipX, { toValue: snapX, useNativeDriver: false }),
          Animated.spring(pipY, { toValue: snapY, useNativeDriver: false }),
        ]).start();
      },
    }),
  ).current;

  // ─── Call timer ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) {
      setCallSeconds(0);
      return;
    }
    const t = setInterval(() => setCallSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [open]);

  // ─── Which stream goes in the main pane vs the PiP ───────────────────────
  // Default: remote = main, local = PiP. Swapped = local = main, remote = PiP.
  const mainStream = isSwapped ? localStream : remoteStream;
  const pipStream = isSwapped ? remoteStream : localStream;
  const mainName = isSwapped ? localUsername : remoteUsername;
  const mainPicture = isSwapped ? localProfilePicture : remoteProfilePicture;
  const mainInitials = isSwapped ? localInitials : remoteInitials;
  const pipName = isSwapped ? remoteUsername : localUsername;
  const pipPicture = isSwapped ? remoteProfilePicture : localProfilePicture;
  const pipInitials = isSwapped ? remoteInitials : localInitials;

  // ─── Web: bind streams to <video> srcObject ─────────────────────────────────
  useEffect(() => {
    if (mainVideoRef.current && mainStream) {
      mainVideoRef.current.srcObject = mainStream as unknown as MediaStream;
    }
  }, [mainStream, isSwapped]);

  useEffect(() => {
    if (pipVideoRef.current && pipStream) {
      pipVideoRef.current.srcObject = pipStream as unknown as MediaStream;
    }
  }, [pipStream, isSwapped]);

  // ─── Toast helper ─────────────────────────────────────────────────────────
  const showToast = useCallback(
    (msg: string) => {
      setToast(msg);
      toastOpacity.setValue(1);
      Animated.sequence([
        Animated.delay(1600),
        Animated.timing(toastOpacity, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start(() => setToast(null));
    },
    [toastOpacity],
  );

  // ─── Control handlers ─────────────────────────────────────────────────────
  const toggleMic = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach((t: any) => {
        t.enabled = isMuted; // flip: if currently muted → enable
      });
    }
    setIsMuted((v) => !v);
    showToast(!isMuted ? "Mic muted" : "Mic on");
  };

  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach((t: any) => {
        t.enabled = !isVideoOn; // flip
      });
    }
    setIsVideoOn((v) => !v);
    showToast(!isVideoOn ? "Camera off" : "Camera on");
  };

  const toggleSpk = () => {
    setIsSpeaker((v) => !v);
    showToast(!isSpeaker ? "Earpiece" : "Speaker on");
  };

  const sendMessage = () => {
    const text = chatText.trim();
    if (!text) return;
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now(),
        sender: "You",
        text,
        isSelf: true,
        timestamp: nowTime(),
      },
    ]);
    setChatText("");
    setTimeout(
      () => chatScrollRef.current?.scrollToEnd({ animated: true }),
      100,
    );
  };

  if (!open) return null;

  return (
    <Modal
      visible={open}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.root}>
        {/* ── Main feed (full-screen) ── */}
        {mainStream ? (
          // @ts-ignore — web only
          <video
            ref={mainVideoRef}
            autoPlay
            playsInline
            muted={isSwapped} // mute local feed to avoid echo
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              transform: isSwapped ? "scaleX(-1)" : "none",
            }}
          />
        ) : (
          // No stream yet — show avatar placeholder
          <View style={[StyleSheet.absoluteFill, styles.mainPlaceholderBg]}>
            <AvatarPlaceholder
              profilePicture={mainPicture}
              initials={mainInitials}
              label={`${mainName} · ${isSwapped ? (isVideoOn ? "Camera on" : "Camera off") : "Camera off"}`}
            />
          </View>
        )}

        {/* ── Top bar ── */}
        <View style={[styles.topBar, { top: insets.top + 12 }]}>
          <View style={styles.timerPill}>
            <View style={styles.recDot} />
            <Text style={styles.timerText}>{formatTime(callSeconds)}</Text>
          </View>
          <View style={styles.signalPill}>
            <Ionicons name="cellular" size={12} color="rgba(255,255,255,0.5)" />
          </View>
        </View>

        {/* ── Toast ── */}
        {toast && (
          <Animated.View
            style={[
              styles.toast,
              { opacity: toastOpacity, top: insets.top + 60 },
            ]}
          >
            <Text style={styles.toastText}>{toast}</Text>
          </Animated.View>
        )}

        {/* ── PiP — draggable, tap to swap ── */}
        <Animated.View
          style={[styles.pip, { left: pipX, top: pipY }]}
          {...pipPanResponder.panHandlers}
        >
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={0.9}
            onPress={() => {
              setIsSwapped((v) => !v);
              showToast("Views swapped");
            }}
          >
            {pipStream ? (
              // @ts-ignore — web only
              <video
                ref={pipVideoRef}
                autoPlay
                playsInline
                muted={!isSwapped} // mute local PiP feed
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  transform: !isSwapped ? "scaleX(-1)" : "none",
                }}
              />
            ) : (
              // PiP placeholder when stream not yet available
              <View style={styles.pipInner}>
                {pipPicture ? (
                  <Image
                    source={{ uri: pipPicture }}
                    style={{ width: 42, height: 42, borderRadius: 21 }}
                  />
                ) : (
                  <View style={styles.pipInitials}>
                    <Text style={styles.pipInitialsText}>{pipInitials}</Text>
                  </View>
                )}
                {isMuted && (
                  <View style={styles.pipMicBadge}>
                    <Ionicons name="mic-off" size={9} color="#fff" />
                  </View>
                )}
              </View>
            )}

            {/* Name label — always shown */}
            <View style={styles.pipLabelWrap}>
              <Text style={styles.pipLabelText}>{pipName}</Text>
            </View>
          </TouchableOpacity>
        </Animated.View>

        {/* ── Bottom controls ── */}
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
          <Text style={styles.callerLabel}>{mainName}</Text>
          <View style={styles.ctrlRow}>
            <CtrlCol label={isMuted ? "Unmute" : "Mute"}>
              <CtrlBtn onPress={toggleMic} off={isMuted}>
                <Ionicons
                  name={isMuted ? "mic-off" : "mic"}
                  size={20}
                  color={
                    isMuted ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.8)"
                  }
                />
              </CtrlBtn>
            </CtrlCol>

            <CtrlCol label={isVideoOn ? "Camera" : "Start"}>
              <CtrlBtn onPress={toggleVideo} off={!isVideoOn}>
                <Ionicons
                  name={isVideoOn ? "videocam" : "videocam-off"}
                  size={20}
                  color={
                    !isVideoOn
                      ? "rgba(255,255,255,0.3)"
                      : "rgba(255,255,255,0.8)"
                  }
                />
              </CtrlBtn>
            </CtrlCol>

            <CtrlCol>
              <TouchableOpacity
                onPress={handleEndCall}
                style={styles.endBtn}
                activeOpacity={0.8}
              >
                <MaterialIcons name="call-end" size={24} color="#fff" />
              </TouchableOpacity>
            </CtrlCol>

            <CtrlCol label={isSpeaker ? "Speaker" : "Earpiece"}>
              <CtrlBtn onPress={toggleSpk} active={isSpeaker}>
                <Ionicons
                  name={isSpeaker ? "volume-high" : "volume-low"}
                  size={20}
                  color="rgba(255,255,255,0.8)"
                />
              </CtrlBtn>
            </CtrlCol>

            <CtrlCol label="Chat">
              <CtrlBtn onPress={() => setChatOpen((p) => !p)} active={chatOpen}>
                <Ionicons
                  name="chatbubble-outline"
                  size={18}
                  color="rgba(255,255,255,0.8)"
                />
              </CtrlBtn>
            </CtrlCol>
          </View>
        </View>

        {/* ── Chat panel ── */}
        {chatOpen && (
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={[styles.chatPanel, { bottom: BOTTOM_BAR_HEIGHT }]}
          >
            <View style={styles.chatHeader}>
              <Text style={styles.chatTitle}>Chat</Text>
              <TouchableOpacity onPress={() => setChatOpen(false)}>
                <Ionicons
                  name="close"
                  size={18}
                  color="rgba(255,255,255,0.4)"
                />
              </TouchableOpacity>
            </View>
            <ScrollView
              ref={chatScrollRef}
              style={{ flex: 1 }}
              contentContainerStyle={{ padding: 12, gap: 8 }}
            >
              {messages.map((msg) => (
                <View
                  key={msg.id}
                  style={[
                    styles.bubble,
                    msg.isSelf ? styles.bubbleSelf : styles.bubbleOther,
                  ]}
                >
                  <Text style={styles.bubbleText}>{msg.text}</Text>
                  <Text style={styles.bubbleTime}>{msg.timestamp}</Text>
                </View>
              ))}
            </ScrollView>
            <View style={styles.chatInputRow}>
              <TextInput
                style={styles.chatInput}
                placeholder="Message..."
                placeholderTextColor="rgba(255,255,255,0.2)"
                value={chatText}
                onChangeText={setChatText}
                onSubmitEditing={sendMessage}
                returnKeyType="send"
              />
              <TouchableOpacity
                onPress={sendMessage}
                style={styles.chatSendBtn}
              >
                <Ionicons name="send" size={13} color="rgba(255,255,255,0.6)" />
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        )}
      </View>
    </Modal>
  );
};

export default VideoCallModal;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#111",
  },

  // Main stream placeholder background
  mainPlaceholderBg: {
    backgroundColor: "#141414",
    alignItems: "center",
    justifyContent: "center",
  },

  // Avatar placeholder
  placeholderWrap: {
    alignItems: "center",
    gap: 12,
  },
  placeholderAvatar: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  placeholderInitials: {
    backgroundColor: "#222",
    borderWidth: 1,
    borderColor: "#2e2e2e",
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderInitialsText: {
    fontWeight: "500",
    color: "#666",
  },
  placeholderLabel: {
    fontSize: 13,
    color: "rgba(255,255,255,0.35)",
  },

  // Top bar
  topBar: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    zIndex: 20,
  },
  timerPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.08)",
  },
  recDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.35)",
  },
  timerText: {
    fontSize: 12,
    color: "rgba(255,255,255,0.5)",
    letterSpacing: 0.8,
  },
  signalPill: {
    backgroundColor: "rgba(0,0,0,0.45)",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.08)",
  },

  // Toast
  toast: {
    position: "absolute",
    alignSelf: "center",
    backgroundColor: "rgba(20,20,20,0.92)",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.08)",
    zIndex: 50,
  },
  toastText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
  },

  // PiP
  pip: {
    position: "absolute",
    width: 100,
    height: 140,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "#1c1c1c",
    zIndex: 10,
  },
  pipInner: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  pipInitials: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#2a2a2a",
    alignItems: "center",
    justifyContent: "center",
  },
  pipInitialsText: {
    fontSize: 15,
    fontWeight: "500",
    color: "#777",
  },
  pipMicBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(192,57,43,0.9)",
    borderRadius: 9,
    width: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  pipLabelWrap: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.45)",
    paddingVertical: 4,
  },
  pipLabelText: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 10,
    textAlign: "center",
  },

  // Bottom bar
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: BOTTOM_BAR_HEIGHT,
    zIndex: 10,
    paddingTop: 12,
    backgroundColor: "rgba(10,10,10,0.82)",
    borderTopWidth: 0.5,
    borderTopColor: "rgba(255,255,255,0.06)",
  },
  callerLabel: {
    textAlign: "center",
    fontSize: 12,
    color: "rgba(255,255,255,0.2)",
    marginBottom: 14,
    letterSpacing: 0.1,
  },
  ctrlRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 24,
  },
  ctrlCol: {
    alignItems: "center",
    gap: 6,
  },
  ctrlBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  ctrlBtnOff: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderColor: "rgba(255,255,255,0.06)",
  },
  ctrlBtnActive: {
    backgroundColor: "rgba(255,255,255,0.14)",
    borderColor: "rgba(255,255,255,0.18)",
  },
  ctrlLbl: {
    fontSize: 10,
    color: "rgba(255,255,255,0.22)",
    letterSpacing: 0.1,
  },
  endBtn: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: RED,
    alignItems: "center",
    justifyContent: "center",
  },

  // Chat panel
  chatPanel: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 300,
    backgroundColor: "rgba(14,14,14,0.97)",
    borderTopWidth: 0.5,
    borderTopColor: "rgba(255,255,255,0.07)",
    zIndex: 20,
  },
  chatHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  chatTitle: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 11,
    letterSpacing: 0.8,
  },
  bubble: {
    maxWidth: "78%",
    borderRadius: 12,
    padding: 9,
    marginBottom: 6,
  },
  bubbleSelf: {
    alignSelf: "flex-end",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderBottomRightRadius: 3,
  },
  bubbleOther: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderBottomLeftRadius: 3,
  },
  bubbleText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 13,
    lineHeight: 18,
  },
  bubbleTime: {
    color: "rgba(255,255,255,0.2)",
    fontSize: 10,
    marginTop: 3,
    textAlign: "right",
  },
  chatInputRow: {
    flexDirection: "row",
    gap: 8,
    padding: 10,
    borderTopWidth: 0.5,
    borderTopColor: "rgba(255,255,255,0.06)",
  },
  chatInput: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    color: "#fff",
    fontSize: 13,
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.08)",
  },
  chatSendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
});
