import React, { useState, useEffect, useRef } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    Animated,
    Image,
    KeyboardAvoidingView,
    Platform,
    Dimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { generatePasswordResetOTP, verifyPasswordResetOTP, ResetPassword } from "../services/api";

const { height: SH } = Dimensions.get("window");

const WARM  = "#f4a96a";
const ROSE  = "#e05c7e";
const BG    = "#0e0a08";
const GREEN = "#34d399";

const PHOTOS = [
    "https://plus.unsplash.com/premium_photo-1663099908294-e235675ca558?q=80&w=687&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?q=80&w=687&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1475403614135-5f1aa0eb5015?q=80&w=687&auto=format&fit=crop",
];

type Step = "email" | "otp" | "reset" | "success";

function useFadeIn(delay: number) {
    const opacity    = useRef(new Animated.Value(0)).current;
    const translateY = useRef(new Animated.Value(16)).current;
    useEffect(() => {
        Animated.parallel([
            Animated.timing(opacity,    { toValue: 1, duration: 450, delay, useNativeDriver: true }),
            Animated.timing(translateY, { toValue: 0, duration: 450, delay, useNativeDriver: true }),
        ]).start();
    }, []);
    return { opacity, transform: [{ translateY }] };
}

function useStepFade(step: Step) {
    const opacity = useRef(new Animated.Value(0)).current;
    const translateX = useRef(new Animated.Value(20)).current;
    useEffect(() => {
        opacity.setValue(0);
        translateX.setValue(20);
        Animated.parallel([
            Animated.timing(opacity,    { toValue: 1, duration: 350, useNativeDriver: true }),
            Animated.timing(translateX, { toValue: 0, duration: 350, useNativeDriver: true }),
        ]).start();
    }, [step]);
    return { opacity, transform: [{ translateX }] };
}

