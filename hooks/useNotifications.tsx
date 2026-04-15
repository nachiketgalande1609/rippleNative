/**
 * useAppNotifications — React Native drop-in replacement
 *
 * Usage:
 *   1. Wrap your app with <NotificationProvider>
 *   2. const notifications = useAppNotifications();
 *      notifications.show("Saved!", { severity: "success", autoHideDuration: 3000 });
 */

import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
} from "react";
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Animated,
    Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ── Types ──────────────────────────────────────────────────────────────────────
type Severity = "success" | "error" | "info" | "warning";

interface NotificationOptions {
    severity?: Severity;
    autoHideDuration?: number;
}

interface NotificationItem extends Required<NotificationOptions> {
    id: string;
    message: string;
}

interface NotificationsAPI {
    show: (message: string, options?: NotificationOptions) => void;
    // Extra helpers used in NotificationsSettings
    isMuted: boolean;
    setMuted: (muted: boolean) => void;
}

// ── Palette ────────────────────────────────────────────────────────────────────
const palette: Record<Severity, { icon: string; accent: string; glow: string }> = {
    success: { icon: "✓", accent: "rgba(52,211,153,0.9)",  glow: "rgba(52,211,153,0.18)" },
    error:   { icon: "✕", accent: "rgba(230,57,70,0.9)",   glow: "rgba(230,57,70,0.18)" },
    warning: { icon: "⚠", accent: "rgba(251,191,36,0.9)",  glow: "rgba(251,191,36,0.18)" },
    info:    { icon: "i", accent: "rgba(124,92,252,0.9)",  glow: "rgba(124,92,252,0.18)" },
};

const ENTER_MS = 340;
const LEAVE_MS = 260;

// ── Single toast ───────────────────────────────────────────────────────────────
const Toast: React.FC<{ item: NotificationItem; onRemove: (id: string) => void }> = ({
    item,
    onRemove,
}) => {
    const { icon, accent, glow } = palette[item.severity];
    const opacity = useRef(new Animated.Value(0)).current;
    const translateY = useRef(new Animated.Value(20)).current;

    useEffect(() => {
        // Enter
        Animated.parallel([
            Animated.timing(opacity,     { toValue: 1, duration: ENTER_MS, useNativeDriver: true }),
            Animated.spring(translateY,  { toValue: 0, speed: 20, bounciness: 6, useNativeDriver: true }),
        ]).start();

        // Auto-hide
        if (item.autoHideDuration > 0) {
            const t = setTimeout(() => dismiss(), item.autoHideDuration);
            return () => clearTimeout(t);
        }
    }, []);

    const dismiss = () => {
        Animated.parallel([
            Animated.timing(opacity,    { toValue: 0, duration: LEAVE_MS, useNativeDriver: true }),
            Animated.timing(translateY, { toValue: 16, duration: LEAVE_MS, useNativeDriver: true }),
        ]).start(() => onRemove(item.id));
    };

    return (
        <Animated.View
            style={[
                styles.toast,
                { opacity, transform: [{ translateY }] },
            ]}
        >
            {/* Icon pill */}
            <View style={[styles.iconPill, { backgroundColor: glow }]}>
                <Text style={[styles.iconText, { color: accent }]}>{icon}</Text>
            </View>

            {/* Message */}
            <Text style={styles.toastMessage} numberOfLines={3}>
                {item.message}
            </Text>

            {/* Dismiss */}
            <TouchableOpacity onPress={dismiss} style={styles.dismissBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.dismissText}>×</Text>
            </TouchableOpacity>
        </Animated.View>
    );
};

// ── Toast stack ────────────────────────────────────────────────────────────────
const NotificationStack: React.FC<{
    items: NotificationItem[];
    onRemove: (id: string) => void;
    bottomInset: number;
}> = ({ items, onRemove, bottomInset }) => {
    if (items.length === 0) return null;

    return (
        <View style={[styles.stack, { bottom: bottomInset + 80 }]}>
            {items.map((item) => (
                <Toast key={item.id} item={item} onRemove={onRemove} />
            ))}
        </View>
    );
};

// ── Context ────────────────────────────────────────────────────────────────────
const NotificationsContext = createContext<NotificationsAPI | null>(null);

// ── Provider ───────────────────────────────────────────────────────────────────
export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [items, setItems] = useState<NotificationItem[]>([]);
    const [isMuted, setIsMuted] = useState(false);
    const counter = useRef(0);
    const insets = useSafeAreaInsets();

    const show = useCallback((message: string, options?: NotificationOptions) => {
        if (isMuted) return;
        const id = `notif-${Date.now()}-${counter.current++}`;
        setItems((prev) => [
            ...prev,
            {
                id,
                message,
                severity: options?.severity ?? "info",
                autoHideDuration: options?.autoHideDuration ?? 4000,
            },
        ]);
    }, [isMuted]);

    const remove = useCallback((id: string) => {
        setItems((prev) => prev.filter((n) => n.id !== id));
    }, []);

    const setMuted = useCallback((muted: boolean) => {
        setIsMuted(muted);
    }, []);

    return (
        <NotificationsContext.Provider value={{ show, isMuted, setMuted }}>
            {children}
            <NotificationStack items={items} onRemove={remove} bottomInset={insets.bottom} />
        </NotificationsContext.Provider>
    );
};

// ── Hook ───────────────────────────────────────────────────────────────────────
export function useAppNotifications(): NotificationsAPI {
    const ctx = useContext(NotificationsContext);
    if (!ctx) throw new Error("useAppNotifications must be used inside <NotificationProvider>");
    return ctx;
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const { width: SW } = Dimensions.get("window");

const styles = StyleSheet.create({
    stack: {
        position: "absolute",
        left: 16,
        right: 16,
        zIndex: 9999,
        gap: 8,
        // React Native doesn't support flexDirection: column-reverse cleanly,
        // so newest toast is appended at bottom via normal column order.
    },
    toast: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderRadius: 14,
        backgroundColor: "#1c1c28",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.09)",
        shadowColor: "#000",
        shadowOpacity: 0.45,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 6 },
        elevation: 10,
        maxWidth: SW - 32,
    },
    iconPill: {
        width: 26,
        height: 26,
        borderRadius: 8,
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
    },
    iconText: {
        fontSize: 13,
        fontWeight: "700",
    },
    toastMessage: {
        flex: 1,
        fontSize: 13.5,
        fontWeight: "500",
        color: "#dde1e7",
        lineHeight: 19,
    },
    dismissBtn: {
        flexShrink: 0,
        paddingHorizontal: 4,
    },
    dismissText: {
        fontSize: 18,
        color: "rgba(255,255,255,0.3)",
        lineHeight: 20,
    },
});