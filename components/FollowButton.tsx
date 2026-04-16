import React, { useState } from "react";
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, View } from "react-native";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useThemeColors } from "../hooks/useThemeColors";

const ACCENT = "#7c5cfc";

interface Profile {
    username: string;
    follow_status: string;
    is_following: boolean;
    is_private: boolean;
    is_request_active: boolean;
}

interface FollowButtonProps {
    isFollowing: boolean;
    profileData: Pick<Profile, "is_request_active"> | null;
    followButtonLoading: boolean;
    handleFollow: () => void;
    handleCancelRequest: () => void;
    handleUnfollow?: () => void;
}

type ButtonState = "follow" | "pending" | "following";

function getState(isFollowing: boolean, profileData: Pick<Profile, "is_request_active"> | null): ButtonState {
    if (profileData?.is_request_active) return "pending";
    if (isFollowing) return "following";
    return "follow";
}

const FollowButton: React.FC<FollowButtonProps> = ({
    isFollowing, profileData, followButtonLoading,
    handleFollow, handleCancelRequest, handleUnfollow,
}) => {
    const colors = useThemeColors();
    const [pressed, setPressed] = useState(false);
    const state = getState(isFollowing, profileData);

    const handlePress = () => {
        if (followButtonLoading) return;
        if (state === "pending") handleCancelRequest();
        else if (state === "following") handleUnfollow?.();
        else handleFollow();
    };

    const isInteractive = state === "pending" || state === "following";
    const showPressed   = pressed && isInteractive;

    // Styles based on state
    const containerStyle = state === "follow"
        ? { backgroundColor: ACCENT, borderWidth: 0 }
        : showPressed
        ? { backgroundColor: "rgba(229,57,53,0.08)", borderWidth: 1.5, borderColor: "rgba(229,57,53,0.3)" }
        : { backgroundColor: colors.hover, borderWidth: 1, borderColor: colors.border };

    const textColor = state === "follow" ? "#fff"
        : showPressed ? "#e53935"
        : colors.textSecondary;

    const iconColor = state === "follow" ? "#fff"
        : showPressed ? "#e53935"
        : colors.textDisabled;

    const label = state === "follow" ? "Follow"
        : showPressed ? (state === "pending" ? "Cancel" : "Unfollow")
        : state === "pending" ? "Requested" : "Following";

    const icon = state === "follow"
        ? <Ionicons name="person-add" size={13} color={iconColor} />
        : showPressed
        ? <Ionicons name="close" size={13} color={iconColor} />
        : state === "pending"
        ? <MaterialIcons name="hourglass-top" size={13} color={iconColor} />
        : <Ionicons name="checkmark" size={13} color={iconColor} />;

    return (
        <TouchableOpacity
            onPress={handlePress}
            onPressIn={() => setPressed(true)}
            onPressOut={() => setPressed(false)}
            disabled={followButtonLoading}
            activeOpacity={1}
            style={[styles.base, containerStyle]}
        >
            {followButtonLoading ? (
                <ActivityIndicator size={13} color={state === "follow" ? "#fff" : colors.textDisabled} />
            ) : (
                <View style={styles.inner}>
                    {icon}
                    <Text style={[styles.label, { color: textColor }]}>{label}</Text>
                </View>
            )}
        </TouchableOpacity>
    );
};

export default FollowButton;

const styles = StyleSheet.create({
    base:  { flex: 1, height: 34, borderRadius: 9, alignItems: "center", justifyContent: "center" },
    inner: { flexDirection: "row", alignItems: "center", gap: 5 },
    label: { fontSize: 13, fontWeight: "600", letterSpacing: 0.1 },
});