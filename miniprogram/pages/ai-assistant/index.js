const { streamModelReply } = require('../../utils/ai-assistant');

const STORAGE_KEY = 'ai_chat_history';
const EXPIRE_TIME = 24 * 60 * 60 * 1000;

function detectDataFabrication(originalData, answer) {
  if (!originalData || !answer) return { isValid: true, warnings: [] };

  const warnings = [];

  const originalStr = String(originalData || '');
  const answerStr = String(answer || '');

  if (originalStr.length < 10 && answerStr.length > 30) {
    if (/(共|总计|合计|一共|总共有)/.test(answerStr) && /\d+[个件名]/.test(answerStr)) {
      warnings.push('originalDataEmpty');
    }
  }

  const originalMoney = originalStr.match(/￥?(\d+(?:\.\d+)?)/g) || [];
  const answerMoney = answerStr.match(/￥?(\d+(?:\.\d+)?)/g) || [];

  if (originalMoney.length === 0 && answerMoney.length > 0) {
    const answerVals = answerMoney.map(m => parseFloat(m.replace('￥', ''))).filter(v => v > 0);
    if (answerVals.some(v => v > 100)) {
      warnings.push('significantDataInAnswerButEmptyOriginal');
    }
  }

  if (originalMoney.length > 0) {
    const originalMax = Math.max(...originalMoney.map(m => parseFloat(m.replace('￥', ''))));
    const answerVals = answerMoney.map(m => parseFloat(m.replace('￥', '')));
    if (answerVals.some(v => v > originalMax * 2)) {
      warnings.push('answerExceedsOriginal');
    }
  }

  return {
    isValid: warnings.length === 0,
    warnings
  };
}

function correctFabricatedAnswer(originalData, answer, warnings) {
  if (!warnings || warnings.length === 0) return answer;

  let corrected = answer;

  if (warnings.includes('originalDataEmpty')) {
    corrected = corrected.replace(/(共|总计|合计|一共|总共有)\s*\d+[个件名]/, '暂无相关数据');
  }

  if (warnings.includes('answerExceedsOriginal')) {
    corrected = corrected.replace(/￥?\d+\.?\d+/, '数据不足');
  }

  return corrected;
}

function buildMessage(role, content) {
  return {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    role,
    content
  };
}

