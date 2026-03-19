// 云函数：submitFeedback
// 目的：提交用户反馈
const cloud = require('wx-server-sdk');

// 如果在云函数中未指定 env，则 auto 选当前环境
cloud.init({ env: 'cloud1-2gltiqs6a2c5cd76' || cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event, context) => {
  const db = cloud.database();

  try {
    // 接收反馈参数
    const { openid, content, type, contact, images } = event;

    // 验证必要参数
    if (!openid) {
      return {
        code: -1,
        message: '缺少用户标识',
        data: null,
      };
    }

    if (!content || content.trim() === '') {
      return {
        code: -1,
        message: '反馈内容不能为空',
        data: null,
      };
    }

    // 构建反馈数据
    const feedbackData = {
      openid: openid,
      content: content.trim(),
      type: type || 'suggestion', // suggestion, complaint, question
      contact: contact || '',
      images: images || [],
      status: 'pending', // pending, processed, closed
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // 保存反馈到数据库
    const result = await db.collection('feedbacks').add({
      data: feedbackData
    });

    // 获取完整的反馈信息
    const feedback = await db.collection('feedbacks').doc(result._id).get();

    return {
      code: 0,
      message: '反馈提交成功',
      data: feedback.data,
    };
  } catch (err) {
    console.error('submitFeedback云函数错误', err);
    return {
      code: -1,
      message: err.message || '反馈提交失败',
      data: null,
    };
  }
};