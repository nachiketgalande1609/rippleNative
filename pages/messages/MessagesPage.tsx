import React, { useState, useEffect, useRef } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { View, StyleSheet, KeyboardAvoidingView, Platform } from "react-native";
import socket from "../../services/socket";
import { useGlobalStore } from "../../store/store";
import {
  deleteMessage,
  getAllMessageUsersData,
  getMessagesDataForSelectedUser,
  getMutedUsers,
  shareChatMedia,
} from "../../services/api";
import { useThemeColors } from "../../hooks/useThemeColors";
import MessagesUserList from "./MessagesUserList";
import MessagesTopBar from "./MessagesTopBar";
import MessagesContainer from "./MessagesContainer";
import MessageInput from "./MessagesInput";

type Message = {
  message_id: number;
  receiver_id: number;
  sender_id: number;
  message_text: string;
  timestamp: string;
  delivered?: boolean;
  read?: boolean;
  saved?: boolean;
  file_url: string;
  delivered_timestamp?: string | null;
  read_timestamp?: string | null;
  file_name: string | null;
  file_size: string | null;
  reply_to: number | null;
  media_height: number | null;
  media_width: number | null;
  reactions: ReactionDetail[];
  post?: any | null;
};

interface ReactionDetail {
  user_id: string;
  reaction: string;
  username: string;
  profile_picture: string;
}

type User = {
  id: number;
  username: string;
  profile_picture: string;
  isOnline: boolean;
  latest_message: string;
  latest_message_timestamp: string;
  unread_count: number;
};

interface MessagesPageProps {
  handleVideoCall?: () => void;
}

