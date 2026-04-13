import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface User {
    id: string;
    username: string;
    email: string;
    profile_picture_url: string;
    theme?: "light" | "dark";
}

interface globalStoreState {
    user: User | null;
    unreadNotificationsCount: number | null;
    unreadMessagesCount: number | null;
    postUploading: boolean;

    setUser: (user: User | null) => Promise<void>;
    loadUser: () => Promise<void>;

    setUnreadNotificationsCount: (count: number | null) => void;
    setUnreadMessagesCount: (count: number | null) => void;
    resetNotificationsCount: () => void;
    setPostUploading: (isUploading: boolean) => void;
}

export const useGlobalStore = create<globalStoreState>((set) => ({
    user: null,
    unreadNotificationsCount: null,
    unreadMessagesCount: null,
    postUploading: false,

    // 🔹 Load user from AsyncStorage (call on app start)
    loadUser: async () => {
        try {
            const storedUser = await AsyncStorage.getItem("user");
            if (storedUser) {
                set({ user: JSON.parse(storedUser) });
            }
        } catch (error) {
            console.log("Error loading user:", error);
        }
    },

    // 🔹 Set user + persist
    setUser: async (user) => {
        try {
            if (user) {
                await AsyncStorage.setItem("user", JSON.stringify(user));
            } else {
                await AsyncStorage.removeItem("user");
            }
            set({ user });
        } catch (error) {
            console.log("Error saving user:", error);
        }
    },

    setUnreadNotificationsCount: (count) => set({ unreadNotificationsCount: count }),

    setUnreadMessagesCount: (count) => set({ unreadMessagesCount: count }),

    resetNotificationsCount: () => set({ unreadNotificationsCount: null }),

    setPostUploading: (isUploading) => set({ postUploading: isUploading }),
}));
