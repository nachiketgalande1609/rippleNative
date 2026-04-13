import React, { useState } from "react";
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, View } from "react-native";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";

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
    isFollowing,
    profileData,
    followButtonLoading,
    handleFollow,
    handleCancelRequest,
    handleUnfollow,
}) => {
    const [pressed, setPressed] = useState(false);
    const state = getState(isFollowing, profileData);

    const handlePress = () => {
        if (followButtonLoading) return;
        if (state === "pending") handleCancelRequest();
        else if (state === "following") handleUnfollow?.();
        else handleFollow();
    };

    const isInteractive = state === "pending" || state === "following";
    const showPressed = pressed && isInteractive;

    const getStyle = () => {
        if (state === "follow") return styles.followBtn;
        if (showPressed) return styles.dangerBtn;
        return styles.outlineBtn;
    };

    const getTextStyle = () => {
        if (state === "follow") return styles.followText;
        if (showPressed) return styles.dangerText;
        return styles.outlineText;
    };

    const getLabel = () => {
        if (state === "follow") return "Follow";
        if (showPressed) return state === "pending" ? "Cancel" : "Unfollow";
        return state === "pending" ? "Requested" : "Following";
    };

    const getIcon = () => {
        const color = state === "follow" ? "#0a0a0a" : showPressed ? "#ff5050" : "#888";
        if (state === "follow") return <Ionicons name="person-add" size={13} color={color} />;
        if (showPressed) return <Ionicons name="close" size={13} color={color} />;
        if (state === "pending") return <MaterialIcons name="hourglass-top" size={13} color={color} />;
        return <Ionicons name="checkmark" size={13} color={color} />;
    };

    return (
        <TouchableOpacity
            onPress={handlePress}
            onPressIn={() => setPressed(true)}
            onPressOut={() => setPressed(false)}
            disabled={followButtonLoading}
            activeOpacity={1}
            style={[styles.base, getStyle()]}
        >
            {followButtonLoading ? (
                <ActivityIndicator size={13} color="#888" />
            ) : (
                <View style={styles.inner}>
                    {getIcon()}
                    <Text style={[styles.label, getTextStyle()]}>{getLabel()}</Text>
                </View>
            )}
        </TouchableOpacity>
    );
};

export default FollowButton;

const styles = StyleSheet.create({
    base: { width: 110, height: 34, borderRadius: 20, alignItems: "center", justifyContent: "center" },
    followBtn: { backgroundColor: "#fff", borderWidth: 0 },
    outlineBtn: { backgroundColor: "transparent", borderWidth: 1.5, borderColor: "#2a2a2a" },
    dangerBtn: { backgroundColor: "rgba(255,80,80,0.08)", borderWidth: 1.5, borderColor: "rgba(255,80,80,0.25)" },
    inner: { flexDirection: "row", alignItems: "center", gap: 5 },
    label: { fontSize: 13, fontWeight: "500", letterSpacing: 0.1 },
    followText: { color: "#0a0a0a" },
    outlineText: { color: "#888" },
    dangerText: { color: "#ff5050" },
});