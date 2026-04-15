/**
 * AI 模型配置与调用模块
 * 负责AI模型的初始化、配置和流式调用
 */

// AI 模型配置
// 可选模型：
// - deepseek: 'deepseek-chat', 'deepseek-v3.2', 'deepseek-reasoner'
// - hunyuan: 'hunyuan-lite', 'hunyuan-standard', 'hunyuan-standard-256K', 'hunyuan-pro'

const AI_CONFIG = {
  // 使用 DeepSeek V3.2 模型
  provider: 'deepseek',
  model: 'deepseek-v3.2',

  // 备用配置：混元大模型
  // provider: 'hunyuan',
  // model: 'hunyuan-standard',
};

/**
 * 从流式响应中提取文本内容
 * @param {Object} chunk - 流式响应的一个片段
 * @returns {string} - 提取的文本内容
 */
function extractTextFromStreamChunk(chunk) {
  const delta = chunk && chunk.choices && chunk.choices[0] && chunk.choices[0].delta;
  return delta && delta.content ? delta.content : '';
}

/**
 * 流式调用AI模型
 * @param {Array} messages - 消息列表，包含system、user、assistant角色的消息
 * @param {Object} handlers - 回调函数，包括onToken（每收到一个token时调用）和onReasoning（收到推理内容时调用）
 * @returns {Promise<string>} - 完整的AI回复
 */
async function streamModelReply(messages, handlers = {}) {
  const { onToken, onReasoning } = handlers;

  // 检查环境支持
  if (!wx.cloud || !wx.cloud.extend || !wx.cloud.extend.AI) {
    throw new Error('当前基础库不支持 wx.cloud.extend.AI，请升级基础库版本');
  }

  // 创建模型实例
  const model = wx.cloud.extend.AI.createModel(AI_CONFIG.provider);

  if (!model) {
    throw new Error(`无法创建 ${AI_CONFIG.provider} 模型实例`);
  }

  // 清理消息格式，确保符合API要求
  const cleanMessages = messages.map(msg => ({
    role: msg.role,
    content: String(msg.content || '')
  })).filter(msg => msg.content && msg.role);

  try {
    // 调用模型的流式文本生成接口
    const res = await model.streamText({
      data: {
        model: AI_CONFIG.model,
        messages: cleanMessages
      }
    });

    let fullText = '';

    // 处理流式响应
    for await (const event of res.eventStream) {
      if (!event || event.data === '[DONE]') {
        break;
      }

      let data;
      try {
        data = JSON.parse(event.data);
      } catch (error) {
        // 解析失败，跳过该事件
        continue;
      }

      // 检查是否有错误
      if (data.error) {
        throw new Error(data.error.message || 'AI服务返回错误');
      }

      // 处理推理内容（DeepSeek Reasoner 支持）
      const reasoning = data && data.choices && data.choices[0] && data.choices[0].delta
        ? data.choices[0].delta.reasoning_content
        : '';
      if (reasoning && typeof onReasoning === 'function') {
        onReasoning(reasoning);
      }

      // 处理正常回复内容
      const token = extractTextFromStreamChunk(data);
      if (!token) {
        continue;
      }

      fullText += token;
      if (typeof onToken === 'function') {
        onToken(token, fullText);
      }
    }

    return fullText.trim();
  } catch (error) {
    throw new Error(`AI服务暂时不可用: ${error.message || '请稍后重试'}`);
  }
}

/**
 * 获取当前AI配置信息（用于调试）
 * @returns {Object} - AI配置信息
 */
function getAIConfig() {
  return {
    provider: AI_CONFIG.provider,
    model: AI_CONFIG.model
  };
}

/**
 * 切换AI模型（如果需要动态切换）
 * @param {string} provider - 模型提供商
 * @param {string} model - 模型名称
 */
function switchAIModel(provider, model) {
  AI_CONFIG.provider = provider;
  AI_CONFIG.model = model;
}

module.exports = {
  AI_PROVIDER: AI_CONFIG.provider,
  AI_MODEL: AI_CONFIG.model,
  streamModelReply,
  getAIConfig,
  switchAIModel
};