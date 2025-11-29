import React, { useState, useRef, useEffect } from "react";
import {
  StyleSheet,
  View,
  TextInput,
  ScrollView,
  Pressable,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { parseCommandWithLLM, executeCommand, CommandResult } from "@/utils/commandProcessor";

interface HistoryItem {
  id: string;
  type: "input" | "output";
  text: string;
  success?: boolean;
  timestamp: Date;
}

export default function CommandScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<HistoryItem[]>([
    {
      id: "welcome",
      type: "output",
      text: `DiscBurn v1.0\n\nType commands in natural language.\nExamples:\n  "burn to disc all projects"\n  "backup my files to OneDrive"\n  "help" for more commands\n`,
      success: true,
      timestamp: new Date(),
    },
  ]);
  const [isProcessing, setIsProcessing] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, [history]);

  const addToHistory = (item: Omit<HistoryItem, "id" | "timestamp">) => {
    setHistory((prev) => [
      ...prev,
      {
        ...item,
        id: Date.now().toString(),
        timestamp: new Date(),
      },
    ]);
  };

  const handleSubmit = async () => {
    const trimmedInput = input.trim();
    if (!trimmedInput || isProcessing) return;

    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    addToHistory({ type: "input", text: trimmedInput });
    setInput("");
    setIsProcessing(true);

    try {
      const parsedCommand = await parseCommandWithLLM(trimmedInput);
      const result: CommandResult = await executeCommand(parsedCommand);
      
      addToHistory({
        type: "output",
        text: result.message,
        success: result.success,
      });
    } catch (error: any) {
      addToHistory({
        type: "output",
        text: `Error: ${error.message || "Something went wrong"}`,
        success: false,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Feather name="terminal" size={24} color={theme.link} />
        <ThemedText style={styles.headerTitle}>DiscBurn</ThemedText>
      </View>

      <KeyboardAvoidingView
        style={styles.content}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.historyContainer}
          contentContainerStyle={styles.historyContent}
        >
          {history.map((item) => (
            <View
              key={item.id}
              style={[
                styles.historyItem,
                item.type === "input" && styles.inputItem,
              ]}
            >
              {item.type === "input" ? (
                <View style={styles.inputRow}>
                  <ThemedText style={[styles.prompt, { color: theme.link }]}>
                    {">"}
                  </ThemedText>
                  <ThemedText style={styles.inputText}>{item.text}</ThemedText>
                </View>
              ) : (
                <ThemedText
                  style={[
                    styles.outputText,
                    {
                      color: item.success === false
                        ? theme.destructive
                        : theme.text,
                    },
                  ]}
                >
                  {item.text}
                </ThemedText>
              )}
            </View>
          ))}
          {isProcessing ? (
            <View style={styles.processingContainer}>
              <ActivityIndicator size="small" color={theme.link} />
              <ThemedText
                style={[styles.processingText, { color: theme.textSecondary }]}
              >
                Processing...
              </ThemedText>
            </View>
          ) : null}
        </ScrollView>

        <View
          style={[
            styles.inputContainer,
            {
              backgroundColor: theme.backgroundDefault,
              borderColor: theme.border,
              paddingBottom: Math.max(insets.bottom, Spacing.lg),
            },
          ]}
        >
          <View style={styles.inputRow}>
            <ThemedText style={[styles.prompt, { color: theme.link }]}>
              {">"}
            </ThemedText>
            <TextInput
              style={[styles.textInput, { color: theme.text }]}
              value={input}
              onChangeText={setInput}
              placeholder="Type a command..."
              placeholderTextColor={theme.textSecondary}
              onSubmitEditing={handleSubmit}
              returnKeyType="send"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isProcessing}
            />
            <Pressable
              onPress={handleSubmit}
              disabled={!input.trim() || isProcessing}
              style={({ pressed }) => [
                styles.sendButton,
                {
                  backgroundColor:
                    input.trim() && !isProcessing
                      ? theme.link
                      : theme.backgroundSecondary,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Feather
                name="send"
                size={18}
                color={input.trim() && !isProcessing ? "#FFFFFF" : theme.textSecondary}
              />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  content: {
    flex: 1,
  },
  historyContainer: {
    flex: 1,
  },
  historyContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing["2xl"],
  },
  historyItem: {
    marginBottom: Spacing.md,
  },
  inputItem: {
    marginTop: Spacing.sm,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  prompt: {
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontSize: 16,
    fontWeight: "700",
    marginRight: Spacing.sm,
    lineHeight: 24,
  },
  inputText: {
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontSize: 15,
    flex: 1,
    lineHeight: 24,
  },
  outputText: {
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontSize: 14,
    lineHeight: 22,
  },
  processingContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  processingText: {
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontSize: 14,
  },
  inputContainer: {
    borderTopWidth: 1,
    paddingTop: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  textInput: {
    flex: 1,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontSize: 16,
    paddingVertical: Spacing.sm,
    lineHeight: 24,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: Spacing.sm,
  },
});
