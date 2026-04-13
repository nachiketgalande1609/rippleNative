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
    KeyboardAvoidingView,
    Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { registerUser } from "../services/api";

const WARM = "#f4a96a";
const ROSE = "#e05c7e";
const BG = "#0e0a08";
const GREEN = "#34d399";

// Password strength
function getStrength(pw: string): 0 | 1 | 2 | 3 | 4 {
    if (!pw) return 0;
    let score = 0;
    if (pw.length >= 6) score++;
    if (pw.length >= 10) score++;
    if (/[A-Z]/.test(pw) || /[0-9]/.test(pw)) score++;
    if (/[^a-zA-Z0-9]/.test(pw)) score++;
    return Math.min(score, 4) as 0 | 1 | 2 | 3 | 4;
}

const STRENGTH_COLORS = ["", "#f87171", "#fbbf24", WARM, GREEN];

// Fade-in animation
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

export default function RegisterPage() {
    const router = useRouter();

    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const strength = getStrength(password);
    const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;
    const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword;
    const canSubmit = !loading && !!email && !!username && !!password && !!confirmPassword;

    const a0 = useFadeIn(80);
    const a1 = useFadeIn(160);
    const a2 = useFadeIn(240);
    const a3 = useFadeIn(320);
    const a4 = useFadeIn(400);
    const a5 = useFadeIn(480);

    const alertOpacity = useRef(new Animated.Value(0)).current;
    const alertHeight = useRef(new Animated.Value(0)).current;
    const hasAlert = !!(error || success);

    useEffect(() => {
        if (hasAlert) {
            Animated.parallel([
                Animated.timing(alertOpacity, { toValue: 1, duration: 250, useNativeDriver: false }),
                Animated.timing(alertHeight, { toValue: 64, duration: 250, useNativeDriver: false }),
            ]).start();
        } else {
            Animated.parallel([
                Animated.timing(alertOpacity, { toValue: 0, duration: 200, useNativeDriver: false }),
                Animated.timing(alertHeight, { toValue: 0, duration: 200, useNativeDriver: false }),
            ]).start();
        }
    }, [hasAlert]);

    const handleRegister = async () => {
        setError(null);
        setSuccess(null);
        setLoading(true);

        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
            setError("Only letters, numbers and underscores allowed in username.");
            setLoading(false);
            return;
        }
        if (password !== confirmPassword) {
            setError("Passwords do not match.");
            setLoading(false);
            return;
        }
        if (password.length < 6) {
            setError("Password must be at least 6 characters.");
            setLoading(false);
            return;
        }

        try {
            const response = await registerUser({ email, username, password });
            if (response.success) {
                setSuccess("Account created! Check your email for a verification link.");
                setUsername(""); setEmail(""); setPassword(""); setConfirmPassword("");
            } else {
                setError(response.error || "Registration failed.");
            }
        } catch (err: any) {
            setError(err.response?.data?.error || "Registration failed.");
        } finally {
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
                {/* Background collage */}
                <View style={styles.photoBg}>
                    {["#f5c07a", "#d4756b", "#e8a87c", "#c87b8a", "#f0956a"].map((c, i) => (
                        <View key={i} style={[styles.photoCard, { backgroundColor: c }]} />
                    ))}
                </View>

                <View style={styles.panel}>
                    {/* Logo */}
                    <Animated.View style={[styles.logoRow, a0]}>
                        <View style={styles.logoMark}>
                            <Text style={styles.logoMarkText}>R</Text>
                        </View>
                        <Text style={styles.logoName}>Ripple</Text>
                    </Animated.View>

                    {/* Headline */}
                    <Animated.View style={a1}>
                        <Text style={styles.greeting}>Create account</Text>
                        <Text style={styles.headline}>Your story{"\n"}<Text style={styles.headlineEm}>starts here.</Text></Text>
                        <Text style={styles.subtext}>Join millions sharing life's best moments.</Text>
                    </Animated.View>

                    {/* Alert */}
                    <Animated.View style={{ opacity: alertOpacity, height: alertHeight, overflow: "hidden" }}>
                        <View style={[styles.alertBox, success ? styles.alertSuccess : styles.alertError]}>
                            <Text style={styles.alertIcon}>{success ? "✓" : "⚠"}</Text>
                            <Text style={[styles.alertText, { color: success ? "#6ee7b7" : "#f9a8a8" }]}>
                                {success || error}
                            </Text>
                        </View>
                    </Animated.View>

                    {/* Fields */}
                    <Animated.View style={a2}>
                        {/* Username + Email row */}
                        <View style={styles.fieldRow}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.fieldLabel}>Username</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="john_doe"
                                    placeholderTextColor="rgba(255,255,255,0.18)"
                                    value={username}
                                    onChangeText={setUsername}
                                    autoCapitalize="none"
                                    autoComplete="username"
                                />
                            </View>
                            <View style={{ flex: 1 }}>
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
                            </View>
                        </View>
                    </Animated.View>

                    {/* Password */}
                    <Animated.View style={[{ marginTop: 16 }, a3]}>
                        <Text style={styles.fieldLabel}>Password</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Min. 6 characters"
                            placeholderTextColor="rgba(255,255,255,0.18)"
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry
                            autoComplete="new-password"
                        />
                        {password.length > 0 && (
                            <View style={styles.strengthRow}>
                                {[1, 2, 3, 4].map((seg) => (
                                    <View
                                        key={seg}
                                        style={[
                                            styles.strengthSeg,
                                            { backgroundColor: seg <= strength ? STRENGTH_COLORS[strength] : "rgba(255,255,255,0.07)" },
                                        ]}
                                    />
                                ))}
                            </View>
                        )}
                    </Animated.View>

                    {/* Confirm password */}
                    <Animated.View style={[{ marginTop: 16 }, a3]}>
                        <Text style={styles.fieldLabel}>Confirm Password</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Re-enter password"
                            placeholderTextColor="rgba(255,255,255,0.18)"
                            value={confirmPassword}
                            onChangeText={setConfirmPassword}
                            secureTextEntry
                            autoComplete="new-password"
                        />
                        {passwordsMatch && <Text style={[styles.matchText, { color: GREEN }]}>✓ Passwords match</Text>}
                        {passwordsMismatch && <Text style={[styles.matchText, { color: "#f87171" }]}>✗ Passwords don't match</Text>}
                    </Animated.View>

                    {/* Submit */}
                    <Animated.View style={a4}>
                        <TouchableOpacity
                            onPress={handleRegister}
                            disabled={!canSubmit}
                            activeOpacity={0.85}
                            style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
                        >
                            {loading ? (
                                <ActivityIndicator size={18} color="#fff" />
                            ) : (
                                <Text style={styles.submitBtnText}>Create account →</Text>
                            )}
                        </TouchableOpacity>
                    </Animated.View>

                    {/* Terms */}
                    <Animated.View style={a4}>
                        <Text style={styles.terms}>
                            By signing up you agree to our{" "}
                            <Text style={styles.termsLink}>Terms of Service</Text> and{" "}
                            <Text style={styles.termsLink}>Privacy Policy</Text>.
                        </Text>
                    </Animated.View>

                    {/* Divider */}
                    <Animated.View style={[styles.divider, a5]}>
                        <View style={styles.dividerLine} />
                        <Text style={styles.dividerText}>Have an account?</Text>
                        <View style={styles.dividerLine} />
                    </Animated.View>

                    {/* Footer */}
                    <Animated.View style={[styles.footer, a5]}>
                        <TouchableOpacity onPress={() => router.push("/login")} activeOpacity={0.7}>
                            <Text style={styles.footerLink}>Sign in instead</Text>
                        </TouchableOpacity>
                        <Text style={styles.footerDot}> · </Text>
                        <TouchableOpacity activeOpacity={0.7}>
                            <Text style={styles.footerMuted}>About Ripple</Text>
                        </TouchableOpacity>
                    </Animated.View>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: BG },
    scroll: { flexGrow: 1 },

    photoBg: { position: "absolute", top: 0, left: 0, right: 0, height: 200, flexDirection: "row", gap: 6, padding: 14, opacity: 0.3 },
    photoCard: { flex: 1, borderRadius: 12 },

    panel: { flex: 1, paddingHorizontal: 28, paddingTop: 190, paddingBottom: 48 },

    logoRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 36 },
    logoMark: { width: 42, height: 42, borderRadius: 14, backgroundColor: WARM, alignItems: "center", justifyContent: "center" },
    logoMarkText: { color: "#fff", fontSize: 20, fontWeight: "700" },
    logoName: { fontSize: 24, fontWeight: "400", color: "#fff", letterSpacing: -0.3 },

    greeting: { fontSize: 12, fontWeight: "500", letterSpacing: 1.5, color: "#e07a60", textTransform: "uppercase", marginBottom: 6 },
    headline: { fontSize: 32, fontWeight: "300", color: "#fff", lineHeight: 38, letterSpacing: -0.5, marginBottom: 10 },
    headlineEm: { fontStyle: "italic", color: "#f5b88a" },
    subtext: { fontSize: 14, color: "rgba(255,255,255,0.36)", fontWeight: "300", lineHeight: 22, marginBottom: 24 },

    alertBox: { flexDirection: "row", alignItems: "flex-start", gap: 10, borderRadius: 12, padding: 12, marginBottom: 16, borderWidth: 1 },
    alertError: { backgroundColor: "rgba(220,80,80,0.08)", borderColor: "rgba(220,80,80,0.2)" },
    alertSuccess: { backgroundColor: "rgba(52,211,153,0.07)", borderColor: "rgba(52,211,153,0.2)" },
    alertIcon: { fontSize: 14 },
    alertText: { fontSize: 13.5, flex: 1, lineHeight: 20 },

    fieldRow: { flexDirection: "row", gap: 12 },
    fieldLabel: { fontSize: 11, fontWeight: "600", letterSpacing: 1, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", marginBottom: 8 },
    input: { height: 52, backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.08)", borderRadius: 14, paddingHorizontal: 14, fontSize: 14, color: "#fff" },

    strengthRow: { flexDirection: "row", gap: 5, marginTop: 7 },
    strengthSeg: { flex: 1, height: 3, borderRadius: 2 },

    matchText: { fontSize: 11.5, marginTop: 6, fontWeight: "500" },

    submitBtn: { height: 52, borderRadius: 14, backgroundColor: ROSE, alignItems: "center", justifyContent: "center", marginTop: 20 },
    submitBtnDisabled: { opacity: 0.3 },
    submitBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },

    terms: { fontSize: 12, color: "rgba(255,255,255,0.22)", textAlign: "center", marginTop: 14, lineHeight: 20 },
    termsLink: { color: "rgba(244,169,106,0.7)" },

    divider: { flexDirection: "row", alignItems: "center", gap: 14, marginTop: 24, marginBottom: 20 },
    dividerLine: { flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.07)" },
    dividerText: { fontSize: 12, color: "rgba(255,255,255,0.22)" },

    footer: { flexDirection: "row", justifyContent: "center", alignItems: "center" },
    footerLink: { color: WARM, fontWeight: "500", fontSize: 14 },
    footerDot: { color: "rgba(255,255,255,0.25)", marginHorizontal: 4 },
    footerMuted: { color: "rgba(255,255,255,0.22)", fontSize: 14 },
});