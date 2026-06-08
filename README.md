# CChatMind

CChatMind 是一个基于 Spring Boot、Spring AI、React 和 PostgreSQL/pgvector 构建的 AI Agent 助手项目。项目围绕“可配置 Agent、持续对话、工具调用、知识库检索和实时执行状态推送”展开，目标是把大模型能力从简单聊天接口扩展成一个可维护、可扩展的工程系统。

> 说明：本仓库基于 MIT 开源项目学习和二次开发，保留原始开源协议声明。当前仓库用于个人学习、工程实践和面试展示，重点补充本地部署、问题修复、运行链路理解和后续功能扩展。

## 核心能力

- Agent 配置管理：支持创建不同 Agent，配置名称、描述、system prompt、模型和能力边界。
- 多轮会话：通过 `chat_session` 和 `chat_message` 保存对话状态，支持按 session 维度恢复上下文。
- 模型接入：基于 Spring AI 接入 DeepSeek 等 ChatModel，并通过统一 ChatClient 使用。
- 工具调用：将外部能力抽象为可注册工具，Agent 可以在执行过程中调用工具完成任务。
- RAG 知识库：支持文档解析、chunk 切分、embedding 入库和 pgvector 相似度检索。
- SSE 实时推送：后端通过 Server-Sent Events 向前端推送 Agent 执行状态和回复结果。
- 前后端分离：后端提供 REST/SSE API，前端使用 React + Ant Design X 构建交互界面。

## 技术栈

### 后端

- Java 17
- Spring Boot 3
- Spring AI
- MyBatis
- PostgreSQL
- pgvector
- Maven

### 前端

- React
- TypeScript
- Vite
- Ant Design / Ant Design X

### AI 与检索

- DeepSeek Chat Model
- Embedding Model
- RAG
- Vector Similarity Search
- PostgreSQL + pgvector

## 系统设计

项目可以拆成几条主链路：

### 1. Agent 配置链路

`agent` 表保存 Agent 的长期配置，例如名称、描述、system prompt、模型类型、可用工具和可访问知识库。

这部分不是一次请求的临时状态，而是 Agent 的“能力定义”。这样做的好处是：新增或调整 Agent 时，不需要频繁修改核心代码。

### 2. 对话状态链路

`chat_session` 表表示一次对话，`chat_message` 表保存该对话中的消息。

用户继续追问时，系统可以根据 `session_id` 查询历史消息，重新拼接上下文，再交给大模型生成回复。

### 3. RAG 检索链路

RAG 的完整流程：

```text
原始文档
  -> 文档解析
  -> 文本切分 chunk
  -> embedding 模型生成向量
  -> 写入 chunk_bge_m3

用户问题
  -> 生成 query embedding
  -> pgvector 相似度检索 top-k chunk
  -> 将 chunk 文本拼入 prompt
  -> LLM 基于资料回答
```

其中，`chunk_bge_m3` 存的是预处理后的文本片段和向量。向量负责“找”，chunk 文本负责“给模型看”。

### 4. SSE 实时通信链路

Agent 执行不是简单的一次 HTTP 请求。后端通过 SSE 建立从服务端到前端的单向实时通道，用于推送：

- 连接初始化
- Agent 思考状态
- 工具执行状态
- 模型回复结果
- 异常和结束状态

相比 WebSocket，SSE 更适合这种“服务端持续推送、前端只接收”的场景。

## 本地运行

### 1. 准备环境

需要安装：

- JDK 17
- Node.js
- PostgreSQL
- pgvector
- Maven

### 2. 数据库配置

后端默认读取：

```text
jchatmind/src/main/resources/application.yaml
```

需要根据本地环境配置：

- PostgreSQL 地址
- 数据库用户名
- 数据库密码
- DeepSeek API Key
- 邮箱授权码等可选配置

不要把真实密钥提交到公开仓库。建议后续改成环境变量或本地 `application-local.yaml`。

### 3. 启动后端

```bash
cd jchatmind
mvn spring-boot:run
```

默认后端地址：

```text
http://localhost:8080
```

### 4. 启动前端

```bash
cd ui
npm install
npm run dev
```

默认前端地址：

```text
http://localhost:5173
```

## 我在项目中的实践内容

当前仓库重点用于学习和面试准备，我已经完成或重点梳理了以下内容：

- 完成本地 Java、Maven、Node.js、PostgreSQL 环境配置。
- 完成项目数据库导入和本地联调。
- 理解并梳理 Agent、chat session、chat message、knowledge base、document、chunk 等核心数据模型。
- 修复首条用户消息发送和 SSE 连接初始化之间的时序问题。
- 优化 SSE 后端发送逻辑，避免客户端断开后异常中断主流程。
- 将本地环境脚本和敏感配置加入 `.gitignore`，避免误提交。

## 面试可讲点

- 为什么 Agent 项目不能只理解成“调大模型 API”？
- Agent 配置、会话状态、消息记录为什么要拆表？
- RAG 为什么需要 chunk？chunk embedding 是否预先生成？
- BGE-M3 / embedding model 在 RAG 中负责什么？
- PostgreSQL + pgvector 和独立向量数据库相比有什么取舍？
- SSE 和 WebSocket 在 Agent 执行状态推送中的区别是什么？
- 如何避免 Agent 工具调用无限循环？
- 如何设计可扩展的模型注册和工具注册机制？

## 后续计划

- 将 API Key、数据库密码等配置改为环境变量。
- 增加 Docker Compose，一键启动 PostgreSQL、后端和前端。
- 补充数据库初始化脚本和示例数据。
- 增加 RAG 检索结果可视化，展示命中的 chunk 和相似度。
- 增加单元测试和接口测试。
- 增强 Agent 工具调用的错误恢复和执行轨迹记录。

## License

This project follows the MIT License. See [LICENSE](./LICENSE) for details.