Page({
  data: {
    assistantTitle: 'AI智能店员',
    assistantSubtitle: '可以帮你查商品、接龙、订单、优惠和经营数据。',
    inputValue: '',
    messages: [],
    quickQuestions: [],
    loading: false,
    sending: false,
    scrollIntoView: '',
    userAvatar: 'cloud://cloud1-2gltiqs6a2c5cd76.636c-cloud1-2gltiqs6a2c5cd76-1411302136/icons/avatar.png',
    scene: 'customer'
  },

  onLoad(options = {}) {
    const app = getApp();
    const userInfo = app.globalData.userInfo || {};
    const role = options.role === 'merchant' ? 'merchant' : 'customer';
    const isMerchant = role === 'merchant';
    const title = isMerchant ? 'AI经营助手' : 'AI智能店员';

    wx.setNavigationBarTitle({ title });

    this.setData({
      scene: role,
      assistantTitle: title,
      assistantSubtitle: isMerchant
        ? '支持经营数据、库存、售后、商品管理和操作指引。'
        : '支持商品、接龙、订单、取货码和优惠咨询。',
      userAvatar: userInfo.avatarUrl || this.data.userAvatar,
      quickQuestions: isMerchant
        ? ['本周营业额', '哪些商品低库存', '未取货订单有哪些']
        : ['今天有什么特价商品', '我的取货码是多少', '现在有哪些接龙活动']
    });

    this.loadChatHistory();
  },

  onUnload() {
    this.saveChatHistory();
  },

  onHide() {
    this.saveChatHistory();
  },

  loadChatHistory() {
    try {
      const stored = wx.getStorageSync(STORAGE_KEY);
      if (stored && stored.expireAt > Date.now() && stored.scene === this.data.scene) {
        const historyMessages = stored.messages || [];
        if (historyMessages.length > 0) {
          const lastMessage = historyMessages[historyMessages.length - 1];
          this.setData({
            messages: historyMessages,
            scrollIntoView: `msg-${lastMessage.id}`
          });
          return;
        }
      }
    } catch (e) {
      console.error('加载历史记录失败', e);
    }

    const isMerchant = this.data.scene === 'merchant';
    this.appendMessage(buildMessage('assistant', isMerchant
      ? '你好，我可以帮你查经营数据、低库存、接龙统计，也可以执行简单商品操作。'
      : '你好，我可以帮你查商品、接龙、订单状态、取货码和优惠活动。'));
  },

  saveChatHistory() {
    try {
      const messages = this.data.messages.filter(msg =>
        msg.role === 'user' || (msg.role === 'assistant' && msg.content)
      );

      wx.setStorageSync(STORAGE_KEY, {
        messages: messages.slice(-20),
        expireAt: Date.now() + EXPIRE_TIME,
        scene: this.data.scene
      });
    } catch (e) {
      console.error('保存历史记录失败', e);
    }
  },

  onInput(event) {
    this.setData({
      inputValue: event.detail.value
    });
  },

  useQuickQuestion(event) {
    const { question } = event.currentTarget.dataset;
    if (!question) return;
    this.setData({ inputValue: question });
    this.sendMessage();
  },

  appendMessage(message, callback) {
    const messages = this.data.messages.concat(message);
    this.setData({
      messages,
      scrollIntoView: `msg-${message.id}`
    }, callback);
  },

  updateLastAssistantMessage(content) {
    const messages = this.data.messages.slice();
    const lastIndex = messages.length - 1;
    if (lastIndex < 0) return;
    messages[lastIndex] = {
      ...messages[lastIndex],
      content
    };
    this.setData({
      messages,
      scrollIntoView: `msg-${messages[lastIndex].id}`
    });
  },

  async sendMessage() {
    const text = String(this.data.inputValue || '').trim();
    if (!text || this.data.sending) {
      return;
    }

    const history = this.data.messages.map((item) => ({
      role: item.role,
      content: item.content
    }));

    this.setData({
      inputValue: '',
      sending: true,
      loading: true
    });

    this.appendMessage(buildMessage('user', text));
    this.appendMessage(buildMessage('assistant', ''));

    try {
      const res = await wx.cloud.callFunction({
        name: 'aiAssistant',
        data: {
          scene: this.data.scene,
          message: text,
          history
        }
      });

      if (!res.result || res.result.code !== 0) {
        throw new Error(res.result && res.result.message ? res.result.message : 'AI助手暂时不可用');
      }

      const payload = res.result.data || {};
      const fallbackAnswer = payload.answerDraft || '我暂时没整理出答案，你可以换个问法再试试。';

      // 检查是否需要大模型理解意图
      if (payload.intent === 'need_intent_understanding' && payload.intentUnderstandingPayload) {
        // 第一步：让大模型理解意图
        try {
          const understoodIntent = await this.understandIntentWithModel(payload.intentUnderstandingPayload);

          // 第二步：将理解的意图传回后端处理
          const processRes = await wx.cloud.callFunction({
            name: 'aiAssistant',
            data: {
              action: 'processUnderstoodIntent',
              understoodIntent,
              originalMessage: payload.originalMessage,
              contextData: payload.contextData,
              history
            }
          });

          if (processRes.result && processRes.result.code === 0) {
            const processPayload = processRes.result.data;
            // 继续处理结果...
            await this.processModelResponse(processPayload, fallbackAnswer);
          } else {
            throw new Error('处理理解的意图失败');
          }
        } catch (error) {
          console.error('意图理解流程失败:', error);
          this.updateLastAssistantMessage(fallbackAnswer);
        }
      } else if (!payload.modelPayload || !payload.modelPayload.messages) {
        // 如果服务器返回了直接的回答（如权限拒绝），不调用AI
        this.updateLastAssistantMessage(fallbackAnswer);
      } else {
        // 正常流程：直接调用大模型生成回复
        await this.processModelResponse(payload, fallbackAnswer);
      }

      if (payload.suggestions && payload.suggestions.length) {
        this.setData({
          quickQuestions: payload.suggestions.slice(0, 3)
        });
      }
    } catch (error) {
      console.error('sendMessage failed', error);
      this.updateLastAssistantMessage(error.message || 'AI助手暂时不可用，请稍后再试。');
    } finally {
      this.setData({
        sending: false,
        loading: false
      });
    }
  },

  goBack() {
    wx.navigateBack({
      fail: () => {
        const fallback = this.data.scene === 'merchant'
          ? '/pages/merchant/index/index'
          : '/pages/customer/index/index';
        wx.redirectTo({ url: fallback });
      }
    });
  },

  /**
   * 使用大模型理解用户意图
   * @param {Object} intentUnderstandingPayload - 意图理解的消息格式
   * @returns {Promise<string>} - 大模型返回的意图
   */
  async understandIntentWithModel(intentUnderstandingPayload) {
    const { streamModelReply } = require('../../utils/ai-assistant');

    try {
      const intent = await streamModelReply(intentUnderstandingPayload.messages);
      console.log('大模型理解的意图:', intent);
      return intent.trim();
    } catch (error) {
      console.error('大模型理解意图失败:', error);
      throw error;
    }
  },

  /**
   * 处理大模型响应
   * @param {Object} payload - 后端返回的数据
   * @param {string} fallbackAnswer - 备用回答
   */
  async processModelResponse(payload, fallbackAnswer) {
    const { streamModelReply } = require('../../utils/ai-assistant');

    try {
      const validationData = payload.validationData || {};
      const originalData = validationData.originalData || '';

      let finalText = await streamModelReply(payload.modelPayload.messages, {
        onToken: (_, currentText) => {
          this.updateLastAssistantMessage(currentText);
        }
      });

      if (!finalText || !finalText.trim()) {
        this.updateLastAssistantMessage(fallbackAnswer);
        return;
      }

      const validation = detectDataFabrication(originalData, finalText);
      if (!validation.isValid) {
        console.warn('检测到大模型可能编造答案:', validation.warnings);
        finalText = correctFabricatedAnswer(originalData, finalText, validation.warnings);
        this.updateLastAssistantMessage(finalText);
      }
    } catch (error) {
      console.error('streamModelReply failed', error);
      this.updateLastAssistantMessage(fallbackAnswer);
    }
  }
});
