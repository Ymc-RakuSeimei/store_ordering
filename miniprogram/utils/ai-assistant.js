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

function extractTextFromStreamChunk(chunk) {
  const delta = chunk && chunk.choices && chunk.choices[0] && chunk.choices[0].delta;
  return delta && delta.content ? delta.content : '';
}

async function streamModelReply(messages, handlers = {}) {
  const { onToken, onReasoning } = handlers;

  // 检查环境支持
  if (!wx.cloud || !wx.cloud.extend || !wx.cloud.extend.AI) {
    throw new Error('当前基础库不支持 wx.cloud.extend.AI，请升级基础库版本');
  }

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
    const res = await model.streamText({
      data: {
        model: AI_CONFIG.model,
        messages: cleanMessages
      }
    });

    let fullText = '';

    for await (const event of res.eventStream) {
      if (!event || event.data === '[DONE]') {
        break;
      }

      let data;
      try {
        data = JSON.parse(event.data);
      } catch (error) {
        console.warn('解析流式数据失败:', event.data);
        continue;
      }

      // 检查是否有错误
      if (data.error) {
        console.error('AI API Error:', data.error);
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
    console.error('AI模型调用失败:', error);
    throw new Error(`AI服务暂时不可用: ${error.message || '请稍后重试'}`);
  }
}

// 获取当前AI配置信息（用于调试）
function getAIConfig() {
  return {
    provider: AI_CONFIG.provider,
    model: AI_CONFIG.model
  };
}

// 切换AI模型（如果需要动态切换）
function switchAIModel(provider, model) {
  AI_CONFIG.provider = provider;
  AI_CONFIG.model = model;
  console.log(`已切换到 ${provider} 的 ${model} 模型`);
}

module.exports = {
  AI_PROVIDER: AI_CONFIG.provider,
  AI_MODEL: AI_CONFIG.model,
  streamModelReply,
  getAIConfig,
  switchAIModel
};