const MessagesPage: React.FC<MessagesPageProps> = ({
  handleVideoCall = () => {},
}) => {
  const insets = useSafeAreaInsets();
  const NAV_BAR_HEIGHT = 66;
  const colors = useThemeColors();
  const router = useRouter();
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [typingUser, setTypingUser] = useState<number | null>(null);
  const [typingTimeout, setTypingTimeout] = useState<ReturnType<
    typeof setTimeout
  > | null>(null);
  const [selectedFile, setSelectedFile] = useState<any>(null);
  const [selectedFileURL, setSelectedFileURL] = useState("");
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [selectedMessageForReply, setSelectedMessageForReply] =
    useState<Message | null>(null);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [initialMessageLoading, setInitialMessageLoading] = useState(false);
  const { onlineUsers } = useGlobalStore();

  // Load current user
  useEffect(() => {
    AsyncStorage.getItem("user").then((raw) => {
      if (raw) setCurrentUser(JSON.parse(raw));
    });
  }, []);

  // Fetch users
  const fetchUsersData = async () => {
    setLoadingUsers(true);
    try {
      const res = await getAllMessageUsersData();
      setUsers(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    fetchUsersData();
  }, []);

  // Navigate to user from route param
  useEffect(() => {
    if (userId && users.length > 0) {
      const user = users.find((u) => u.id === parseInt(userId));
      if (user && (!selectedUser || user.id !== selectedUser.id)) {
        setSelectedUser(user);
        setMessages([]);
        fetchMessagesForUser(parseInt(userId));
      }
    }
  }, [userId, users]);

  const fetchMessagesForUser = async (uid: number, offset = 0, limit = 20) => {
    setInitialMessageLoading(true);
    try {
      const res = await getMessagesDataForSelectedUser(uid, offset, limit);
      const reversed = res.data.slice().reverse();
      setMessages((prev) => (offset === 0 ? reversed : [...reversed, ...prev]));
    } catch (e) {
      console.error(e);
    } finally {
      setInitialMessageLoading(false);
    }
  };

  const handleUserClick = (uid: number) => {
    setMessages([]);
    const user = users.find((u) => u.id === uid) || null;
    setSelectedUser(user);
    fetchMessagesForUser(uid);
    setUsers((prev) =>
      prev.map((u) => (u.id === uid ? { ...u, unread_count: 0 } : u)),
    );
    router.push(`/messages/${uid}`);
  };

  // Socket — receive messages
  useEffect(() => {
    if (!currentUser) return;
    socket.on("receiveMessage", (data) => {
      if (data.senderId === currentUser.id) return;
      if (data.senderId !== selectedUser?.id) {
        setUsers((prev) =>
          prev.map((u) =>
            u.id === data.senderId
              ? { ...u, unread_count: (u.unread_count || 0) + 1 }
              : u,
          ),
        );
        return;
      }
      setMessages((prev) => {
        if (prev.some((m) => m.message_id === data.messageId)) return prev;
        const newMsg: Message = {
          message_id: data.messageId,
          sender_id: data.senderId,
          receiver_id: data.receiverId,
          message_text: data.message_text,
          timestamp: new Date().toISOString(),
          saved: !!data.messageId,
          file_url: data?.fileUrl || null,
          file_name: data?.fileName || null,
          file_size: data?.fileSize || null,
          reply_to: data?.replyTo || null,
          media_width: data?.mediaWidth || null,
          media_height: data?.mediaHeight || null,
          delivered: false,
          read: false,
          reactions: [],
          post: null,
        };
        return [...prev, newMsg];
      });
    });
    return () => {
      socket.off("receiveMessage");
    };
  }, [currentUser, selectedUser]);

  // Socket — typing
  useEffect(() => {
    if (!currentUser) return;
    socket.on("typing", (data) => {
      if (
        data.receiverId === currentUser.id &&
        selectedUser?.id === data.senderId
      )
        setTypingUser(data.senderId);
    });
    socket.on("stopTyping", (data) => {
      if (
        data.receiverId === currentUser.id &&
        selectedUser?.id === data.senderId
      )
        setTypingUser(null);
    });
    return () => {
      socket.off("typing");
      socket.off("stopTyping");
    };
  }, [currentUser, selectedUser]);

  // Socket — messageSaved
  useEffect(() => {
    socket.on("messageSaved", (data: { tempId: number; messageId: number }) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.message_id === data.tempId
            ? { ...m, message_id: data.messageId, saved: true }
            : m,
        ),
      );
    });
    return () => {
      socket.off("messageSaved");
    };
  }, []);

  // Socket — messageRead
  useEffect(() => {
    socket.on("messageRead", () => {
      setMessages((prev) =>
        prev.map((m) => ({
          ...m,
          read: true,
          read_timestamp: new Date().toISOString(),
        })),
      );
    });
    return () => {
      socket.off("messageRead");
    };
  }, []);

  // Emit read
  useEffect(() => {
    if (!selectedUser || !messages.length || !currentUser) return;
    const hasUnread = messages.some(
      (m) => m.sender_id === selectedUser.id && !m.read,
    );
    if (hasUnread) {
      socket.emit("messageRead", {
        senderId: selectedUser.id,
        receiverId: currentUser.id,
      });
      setMessages((prev) => prev.map((m) => ({ ...m, read: true })));
    }
  }, [selectedUser, messages, currentUser]);

  const handleTyping = () => {
    if (!inputMessage.trim()) return;
    socket.emit("typing", {
      senderId: currentUser?.id,
      receiverId: selectedUser?.id,
    });
    if (typingTimeout) clearTimeout(typingTimeout);
    const t = setTimeout(() => {
      socket.emit("stopTyping", {
        senderId: currentUser?.id,
        receiverId: selectedUser?.id,
      });
    }, 3000);
    setTypingTimeout(t);
  };

  const handleSendMessage = async () => {
    if (
      (!inputMessage.trim() && !selectedFile) ||
      !selectedUser ||
      !currentUser
    )
      return;

    let fileUrl = null,
      fileName = null,
      fileSize = null,
      mediaWidth = null,
      mediaHeight = null;

    if (selectedFile) {
      const formData = new FormData();
      formData.append("image", {
        uri: selectedFile.uri,
        name: selectedFile.name,
        type: selectedFile.mimeType,
      } as any);
      try {
        setIsSendingMessage(true);
        const response = await shareChatMedia(formData);
        fileUrl = response?.data?.fileUrl;
        fileName = response?.data?.fileName;
        fileSize = response?.data?.fileSize;
        mediaWidth = response?.data?.mediaWidth;
        mediaHeight = response?.data?.mediaHeight;
      } catch (e) {
        console.error(e);
        setIsSendingMessage(false);
        return;
      }
    }

    const tempId = Date.now() + Math.floor(Math.random() * 1000);
    const newMsg: Message = {
      message_id: tempId,
      sender_id: currentUser.id,
      receiver_id: selectedUser.id,
      message_text: inputMessage,
      file_url: fileUrl,
      file_name: fileName,
      file_size: fileSize,
      media_width: mediaWidth,
      media_height: mediaHeight,
      timestamp: new Date().toISOString(),
      saved: false,
      delivered: false,
      read: false,
      delivered_timestamp: null,
      read_timestamp: null,
      reply_to: selectedMessageForReply?.message_id || null,
      reactions: [],
      post: null,
    };

    setMessages((prev) => [...prev, newMsg]);
    setSelectedFile(null);
    setSelectedFileURL("");
    setSelectedMessageForReply(null);

    socket.emit("sendMessage", {
      tempId,
      senderId: currentUser.id,
      receiverId: selectedUser.id,
      text: inputMessage,
      fileUrl,
      fileName,
      fileSize,
      mediaWidth,
      mediaHeight,
      replyTo: selectedMessageForReply?.message_id || null,
    });
    socket.emit("stopTyping", {
      senderId: currentUser.id,
      receiverId: selectedUser?.id,
    });

    setInputMessage("");
    setIsSendingMessage(false);
  };

  const handleDeleteMessage = async (msg: Message | null) => {
    if (!msg) return;
    try {
      const res = await deleteMessage(msg.message_id);
      if (res?.success)
        setMessages((prev) =>
          prev.filter((m) => m.message_id !== msg.message_id),
        );
    } catch (e) {
      console.error(e);
    }
  };

  const handleReaction = (messageId: number, reaction: string) => {
    if (!selectedUser || !currentUser) return;
    setMessages((prev) =>
      prev.map((m) => {
        if (m.message_id !== messageId) return m;
        const prevReactions = Array.isArray(m.reactions) ? m.reactions : [];
        const existing = prevReactions.find(
          (r) => r.user_id === currentUser.id.toString(),
        );
        const isSame = existing?.reaction === reaction;
        const updated = isSame
          ? prevReactions.filter((r) => r.user_id !== currentUser.id.toString())
          : existing
            ? prevReactions.map((r) =>
                r.user_id === currentUser.id.toString()
                  ? { ...r, reaction }
                  : r,
              )
            : [
                ...prevReactions,
                {
                  user_id: currentUser.id.toString(),
                  reaction,
                  username: currentUser.username,
                  profile_picture: currentUser.profile_picture_url,
                },
              ];
        return { ...m, reactions: updated };
      }),
    );
    socket.emit("send-reaction", {
      messageId,
      senderUserId: currentUser.id,
      reaction,
    });
  };

  return (
    <SafeAreaView
      style={[
        styles.root,
        { backgroundColor: colors.bg },
        selectedUser && {
          paddingBottom: NAV_BAR_HEIGHT,
          marginTop: -insets.top,
        },
      ]}
      edges={["top"]}
    >
      {!selectedUser ? (
        <MessagesUserList
          users={users}
          onlineUsers={onlineUsers}
          handleUserClick={handleUserClick}
          loading={loadingUsers}
        />
      ) : (
        <KeyboardAvoidingView
          style={styles.chatView}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={NAV_BAR_HEIGHT}
        >
          <MessagesTopBar
            selectedUser={selectedUser}
            openVideoCall={handleVideoCall}
            onMuteToggle={() => {}}
            onBack={() => {
              setSelectedUser(null);
              setMessages([]);
            }}
          />
          <MessagesContainer
            selectedUser={selectedUser}
            messages={messages}
            currentUser={currentUser}
            handleImageClick={() => {}}
            handleReply={(msg) => setSelectedMessageForReply(msg)}
            handleDeleteMessage={handleDeleteMessage}
            handleReaction={handleReaction}
            typingUser={typingUser}
            initialMessageLoading={initialMessageLoading}
          />
          <MessageInput
            selectedFile={selectedFile}
            setSelectedFile={setSelectedFile}
            selectedFileURL={selectedFileURL}
            setSelectedFileURL={setSelectedFileURL}
            inputMessage={inputMessage}
            setInputMessage={setInputMessage}
            handleTyping={handleTyping}
            handleSendMessage={handleSendMessage}
            isSendingMessage={isSendingMessage}
            selectedMessageForReply={selectedMessageForReply}
            cancelReply={() => setSelectedMessageForReply(null)}
            selectedUser={selectedUser}
            currentUserId={currentUser?.id}
          />
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
};

export default MessagesPage;

const styles = StyleSheet.create({
  root: { flex: 1 },
  chatView: {
    flex: 1,
    flexDirection: "column",
    justifyContent: "space-between",
  },
});