export default function ForgotPasswordPage() {
    const router = useRouter();

    const [step,            setStep]            = useState<Step>("email");
    const [email,           setEmail]           = useState("");
    const [otp,             setOtp]             = useState(["", "", "", "", "", ""]);
    const [newPassword,     setNewPassword]     = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error,           setError]           = useState<string | null>(null);
    const [loading,         setLoading]         = useState(false);

    const otpRefs = useRef<(TextInput | null)[]>([]);

    const a0 = useFadeIn(80);
    const a1 = useFadeIn(160);
    const a2 = useFadeIn(240);
    const a3 = useFadeIn(320);
    const stepAnim = useStepFade(step);

    const errOpacity = useRef(new Animated.Value(0)).current;
    const errHeight  = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(errOpacity, { toValue: error ? 1 : 0, duration: 220, useNativeDriver: false }),
            Animated.timing(errHeight,  { toValue: error ? 60 : 0, duration: 220, useNativeDriver: false }),
        ]).start();
    }, [error]);

    // Progress: 0=email, 1=otp, 2=reset, 3=success
    const stepIdx = { email: 0, otp: 1, reset: 2, success: 3 }[step];

    const handleEmailSend = async () => {
        if (!email) return;
        setError(null); setLoading(true);
        try {
            const res = await generatePasswordResetOTP(email);
            if (res.success) setStep("otp");
            else setError(res.error || "Failed to send code.");
        } catch (e: any) {
            setError(e.response?.data?.error || "Failed to send code.");
        } finally { setLoading(false); }
    };

    const handleOTPChange = (index: number, value: string) => {
        if (!/^\d*$/.test(value)) return;
        const next = [...otp];
        next[index] = value.slice(-1);
        setOtp(next);
        if (value && index < 5) otpRefs.current[index + 1]?.focus();
    };

    const handleOTPBackspace = (index: number, key: string) => {
        if (key === "Backspace" && !otp[index] && index > 0) {
            otpRefs.current[index - 1]?.focus();
        }
    };

    const handleOTPVerify = async () => {
        const code = otp.join("");
        if (code.length < 6) { setError("Please enter the full 6-digit code."); return; }
        setError(null); setLoading(true);
        try {
            const res = await verifyPasswordResetOTP(email, code);
            if (res.success) setStep("reset");
            else setError(res.error || "Invalid code.");
        } catch (e: any) {
            setError(e.response?.data?.error || "Verification failed.");
        } finally { setLoading(false); }
    };

    const handlePasswordReset = async () => {
        if (!newPassword || !confirmPassword) { setError("Please fill in both fields."); return; }
        if (newPassword !== confirmPassword) { setError("Passwords do not match."); return; }
        if (newPassword.length < 6) { setError("Password must be at least 6 characters."); return; }
        setError(null); setLoading(true);
        try {
            const res = await ResetPassword(email, otp.join(""), newPassword);
            if (res.success) {
                setStep("success");
                setTimeout(() => router.replace("/login"), 2500);
            } else {
                setError(res.error || "Reset failed.");
            }
        } catch (e: any) {
            setError(e.message || "Reset failed.");
        } finally { setLoading(false); }
    };

    const stepLabel: Record<Step, string> = {
        email:   "Account recovery",
        otp:     "Verification",
        reset:   "New password",
        success: "All done",
    };

    return (
        <KeyboardAvoidingView
            style={styles.root}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
            {/* ── Photos — identical to LoginPage ── */}
            <View style={styles.photoBg}>
                <View style={styles.photoCol1}>
                    <Image source={{ uri: PHOTOS[0] }} style={styles.photoTall} resizeMode="cover" />
                </View>
                <View style={styles.photoCol2}>
                    <Image source={{ uri: PHOTOS[1] }} style={styles.photoShort} resizeMode="cover" />
                    <Image source={{ uri: PHOTOS[2] }} style={styles.photoShort} resizeMode="cover" />
                </View>
            </View>
            <View style={styles.photoBottomOverlay} />

            {/* ── Panel ── */}
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

                {/* Progress bar */}
                <Animated.View style={[styles.progressRow, a1]}>
                    {["email", "otp", "reset"].map((s, i) => (
                        <View
                            key={s}
                            style={[
                                styles.progressSeg,
                                i < stepIdx  && styles.progressDone,
                                i === stepIdx && styles.progressActive,
                            ]}
                        />
                    ))}
                </Animated.View>

                {/* Error */}
                <Animated.View style={{ opacity: errOpacity, height: errHeight, overflow: "hidden" }}>
                    <View style={styles.errorBox}>
                        <Text style={styles.errorIcon}>⚠</Text>
                        <Text style={styles.errorText}>{error}</Text>
                    </View>
                </Animated.View>

                {/* ── Step content ── */}
                <Animated.View style={[{ flex: 1 }, stepAnim]}>

                    {/* STEP: EMAIL */}
                    {step === "email" && (
                        <View>
                            <Animated.View style={a2}>
                                <Text style={styles.greeting}>{stepLabel.email}</Text>
                                <Text style={styles.headline}>
                                    Forgot your{"\n"}
                                    <Text style={styles.headlineEm}>password?</Text>
                                </Text>
                                <Text style={styles.subtext}>
                                    Enter your email and we'll send you a verification code.
                                </Text>
                            </Animated.View>
                            <Animated.View style={a3}>
                                <Text style={styles.fieldLabel}>Email address</Text>
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
                                <TouchableOpacity
                                    onPress={handleEmailSend}
                                    disabled={loading || !email}
                                    activeOpacity={0.85}
                                    style={[styles.btn, (!email) && styles.btnDisabled]}
                                >
                                    {loading
                                        ? <ActivityIndicator size={18} color="#fff" />
                                        : <Text style={styles.btnText}>Send code →</Text>
                                    }
                                </TouchableOpacity>
                            </Animated.View>
                        </View>
                    )}

                    {/* STEP: OTP */}
                    {step === "otp" && (
                        <View>
                            <Animated.View style={a2}>
                                <Text style={styles.greeting}>{stepLabel.otp}</Text>
                                <Text style={styles.headline}>
                                    Check your{"\n"}
                                    <Text style={styles.headlineEm}>inbox.</Text>
                                </Text>
                                <Text style={styles.subtext}>
                                    We sent a 6-digit code to{"\n"}
                                    <Text style={styles.subtextBold}>{email}</Text>
                                </Text>
                            </Animated.View>
                            <Animated.View style={a3}>
                                {/* OTP boxes */}
                                <View style={styles.otpRow}>
                                    {otp.map((digit, i) => (
                                        <TextInput
                                            key={i}
                                            ref={(r) => (otpRefs.current[i] = r)}
                                            style={[styles.otpBox, digit ? styles.otpBoxFilled : undefined]}
                                            value={digit}
                                            onChangeText={(v) => handleOTPChange(i, v)}
                                            onKeyPress={({ nativeEvent }) => handleOTPBackspace(i, nativeEvent.key)}
                                            keyboardType="number-pad"
                                            maxLength={1}
                                            textAlign="center"
                                            keyboardAppearance="dark"
                                            placeholderTextColor="rgba(255,255,255,0.18)"
                                        />
                                    ))}
                                </View>
                                <TouchableOpacity
                                    onPress={handleOTPVerify}
                                    disabled={loading || otp.join("").length < 6}
                                    activeOpacity={0.85}
                                    style={[styles.btn, otp.join("").length < 6 && styles.btnDisabled]}
                                >
                                    {loading
                                        ? <ActivityIndicator size={18} color="#fff" />
                                        : <Text style={styles.btnText}>Verify code →</Text>
                                    }
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => { setStep("email"); setOtp(["","","","","",""]); setError(null); }}
                                    activeOpacity={0.7}
                                    style={styles.backBtn}
                                >
                                    <Text style={styles.backBtnText}>← Change email</Text>
                                </TouchableOpacity>
                            </Animated.View>
                        </View>
                    )}

                    {/* STEP: RESET */}
                    {step === "reset" && (
                        <View>
                            <Animated.View style={a2}>
                                <Text style={styles.greeting}>{stepLabel.reset}</Text>
                                <Text style={styles.headline}>
                                    Set a new{"\n"}
                                    <Text style={styles.headlineEm}>password.</Text>
                                </Text>
                                <Text style={styles.subtext}>
                                    Choose something strong — at least 6 characters.
                                </Text>
                            </Animated.View>
                            <Animated.View style={a3}>
                                <Text style={styles.fieldLabel}>New password</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="••••••••"
                                    placeholderTextColor="rgba(255,255,255,0.18)"
                                    value={newPassword}
                                    onChangeText={setNewPassword}
                                    secureTextEntry
                                    keyboardAppearance="dark"
                                />
                                <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Confirm password</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="••••••••"
                                    placeholderTextColor="rgba(255,255,255,0.18)"
                                    value={confirmPassword}
                                    onChangeText={setConfirmPassword}
                                    secureTextEntry
                                    keyboardAppearance="dark"
                                />
                                <TouchableOpacity
                                    onPress={handlePasswordReset}
                                    disabled={loading || !newPassword || !confirmPassword}
                                    activeOpacity={0.85}
                                    style={[styles.btn, (!newPassword || !confirmPassword) && styles.btnDisabled]}
                                >
                                    {loading
                                        ? <ActivityIndicator size={18} color="#fff" />
                                        : <Text style={styles.btnText}>Reset password →</Text>
                                    }
                                </TouchableOpacity>
                            </Animated.View>
                        </View>
                    )}

                    {/* STEP: SUCCESS */}
                    {step === "success" && (
                        <Animated.View style={[styles.successBlock, a2]}>
                            <View style={styles.successRing}>
                                <Text style={styles.successCheck}>✓</Text>
                            </View>
                            <Text style={styles.headline}>
                                All <Text style={styles.headlineEm}>done!</Text>
                            </Text>
                            <Text style={styles.subtext}>
                                Your password has been reset.{"\n"}
                                Redirecting you to sign in…
                            </Text>
                        </Animated.View>
                    )}
                </Animated.View>

                {/* Footer */}
                {step !== "success" && (
                    <Animated.View style={[styles.footer, a3]}>
                        <Text style={styles.footerMuted}>Remember it? </Text>
                        <TouchableOpacity onPress={() => router.push("/login")} activeOpacity={0.7}>
                            <Text style={styles.footerLink}>Back to sign in</Text>
                        </TouchableOpacity>
                    </Animated.View>
                )}
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: BG },

    // Photos — identical to LoginPage
    photoBg: {
        position: "absolute",
        top: 0, left: 0, right: 0,
        height: SH * 0.42,
        flexDirection: "row",
        gap: 6, padding: 12,
        opacity: 0.6,
    },
    photoCol1: { flex: 1 },
    photoCol2: { flex: 1, gap: 6 },
    photoTall:  { flex: 1, borderRadius: 14 },
    photoShort: { flex: 1, borderRadius: 14 },
    photoBottomOverlay: {
        position: "absolute",
        top: 0, left: 0, right: 0,
        height: SH * 0.52,
        backgroundColor: BG,
        opacity: 0.7,
    },

    // Panel — identical to LoginPage
    panel: {
        flex: 1,
        paddingHorizontal: 28,
        paddingTop: SH * 0.28,
        paddingBottom: 32,
        justifyContent: "flex-end",
    },

    // Logo — identical to LoginPage
    logoRow:   { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 20 },
    logoImage: { width: 42, height: 42, borderRadius: 14 },
    logoName:  { fontFamily: "MomoSignature", fontWeight: "400", fontSize: 18, color: "#fff", letterSpacing: 0 },

    // Progress bar
    progressRow:   { flexDirection: "row", gap: 6, marginBottom: 20 },
    progressSeg:   { flex: 1, height: 3, borderRadius: 99, backgroundColor: "rgba(255,255,255,0.07)" },
    progressActive:{ backgroundColor: ROSE },
    progressDone:  { backgroundColor: "rgba(244,169,106,0.35)" },

    // Error
    errorBox:   { flexDirection: "row", alignItems: "flex-start", gap: 10, backgroundColor: "rgba(220,80,80,0.08)", borderWidth: 1, borderColor: "rgba(220,80,80,0.2)", borderRadius: 12, padding: 12, marginBottom: 14 },
    errorIcon:  { fontSize: 14, color: "#f9a8a8" },
    errorText:  { fontSize: 13.5, color: "#f9a8a8", flex: 1, lineHeight: 20 },

    // Headline — identical to LoginPage
    greeting:    { fontSize: 12, fontWeight: "500", letterSpacing: 1.5, color: "#e07a60", textTransform: "uppercase", marginBottom: 6 },
    headline:    { fontSize: 34, fontWeight: "300", color: "#fff", lineHeight: 42, letterSpacing: -0.5, marginBottom: 10 },
    headlineEm:  { fontStyle: "italic", color: "#f5b88a" },
    subtext:     { fontSize: 13.5, color: "rgba(255,255,255,0.38)", fontWeight: "300", lineHeight: 22, marginBottom: 20 },
    subtextBold: { color: "rgba(255,255,255,0.65)", fontWeight: "500" },

    // Fields — identical to LoginPage
    fieldLabel: { fontSize: 11, fontWeight: "600", letterSpacing: 1, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", marginBottom: 8 },
    input:      { height: 48, backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.08)", borderRadius: 14, paddingHorizontal: 18, fontSize: 15, color: "#fff" },

    // OTP
    otpRow:      { flexDirection: "row", gap: 8, justifyContent: "space-between", marginBottom: 20 },
    otpBox:      { flex: 1, height: 54, backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.08)", borderRadius: 14, fontSize: 22, fontWeight: "600", color: "#fff" },
    otpBoxFilled:{ borderColor: "rgba(244,169,106,0.4)", backgroundColor: "rgba(244,169,106,0.06)" },

    // Button — identical to loginBtn in LoginPage
    btn:         { height: 48, paddingHorizontal: 24,marginTop: 18, borderRadius: 14, backgroundColor: ROSE, alignItems: "center", justifyContent: "center", shadowColor: ROSE, shadowOpacity: 0.4, shadowRadius: 16, shadowOffset: { width: 0, height: 5 }, elevation: 6 },
    btnDisabled: { opacity: 0.3 },
    btnText:     { color: "#fff", fontSize: 15, fontWeight: "600" },

    // Back button
    backBtn:     { alignItems: "center", marginTop: 16 },
    backBtnText: { fontSize: 13, color: "rgba(255,255,255,0.28)" },

    // Success
    successBlock: { alignItems: "center", paddingTop: 8 },
    successRing:  { width: 68, height: 68, borderRadius: 34, backgroundColor: "rgba(52,211,153,0.09)", borderWidth: 1, borderColor: "rgba(52,211,153,0.22)", alignItems: "center", justifyContent: "center", marginBottom: 20 },
    successCheck: { fontSize: 28, color: GREEN, fontWeight: "300" },

    // Footer
    footer:      { flexDirection: "row", justifyContent: "center", alignItems: "center", marginTop: 20 },
    footerMuted: { color: "rgba(255,255,255,0.28)", fontSize: 13 },
    footerLink:  { color: WARM, fontWeight: "500", fontSize: 13 },
});