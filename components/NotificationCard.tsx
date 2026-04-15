import React from "react";
import {
    View,
    Text,
    Image,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { timeAgo } from "../utils/utils";
import { useThemeColors } from "../hooks/useThemeColors";

interface Notification {
    id: number;
    type: string;
    message: string;
    post_id: number | null;
    created_at: string;
    sender_id: string;
    username: string;
    profile_picture: string;
    file_url?: string;
    request_status: string;
    requester_id?: number;
    request_id: number;
}

interface NotificationCardProps {
    notification: Notification;
    onFollowBack: (userId: string) => void;
    onFollowRequestResponse: (request_id: number, response: "accepted" | "rejected") => void;
    followRequestAcceptLoading: boolean;
    followRequestRejectLoading: boolean;
}

const NotificationCard: React.FC<NotificationCardProps> = ({
    notification,
    onFollowBack,
    onFollowRequestResponse,
    followRequestAcceptLoading,
    followRequestRejectLoading,
}) => {
    const colors = useThemeColors();
    const router = useRouter();

    const timeLabel = timeAgo(notification.created_at);
    const isAccepted = notification.request_status === "accepted";
    const isRejected = notification.request_status === "rejected";
    const isPending = notification.request_status === "pending";

    return (
        <TouchableOpacity
            onPress={() => router.push(`/profile/${notification.sender_id}`)}
            activeOpacity={0.7}
            style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
            {/* Avatar */}
            <Image
                source={
                    notification.profile_picture
                        ? { uri: notification.profile_picture }
                        : require("../assets/profile_blank.png")
                }
                style={[styles.avatar, { borderColor: colors.border }]}
            />

            {/* Text */}
            <View style={styles.textWrap}>
                <Text style={[styles.message, { color: colors.textPrimary }]}>
                    <Text style={styles.username}>{notification.username} </Text>
                    <Text style={{ color: colors.textSecondary }}>{notification.message}</Text>
                </Text>
                <Text style={[styles.time, { color: colors.textDisabled }]}>
                    {timeLabel === "Just Now" ? timeLabel : `${timeLabel} ago`}
                </Text>
            </View>

            {/* Follow back */}
            {notification.type === "follow" && (
                <TouchableOpacity
                    onPress={() => { if (!isPending && !isAccepted) onFollowBack(notification.sender_id); }}
                    disabled={isPending || isAccepted}
                    activeOpacity={0.7}
                    style={[
                        styles.followBackBtn,
                        { borderColor: isAccepted ? "transparent" : colors.border, backgroundColor: isAccepted ? "transparent" : colors.hover },
                    ]}
                >
                    <Text style={[styles.followBackText, { color: isAccepted ? colors.textDisabled : colors.textPrimary }]}>
                        {isAccepted ? "Following" : "Follow Back"}
                    </Text>
                </TouchableOpacity>
            )}

            {/* Follow request */}
            {notification.type === "follow_request" && (
                <View style={styles.requestBtns}>
                    {isPending ? (
                        <>
                            <TouchableOpacity
                                onPress={() => onFollowRequestResponse(notification.request_id, "accepted")}
                                disabled={followRequestAcceptLoading}
                                activeOpacity={0.8}
                                style={[styles.acceptBtn, { backgroundColor: colors.textPrimary }]}
                            >
                                {followRequestAcceptLoading ? (
                                    <ActivityIndicator size={13} color={colors.bg} />
                                ) : (
                                    <Text style={[styles.acceptText, { color: colors.bg }]}>Accept</Text>
                                )}
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => onFollowRequestResponse(notification.request_id, "rejected")}
                                disabled={followRequestRejectLoading}
                                activeOpacity={0.7}
                                style={[styles.declineBtn, { borderColor: colors.border }]}
                            >
                                {followRequestRejectLoading ? (
                                    <ActivityIndicator size={13} color={colors.textDisabled} />
                                ) : (
                                    <Text style={[styles.declineText, { color: colors.textSecondary }]}>Decline</Text>
                                )}
                            </TouchableOpacity>
                        </>
                    ) : (
                        <View style={[styles.statusChip, { backgroundColor: colors.hover, borderColor: colors.border }]}>
                            <Text style={[styles.statusText, { color: colors.textDisabled }]}>
                                {isAccepted ? "Accepted" : isRejected ? "Declined" : ""}
                            </Text>
                        </View>
                    )}
                </View>
            )}

            {/* Post thumbnail */}
            {(notification.type === "like" || notification.type === "comment") && notification.file_url && (
                <View style={[styles.thumbWrap, { borderColor: colors.border }]}>
                    <Image source={{ uri: notification.file_url }} style={styles.thumb} resizeMode="cover" />
                </View>
            )}
        </TouchableOpacity>
    );
};

export default NotificationCard;

const styles = StyleSheet.create({
    card: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 8, borderRadius: 14, borderWidth: 1 },
    avatar: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, flexShrink: 0 },
    textWrap: { flex: 1, minWidth: 0 },
    message: { fontSize: 13.5, lineHeight: 20 },
    username: { fontWeight: "600" },
    time: { fontSize: 11.5, marginTop: 3 },

    followBackBtn: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, flexShrink: 0 },
    followBackText: { fontSize: 12, fontWeight: "600" },

    requestBtns: { flexDirection: "row", gap: 6, flexShrink: 0 },
    acceptBtn: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, minWidth: 68, alignItems: "center" },
    acceptText: { fontSize: 12, fontWeight: "600" },
    declineBtn: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 6, minWidth: 68, alignItems: "center" },
    declineText: { fontSize: 12, fontWeight: "600" },

    statusChip: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4 },
    statusText: { fontSize: 11.5 },

    thumbWrap: { width: 48, height: 48, borderRadius: 8, overflow: "hidden", borderWidth: 1, flexShrink: 0 },
    thumb: { width: "100%", height: "100%" },
});