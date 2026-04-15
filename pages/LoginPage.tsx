import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Animated,
  Image,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { loginUser } from "../services/api";
import { useGlobalStore } from "../store/store";
import socket from "../services/socket";

const { width: SW, height: SH } = Dimensions.get("window");

const WARM = "#f4a96a";
const ROSE = "#e05c7e";
const BG = "#0e0a08";

const PHOTOS = [
  "https://plus.unsplash.com/premium_photo-1683143646126-df3a3f3739f3?q=80&w=687&auto=format&fit=crop",
  "https://plus.unsplash.com/premium_photo-1682401101972-5dc0756ece88?q=80&w=687&auto=format&fit=crop",
  "https://plus.unsplash.com/premium_photo-1663051303500-c85bef3f05f6?q=80&w=687&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?q=80&w=687&auto=format&fit=crop",
];

// ── Staggered fade-in ──────────────────────────────────────────────────────────
function useFadeIn(delay: number) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(16)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 450,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 450,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);
  return { opacity, transform: [{ translateY }] };
}

export default function LoginPage() {
  const router = useRouter();
  const { setUser } = useGlobalStore();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const a0 = useFadeIn(80);
  const a1 = useFadeIn(160);
  const a2 = useFadeIn(240);
  const a3 = useFadeIn(320);
  const a4 = useFadeIn(400);
  const a5 = useFadeIn(480);
  const a6 = useFadeIn(560);

  const errorOpacity = useRef(new Animated.Value(0)).current;
  const errorHeight = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (error) {
      Animated.parallel([
        Animated.timing(errorOpacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: false,
        }),
        Animated.timing(errorHeight, {
          toValue: 64,
          duration: 250,
          useNativeDriver: false,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(errorOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: false,
        }),
        Animated.timing(errorHeight, {
          toValue: 0,
          duration: 200,
          useNativeDriver: false,
        }),
      ]).start();
    }
  }, [error]);

  const handleLogin = async () => {
    if (!email || !password) return;
    setError(null);
    setLoading(true);
    try {
      const response = await loginUser({ email, password });
      if (response.success) {
        const { token, user } = response.data;
        await AsyncStorage.setItem("token", token);
        await AsyncStorage.setItem("user", JSON.stringify(user));
        socket.emit("registerUser", user.id);
        await setUser(user);
        router.replace("/");
      } else {
        setError(response.error || "Login failed.");
        setLoading(false);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || "Login failed.");
      setLoading(false);
    }
  };

  // Replace KeyboardAvoidingView + ScrollView with:
  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.container}>
        {/* ── Photo collage ── */}
        <View style={styles.photoBg}>
          <View style={styles.photoCol1}>
            <Image
              source={{ uri: PHOTOS[0] }}
              style={styles.photoTall}
              resizeMode="cover"
            />
          </View>
          <View style={styles.photoCol2}>
            <Image
              source={{ uri: PHOTOS[1] }}
              style={styles.photoShort}
              resizeMode="cover"
            />
            <Image
              source={{ uri: PHOTOS[2] }}
              style={styles.photoShort}
              resizeMode="cover"
            />
          </View>
        </View>
        <View style={styles.photoBottomOverlay} />

        {/* ── Form panel ── */}
        <View style={styles.panel}>
          {/* Logo */}
          <Animated.View style={[styles.logoRow, a0]}>
            <Image
              source={require("../assets/logo-transparent.png")}
              style={styles.logoImage}
              resizeMode="contain"
            />
            <Text style={styles.logoName}>Ripple</Text>
          </Animated.View>

          {/* Greeting */}
          <Animated.View style={a1}>
            <Text style={styles.greeting}>Welcome back</Text>
            <Text style={styles.headline}>
              Sign in to your{"\n"}
              <Text style={styles.headlineEm}>world.</Text>
            </Text>
            <Text style={styles.subtext}>
              Your feed, your stories, your people — all waiting.
            </Text>
          </Animated.View>

          {/* Social proof */}
          <Animated.View style={[styles.socialRow, a2]}>
            <View style={styles.avatarStack}>
              {[
                { l: "A", bg: "#f4a96a" },
                { l: "J", bg: "#e05c7e" },
                { l: "M", bg: "#c47a5a" },
              ].map((item, i) => (
                <View
                  key={item.l}
                  style={[
                    styles.socialAvatar,
                    { marginLeft: i === 0 ? 0 : -8, backgroundColor: item.bg },
                  ]}
                >
                  <Text style={styles.socialAvatarText}>{item.l}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.socialText}>
              <Text style={styles.socialTextBold}>2.4M people</Text> shared
              moments today
            </Text>
          </Animated.View>

          {/* Error */}
          <Animated.View
            style={{
              opacity: errorOpacity,
              height: errorHeight,
              overflow: "hidden",
            }}
          >
            <View style={styles.errorBox}>
              <Text style={styles.errorIcon}>⚠</Text>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          </Animated.View>

          {/* Fields */}
          <Animated.View style={a3}>
            <Text style={styles.fieldLabel}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="you@example.com"
              placeholderTextColor="rgba(255,255,255,0.18)"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              keyboardAppearance="dark"
            />
            <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor="rgba(255,255,255,0.18)"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              keyboardAppearance="dark"
            />
          </Animated.View>

          {/* Forgot + Sign in */}
          <Animated.View style={[styles.actionRow, a4]}>
            <TouchableOpacity
              onPress={() => router.push("/reset-password")}
              activeOpacity={0.7}
            >
              <Text style={styles.forgotText}>Forgot password?</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleLogin}
              disabled={loading || !email || !password}
              activeOpacity={0.85}
              style={[
                styles.loginBtn,
                (!email || !password) && styles.loginBtnDisabled,
              ]}
            >
              {loading ? (
                <ActivityIndicator size={18} color="#fff" />
              ) : (
                <Text style={styles.loginBtnText}>Sign in →</Text>
              )}
            </TouchableOpacity>
          </Animated.View>

          {/* Divider */}
          <Animated.View style={[styles.divider, a5]}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>New to Ripple?</Text>
            <View style={styles.dividerLine} />
          </Animated.View>

          {/* Footer */}
          <Animated.View style={[styles.footer, a6]}>
            <TouchableOpacity
              onPress={() => router.push("/register")}
              activeOpacity={0.7}
            >
              <Text style={styles.footerLink}>Create your account</Text>
            </TouchableOpacity>
            <Text style={styles.footerDot}> · </Text>
            <TouchableOpacity activeOpacity={0.7}>
              <Text style={styles.footerMuted}>About Ripple</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  scroll: { flexGrow: 1 },
  container: { flex: 1 },
  // ── Photo collage ──
  photoBg: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: SH * 0.42, // ← slightly taller
    flexDirection: "row",
    gap: 6,
    padding: 12,
    opacity: 0.6,
  },
  photoCol1: { flex: 1 },
  photoCol2: { flex: 1, gap: 6 },
  photoTall: { flex: 1, borderRadius: 14 },
  photoShort: { flex: 1, borderRadius: 14 },
  photoBottom: {
    position: "absolute",
    top: SH * 0.28,
    left: 0,
    right: 0,
    height: SH * 0.16,
    opacity: 0.25,
  },

  photoOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: SH * 0.45,
    // Fade from transparent to BG
    backgroundColor: "transparent",
  },
  photoBottomOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: SH * 0.52,
    backgroundColor: BG,
    opacity: 0.7,
  },

  // ── Panel ──
  panel: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: SH * 0.28, // ← sits below photos
    paddingBottom: 32,
    justifyContent: "flex-end", // ← pushes content to bottom half
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 28,
  }, // ← was 40
  subtext: {
    fontSize: 13.5,
    color: "rgba(255,255,255,0.38)",
    fontWeight: "300",
    lineHeight: 20,
    marginBottom: 8,
  }, // ← was 28
  socialRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 18,
  }, // ← was 28
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 18,
    marginBottom: 20,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 16,
  },
  input: {
    height: 48,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 14,
    paddingHorizontal: 18,
    fontSize: 15,
    color: "#fff",
  },
  loginBtn: {
    height: 48,
    paddingHorizontal: 24,
    borderRadius: 14,
    backgroundColor: ROSE,
    alignItems: "center",
    justifyContent: "center",
  },
  logoMark: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: WARM,
    alignItems: "center",
    justifyContent: "center",
  },
  logoName: {
    fontFamily: "MomoSignature", // ← matches the key in useFonts
    fontWeight: "400",
    fontSize: 18, // signature fonts usually need to be larger
    color: "#ffffff",
    letterSpacing: 0,
  },
  logoImage: {
    width: 42,
    height: 42,
    borderRadius: 14,
  },

  // Greeting
  greeting: {
    fontSize: 12,
    fontWeight: "500",
    letterSpacing: 1.5,
    color: "#e07a60",
    textTransform: "uppercase",
    marginBottom: 6,
  },
  headline: {
    fontSize: 34,
    fontWeight: "300",
    color: "#fff",
    lineHeight: 42,
    letterSpacing: -0.5,
    marginBottom: 10,
  },
  headlineEm: { fontStyle: "italic", color: "#f5b88a" },
  avatarStack: { flexDirection: "row" },
  socialAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: BG,
  },
  socialAvatarText: { color: "#fff", fontSize: 10, fontWeight: "600" },
  socialText: {
    fontSize: 12.5,
    color: "rgba(255,255,255,0.32)",
    fontWeight: "300",
  },
  socialTextBold: { color: "rgba(255,255,255,0.6)", fontWeight: "500" },

  // Error
  errorBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "rgba(220,80,80,0.08)",
    borderWidth: 1,
    borderColor: "rgba(220,80,80,0.2)",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  errorIcon: { fontSize: 14, color: "#f9a8a8" },
  errorText: { fontSize: 13.5, color: "#f9a8a8", flex: 1, lineHeight: 20 },

  // Fields
  fieldLabel: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1,
    color: "rgba(255,255,255,0.3)",
    textTransform: "uppercase",
    marginBottom: 8,
  },
  forgotText: { fontSize: 13, color: "rgba(255,255,255,0.3)" },
  loginBtnDisabled: { opacity: 0.3 },
  loginBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  dividerText: { fontSize: 12, color: "rgba(255,255,255,0.22)" },

  // Footer
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  footerLink: { color: WARM, fontWeight: "500", fontSize: 14 },
  footerDot: { color: "rgba(255,255,255,0.25)", marginHorizontal: 4 },
  footerMuted: { color: "rgba(255,255,255,0.22)", fontSize: 14 },
});
