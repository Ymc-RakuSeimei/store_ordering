// 云函数：submitFeedbackReply
// 作用：商家回复售后反馈
const cloud = require('wx-server-sdk');

const ENV_ID = 'cloud1-2gltiqs6a2c5cd76';

cloud.init({ env: ENV_ID });

const db = cloud.database();
const _ = db.command;

function formatDate(dateValue) {
  if (!dateValue) return '';
  const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hour}:${minute}`;
}

exports.main = async (event) => {
  try {
    const { feedbackId, replyContent } = event;

    if (!feedbackId) {
      return {
        success: false,
        message: '缺少反馈ID'
      };
    }

    if (!replyContent || replyContent.trim() === '') {
      return {
        success: false,
        message: '缺少回复内容'
      };
    }

    // 查询反馈记录
    const feedbackRes = await db.collection('feedbacks').doc(feedbackId).get();
    if (!feedbackRes.data) {
      return {
        success: false,
        message: '反馈不存在'
      };
    }

    const feedback = feedbackRes.data;
    const now = new Date();

    // 获取现有messages，或初始化
    let messages = feedback.messages || [];

    // 如果是第一次回复，需要先把用户的原始反馈添加到messages
    if (messages.length === 0) {
      // 添加用户的原始消息
      const userMessage = {
        role: 'customer',
        content: feedback.reason || feedback.content || '',
        time: formatDate(feedback.createdAt)
      };
      messages.push(userMessage);
    }

    // 添加商家回复
    const merchantMessage = {
      role: 'merchant',
      content: replyContent.trim(),
      time: formatDate(now)
    };
    messages.push(merchantMessage);

    // 更新反馈记录
    await db.collection('feedbacks').doc(feedbackId).update({
      data: {
        messages: messages,
        status: '已处理',
        updatedAt: now
      }
    });

    // 获取更新后的反馈数据
    const updatedFeedbackRes = await db.collection('feedbacks').doc(feedbackId).get();
    const updatedFeedback = updatedFeedbackRes.data;

    // 格式化返回数据
    const formattedFeedback = {
      ...updatedFeedback,
      id: updatedFeedback._id,
      createdAt: formatDate(updatedFeedback.createdAt),
      updatedAt: formatDate(updatedFeedback.updatedAt)
    };

    return {
      success: true,
      message: '回复成功',
      data: formattedFeedback
    };
  } catch (err) {
    console.error('submitFeedbackReply 云函数错误', err);
    return {
      success: false,
      message: err.message || '回复失败'
    };
  }
};
