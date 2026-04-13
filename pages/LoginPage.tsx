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
    Alert,
} from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { loginUser } from "../services/api";
import { useGlobalStore } from "../store/store";
import socket from "../services/socket";

const WARM = "#f4a96a";
const ROSE = "#e05c7e";
const BG = "#0e0a08";

// Staggered fade-in
function useFadeIn(delay: number) {
    const opacity = useRef(new Animated.Value(0)).current;
    const translateY = useRef(new Animated.Value(16)).current;
    useEffect(() => {
        Animated.parallel([
            Animated.timing(opacity, { toValue: 1, duration: 450, delay, useNativeDriver: true }),
            Animated.timing(translateY, { toValue: 0, duration: 450, delay, useNativeDriver: true }),
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

    const errorOpacity = useRef(new Animated.Value(0)).current;
    const errorHeight = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (error) {
            Animated.parallel([
                Animated.timing(errorOpacity, { toValue: 1, duration: 250, useNativeDriver: false }),
                Animated.timing(errorHeight, { toValue: 60, duration: 250, useNativeDriver: false }),
            ]).start();
        } else {
            Animated.parallel([
                Animated.timing(errorOpacity, { toValue: 0, duration: 200, useNativeDriver: false }),
                Animated.timing(errorHeight, { toValue: 0, duration: 200, useNativeDriver: false }),
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

    return (
        <KeyboardAvoidingView
            style={styles.root}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
            <ScrollView
                contentContainerStyle={styles.scroll}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                {/* ── Photo collage background ── */}
                <View style={styles.photoBg}>
                    <View style={[styles.photoCard, { backgroundColor: "#f5c07a" }]} />
                    <View style={[styles.photoCard, { backgroundColor: "#d4756b" }]} />
                    <View style={[styles.photoCard, { backgroundColor: "#e8a87c", flex: 1.5 }]} />
                    <View style={[styles.photoCard, { backgroundColor: "#c87b8a" }]} />
                </View>
                <View style={styles.photoBgOverlay} />

                <View style={styles.panel}>
                    {/* Logo */}
                    <Animated.View style={[styles.logoRow, a0]}>
                        <View style={styles.logoMark}>
                            <Text style={styles.logoMarkText}>R</Text>
                        </View>
                        <Text style={styles.logoName}>Ripple</Text>
                    </Animated.View>

                    {/* Greeting */}
                    <Animated.View style={a1}>
                        <Text style={styles.greeting}>Welcome back</Text>
                        <Text style={styles.headline}>Sign in to your{"\n"}<Text style={styles.headlineEm}>world.</Text></Text>
                        <Text style={styles.subtext}>Your feed, your stories, your people — all waiting.</Text>
                    </Animated.View>

                    {/* Social proof */}
                    <Animated.View style={[styles.socialRow, a2]}>
                        <View style={styles.avatarStack}>
                            {["A", "J", "M"].map((l, i) => (
                                <View key={l} style={[styles.socialAvatar, { marginLeft: i === 0 ? 0 : -8 }]}>
                                    <Text style={styles.socialAvatarText}>{l}</Text>
                                </View>
                            ))}
                        </View>
                        <Text style={styles.socialText}>
                            <Text style={styles.socialTextBold}>2.4M people</Text> shared moments today
                        </Text>
                    </Animated.View>

                    {/* Error */}
                    <Animated.View style={{ opacity: errorOpacity, height: errorHeight, overflow: "hidden" }}>
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
                            autoComplete="email"
                        />

                        <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Password</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="••••••••"
                            placeholderTextColor="rgba(255,255,255,0.18)"
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry
                            autoComplete="current-password"
                        />
                    </Animated.View>

                    {/* Row: forgot + submit */}
                    <Animated.View style={[styles.actionRow, a4]}>
                        <TouchableOpacity onPress={() => router.push("/reset-password")} activeOpacity={0.7}>
                            <Text style={styles.forgotText}>Forgot password?</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={handleLogin}
                            disabled={loading || !email || !password}
                            activeOpacity={0.85}
                            style={[styles.loginBtn, (!email || !password) && styles.loginBtnDisabled]}
                        >
                            {loading ? (
                                <ActivityIndicator size={18} color="#fff" />
                            ) : (
                                <Text style={styles.loginBtnText}>Sign in →</Text>
                            )}
                        </TouchableOpacity>
                    </Animated.View>

                    {/* Divider */}
                    <View style={styles.divider}>
                        <View style={styles.dividerLine} />
                        <Text style={styles.dividerText}>New to Ripple?</Text>
                        <View style={styles.dividerLine} />
                    </View>

                    {/* Footer */}
                    <View style={styles.footer}>
                        <TouchableOpacity onPress={() => router.push("/register")} activeOpacity={0.7}>
                            <Text style={styles.footerLink}>Create your account</Text>
                        </TouchableOpacity>
                        <Text style={styles.footerDot}> · </Text>
                        <TouchableOpacity activeOpacity={0.7}>
                            <Text style={styles.footerMuted}>About Ripple</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: BG },
    scroll: { flexGrow: 1 },

    // Photo background
    photoBg: { position: "absolute", top: 0, left: 0, right: 0, height: 220, flexDirection: "row", gap: 8, padding: 16, opacity: 0.35 },
    photoCard: { flex: 1, borderRadius: 14 },
    photoBgOverlay: { position: "absolute", top: 0, left: 0, right: 0, height: 260, backgroundColor: "transparent",
        // gradient-like fade
    },

    // Panel
    panel: { flex: 1, paddingHorizontal: 32, paddingTop: 200, paddingBottom: 48 },

    // Logo
    logoRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 44 },
    logoMark: { width: 42, height: 42, borderRadius: 14, backgroundColor: WARM, alignItems: "center", justifyContent: "center" },
    logoMarkText: { color: "#fff", fontSize: 20, fontWeight: "700" },
    logoName: { fontSize: 24, fontWeight: "400", color: "#fff", letterSpacing: -0.3 },

    // Greeting
    greeting: { fontSize: 12, fontWeight: "500", letterSpacing: 1.5, color: "#e07a60", textTransform: "uppercase", marginBottom: 6 },
    headline: { fontSize: 34, fontWeight: "300", color: "#fff", lineHeight: 40, letterSpacing: -0.5, marginBottom: 10 },
    headlineEm: { fontStyle: "italic", color: "#f5b88a" },
    subtext: { fontSize: 14, color: "rgba(255,255,255,0.38)", fontWeight: "300", lineHeight: 22, marginBottom: 28 },

    // Social proof
    socialRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 28 },
    avatarStack: { flexDirection: "row" },
    socialAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: WARM, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: BG },
    socialAvatarText: { color: "#fff", fontSize: 10, fontWeight: "600" },
    socialText: { fontSize: 12.5, color: "rgba(255,255,255,0.32)", fontWeight: "300" },
    socialTextBold: { color: "rgba(255,255,255,0.6)", fontWeight: "500" },

    // Error
    errorBox: { flexDirection: "row", alignItems: "flex-start", gap: 10, backgroundColor: "rgba(220,80,80,0.08)", borderWidth: 1, borderColor: "rgba(220,80,80,0.2)", borderRadius: 12, padding: 12, marginBottom: 16 },
    errorIcon: { fontSize: 14, color: "#f9a8a8" },
    errorText: { fontSize: 13.5, color: "#f9a8a8", flex: 1, lineHeight: 20 },

    // Fields
    fieldLabel: { fontSize: 11, fontWeight: "600", letterSpacing: 1, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", marginBottom: 8 },
    input: { height: 52, backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.08)", borderRadius: 14, paddingHorizontal: 18, fontSize: 15, color: "#fff" },

    // Action row
    actionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 24, marginBottom: 28 },
    forgotText: { fontSize: 13, color: "rgba(255,255,255,0.3)" },
    loginBtn: { height: 52, paddingHorizontal: 28, borderRadius: 14, backgroundColor: ROSE, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
    loginBtnDisabled: { opacity: 0.3 },
    loginBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },

    // Divider
    divider: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 24 },
    dividerLine: { flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.07)" },
    dividerText: { fontSize: 12, color: "rgba(255,255,255,0.22)" },

    // Footer
    footer: { flexDirection: "row", justifyContent: "center", alignItems: "center" },
    footerLink: { color: WARM, fontWeight: "500", fontSize: 14 },
    footerDot: { color: "rgba(255,255,255,0.25)", marginHorizontal: 4 },
    footerMuted: { color: "rgba(255,255,255,0.22)", fontSize: 14 },
});