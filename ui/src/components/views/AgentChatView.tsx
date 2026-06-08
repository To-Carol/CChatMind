import React, { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { message as antdMessage } from "antd";
import AgentChatHistory from "./agentChatView/AgentChatHistory.tsx";
import AgentChatInput from "./agentChatView/AgentChatInput.tsx";
import {
  createChatMessage,
  createChatSession,
  getChatMessagesBySessionId,
  getChatSession,
} from "../../api/api.ts";
import { useAgents } from "../../hooks/useAgents.ts";
import { useChatSessions } from "../../hooks/useChatSessions.ts";
import EmptyAgentChatView from "./agentChatView/EmptyAgentChatView.tsx";
import type { ChatMessageVO, SseMessage, SseMessageType } from "../../types";

const AgentChatView: React.FC = () => {
  const { chatSessionId } = useParams<{ chatSessionId: string }>();
  const navigate = useNavigate();
  const { state } = useLocation();
  const [loading, setLoading] = useState(false);
  const { agents } = useAgents();
  const { refreshChatSessions } = useChatSessions();
  const initMessageSentRef = useRef(false);

  const [messages, setMessages] = useState<ChatMessageVO[]>([]);

  const addMessage = (message: ChatMessageVO) => {
    setMessages((prevMessages) => [...prevMessages, message]);
  };

  const [agentId, setAgentId] = useState<string>("");

  const getChatMessages = useCallback(async () => {
    if (!chatSessionId) {
      return;
    }
    const resp = await getChatMessagesBySessionId(chatSessionId);
    setMessages(resp.chatMessages);

    const fetchData = async () => {
      const resp = await getChatSession(chatSessionId);
      // setChatSession(resp.chatSession);
      setAgentId(resp.chatSession.agentId);
    };
    fetchData().then();
  }, [chatSessionId]);

  useEffect(() => {
    if (!chatSessionId) {
      return;
    }
    getChatMessages().then();
  }, [chatSessionId, getChatMessages]);

  const handleSendMessage = async (value: string | { text: string }) => {
    // 处理 Sender 组件可能传递的不同格式
    const message = typeof value === "string" ? value : value.text;

    console.log(message);

    if (!message || !message.trim()) return;

    // 如果没有 chatSessionId，创建新会话
    if (!chatSessionId) {
      if (!agentId) {
        antdMessage.warning("请先创建一个智能体助手");
        return;
      }
      setLoading(true);
      try {
        const response = await createChatSession({
          agentId: agentId,
          title: message.slice(0, 20),
        });
        // 刷新聊天会话列表
        await refreshChatSessions();
        // 导航到新创建的会话
        navigate(`/chat/${response.chatSessionId}`, {
          replace: true,
          // 携带初始化消息
          state: {
            init: true,
            initMessage: message,
          },
        });
      } catch (error) {
        console.error("创建聊天会话失败:", error);
        antdMessage.error("创建聊天会话失败，请重试");
      } finally {
        setLoading(false);
      }
    } else {
      if (state?.init) {
        console.log("init", state.initMessage);
        await createChatMessage({
          agentId: agentId ?? "",
          sessionId: chatSessionId,
          role: "user",
          content: state.initMessage ?? "",
        });
      } else {
        console.log("ask", message);
        await createChatMessage({
          agentId: agentId ?? "",
          sessionId: chatSessionId,
          role: "user",
          content: message,
        });
      }
      await getChatMessages();
    }
  };

  const [displayAgentStatus, setDisplayAgentStatus] = useState<boolean>(false);
  const [agentStatusText, setAgentStatusText] = useState("");
  const [agentStatusType, setAgentStatusType] = useState<
    SseMessageType | undefined
  >(undefined);
  const [sseReady, setSseReady] = useState(false);

  useEffect(() => {
    initMessageSentRef.current = false;
  }, [chatSessionId]);

  useEffect(() => {
    // sse 连接处理, 不是对话消息不开连接
    if (!chatSessionId) {
      return;
    }
    setSseReady(false);
    const es = new EventSource(
      `http://localhost:8080/sse/connect/${chatSessionId}`,
    );
    es.onmessage = (event) => {
      console.log("Received message:", event.data);
    };
    es.onerror = (error) => {
      console.error("SSE error:", error);
    };

    es.addEventListener("message", (event) => {
      // 解析 JSON
      const message = JSON.parse(event.data) as SseMessage;
      if (message.type === "AI_GENERATED_CONTENT") {
        // 将 AI 生成的内容存到 messages 中
        addMessage(message.payload.message);
      } else if (message.type === "AI_PLANNING") {
        setDisplayAgentStatus(true);
        setAgentStatusText(message.payload.statusText);
        setAgentStatusType("AI_PLANNING");
      } else if (message.type === "AI_THINKING") {
        setDisplayAgentStatus(true);
        setAgentStatusText(message.payload.statusText);
        setAgentStatusType("AI_THINKING");
      } else if (message.type === "AI_EXECUTING") {
        setDisplayAgentStatus(true);
        setAgentStatusText(message.payload.statusText);
        setAgentStatusType("AI_EXECUTING");
      } else if (message.type === "AI_DONE") {
        setDisplayAgentStatus(false);
        setAgentStatusText("");
        setAgentStatusType(undefined);
      } else {
        throw new Error(`Unknown message type: ${message.type}`);
      }
    });

    es.addEventListener("init", (event) => {
      console.log("Received init message:", event.data);
      setSseReady(true);
    });

    return () => {
      console.log("Closing SSE connection.");
      es.close();
    };
  }, [chatSessionId]);

  useEffect(() => {
    const initMessage = state?.initMessage;
    if (
      !chatSessionId ||
      !agentId ||
      !sseReady ||
      !state?.init ||
      !initMessage ||
      initMessageSentRef.current
    ) {
      return;
    }

    initMessageSentRef.current = true;
    const sendInitialMessage = async () => {
      try {
        await createChatMessage({
          agentId,
          sessionId: chatSessionId,
          role: "user",
          content: initMessage,
        });
        await getChatMessages();
        navigate(`/chat/${chatSessionId}`, {
          replace: true,
          state: null,
        });
      } catch (error) {
        console.error("Failed to send initial message:", error);
        initMessageSentRef.current = false;
        antdMessage.error("发送消息失败，请重试");
      }
    };

    sendInitialMessage().then();
  }, [agentId, chatSessionId, getChatMessages, navigate, sseReady, state]);

  // 如果没有 chatSessionId，显示提示界面
  if (!chatSessionId) {
    return (
      <EmptyAgentChatView
        agents={agents}
        loading={loading}
        handleSendMessage={handleSendMessage}
      />
    );
  }

  // 如果有 chatSessionId，显示正常的聊天界面
  return (
    <div className="flex flex-col h-full">
      <AgentChatHistory
        messages={messages}
        displayAgentStatus={displayAgentStatus}
        agentStatusText={agentStatusText}
        agentStatusType={agentStatusType}
      />
      <div className="border-t border-gray-200 p-4 bg-white">
        <AgentChatInput onSend={handleSendMessage} />
      </div>
    </div>
  );
};

export default AgentChatView;
